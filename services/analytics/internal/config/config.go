package config

import (
	"os"
)

// Config holds all configuration for the Analytics Service.
type Config struct {
	Port string

	// TimescaleDB — own time-series rollup store (Database-per-Service).
	TimescaleDSN string

	// NATS — event bus carrying telemetry.batch from Module Service.
	NATSUrl string

	// JWTSecret validates the Bearer token issued by the Auth Service so
	// analytics endpoints are never reachable unauthenticated.
	JWTSecret string
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port: getEnv("PORT", "8080"),
		TimescaleDSN: getEnv("TIMESCALE_DSN",
			"postgres://analytics_user:analytics_pass@timescaledb-analytics:5432/analytics_ts?sslmode=disable"),
		NATSUrl:   getEnv("NATS_URL", "nats://nats:4222"),
		JWTSecret: getEnv("JWT_SECRET", ""),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
