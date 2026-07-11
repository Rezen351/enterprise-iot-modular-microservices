package config

import "os"

// Config holds all configuration for the WS-Gateway service.
type Config struct {
	Port    string
	NATSUrl string
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() *Config {
	return &Config{
		Port:    getEnv("PORT", "8090"),
		NATSUrl: getEnv("NATS_URL", "nats://nats:4222"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
