package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port string

	DBDSN string

	RedisAddr     string
	RedisPassword string
	RedisDB       int

	NATSUrl string

	JWTSecret string

	WebhookSecret string

	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPFrom string

	TelegramBotToken string
	TelegramChatID   string

	MaxAttempts    int
	RetryDelayMs   int
	SendIntervalMs int
	DevMode        bool
	ForceFail      bool
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		DBDSN:            getEnv("DB_DSN", "webhook_user:webhook_pass@tcp(mariadb-webhook:3306)/webhook_db?parseTime=true&charset=utf8mb4"),
		RedisAddr:        getEnv("REDIS_ADDR", "redis-shared:6379"),
		RedisPassword:    getEnv("REDIS_PASSWORD", ""),
		RedisDB:          atoiDefault(getEnv("REDIS_DB", "4"), 4),
		NATSUrl:          getEnv("NATS_URL", "nats://nats:4222"),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		WebhookSecret:    getEnv("WEBHOOK_SECRET", ""),
		SMTPHost:         getEnv("SMTP_HOST", ""),
		SMTPPort:         atoiDefault(getEnv("SMTP_PORT", "587"), 587),
		SMTPUser:         getEnv("SMTP_USER", ""),
		SMTPFrom:         getEnv("SMTP_FROM", ""),
		TelegramBotToken: getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:   getEnv("TELEGRAM_CHAT_ID", ""),
		MaxAttempts:      atoiDefault(getEnv("WEBHOOK_MAX_ATTEMPTS", "3"), 3),
		RetryDelayMs:     atoiDefault(getEnv("WEBHOOK_RETRY_DELAY_MS", "1000"), 1000),
		SendIntervalMs:   atoiDefault(getEnv("WEBHOOK_SEND_INTERVAL_MS", "100"), 100),
		DevMode:          getEnv("WEBHOOK_DEV", "1") == "1",
		ForceFail:        getEnv("WEBHOOK_FORCE_FAIL", "") == "1",
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET env variable is required")
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
	n, err := parseInt(s)
	if err != nil {
		return def
	}
	return n
}

func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
