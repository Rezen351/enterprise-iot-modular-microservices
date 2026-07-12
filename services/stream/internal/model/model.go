package model

import "time"

// Stream is the persisted stream metadata (GORM single source of truth).
type Stream struct {
	ID          string    `gorm:"column:id;type:char(36);primaryKey"`
	Name        string    `gorm:"column:name;type:varchar(64);uniqueIndex;not null"` // MediaMTX path name
	DeviceLabel string    `gorm:"column:device_label;type:varchar(128)"`
	Location    string    `gorm:"column:location;type:varchar(128)"`
	SourceRTSP  string    `gorm:"column:source_rtsp;type:varchar(512);not null"` // includes CCTV credentials
	Enabled     bool      `gorm:"column:enabled;not null;default:true"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (Stream) TableName() string { return "streams" }

// Snapshot is a captured frame (or recording cover) stored in MinIO.
// kind is "snapshot" (single frame) or "recording" (recording session cover).
type Snapshot struct {
	ID          string    `gorm:"column:id;type:char(36);primaryKey"`
	StreamID    string    `gorm:"column:stream_id;type:char(36);index"`
	StreamName  string    `gorm:"column:stream_name;type:varchar(64)"`
	ObjectKey   string    `gorm:"column:object_key;type:varchar(512);not null"`
	URL         string    `gorm:"column:url;type:varchar(1024);not null"`
	ContentType string    `gorm:"column:content_type;type:varchar(64)"`
	Size        int64     `gorm:"column:size"`
	Kind        string    `gorm:"column:kind;type:varchar(16);default:snapshot"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (Snapshot) TableName() string { return "snapshots" }

// SnapshotView is returned to the dashboard.
type SnapshotView struct {
	ID         string    `json:"id"`
	StreamID   string    `json:"stream_id"`
	StreamName string    `json:"stream_name"`
	URL        string    `json:"url"`
	Kind       string    `json:"kind"`
	Size       int64     `json:"size"`
	CreatedAt  time.Time `json:"created_at"`
}


// ─── Request DTOs ─────────────────────────────────────────────────────────────

// CreateStreamRequest is the body for POST /streams.
// source_rtsp is optional; when empty the configured CCTV_RTSP_URL is used.
type CreateStreamRequest struct {
	Name        string `json:"name"`
	DeviceLabel string `json:"device_label"`
	Location    string `json:"location"`
	SourceRTSP  string `json:"source_rtsp"`
}

// UpdateStreamRequest is the body for PUT /streams/{id}.
// Name and SourceRTSP are optional; when provided they re-register the
// MediaMTX path (the path is keyed by name and pulls from SourceRTSP, so
// changing either requires removing the old path and adding a new one).
type UpdateStreamRequest struct {
	Name        *string `json:"name"`
	DeviceLabel *string `json:"device_label"`
	Location    *string `json:"location"`
	SourceRTSP  *string `json:"source_rtsp"`
	Enabled     *bool   `json:"enabled"`
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

// StreamView is what the dashboard receives: metadata + live status + playback URLs.
type StreamView struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	DeviceLabel string     `json:"device_label"`
	Location    string     `json:"location"`
	SourceRTSP  string     `json:"source_rtsp"`
	Enabled     bool       `json:"enabled"`
	Status      string     `json:"status"` // MediaMTX source state: idle|waiting|running|ready|unknown
	HlsURL      string     `json:"hls_url"`
	WebRTCURL   string     `json:"webrtc_url"` // playback (WHEP) endpoint, host-direct
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
