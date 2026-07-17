package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the DLQ Saga worker.
type Config struct {
	Port string

	// MariaDB — the DLQ landing table lives in the audit database
	// (mariadb-audit). This is a deliberate, documented choice: the DLQ is an
	// observability/audit artifact (see ADR-006) and must not introduce a new
	// database that violates the Database-per-Service isolation rule. It reuses
	// the existing audit_db instance rather than creating a separate DB.
	DBDSN string

	// NATS — advisory events and the DLQ JetStream stream both live here.
	NATSUrl string

	// JWT — shared secret with Auth Service, used to validate admin tokens on
	// the DLQ list endpoint.
	JWTSecret string

	// DLQ JetStream stream tuning.
	DLQMaxAgeHours int // retention window in hours (spec: 30 days)
	DLQReplicas    int // spec: Replicas:2
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DBDSN:          getEnv("DB_DSN", "app:app1234@tcp(mariadb-audit:3306)/audit_db?parseTime=true&charset=utf8mb4"),
		NATSUrl:        getEnv("NATS_URL", "nats://nats:4222"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		DLQMaxAgeHours: intEnv("DLQ_MAX_AGE_HOURS", 24*30),
		DLQReplicas:    intEnv("DLQ_REPLICAS", 2),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
