package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the Notification Service.
type Config struct {
	Port          string
	DBDSN         string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	NATSUrl       string
	JWTSecret     string
	// SecretKey is used to derive the AES key that encrypts channel secrets
	// (telegram bot token, SMTP password, push server key) at rest.
	SecretKey string

	// Channel transports (optional). When empty the channel is "simulated"
	// in DevMode so the full send path is exercisable without external creds.
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string
	PushURL  string
	TelegramBotToken string
	TelegramChatID   string

	// Worker behaviour.
	MaxAttempts  int
	RetryDelay   time.Duration
	SendInterval time.Duration // throttle between sends to avoid spam
	DevMode      bool          // simulate delivery when transport unavailable
	ForceFail    bool          // test/debug: force every send to fail (exercises retry)
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		DBDSN:         getEnv("DB_DSN", "notification_user:notification_pass@tcp(mariadb-notification:3306)/notification_db?parseTime=true&charset=utf8mb4"),
		RedisAddr:     getEnv("REDIS_ADDR", "redis-shared:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       atoiDefault(getEnv("REDIS_DB", "0"), 0),
		NATSUrl:       getEnv("NATS_URL", "nats://nats:4222"),
		JWTSecret:     getEnv("JWT_SECRET", ""),
		SecretKey:     getEnv("NOTIFICATION_SECRET_KEY", getEnv("JWT_SECRET", "")),

		SMTPHost: getEnv("SMTP_HOST", ""),
		SMTPPort: atoiDefault(getEnv("SMTP_PORT", "587"), 587),
		SMTPUser:  getEnv("SMTP_USER", ""),
		SMTPPass:  getEnv("SMTP_PASS", ""),
		SMTPFrom:  getEnv("SMTP_FROM", ""),
		PushURL:  getEnv("PUSH_URL", ""),
		TelegramBotToken: getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:   getEnv("TELEGRAM_CHAT_ID", ""),

		MaxAttempts:  atoiDefault(getEnv("NOTIFICATION_MAX_ATTEMPTS", "3"), 3),
		RetryDelay:   time.Duration(atoiDefault(getEnv("NOTIFICATION_RETRY_DELAY_MS", "1000"), 1000)) * time.Millisecond,
		SendInterval: time.Duration(atoiDefault(getEnv("NOTIFICATION_SEND_INTERVAL_MS", "100"), 100)) * time.Millisecond,
		DevMode:      getEnv("NOTIFICATION_DEV", "1") != "0",
		ForceFail:    getEnv("NOTIFICATION_FORCE_FAIL", "") == "1",
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
