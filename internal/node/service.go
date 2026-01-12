package node

import (
	"bufio"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/cosmos/cosmos-sdk/crypto/hd"
	"github.com/cosmos/cosmos-sdk/crypto/keys/secp256k1"
	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/cosmos/go-bip39"
)

type Service struct {
	dataDir   string
	nodeCmd   *exec.Cmd
	nodeMutex sync.Mutex
	logs      []string
	logsMutex sync.RWMutex
	maxLogs   int
}

type CosmovisorConfig struct {
	Installed    bool   `json:"installed"`
	AutoDownload bool   `json:"autoDownload"`
	Version      string `json:"version"`
}

type WalletData struct {
	ID                string `json:"id"`
	Address           string `json:"address"`
	Name              string `json:"name"`
	EncryptedMnemonic string `json:"encryptedMnemonic"`
	Salt              string `json:"salt"`
	CreatedAt         int64  `json:"createdAt"`
}

type WalletsStore struct {
	Wallets        []WalletData `json:"wallets"`
	ActiveWalletID string       `json:"activeWalletId"`
}

type NodeConfig struct {
	Moniker  string `json:"moniker"`
	ChainID  string `json:"chainId"`
	NodeHome string `json:"nodeHome"`
}

type ValidatorInfo struct {
	Moniker    string `json:"moniker"`
	Commission string `json:"commission"`
	Stake      string `json:"stake"`
	CreatedAt  int64  `json:"createdAt"`
}

func NewService(dataDir string) *Service {
	os.MkdirAll(dataDir, 0700)
	return &Service{
		dataDir: dataDir,
		logs:    make([]string, 0),
		maxLogs: 1000,
	}
}

// =============================================================================
// STATUS
// =============================================================================

type AppStatus struct {
	HasWallet             bool   `json:"hasWallet"`
	IsNodeInstalled       bool   `json:"isNodeInstalled"`
	IsNodeInitialized     bool   `json:"isNodeInitialized"`
	IsNodeRunning         bool   `json:"isNodeRunning"`
	IsValidator           bool   `json:"isValidator"`
	IsCosmovisorInstalled bool   `json:"isCosmovisorInstalled"`
	WalletAddress         string `json:"walletAddress,omitempty"`
	Moniker               string `json:"moniker,omitempty"`
	CurrentBlock          int64  `json:"currentBlock"`
	Peers                 int    `json:"peers"`
}

func (s *Service) isNodeRunning() bool {
	s.nodeMutex.Lock()
	defer s.nodeMutex.Unlock()
	return s.nodeCmd != nil && s.nodeCmd.Process != nil
}

func (s *Service) GetStatus() *AppStatus {
	status := &AppStatus{}

	// Check wallets (multiple wallet support)
	store, _ := s.loadWalletsStore()
	if len(store.Wallets) > 0 {
		status.HasWallet = true
		// Get active wallet address
		for _, w := range store.Wallets {
			if w.ID == store.ActiveWalletID {
				status.WalletAddress = w.Address
				break
			}
		}
		// If no active, use first wallet
		if status.WalletAddress == "" && len(store.Wallets) > 0 {
			status.WalletAddress = store.Wallets[0].Address
		}
	}

	// Check node binary
	binaryPath := s.getBinaryPath()
	if _, err := os.Stat(binaryPath); err == nil {
		status.IsNodeInstalled = true
	}

	// Check node initialized (via wizard - node-config.json must exist)
	nodeConfigPath := filepath.Join(s.dataDir, "node-config.json")
	if _, err := os.Stat(nodeConfigPath); err == nil {
		status.IsNodeInitialized = true
	}

	// Check validator
	valPath := filepath.Join(s.dataDir, "validator.json")
	if _, err := os.Stat(valPath); err == nil {
		status.IsValidator = true
	}

	// Check Cosmovisor
	cosmovisorPath := s.getCosmovisorPath()
	if _, err := os.Stat(cosmovisorPath); err == nil {
		status.IsCosmovisorInstalled = true
	}

	// Check if running and get block info
	status.IsNodeRunning = s.isNodeRunning()

	if status.IsNodeRunning {
		if block, peers, err := s.getNodeInfo(); err == nil {
			status.CurrentBlock = block
			status.Peers = peers
		}
	}

	// Load moniker
	configPath := filepath.Join(s.dataDir, "node-config.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var cfg NodeConfig
		if json.Unmarshal(data, &cfg) == nil {
			status.Moniker = cfg.Moniker
		}
	}

	return status
}

