package repository

import (
	"context"
	"errors"
	"time"

	"github.com/almuzky/iot/services/alert/internal/model"
	"gorm.io/gorm"
)

// Store persists and queries alert + threshold data.
type Store struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Store {
	return &Store{db: db}
}

var (
	ErrNotFound = errors.New("record not found")
)

// ─── Alerts ────────────────────────────────────────────────────────────────

// ListAlerts returns alerts filtered by node/metric/status/severity and an
// optional time window, paginated by limit/offset (most recent first).
func (s *Store) ListAlerts(ctx context.Context, f AlertFilter, limit, offset int) ([]model.Alert, int64, error) {
	q := s.db.WithContext(ctx).Model(&model.Alert{})
	if f.NodeID != "" {
		q = q.Where("node_id = ?", f.NodeID)
	}
	if f.Metric != "" {
		q = q.Where("metric = ?", f.Metric)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Severity != "" {
		q = q.Where("severity = ?", f.Severity)
	}
	if !f.From.IsZero() {
		q = q.Where("triggered_at >= ?", f.From)
	}
	if !f.To.IsZero() {
		q = q.Where("triggered_at <= ?", f.To)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var alerts []model.Alert
	if err := q.Order("triggered_at DESC").Limit(limit).Offset(offset).Find(&alerts).Error; err != nil {
		return nil, 0, err
	}
	return alerts, total, nil
}

// AlertFilter holds the optional query filters for ListAlerts.
type AlertFilter struct {
	NodeID   string
	Metric   string
	Status   string
	Severity string
	From     time.Time
	To       time.Time
}

// GetAlert fetches a single alert by id.
func (s *Store) GetAlert(ctx context.Context, id string) (*model.Alert, error) {
	var a model.Alert
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&a).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

// CreateAlert inserts a new alert record.
func (s *Store) CreateAlert(ctx context.Context, a *model.Alert) error {
	return s.db.WithContext(ctx).Create(a).Error
}

// ResolveActive marks the latest active alert for a (node, metric) as resolved.
func (s *Store) ResolveActive(ctx context.Context, nodeID, metric string, resolvedAt time.Time) error {
	return s.db.WithContext(ctx).
		Model(&model.Alert{}).
		Where("node_id = ? AND metric = ? AND status = ?", nodeID, metric, "active").
		Updates(map[string]any{"status": "resolved", "resolved_at": resolvedAt}).Error
}

// GetLatestActive returns the most recent active alert for a (node, metric).
func (s *Store) GetLatestActive(ctx context.Context, nodeID, metric string) (*model.Alert, error) {
	var a model.Alert
	err := s.db.WithContext(ctx).
		Where("node_id = ? AND metric = ? AND status = ?", nodeID, metric, "active").
		Order("triggered_at DESC").First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

// AckAlert marks an alert as acknowledged by the given user.
func (s *Store) AckAlert(ctx context.Context, id, userID string, ackedAt time.Time) (*model.Alert, error) {
	res := s.db.WithContext(ctx).
		Model(&model.Alert{}).
		Where("id = ?", id).
		Updates(map[string]any{"status": "acked", "acked_by": userID, "acked_at": ackedAt})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrNotFound
	}
	return s.GetAlert(ctx, id)
}

// ─── Thresholds ───────────────────────────────────────────────────────────

// GetThresholdForNodeMetric resolves the threshold for a (node, metric) pair,
// falling back to a wildcard (node_id="*") threshold for the same metric.
func (s *Store) GetThresholdForNodeMetric(ctx context.Context, nodeID, metric string) (*model.Threshold, error) {
	var t model.Threshold
	err := s.db.WithContext(ctx).Where("node_id = ? AND metric = ?", nodeID, metric).First(&t).Error
	if err == nil {
		return &t, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	// Fall back to wildcard threshold for this metric.
	err = s.db.WithContext(ctx).Where("node_id = ? AND metric = ?", "*", metric).First(&t).Error
	if err == nil {
		return &t, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return nil, err
}

// ListThresholds returns thresholds filtered by node/metric (optional).
func (s *Store) ListThresholds(ctx context.Context, nodeID, metric string, enabledOnly bool) ([]model.Threshold, error) {
	q := s.db.WithContext(ctx).Model(&model.Threshold{})
	if nodeID != "" {
		q = q.Where("node_id = ?", nodeID)
	}
	if metric != "" {
		q = q.Where("metric = ?", metric)
	}
	if enabledOnly {
		q = q.Where("enabled = ?", true)
	}
	var ts []model.Threshold
	if err := q.Order("node_id, metric").Find(&ts).Error; err != nil {
		return nil, err
	}
	return ts, nil
}

// GetThreshold fetches a threshold by id.
func (s *Store) GetThreshold(ctx context.Context, id string) (*model.Threshold, error) {
	var t model.Threshold
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

// CreateThreshold inserts a new threshold.
func (s *Store) CreateThreshold(ctx context.Context, t *model.Threshold) error {
	return s.db.WithContext(ctx).Create(t).Error
}

// UpdateThreshold applies the mutable fields of a threshold (partial update).
func (s *Store) UpdateThreshold(ctx context.Context, id string, patch map[string]any) (*model.Threshold, error) {
	res := s.db.WithContext(ctx).Model(&model.Threshold{}).Where("id = ?", id).Updates(patch)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrNotFound
	}
	return s.GetThreshold(ctx, id)
}

// DeleteThreshold removes a threshold by id (returns the deleted row for cache eviction).
func (s *Store) DeleteThreshold(ctx context.Context, id string) (*model.Threshold, error) {
	t, err := s.GetThreshold(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Delete(&model.Threshold{}, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return t, nil
}
