package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/almuzky/iot/services/alert/internal/model"
	"github.com/redis/go-redis/v9"
)

// AlertCache caches resolved thresholds and tracks currently-active alerts so
// the subscriber does not re-fire an alert on every telemetry reading.
type AlertCache struct {
	rdb *redis.Client
}

func New(addr, password string, db int) *AlertCache {
	return &AlertCache{
		rdb: redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}),
	}
}

func (c *AlertCache) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func (c *AlertCache) Close() error {
	return c.rdb.Close()
}

const (
	thresholdCacheTTL = 60 * time.Second
	activeCacheTTL    = 24 * time.Hour
)

func thresholdKey(nodeID, metric string) string {
	return "threshold:" + nodeID + ":" + metric
}

func activeKey(nodeID, metric string) string {
	return "alert:active:" + nodeID + ":" + metric
}

// GetCachedThreshold returns a cached threshold for (node, metric), or nil.
func (c *AlertCache) GetCachedThreshold(ctx context.Context, nodeID, metric string) *model.Threshold {
	b, err := c.rdb.Get(ctx, thresholdKey(nodeID, metric)).Bytes()
	if err != nil || len(b) == 0 {
		return nil
	}
	var t model.Threshold
	if err := json.Unmarshal(b, &t); err != nil {
		return nil
	}
	return &t
}

// SetCachedThreshold stores a resolved threshold for (node, metric).
func (c *AlertCache) SetCachedThreshold(ctx context.Context, nodeID, metric string, t *model.Threshold) {
	if t == nil {
		return
	}
	b, err := json.Marshal(t)
	if err != nil {
		return
	}
	_ = c.rdb.Set(ctx, thresholdKey(nodeID, metric), b, thresholdCacheTTL).Err()
}

// ClearThreshold removes any cached threshold for (node, metric) AND the
// wildcard form for that metric (since a change may affect either).
func (c *AlertCache) ClearThreshold(ctx context.Context, nodeID, metric string) {
	_ = c.rdb.Del(ctx, thresholdKey(nodeID, metric)).Err()
	_ = c.rdb.Del(ctx, thresholdKey("*", metric)).Err()
}

// ActiveExists reports whether an alert is currently active for (node, metric).
func (c *AlertCache) ActiveExists(ctx context.Context, nodeID, metric string) bool {
	n, err := c.rdb.Exists(ctx, activeKey(nodeID, metric)).Result()
	return err == nil && n > 0
}

// SetActive marks an alert as active for (node, metric) to dedup re-fires.
func (c *AlertCache) SetActive(ctx context.Context, nodeID, metric string) {
	_ = c.rdb.Set(ctx, activeKey(nodeID, metric), "1", activeCacheTTL).Err()
}

// ClearActive removes the active marker for (node, metric) on resolution.
func (c *AlertCache) ClearActive(ctx context.Context, nodeID, metric string) {
	_ = c.rdb.Del(ctx, activeKey(nodeID, metric)).Err()
}