func (s *Service) getNodeInfo() (int64, int, error) {
	resp, err := http.Get("http://localhost:26657/status")
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			SyncInfo struct {
				LatestBlockHeight string `json:"latest_block_height"`
			} `json:"sync_info"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, err
	}

	var block int64
	fmt.Sscanf(result.Result.SyncInfo.LatestBlockHeight, "%d", &block)

	// Get peers
	respPeers, err := http.Get("http://localhost:26657/net_info")
	peers := 0
	if err == nil {
		defer respPeers.Body.Close()
		var peerResult struct {
			Result struct {
				NPeers string `json:"n_peers"`
			} `json:"result"`
		}
		if json.NewDecoder(respPeers.Body).Decode(&peerResult) == nil {
			fmt.Sscanf(peerResult.Result.NPeers, "%d", &peers)
		}
	}

	return block, peers, nil
}

// =============================================================================
// WALLET
// =============================================================================

func (s *Service) loadWalletsStore() (*WalletsStore, error) {
	walletPath := filepath.Join(s.dataDir, "wallets.json")
	data, err := os.ReadFile(walletPath)
	if err != nil {
		// Try to migrate from old wallet.json
		oldPath := filepath.Join(s.dataDir, "wallet.json")
		if oldData, err := os.ReadFile(oldPath); err == nil {
			var oldWallet WalletData
			if json.Unmarshal(oldData, &oldWallet) == nil && oldWallet.Address != "" {
				oldWallet.ID = generateWalletID()
				store := &WalletsStore{
					Wallets:        []WalletData{oldWallet},
					ActiveWalletID: oldWallet.ID,
				}
				s.saveWalletsStore(store)
				os.Remove(oldPath)
				return store, nil
			}
		}
		return &WalletsStore{Wallets: []WalletData{}}, nil
	}

	var store WalletsStore
	if err := json.Unmarshal(data, &store); err != nil {
		return &WalletsStore{Wallets: []WalletData{}}, nil
	}
	return &store, nil
}

func (s *Service) saveWalletsStore(store *WalletsStore) error {
	walletPath := filepath.Join(s.dataDir, "wallets.json")
	data, _ := json.MarshalIndent(store, "", "  ")
	return os.WriteFile(walletPath, data, 0600)
}

func generateWalletID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Service) CreateWallet(name, password string) (string, string, string, error) {
	entropy, _ := bip39.NewEntropy(256)
	mnemonic, _ := bip39.NewMnemonic(entropy)

	address := deriveAddress(mnemonic)
	salt := generateSalt()
	encrypted, err := encryptData(mnemonic, password, salt)
	if err != nil {
		return "", "", "", err
	}

	walletID := generateWalletID()
	walletData := WalletData{
		ID:                walletID,
		Address:           address,
		Name:              name,
		EncryptedMnemonic: encrypted,
		Salt:              salt,
		CreatedAt:         time.Now().Unix(),
	}

	store, _ := s.loadWalletsStore()
	store.Wallets = append(store.Wallets, walletData)
	store.ActiveWalletID = walletID

	if err := s.saveWalletsStore(store); err != nil {
		return "", "", "", err
	}

	return walletID, address, mnemonic, nil
}

func (s *Service) ImportWallet(name, mnemonic, password string) (string, string, error) {
	if !bip39.IsMnemonicValid(mnemonic) {
		return "", "", errors.New("mnemônico inválido")
	}

	address := deriveAddress(mnemonic)
	salt := generateSalt()
	encrypted, err := encryptData(mnemonic, password, salt)
	if err != nil {
		return "", "", err
	}

	walletID := generateWalletID()
	walletData := WalletData{
		ID:                walletID,
		Address:           address,
		Name:              name,
		EncryptedMnemonic: encrypted,
		Salt:              salt,
		CreatedAt:         time.Now().Unix(),
	}

	store, _ := s.loadWalletsStore()

	// Check if address already exists
	for _, w := range store.Wallets {
		if w.Address == address {
			return "", "", errors.New("esta carteira já foi importada")
		}
	}

	store.Wallets = append(store.Wallets, walletData)
	store.ActiveWalletID = walletID

	if err := s.saveWalletsStore(store); err != nil {
		return "", "", err
	}

	return walletID, address, nil
}

func (s *Service) GetWallets() ([]map[string]interface{}, string, error) {
	store, err := s.loadWalletsStore()
	if err != nil {
		return nil, "", err
	}

	wallets := make([]map[string]interface{}, len(store.Wallets))
	for i, w := range store.Wallets {
		wallets[i] = map[string]interface{}{
			"id":        w.ID,
			"name":      w.Name,
			"address":   w.Address,
			"createdAt": w.CreatedAt,
		}
	}

	return wallets, store.ActiveWalletID, nil
}

func (s *Service) SetActiveWallet(walletID string) error {
	store, err := s.loadWalletsStore()
	if err != nil {
		return err
	}

	// Check if wallet exists
	found := false
	for _, w := range store.Wallets {
		if w.ID == walletID {
			found = true
			break
		}
	}

	if !found {
		return errors.New("carteira não encontrada")
	}

	store.ActiveWalletID = walletID
	return s.saveWalletsStore(store)
}

func (s *Service) GetWalletInfo() (string, string, error) {
	store, err := s.loadWalletsStore()
	if err != nil || len(store.Wallets) == 0 {
		return "", "", errors.New("nenhuma carteira encontrada")
	}

	// Find active wallet
	for _, w := range store.Wallets {
		if w.ID == store.ActiveWalletID {
			return w.Address, w.Name, nil
		}
	}

	// If no active, return first
	if len(store.Wallets) > 0 {
		return store.Wallets[0].Address, store.Wallets[0].Name, nil
	}

	return "", "", errors.New("carteira não encontrada")
}

func (s *Service) DeleteWallet(walletID string) error {
	// Check if node is running
	if s.isNodeRunning() {
		return errors.New("pare o node antes de remover a carteira")
	}

	store, err := s.loadWalletsStore()
	if err != nil {
		return err
	}

	// Find and remove wallet
	newWallets := make([]WalletData, 0)
	found := false
	for _, w := range store.Wallets {
		if w.ID == walletID {
			found = true
		} else {
			newWallets = append(newWallets, w)
		}
	}

	if !found {
		return errors.New("carteira não encontrada")
	}

	store.Wallets = newWallets

	// Update active wallet if needed
	if store.ActiveWalletID == walletID {
		if len(newWallets) > 0 {
			store.ActiveWalletID = newWallets[0].ID
		} else {
			store.ActiveWalletID = ""
		}
	}

	return s.saveWalletsStore(store)
}

func (s *Service) GetBalance(address string) (map[string]interface{}, error) {
	resp, err := http.Get(fmt.Sprintf("http://localhost:1317/cosmos/bank/v1beta1/balances/%s", address))
	if err != nil {
		return map[string]interface{}{
			"utkfy":   int64(0),
			"tkfy":    float64(0),
			"display": "0 TKFY",
		}, nil
	}
	defer resp.Body.Close()

	var balResp struct {
		Balances []struct {
			Denom  string `json:"denom"`
			Amount string `json:"amount"`
		} `json:"balances"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&balResp); err != nil {
		return map[string]interface{}{
			"utkfy":   int64(0),
			"tkfy":    float64(0),
			"display": "0 TKFY",
		}, nil
	}

	var amount int64
	for _, bal := range balResp.Balances {
		if bal.Denom == "utkfy" || bal.Denom == "stake" {
			fmt.Sscanf(bal.Amount, "%d", &amount)
			break
		}
	}

	tkfy := float64(amount) / 1000000
	display := formatBalance(tkfy)

	return map[string]interface{}{
		"utkfy":   amount,
		"tkfy":    tkfy,
		"display": display,
	}, nil
}

