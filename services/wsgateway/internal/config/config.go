package config

import "os"

// Config holds all configuration for the WS-Gateway service.
type Config struct {
	Port    string
	NATSUrl string

	// JWTSecret validates the access token sent by dashboard clients during the
	// WebSocket handshake. It MUST match the secret used by the Auth Service
	// (JWT_SECRET) so the same tokens are accepted here.
	JWTSecret string
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() *Config {
	return &Config{
		Port:      getEnv("PORT", "8090"),
		NATSUrl:   getEnv("NATS_URL", "nats://nats:4222"),
		JWTSecret: getEnv("JWT_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
