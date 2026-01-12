package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/tickfy/tickfy-validator-setup/internal/api"
	"github.com/tickfy/tickfy-validator-setup/internal/auth"
	"github.com/tickfy/tickfy-validator-setup/internal/node"
)

//go:embed web/dist/*
var webFS embed.FS

type Config struct {
	Port      int    `json:"port"`
	DataDir   string `json:"dataDir"`
	JWTSecret string `json:"jwtSecret"`
}

func main() {
	// Load or create config
	config := loadConfig()

	// Initialize services
	nodeService := node.NewService(config.DataDir)
	authService := auth.NewService(config.JWTSecret, config.DataDir)
	apiHandler := api.NewHandler(nodeService, authService)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Public routes
		r.Post("/auth/setup", apiHandler.SetupAuth)
		r.Post("/auth/login", apiHandler.Login)
		r.Get("/auth/status", apiHandler.AuthStatus)
		r.Get("/dependencies/status", apiHandler.GetDependenciesStatus)
		r.Post("/dependencies/install", apiHandler.InstallDependencies)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(authService.Middleware)

			// Wallet
			r.Post("/wallet/create", apiHandler.CreateWallet)
			r.Post("/wallet/import", apiHandler.ImportWallet)
			r.Get("/wallets", apiHandler.GetWallets)
			r.Post("/wallet/active", apiHandler.SetActiveWallet)
			r.Get("/wallet/info", apiHandler.GetWalletInfo)
			r.Post("/wallet/delete", apiHandler.DeleteWallet)
			r.Get("/wallet/balance", apiHandler.GetBalance)

			// Node
			r.Get("/node/status", apiHandler.GetNodeStatus)
			r.Post("/node/install", apiHandler.InstallNode)
			r.Post("/node/init", apiHandler.InitNode)
			r.Post("/node/start", apiHandler.StartNode)
			r.Post("/node/stop", apiHandler.StopNode)
			r.Get("/node/logs", apiHandler.GetLogs)

			// Cosmovisor
			r.Post("/cosmovisor/install", apiHandler.InstallCosmovisor)
			r.Post("/cosmovisor/setup", apiHandler.SetupCosmovisor)

			// Validator
			r.Post("/validator/create", apiHandler.CreateValidator)
			r.Get("/validator/status", apiHandler.GetValidatorStatus)
			r.Get("/validator/staking", apiHandler.GetStakingInfo)
			r.Post("/validator/withdraw", apiHandler.WithdrawRewards)
			r.Post("/validator/restake", apiHandler.Restake)
		})
	})

	// Serve static files
	webContent, err := fs.Sub(webFS, "web/dist")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(webContent))
	r.Handle("/*", fileServer)

	// Start server
	addr := fmt.Sprintf(":%d", config.Port)
	fmt.Println("╔════════════════════════════════════════════════════════╗")
	fmt.Println("║           🚀 Tickfy Validator Setup 🚀                 ║")
	fmt.Println("╠════════════════════════════════════════════════════════╣")
	fmt.Printf("║  Dashboard: http://localhost%s                     ║\n", addr)
	fmt.Printf("║  Data Dir:  %-42s ║\n", config.DataDir)
	fmt.Println("╚════════════════════════════════════════════════════════╝")

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}

func loadConfig() *Config {
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".tickfy-validator")
	os.MkdirAll(configDir, 0700)

	configPath := filepath.Join(configDir, "server-config.json")

	// Default port, can be overridden by PORT env
	defaultPort := 8080
	if portEnv := os.Getenv("PORT"); portEnv != "" {
		fmt.Sscanf(portEnv, "%d", &defaultPort)
	}

	config := &Config{
		Port:      defaultPort,
		DataDir:   configDir,
		JWTSecret: "",
	}

	// Try to load existing config
	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, config)
	}

	// Generate JWT secret if not set
	if config.JWTSecret == "" {
		config.JWTSecret = auth.GenerateSecret(32)
		data, _ := json.MarshalIndent(config, "", "  ")
		os.WriteFile(configPath, data, 0600)
	}

	return config
}