func formatBalance(tkfy float64) string {
	var display string
	if tkfy >= 1000000 {
		display = fmt.Sprintf("%.0f TKFY", tkfy)
	} else {
		display = fmt.Sprintf("%.2f TKFY", tkfy)
	}

	parts := strings.Split(display, " ")
	if len(parts) == 2 {
		numStr := parts[0]
		numParts := strings.Split(numStr, ".")
		intPart := numParts[0]
		var formatted string
		for i, c := range intPart {
			if i > 0 && (len(intPart)-i)%3 == 0 {
				formatted += ","
			}
			formatted += string(c)
		}
		if len(numParts) > 1 && numParts[1] != "00" {
			display = formatted + "." + numParts[1] + " " + parts[1]
		} else {
			display = formatted + " " + parts[1]
		}
	}
	return display
}

// =============================================================================
// NODE OPERATIONS
// =============================================================================

func (s *Service) InstallNode(progressCh chan<- int) error {
	binaryPath := s.getBinaryPath()
	binDir := filepath.Dir(binaryPath)
	os.MkdirAll(binDir, 0755)

	if _, err := os.Stat(binaryPath); err == nil {
		return nil // Already installed
	}

	binaryURL := s.getBinaryURL()
	s.addLog(fmt.Sprintf("Downloading from: %s", binaryURL))

	resp, err := http.Get(binaryURL)
	if err != nil {
		return fmt.Errorf("erro ao baixar: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("binário não encontrado (status %d)", resp.StatusCode)
	}

	out, err := os.Create(binaryPath)
	if err != nil {
		return err
	}
	defer out.Close()

	// Track progress
	totalSize := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
			downloaded += int64(n)
			if progressCh != nil && totalSize > 0 {
				progress := int(float64(downloaded) / float64(totalSize) * 100)
				select {
				case progressCh <- progress:
				default:
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}

	if runtime.GOOS != "windows" {
		os.Chmod(binaryPath, 0755)
	}

	s.addLog("Binary installed successfully")
	return nil
}

func (s *Service) InitNode(moniker string) error {
	binaryPath := s.getBinaryPath()
	nodeHome := s.getNodeHome()

	genesisPath := filepath.Join(nodeHome, "config", "genesis.json")
	if _, err := os.Stat(genesisPath); err == nil {
		return nil // Already initialized
	}

	if _, err := os.Stat(binaryPath); err != nil {
		return errors.New("binário não encontrado. Instale primeiro.")
	}

	s.addLog(fmt.Sprintf("Initializing node with moniker: %s", moniker))

	cmd := exec.Command(binaryPath, "init", moniker, "--chain-id", "tickfyblockchain", "--home", nodeHome)
	output, err := cmd.CombinedOutput()
	if err != nil {
		s.addLog(fmt.Sprintf("Init error: %s", string(output)))
		return fmt.Errorf("erro ao inicializar: %s", string(output))
	}

	// Download genesis
	genesisURL := "https://raw.githubusercontent.com/Tickfy/tickfy-blockchain/main/network/genesis.json"
	if resp, err := http.Get(genesisURL); err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		if data, err := io.ReadAll(resp.Body); err == nil {
			os.WriteFile(genesisPath, data, 0644)
			s.addLog("Genesis downloaded")
		}
	}

	// Configure seeds
	configPath := filepath.Join(nodeHome, "config", "config.toml")
	if data, err := os.ReadFile(configPath); err == nil {
		content := string(data)
		seeds := "seed1.tickfy.io:26656,seed2.tickfy.io:26656"
		content = strings.Replace(content, `seeds = ""`, fmt.Sprintf(`seeds = "%s"`, seeds), 1)
		os.WriteFile(configPath, []byte(content), 0644)
	}

	// Save config
	cfg := NodeConfig{
		Moniker:  moniker,
		ChainID:  "tickfyblockchain",
		NodeHome: nodeHome,
	}
	cfgData, _ := json.MarshalIndent(cfg, "", "  ")
	os.WriteFile(filepath.Join(s.dataDir, "node-config.json"), cfgData, 0600)

	s.addLog("Node initialized successfully")
	return nil
}

// =============================================================================
// COSMOVISOR
// =============================================================================

func (s *Service) InstallCosmovisor(progressCh chan<- int) error {
	cosmovisorPath := s.getCosmovisorPath()
	cosmovisorDir := filepath.Dir(cosmovisorPath)
	os.MkdirAll(cosmovisorDir, 0755)

	if _, err := os.Stat(cosmovisorPath); err == nil {
		s.addLog("Cosmovisor already installed")
		return nil
	}

	// Download Cosmovisor
	version := "v1.5.0"
	downloadURL := s.getCosmovisorURL(version)
	s.addLog(fmt.Sprintf("Downloading Cosmovisor from: %s", downloadURL))

	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("erro ao baixar cosmovisor: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("cosmovisor não encontrado (status %d)", resp.StatusCode)
	}

	// Save to temp file for extraction
	tmpFile := filepath.Join(cosmovisorDir, "cosmovisor.tar.gz")
	out, err := os.Create(tmpFile)
	if err != nil {
		return err
	}

	totalSize := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
			downloaded += int64(n)
			if progressCh != nil && totalSize > 0 {
				progress := int(float64(downloaded) / float64(totalSize) * 100)
				select {
				case progressCh <- progress:
				default:
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			out.Close()
			os.Remove(tmpFile)
			return err
		}
	}
	out.Close()

	// Extract tarball
	s.addLog("Extracting Cosmovisor...")
	cmd := exec.Command("tar", "-xzf", tmpFile, "-C", cosmovisorDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		s.addLog(fmt.Sprintf("Extract error: %s", string(output)))
		return fmt.Errorf("erro ao extrair: %s", string(output))
	}
	os.Remove(tmpFile)

	// Make executable
	os.Chmod(cosmovisorPath, 0755)

	s.addLog("Cosmovisor installed successfully")
	return nil
}

func (s *Service) SetupCosmovisorDirs() error {
	nodeHome := s.getNodeHome()
	binaryPath := s.getBinaryPath()

	// Create Cosmovisor directory structure
	// ~/.tickfy-validator/node/cosmovisor/
	//   ├── genesis/bin/tickfy-blockchaind
	//   ├── upgrades/
	//   └── current -> genesis/

	genesisDir := filepath.Join(nodeHome, "cosmovisor", "genesis", "bin")
	upgradesDir := filepath.Join(nodeHome, "cosmovisor", "upgrades")
	currentLink := filepath.Join(nodeHome, "cosmovisor", "current")

	os.MkdirAll(genesisDir, 0755)
	os.MkdirAll(upgradesDir, 0755)

	// Copy binary to genesis/bin
	targetBinary := filepath.Join(genesisDir, "tickfy-blockchaind")
	if runtime.GOOS == "windows" {
		targetBinary += ".exe"
	}

	if _, err := os.Stat(targetBinary); os.IsNotExist(err) {
		// Copy binary
		srcData, err := os.ReadFile(binaryPath)
		if err != nil {
			return fmt.Errorf("erro ao ler binário: %v", err)
		}
		if err := os.WriteFile(targetBinary, srcData, 0755); err != nil {
			return fmt.Errorf("erro ao copiar binário: %v", err)
		}
		s.addLog("Binary copied to cosmovisor/genesis/bin")
	}

	// Create current symlink
	os.Remove(currentLink)
	genesisPath := filepath.Join(nodeHome, "cosmovisor", "genesis")
	if err := os.Symlink(genesisPath, currentLink); err != nil {
		s.addLog(fmt.Sprintf("Symlink warning: %v", err))
	}

	// Save Cosmovisor config
	cfg := CosmovisorConfig{
		Installed:    true,
		AutoDownload: true,
		Version:      "v1.5.0",
	}
	cfgData, _ := json.MarshalIndent(cfg, "", "  ")
	os.WriteFile(filepath.Join(s.dataDir, "cosmovisor-config.json"), cfgData, 0600)

	s.addLog("Cosmovisor directory structure created")
	return nil
}

func (s *Service) getCosmovisorPath() string {
	name := "cosmovisor"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(s.dataDir, "bin", name)
}

func (s *Service) getCosmovisorURL(version string) string {
	base := fmt.Sprintf("https://github.com/cosmos/cosmos-sdk/releases/download/cosmovisor%%2F%s", version)
	switch runtime.GOOS {
	case "darwin":
		if runtime.GOARCH == "arm64" {
			return base + "/cosmovisor-" + version + "-darwin-arm64.tar.gz"
		}
		return base + "/cosmovisor-" + version + "-darwin-amd64.tar.gz"
	case "windows":
		return base + "/cosmovisor-" + version + "-windows-amd64.tar.gz"
	default:
		return base + "/cosmovisor-" + version + "-linux-amd64.tar.gz"
	}
}

func (s *Service) IsCosmovisorEnabled() bool {
	cfgPath := filepath.Join(s.dataDir, "cosmovisor-config.json")
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		return false
	}
	return true
}

