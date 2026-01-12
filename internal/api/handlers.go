package api

import (
	"encoding/json"
	"net/http"

	"github.com/tickfy/tickfy-validator-setup/internal/auth"
	"github.com/tickfy/tickfy-validator-setup/internal/node"
)

type Handler struct {
	nodeService *node.Service
	authService *auth.Service
}

func NewHandler(nodeService *node.Service, authService *auth.Service) *Handler {
	return &Handler{
		nodeService: nodeService,
		authService: authService,
	}
}

func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) respondError(w http.ResponseWriter, status int, message string) {
	h.respondJSON(w, status, map[string]string{"error": message})
}

// =============================================================================
// DEPENDENCIES (Public - before auth setup)
// =============================================================================

func (h *Handler) GetDependenciesStatus(w http.ResponseWriter, r *http.Request) {
	status := h.nodeService.GetStatus()
	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"isNodeInstalled":       status.IsNodeInstalled,
		"isCosmovisorInstalled": status.IsCosmovisorInstalled,
	})
}

func (h *Handler) InstallDependencies(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Component string `json:"component"` // "binary" or "cosmovisor"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	switch req.Component {
	case "binary":
		if err := h.nodeService.InstallNode(nil); err != nil {
			h.respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	case "cosmovisor":
		if err := h.nodeService.InstallCosmovisor(nil); err != nil {
			h.respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err := h.nodeService.SetupCosmovisorDirs(); err != nil {
			h.respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	default:
		h.respondError(w, http.StatusBadRequest, "Componente inválido")
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Instalado com sucesso"})
}

// =============================================================================
// AUTH
// =============================================================================

func (h *Handler) AuthStatus(w http.ResponseWriter, r *http.Request) {
	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"isSetup": h.authService.IsSetup(),
	})
}

func (h *Handler) SetupAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if len(req.Password) < 6 {
		h.respondError(w, http.StatusBadRequest, "Senha deve ter pelo menos 6 caracteres")
		return
	}

	if err := h.authService.Setup(req.Password); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Auto login after setup
	token, _ := h.authService.Login(req.Password)
	h.respondJSON(w, http.StatusOK, map[string]string{
		"message": "Configuração concluída",
		"token":   token,
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	token, err := h.authService.Login(req.Password)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"token": token})
}

// =============================================================================
// WALLET
// =============================================================================

func (h *Handler) CreateWallet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	walletID, address, mnemonic, err := h.nodeService.CreateWallet(req.Name, req.Password)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{
		"id":       walletID,
		"address":  address,
		"mnemonic": mnemonic,
	})
}

func (h *Handler) ImportWallet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Mnemonic string `json:"mnemonic"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	walletID, address, err := h.nodeService.ImportWallet(req.Name, req.Mnemonic, req.Password)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{
		"id":      walletID,
		"address": address,
	})
}

func (h *Handler) GetWallets(w http.ResponseWriter, r *http.Request) {
	wallets, activeID, err := h.nodeService.GetWallets()
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"wallets":        wallets,
		"activeWalletId": activeID,
	})
}

func (h *Handler) SetActiveWallet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WalletID string `json:"walletId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if err := h.nodeService.SetActiveWallet(req.WalletID); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Carteira ativa atualizada"})
}

func (h *Handler) GetWalletInfo(w http.ResponseWriter, r *http.Request) {
	address, name, err := h.nodeService.GetWalletInfo()
	if err != nil {
		h.respondError(w, http.StatusNotFound, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{
		"address": address,
		"name":    name,
	})
}

func (h *Handler) DeleteWallet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WalletID string `json:"walletId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if err := h.nodeService.DeleteWallet(req.WalletID); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Carteira removida"})
}

func (h *Handler) GetBalance(w http.ResponseWriter, r *http.Request) {
	address, _, err := h.nodeService.GetWalletInfo()
	if err != nil {
		h.respondError(w, http.StatusNotFound, err.Error())
		return
	}

	balance, err := h.nodeService.GetBalance(address)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, balance)
}

// =============================================================================
// NODE
// =============================================================================

func (h *Handler) GetNodeStatus(w http.ResponseWriter, r *http.Request) {
	status := h.nodeService.GetStatus()
	h.respondJSON(w, http.StatusOK, status)
}

func (h *Handler) InstallNode(w http.ResponseWriter, r *http.Request) {
	// For simplicity, run synchronously (could use SSE for progress)
	if err := h.nodeService.InstallNode(nil); err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Node instalado com sucesso"})
}

func (h *Handler) InitNode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Moniker string `json:"moniker"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if req.Moniker == "" {
		h.respondError(w, http.StatusBadRequest, "Moniker é obrigatório")
		return
	}

	if err := h.nodeService.InitNode(req.Moniker); err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Node inicializado com sucesso"})
}

func (h *Handler) StartNode(w http.ResponseWriter, r *http.Request) {
	if err := h.nodeService.StartNode(); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Node iniciado"})
}

func (h *Handler) StopNode(w http.ResponseWriter, r *http.Request) {
	if err := h.nodeService.StopNode(); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Node parado"})
}

func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
	logs := h.nodeService.GetLogs(100)
	h.respondJSON(w, http.StatusOK, map[string]interface{}{"logs": logs})
}

// =============================================================================
// COSMOVISOR
// =============================================================================

func (h *Handler) InstallCosmovisor(w http.ResponseWriter, r *http.Request) {
	if err := h.nodeService.InstallCosmovisor(nil); err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Cosmovisor instalado com sucesso"})
}

func (h *Handler) SetupCosmovisor(w http.ResponseWriter, r *http.Request) {
	if err := h.nodeService.SetupCosmovisorDirs(); err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Cosmovisor configurado com sucesso"})
}

// =============================================================================
// VALIDATOR
// =============================================================================

func (h *Handler) CreateValidator(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Moniker     string `json:"moniker"`
		Commission  string `json:"commission"`
		StakeAmount string `json:"stakeAmount"`
		Password    string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if err := h.nodeService.CreateValidator(req.Moniker, req.Commission, req.StakeAmount, req.Password); err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Validador criado com sucesso"})
}

func (h *Handler) GetValidatorStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.nodeService.GetValidatorStatus()
	if err != nil {
		h.respondError(w, http.StatusNotFound, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, status)
}

func (h *Handler) GetStakingInfo(w http.ResponseWriter, r *http.Request) {
	info, err := h.nodeService.GetStakingInfo()
	if err != nil {
		h.respondError(w, http.StatusNotFound, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, info)
}

func (h *Handler) WithdrawRewards(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if err := h.nodeService.WithdrawRewards(req.Password); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Recompensas sacadas"})
}

func (h *Handler) Restake(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "JSON inválido")
		return
	}

	if err := h.nodeService.Restake(req.Password); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"message": "Restake realizado"})
}
