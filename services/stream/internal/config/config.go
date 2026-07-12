package config

import (
	"os"
)

// Config holds all configuration for the Stream Service.
type Config struct {
	Port string

	// MariaDB — stream metadata (primary store).
	DBDSN string

	// MediaMTX Control API (internal iot-net). Used to register/remove paths.
	MediaMTXAPIURL string

	// MediaMTX HTTP/HLS server (internal iot-net). Serves /{name}/snapshot.
	MediaMTXHTTPURL string

	// Default RTSP source used when a stream is created without an explicit URL.
	CCTVRTSPURL string

	// Public URL of Kong as seen by the browser. Used to build hls_url so the
	// dashboard can play HLS through the gateway (e.g. http://localhost:8000).
	KongPublicURL string

	// Shared JWT secret (same as Auth Service). Empty disables JWT enforcement (dev).
	JWTSecret string

	// MinIO — object storage for snapshots & recordings (bucket MINIO_STREAM_BUCKET).
	MinIOEndpoint    string
	MinIOAccessKey   string
	MinIOSecretKey   string
	MinIOUseSSL      bool
	MinIOStreamBucket string
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DBDSN:          getEnv("DB_DSN", "app:app1234@tcp(mariadb-stream:3306)/stream_db?parseTime=true&charset=utf8mb4"),
		MediaMTXAPIURL: getEnv("MEDIAMTX_API_URL", "http://mediamtx:9997"),
		MediaMTXHTTPURL: getEnv("MEDIAMTX_HTTP_URL", "http://mediamtx:8888"),
		CCTVRTSPURL:    getEnv("CCTV_RTSP_URL", ""),
		KongPublicURL:  getEnv("KONG_PUBLIC_URL", "http://localhost:8000"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		MinIOEndpoint:     getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinIOAccessKey:    getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey:    getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinIOUseSSL:       getEnvBool("MINIO_USE_SSL", false),
		MinIOStreamBucket: getEnv("MINIO_STREAM_BUCKET", "stream"),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v == "true" || v == "1" || v == "yes"
}