func (s *Service) StartNode() error {
	s.nodeMutex.Lock()
	defer s.nodeMutex.Unlock()

	if s.nodeCmd != nil && s.nodeCmd.Process != nil {
		return errors.New("node já está rodando")
	}

	nodeHome := s.getNodeHome()

	// Check if Cosmovisor is enabled
	if s.IsCosmovisorEnabled() {
		return s.startWithCosmovisor(nodeHome)
	}

	// Fallback to direct binary start
	binaryPath := s.getBinaryPath()
	s.nodeCmd = exec.Command(binaryPath, "start", "--home", nodeHome)

	stdout, _ := s.nodeCmd.StdoutPipe()
	stderr, _ := s.nodeCmd.StderrPipe()

	if err := s.nodeCmd.Start(); err != nil {
		return err
	}

	// Capture logs
	go s.captureLogs(stdout)
	go s.captureLogs(stderr)

	// Monitor process
	go func() {
		s.nodeCmd.Wait()
		s.nodeMutex.Lock()
		s.nodeCmd = nil
		s.nodeMutex.Unlock()
		s.addLog("Node stopped")
	}()

	s.addLog("Node started (direct)")
	return nil
}

func (s *Service) startWithCosmovisor(nodeHome string) error {
	cosmovisorPath := s.getCosmovisorPath()

	// Set environment variables for Cosmovisor
	env := os.Environ()
	env = append(env, fmt.Sprintf("DAEMON_NAME=%s", "tickfy-blockchaind"))
	env = append(env, fmt.Sprintf("DAEMON_HOME=%s", nodeHome))
	env = append(env, "DAEMON_ALLOW_DOWNLOAD_BINARIES=true")
	env = append(env, "DAEMON_RESTART_AFTER_UPGRADE=true")
	env = append(env, "DAEMON_POLL_INTERVAL=300ms")
	env = append(env, "UNSAFE_SKIP_BACKUP=true")

	s.nodeCmd = exec.Command(cosmovisorPath, "run", "start", "--home", nodeHome)
	s.nodeCmd.Env = env

	stdout, _ := s.nodeCmd.StdoutPipe()
	stderr, _ := s.nodeCmd.StderrPipe()

	if err := s.nodeCmd.Start(); err != nil {
		return err
	}

	// Capture logs
	go s.captureLogs(stdout)
	go s.captureLogs(stderr)

	// Monitor process
	go func() {
		s.nodeCmd.Wait()
		s.nodeMutex.Lock()
		s.nodeCmd = nil
		s.nodeMutex.Unlock()
		s.addLog("Node stopped (cosmovisor)")
	}()

	s.addLog("Node started via Cosmovisor (auto-upgrade enabled)")
	return nil
}

