package model

import "time"

// DLQMessage is the durable record persisted for every message that exceeded
// its source consumer's MaxDeliver and was captured by the DLQ Saga worker.
type DLQMessage struct {
	ID             string    `gorm:"column:id;type:char(36);primaryKey"`
	TraceID        string    `gorm:"column:trace_id;type:varchar(128);index"`
	SourceStream   string    `gorm:"column:source_stream;type:varchar(256);not null;index"`
	SourceConsumer string    `gorm:"column:source_consumer;type:varchar(256);not null;index"`
	StreamSeq      uint64    `gorm:"column:stream_seq;type:bigint unsigned;not null;index"`
	Subject        string    `gorm:"column:subject;type:varchar(256);not null"`
	Reason         string    `gorm:"column:reason;type:varchar(256)"`
	Payload        string    `gorm:"column:payload;type:longtext;not null"`
	Headers        string    `gorm:"column:headers;type:longtext"`
	DLQSeq         uint64    `gorm:"column:dlq_seq;type:bigint unsigned;index"`
	CreatedAt      time.Time `gorm:"column:created_at;autoCreateTime;index"`
}

func (DLQMessage) TableName() string { return "dlq_messages" }
