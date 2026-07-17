package model

import "time"

// AuditLog is the append-only record persisted for every audit.log event.
type AuditLog struct {
	ID         string    `gorm:"column:id;type:char(36);primaryKey"`
	Event      string    `gorm:"column:event;type:varchar(128);not null;index"`
	Payload    string    `gorm:"column:payload;type:longtext;not null"`
	ReceivedAt time.Time `gorm:"column:received_at;autoCreateTime;index"`
}

func (AuditLog) TableName() string { return "audit_logs" }

// ProcessedMsg records msg_id values already consumed, providing consumer-side
// idempotency (ADR-007). The audit subscriber checks this before persisting so
// a redelivered event (NATS redelivery / publisher-side Nats-Msg-Id window
// expiry) is not stored twice.
type ProcessedMsg struct {
	MsgID     string    `gorm:"column:msg_id;type:varchar(64);primaryKey"`
	Subject   string    `gorm:"column:subject;type:varchar(128);not null"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (ProcessedMsg) TableName() string { return "processed_msgs" }

// AuditLogDTO is the API representation returned to clients.
type AuditLogDTO struct {
	ID         string    `json:"id"`
	Event      string    `json:"event"`
	Payload    string    `json:"payload"`
	ReceivedAt time.Time `json:"received_at"`
}

func ToDTO(l AuditLog) AuditLogDTO {
	return AuditLogDTO{
		ID:         l.ID,
		Event:      l.Event,
		Payload:    l.Payload,
		ReceivedAt: l.ReceivedAt,
	}
}