func (s *Service) StopNode() error {
	s.nodeMutex.Lock()
	defer s.nodeMutex.Unlock()

	if s.nodeCmd == nil || s.nodeCmd.Process == nil {
		return errors.New("node não está rodando")
	}

	s.nodeCmd.Process.Kill()
	s.nodeCmd = nil
	s.addLog("Node stopped")
	return nil
}

func (s *Service) captureLogs(reader io.ReadCloser) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		s.addLog(scanner.Text())
	}
}

func (s *Service) addLog(msg string) {
	s.logsMutex.Lock()
	defer s.logsMutex.Unlock()

	timestamp := time.Now().Format("15:04:05")
	logEntry := fmt.Sprintf("[%s] %s", timestamp, msg)
	s.logs = append(s.logs, logEntry)

	if len(s.logs) > s.maxLogs {
		s.logs = s.logs[len(s.logs)-s.maxLogs:]
	}
}

func (s *Service) GetLogs(lastN int) []string {
	s.logsMutex.RLock()
	defer s.logsMutex.RUnlock()

	if lastN <= 0 || lastN > len(s.logs) {
		lastN = len(s.logs)
	}

	start := len(s.logs) - lastN
	result := make([]string, lastN)
	copy(result, s.logs[start:])
	return result
}

// =============================================================================
// VALIDATOR
// =============================================================================

