package repository

import (
	"context"
	"errors"

	"github.com/almuzky/iot/services/notification/internal/model"
	"gorm.io/gorm"
)

// Store persists and queries notification settings and delivery logs.
type Store struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Store { return &Store{db: db} }

var ErrNotFound = errors.New("record not found")

// ─── Settings (singleton) ────────────────────────────────────────────────

// GetSettings returns the singleton settings row, creating an empty one in
// memory if it does not yet exist (caller persists via UpsertSettings).
func (s *Store) GetSettings(ctx context.Context) (*model.NotificationSetting, error) {
	var st model.NotificationSetting
	err := s.db.WithContext(ctx).Where("id = ?", model.SettingsID).First(&st).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &model.NotificationSetting{ID: model.SettingsID}, nil
		}
		return nil, err
	}
	return &st, nil
}

// UpsertSettings saves the singleton settings row (insert or update).
func (s *Store) UpsertSettings(ctx context.Context, st *model.NotificationSetting) error {
	st.ID = model.SettingsID
	return s.db.WithContext(ctx).Save(st).Error
}

// ─── Logs ────────────────────────────────────────────────────────────────

// CreateLog inserts a new delivery log row.
func (s *Store) CreateLog(ctx context.Context, l *model.NotificationLog) error {
	return s.db.WithContext(ctx).Create(l).Error
}

// UpdateLog sets the attempts/status/error for a log entry. The error message
// must never contain a secret (the worker enforces this).
func (s *Store) UpdateLog(ctx context.Context, id string, attempts int, status, errMsg string) error {
	return s.db.WithContext(ctx).Model(&model.NotificationLog{}).
		Where("id = ?", id).
		Updates(map[string]any{"attempts": attempts, "status": status, "error": errMsg}).Error
}

// LogFilter holds optional query filters for ListLogs.
type LogFilter struct {
	Channel string
	Status  string
}

// ListLogs returns notification logs filtered by channel/status, newest first.
func (s *Store) ListLogs(ctx context.Context, f LogFilter, limit, offset int) ([]model.NotificationLog, int64, error) {
	q := s.db.WithContext(ctx).Model(&model.NotificationLog{})
	if f.Channel != "" {
		q = q.Where("channel = ?", f.Channel)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.NotificationLog
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
