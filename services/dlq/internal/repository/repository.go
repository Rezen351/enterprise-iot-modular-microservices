package repository

import (
	"context"
	"time"

	"github.com/almuzky/iot/services/dlq/internal/model"
	"gorm.io/gorm"
)

// Store persists DLQ records into the audit database.
type Store struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Store {
	return &Store{db: db}
}

// Insert appends a single DLQ record. Failures are logged by the caller (the
// advisory handler) but never ack the advisory, so a transient DB outage
// redelivers the advisory later.
func (s *Store) Insert(ctx context.Context, m *model.DLQMessage) error {
	return s.db.WithContext(ctx).Create(m).Error
}

// List returns DLQ records ordered by creation time (newest first), filtered
// by optional source_stream / trace_id, paginated.
func (s *Store) List(ctx context.Context, sourceStream, traceID string, limit, offset int) ([]model.DLQMessage, int64, error) {
	q := s.db.WithContext(ctx).Model(&model.DLQMessage{})
	if sourceStream != "" {
		q = q.Where("source_stream = ?", sourceStream)
	}
	if traceID != "" {
		q = q.Where("trace_id = ?", traceID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.DLQMessage
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// CountSince returns the number of DLQ records created after t — used by the
// health/metrics endpoint to surface DLQ pressure.
func (s *Store) CountSince(ctx context.Context, t time.Time) (int64, error) {
	var n int64
	err := s.db.WithContext(ctx).Model(&model.DLQMessage{}).
		Where("created_at >= ?", t).Count(&n).Error
	return n, err
}