func (s *Service) CreateValidator(moniker, commission, stakeAmount, password string) error {
	// Get mnemonic
	mnemonic, err := s.getMnemonic(password)
	if err != nil {
		return err
	}

	binaryPath := s.getBinaryPath()
	nodeHome := s.getNodeHome()

	// Import key
	keyName := "validator"
	cmd := exec.Command(binaryPath, "keys", "add", keyName, "--recover", "--home", nodeHome, "--keyring-backend", "test")
	cmd.Stdin = strings.NewReader(mnemonic + "\n")
	if output, err := cmd.CombinedOutput(); err != nil {
		if !strings.Contains(string(output), "already exists") {
			s.addLog(fmt.Sprintf("Key import error: %s", string(output)))
		}
	}

	// Create validator transaction
	createCmd := exec.Command(binaryPath, "tx", "staking", "create-validator",
		"--amount", stakeAmount+"stake",
		"--pubkey", s.getValidatorPubKey(),
		"--moniker", moniker,
		"--commission-rate", commission,
		"--commission-max-rate", "0.20",
		"--commission-max-change-rate", "0.01",
		"--min-self-delegation", "1",
		"--from", keyName,
		"--chain-id", "tickfyblockchain",
		"--home", nodeHome,
		"--keyring-backend", "test",
		"--yes",
	)

	output, err := createCmd.CombinedOutput()
	if err != nil {
		s.addLog(fmt.Sprintf("Create validator error: %s", string(output)))
		return fmt.Errorf("erro ao criar validador: %s", string(output))
	}

	// Save validator info
	valInfo := ValidatorInfo{
		Moniker:    moniker,
		Commission: commission,
		Stake:      stakeAmount,
		CreatedAt:  time.Now().Unix(),
	}
	valData, _ := json.MarshalIndent(valInfo, "", "  ")
	os.WriteFile(filepath.Join(s.dataDir, "validator.json"), valData, 0600)

	s.addLog("Validator created successfully")
	return nil
}

