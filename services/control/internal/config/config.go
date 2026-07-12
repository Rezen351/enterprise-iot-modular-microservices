package config

import "os"

// Config holds all configuration for the Control Service.
type Config struct {
	Port string

	// MariaDB — command log, schedules, target catalog, per-target mode
	DBDSN string

	// NATS — audit + event bus
	NATSUrl string

	// MQTT — Mosquitto broker: publish actuator commands, subscribe confirm/telemetry
	MQTTURL         string
	MQTTUser        string
	MQTTPass        string
	MQTTClientID    string
	MQTTTopicPrefix string

	// ModuleURL — Module Service base URL, used to read the node's telemetry
	// tag-mapping (actuator outputs are tags, same schema as sensors).
	ModuleURL string

	// JWT — same secret as Auth Service so this service can validate access tokens.
	JWTSecret string

	// AckTimeout — how long to wait for the firmware /confirm before a command is
	// marked "timeout". Firmware telemetry interval is ~5s, so keep this generous.
	AckTimeoutSeconds int
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		DBDSN:             getEnv("DB_DSN", "control_user:control_pass@tcp(mariadb-control:3306)/control_db?parseTime=true&charset=utf8mb4"),
		NATSUrl:           getEnv("NATS_URL", "nats://nats:4222"),
		MQTTURL:           getEnv("MQTT_URL", "tcp://mosquitto:1883"),
		MQTTUser:          getEnv("MQTT_USER", ""),
		MQTTPass:          getEnv("MQTT_PASS", ""),
		MQTTClientID:      getEnv("MQTT_CLIENT_ID", "control-svc"),
		MQTTTopicPrefix:   getEnv("MQTT_TOPIC_PREFIX", "smartfarm"),
		JWTSecret:         getEnv("JWT_SECRET", ""),
		AckTimeoutSeconds: getEnvInt("ACK_TIMEOUT_SECONDS", 8),
		ModuleURL:         getEnv("MODULE_URL", "http://module:8080"),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		n := 0
		for _, c := range v {
			if c < '0' || c > '9' {
				return fallback
			}
			n = n*10 + int(c-'0')
		}
		return n
	}
	return fallback
}
