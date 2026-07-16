package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the Alert Service.
type Config struct {
	Port      string
	DBDSN     string
	NATSUrl   string
	JWTSecret string

	// Redis — cache for resolved thresholds and active-alert dedup state.
	RedisAddr     string
	RedisPassword string
	RedisDB       int
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		DBDSN:         getEnv("DB_DSN", "alert_user:alert_pass@tcp(mariadb-alert:3306)/alert_db?parseTime=true&charset=utf8mb4"),
		NATSUrl:       getEnv("NATS_URL", "nats://nats:4222"),
		JWTSecret:     getEnv("JWT_SECRET", ""),
		RedisAddr:     getEnv("REDIS_ADDR", "redis-shared:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       atoiDefault(getEnv("REDIS_DB", "0"), 0),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