func (s *Service) getValidatorPubKey() string {
	binaryPath := s.getBinaryPath()
	nodeHome := s.getNodeHome()

	cmd := exec.Command(binaryPath, "tendermint", "show-validator", "--home", nodeHome)
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func (s *Service) GetValidatorStatus() (map[string]interface{}, error) {
	valPath := filepath.Join(s.dataDir, "validator.json")
	data, err := os.ReadFile(valPath)
	if err != nil {
		return nil, errors.New("validador não encontrado")
	}

	var valInfo ValidatorInfo
	if err := json.Unmarshal(data, &valInfo); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"moniker":    valInfo.Moniker,
		"commission": valInfo.Commission,
		"stake":      valInfo.Stake,
		"createdAt":  valInfo.CreatedAt,
	}, nil
}

func (s *Service) GetStakingInfo() (map[string]interface{}, error) {
	valPath := filepath.Join(s.dataDir, "validator.json")
	data, err := os.ReadFile(valPath)
	if err != nil {
		return map[string]interface{}{
			"totalStaked":    "0 TKFY",
			"selfDelegation": "0 TKFY",
			"delegations":    "0 TKFY",
		}, nil
	}

	var valInfo ValidatorInfo
	if err := json.Unmarshal(data, &valInfo); err != nil {
		return nil, err
	}

	// Get staking info from chain (simplified for now)
	stakeAmount := valInfo.Stake
	if stakeAmount == "" {
		stakeAmount = "0"
	}

	return map[string]interface{}{
		"totalStaked":    stakeAmount + " TKFY",
		"selfDelegation": stakeAmount + " TKFY",
		"delegations":    "0 TKFY",
	}, nil
}

