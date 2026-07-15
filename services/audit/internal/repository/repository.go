package repository

import (
	"context"
	"errors"
	"time"

	"github.com/almuzky/iot/services/audit/internal/model"
	"gorm.io/gorm"
)

// Store persists and queries audit logs.
type Store struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Store {
	return &Store{db: db}
}

var ErrNotFound = errors.New("audit log not found")

// List returns audit logs filtered by event (optional) and free-text search
// across the payload (optional), constrained to an optional [from,to] time
// window (zero time means unbounded), paginated by limit/offset.
func (s *Store) List(ctx context.Context, event, search string, from, to time.Time, limit, offset int) ([]model.AuditLog, int64, error) {
	q := s.db.WithContext(ctx).Model(&model.AuditLog{})
	if event != "" {
		q = q.Where("event LIKE ?", event+"%")
	}
	if search != "" {
		q = q.Where("payload LIKE ?", "%"+search+"%")
	}
	if !from.IsZero() {
		q = q.Where("received_at >= ?", from)
	}
	if !to.IsZero() {
		q = q.Where("received_at <= ?", to)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.AuditLog
	if err := q.Order("received_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

// Insert appends a single audit log entry. Failures are non-fatal to the
// subscriber loop (logged by the caller).
func (s *Store) Insert(ctx context.Context, l *model.AuditLog) error {
	return s.db.WithContext(ctx).Create(l).Error
}
