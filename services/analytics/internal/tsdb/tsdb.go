package tsdb

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store reads/writes aggregated telemetry into the Analytics TimescaleDB.
type Store struct {
	pool *pgxpool.Pool
}

// New connects to TimescaleDB using a libpq DSN.
func New(dsn string) (*Store, error) {
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

// Close releases the connection pool.
func (s *Store) Close() { s.pool.Close() }

// UpsertRollup writes one batch row into metrics_rollup. The time bucket is
// aligned to the minute using the batch's last_ts, and the write is idempotent
// (ON CONFLICT) so redelivered NATS batches do not duplicate data.
func (s *Store) UpsertRollup(ctx context.Context, row model.BatchRow) error {
	// Align the rollup timestamp to the start of the batch minute (UTC).
	bucket := time.UnixMilli(row.LastTS).UTC().Truncate(time.Minute)
	if row.LastTS == 0 {
		bucket = time.Now().UTC().Truncate(time.Minute)
	}
	var moduleID *string
	if row.ModuleID != "" {
		m := row.ModuleID
		moduleID = &m
	}

	_, err := s.pool.Exec(ctx,
		`INSERT INTO metrics_rollup
		   (time, node_id, module_id, metric, count, sum, min, max, avg, last, first_ts, last_ts)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 ON CONFLICT (time, node_id, metric) DO UPDATE SET
		   module_id = EXCLUDED.module_id,
		   count     = EXCLUDED.count,
		   sum       = EXCLUDED.sum,
		   min       = EXCLUDED.min,
		   max       = EXCLUDED.max,
		   avg       = EXCLUDED.avg,
		   last      = EXCLUDED.last,
		   first_ts  = EXCLUDED.first_ts,
		   last_ts   = EXCLUDED.last_ts`,
		bucket, row.NodeID, moduleID, row.Metric, row.Count,
		row.Sum, row.Min, row.Max, row.Avg, row.Last, row.FirstTS, row.LastTS,
	)
	if err != nil {
		log.Printf("[tsdb] upsert rollup failed node=%s metric=%s: %v", row.NodeID, row.Metric, err)
	}
	return err
}

// sourceForInterval picks the materialized view (or raw hypertable) that best
// matches the requested resolution to keep payloads small.
func sourceForInterval(interval string) (table string, agg string) {
	d := parseInterval(interval)
	switch {
	case d <= time.Hour:
		return "metrics_rollup", "avg"
	case d <= 24*time.Hour:
		return "metrics_hourly", "(CASE WHEN sum = 0 THEN 0 ELSE sum / count END)"
	default:
		return "metrics_daily", "(CASE WHEN sum = 0 THEN 0 ELSE sum / count END)"
	}
}

// QuerySeries returns the aggregated time-series for a node/metric over a window.
func (s *Store) QuerySeries(ctx context.Context, nodeID, metric string, from, to time.Time, interval string) (*model.SeriesResponse, error) {
	table, valueExpr := sourceForInterval(interval)
	timeCol := "time"
	if table != "metrics_rollup" {
		timeCol = "bucket"
	}

	q := `SELECT ` + timeCol + `, ` + valueExpr + `
	      FROM ` + table + `
	      WHERE node_id = $1 AND metric = $2 AND ` + timeCol + ` BETWEEN $3 AND $4
	      ORDER BY ` + timeCol
	rows, err := s.pool.Query(ctx, q, nodeID, metric, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pts := make([]model.SeriesPoint, 0)
	for rows.Next() {
		var t time.Time
		var v float64
		if err := rows.Scan(&t, &v); err != nil {
			return nil, err
		}
		pts = append(pts, model.SeriesPoint{T: t.UTC().Format(time.RFC3339), V: v})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &model.SeriesResponse{NodeID: nodeID, Metric: metric, Interval: interval, Points: pts}, nil
}

// QuerySummary returns the statistical summary for a node/metric over a window.
func (s *Store) QuerySummary(ctx context.Context, nodeID, metric string, from, to time.Time) (*model.SummaryResponse, error) {
	var countSum, firstTS, lastTS int64
	var sumSum, mn, mx, lastV float64
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(sum(count),0), COALESCE(sum(sum),0),
		        COALESCE(min(min),0), COALESCE(max(max),0),
		        COALESCE(last(last,time),0),
		        COALESCE(min(first_ts),0), COALESCE(max(last_ts),0)
		 FROM metrics_rollup
		 WHERE node_id = $1 AND metric = $2 AND time BETWEEN $3 AND $4`,
		nodeID, metric, from, to,
	).Scan(&countSum, &sumSum, &mn, &mx, &lastV, &firstTS, &lastTS)
	if err != nil {
		return nil, err
	}
	avg := 0.0
	if countSum > 0 {
		avg = float64(sumSum) / float64(countSum)
	}
	return &model.SummaryResponse{
		NodeID:  nodeID,
		Metric:  metric,
		Count:   int(countSum),
		Min:     float64(mn),
		Max:     float64(mx),
		Avg:     avg,
		Last:    float64(lastV),
		FirstTS: firstTS,
		LastTS:  lastTS,
	}, nil
}

// ListNodes returns every node that has telemetry and the metrics available.
func (s *Store) ListNodes(ctx context.Context) ([]model.NodeMetric, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT node_id, COALESCE(module_id,''),
		        string_agg(DISTINCT metric, ',' ORDER BY metric)
		 FROM metrics_rollup
		 GROUP BY node_id, module_id
		 ORDER BY node_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.NodeMetric, 0)
	for rows.Next() {
		var nodeID, moduleID, metricsCSV string
		if err := rows.Scan(&nodeID, &moduleID, &metricsCSV); err != nil {
			return nil, err
		}
		var metrics []string
		if metricsCSV != "" {
			for _, m := range strings.Split(metricsCSV, ",") {
				if m != "" {
					metrics = append(metrics, m)
				}
			}
		}
		out = append(out, model.NodeMetric{NodeID: nodeID, ModuleID: moduleID, Metrics: metrics})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// WindowForInterval returns the duration covered by an interval label
// (used by the API to default the query window when from/to are omitted).
func WindowForInterval(interval string) time.Duration { return parseInterval(interval) }
func parseInterval(interval string) time.Duration {
	switch strings.ToLower(interval) {
	case "15m", "30m":
		return 30 * time.Minute
	case "1h":
		return time.Hour
	case "6h":
		return 6 * time.Hour
	case "12h":
		return 12 * time.Hour
	case "24h", "1d":
		return 24 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	case "30d":
		return 30 * 24 * time.Hour
	case "90d":
		return 90 * 24 * time.Hour
	default:
		if d, err := time.ParseDuration(interval); err == nil {
			return d
		}
		return time.Hour
	}
}