func (s *Service) WithdrawRewards(password string) error {
	if _, err := s.getMnemonic(password); err != nil {
		return errors.New("senha incorreta")
	}

	binaryPath := s.getBinaryPath()
	nodeHome := s.getNodeHome()

	address, _, _ := s.GetWalletInfo()

	cmd := exec.Command(binaryPath, "tx", "distribution", "withdraw-all-rewards",
		"--from", "validator",
		"--chain-id", "tickfyblockchain",
		"--home", nodeHome,
		"--keyring-backend", "test",
		"--yes",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("erro: %s", string(output))
	}

	s.addLog(fmt.Sprintf("Rewards withdrawn to %s", address))
	return nil
}

func (s *Service) Restake(password string) error {
	// Implementation similar to withdraw + delegate
	return errors.New("não implementado")
}

// =============================================================================
// HELPERS
// =============================================================================

func (s *Service) getBinaryPath() string {
	name := "tickfy-blockchaind"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(s.dataDir, "bin", name)
}

func (s *Service) getNodeHome() string {
	return filepath.Join(s.dataDir, "node")
}

func (s *Service) getBinaryURL() string {
	base := "https://github.com/Tickfy/tickfy-blockchain/releases/download/v1.0.0"
	switch runtime.GOOS {
	case "windows":
		return base + "/tickfy-blockchaind-windows-amd64.exe"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			return base + "/tickfy-blockchaind-darwin-arm64"
		}
		return base + "/tickfy-blockchaind-darwin-amd64"
	default:
		return base + "/tickfy-blockchaind-linux-amd64"
	}
}

func (s *Service) getMnemonic(password string) (string, error) {
	walletPath := filepath.Join(s.dataDir, "wallet.json")
	data, err := os.ReadFile(walletPath)
	if err != nil {
		return "", errors.New("carteira não encontrada")
	}

	var w WalletData
	if err := json.Unmarshal(data, &w); err != nil {
		return "", err
	}

	return decryptData(w.EncryptedMnemonic, password, w.Salt)
}

func deriveAddress(mnemonic string) string {
	config := sdk.GetConfig()
	config.SetBech32PrefixForAccount("tickfy", "tickfypub")

	seed := bip39.NewSeed(mnemonic, "")
	master, ch := hd.ComputeMastersFromSeed(seed)
	derivedKey, _ := hd.DerivePrivateKeyForPath(master, ch, "m/44'/118'/0'/0/0")

	privKey := &secp256k1.PrivKey{Key: derivedKey}
	pubKey := privKey.PubKey()
	address := sdk.AccAddress(pubKey.Address())

	return address.String()
}

func generateSalt() string {
	salt := make([]byte, 16)
	rand.Read(salt)
	return hex.EncodeToString(salt)
}

func encryptData(plaintext, password, salt string) (string, error) {
	key := sha256.Sum256([]byte(password + salt))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	rand.Read(nonce)

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

func decryptData(cipherHex, password, salt string) (string, error) {
	ciphertext, err := hex.DecodeString(cipherHex)
	if err != nil {
		return "", err
	}

	key := sha256.Sum256([]byte(password + salt))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext muito curto")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("senha incorreta")
	}

	return string(plaintext), nil
}
