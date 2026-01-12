package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	jwtSecret string
	dataDir   string
}

type UserData struct {
	PasswordHash string `json:"passwordHash"`
	CreatedAt    int64  `json:"createdAt"`
}

type Claims struct {
	jwt.RegisteredClaims
}

func NewService(jwtSecret, dataDir string) *Service {
	return &Service{
		jwtSecret: jwtSecret,
		dataDir:   dataDir,
	}
}

func (s *Service) IsSetup() bool {
	userPath := filepath.Join(s.dataDir, "user.json")
	_, err := os.Stat(userPath)
	return err == nil
}

func (s *Service) Setup(password string) error {
	if s.IsSetup() {
		return errors.New("já configurado")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	userData := UserData{
		PasswordHash: string(hash),
		CreatedAt:    time.Now().Unix(),
	}

	data, _ := json.MarshalIndent(userData, "", "  ")
	userPath := filepath.Join(s.dataDir, "user.json")
	return os.WriteFile(userPath, data, 0600)
}

func (s *Service) Login(password string) (string, error) {
	userPath := filepath.Join(s.dataDir, "user.json")
	data, err := os.ReadFile(userPath)
	if err != nil {
		return "", errors.New("não configurado")
	}

	var userData UserData
	if err := json.Unmarshal(data, &userData); err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(userData.PasswordHash), []byte(password)); err != nil {
		return "", errors.New("senha incorreta")
	}

	// Generate JWT
	claims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *Service) ValidateToken(tokenString string) error {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return err
	}

	if !token.Valid {
		return errors.New("token inválido")
	}

	return nil
}

func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error": "Token não fornecido"}`, http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if err := s.ValidateToken(tokenString); err != nil {
			http.Error(w, `{"error": "Token inválido"}`, http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.Background()))
	})
}

func (s *Service) VerifyPassword(password string) error {
	userPath := filepath.Join(s.dataDir, "user.json")
	data, err := os.ReadFile(userPath)
	if err != nil {
		return errors.New("não configurado")
	}

	var userData UserData
	if err := json.Unmarshal(data, &userData); err != nil {
		return err
	}

	return bcrypt.CompareHashAndPassword([]byte(userData.PasswordHash), []byte(password))
}

func GenerateSecret(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
