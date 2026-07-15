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
