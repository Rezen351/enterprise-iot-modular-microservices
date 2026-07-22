package repository

import (
	"context"
	"errors"

	"github.com/almuzky/iot/services/webhook/internal/model"
	"gorm.io/gorm"
)

type Store struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Store { return &Store{db: db} }

func (s *Store) GetSettings(ctx context.Context) (*model.WebhookSetting, error) {
	var st model.WebhookSetting
	err := s.db.WithContext(ctx).Where("id = ?", model.SettingsID).First(&st).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &model.WebhookSetting{ID: model.SettingsID}, nil
		}
		return nil, err
	}
	return &st, nil
}

func (s *Store) UpsertSettings(ctx context.Context, st *model.WebhookSetting) error {
	st.ID = model.SettingsID
	return s.db.WithContext(ctx).Save(st).Error
}

func (s *Store) CreateLog(ctx context.Context, l *model.WebhookLog) error {
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *Store) UpdateLog(ctx context.Context, id string, attempts int, status, errMsg string) error {
	return s.db.WithContext(ctx).Model(&model.WebhookLog{}).
		Where("id = ?", id).
		Updates(map[string]any{"attempts": attempts, "status": status, "error": errMsg}).Error
}

type LogFilter struct {
	Channel string
	Status  string
}

func (s *Store) ListLogs(ctx context.Context, f LogFilter, limit, offset int) ([]model.WebhookLog, int64, error) {
	q := s.db.WithContext(ctx).Model(&model.WebhookLog{})
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
	var logs []model.WebhookLog
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
