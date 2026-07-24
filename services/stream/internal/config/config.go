package config

import (
	"fmt"
	"os"
	"time"
)

// Config holds all configuration for the Stream Service.
type Config struct {
	Port string

	// MariaDB — stream metadata (primary store).
	DBDSN string

	// MediaMTX Control API (internal iot-net). Used to register/remove paths.
	MediaMTXAPIURL string

	// MediaMTX HTTP/HLS server (internal iot-net). Serves /{name}/index.m3u8
	// and the single-frame snapshot endpoint /live/{name}/snapshot.
	MediaMTXHTTPURL string

	// MediaMTX RTSP server (internal iot-net). Legacy/compat only; snapshots
	// now use the HTTP snapshot endpoint instead of pulling RTSP via ffmpeg.
	MediaMTXRTSPURL string

	// Default RTSP source used when a stream is created without an explicit URL.
	CCTVRTSPURL string

	// Public URL of Kong as seen by the browser. Used to build hls_url so the
	// dashboard can play HLS through the gateway (e.g. http://localhost:8000).
	KongPublicURL string

	// Shared JWT secret (same as Auth Service). Empty disables JWT enforcement (dev).
	JWTSecret string

	// MinIO — object storage for snapshots & recordings (bucket MINIO_STREAM_BUCKET).
	MinIOEndpoint     string
	MinIOAccessKey    string
	MinIOSecretKey    string
	MinIOUseSSL       bool
	MinIOStreamBucket string

	// ML / Vision service — used to run AI detection on captured snapshots.
	// The stream service mints its own service JWT (shared JWT secret) so it can
	// call the ML inference endpoint without a round-trip through Auth.
	MLBaseURL       string
	MLVisionModelID string

	// Interval at which the service re-registers enabled stream paths into
	// MediaMTX. API-added MediaMTX paths are lost on a MediaMTX restart, so a
	// periodic reconcile keeps DB and MediaMTX in sync. 0 disables the timer
	// (startup reconcile only).
	ReconcileInterval time.Duration
}

// Load reads configuration from environment variables with dev-friendly defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		DBDSN:             getEnv("DB_DSN", "app:app1234@tcp(mariadb-stream:3306)/stream_db?parseTime=true&charset=utf8mb4"),
		MediaMTXAPIURL:    getEnv("MEDIAMTX_API_URL", "http://mediamtx:9997"),
		MediaMTXHTTPURL:   getEnv("MEDIAMTX_HTTP_URL", "http://mediamtx:8888"),
		MediaMTXRTSPURL:   getEnv("MEDIAMTX_RTSP_URL", "rtsp://mediamtx:8554"),
		CCTVRTSPURL:       getEnv("CCTV_RTSP_URL", ""),
		KongPublicURL:     getEnv("KONG_PUBLIC_URL", "http://localhost:8000"),
		JWTSecret:         getEnv("JWT_SECRET", ""),
		MinIOEndpoint:     getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinIOAccessKey:    getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey:    getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinIOUseSSL:       getEnvBool("MINIO_USE_SSL", false),
		MinIOStreamBucket: getEnv("MINIO_STREAM_BUCKET", "stream"),
		MLBaseURL:         getEnv("ML_BASE_URL", "http://ml:8080"),
		MLVisionModelID:   getEnv("ML_VISION_MODEL_ID", ""),
		ReconcileInterval: time.Duration(getEnvInt("RECONCILE_INTERVAL_SECONDS", 30)) * time.Second,
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
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	var n int
	if _, err := fmt.Sscanf(v, "%d", &n); err != nil {
		return fallback
	}
	return n
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v == "true" || v == "1" || v == "yes"
}
