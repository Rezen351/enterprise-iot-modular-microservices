package config

import "os"

// Config holds all configuration for the Audit Service.
type Config struct {
	Port string

	// MariaDB — append-only audit log store.
	DBDSN string

	// NATS — subscribe to the audit.log subject published by other services.
	NATSUrl string

	// JWT — same secret as Auth Service so this service can validate access tokens.
	JWTSecret string
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:      getEnv("PORT", "8080"),
		DBDSN:     getEnv("DB_DSN", "audit_user:audit_pass@tcp(mariadb-audit:3306)/audit_db?parseTime=true&charset=utf8mb4"),
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
