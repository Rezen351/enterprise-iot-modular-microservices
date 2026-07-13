-- =====================================================================
-- TimescaleDB — analytics_ts
-- Time-series rollup store owned by the Analytics Service.
--
-- Module Service publishes `telemetry.batch` (1-min aggregates per
-- node/metric). Analytics consumes those batches and upserts them into
-- `metrics_rollup`, then derives hourly/daily Continuous Aggregates and
-- applies a retention policy. The dashboard reads aggregated series from
-- here through the Analytics REST API (via Kong).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS metrics_rollup (
    time        TIMESTAMPTZ      NOT NULL DEFAULT now(),
    node_id     TEXT             NOT NULL,
    module_id   TEXT,
    metric      TEXT             NOT NULL,
    count       INT              NOT NULL DEFAULT 1,
    sum         DOUBLE PRECISION NOT NULL,
    min         DOUBLE PRECISION NOT NULL,
    max         DOUBLE PRECISION NOT NULL,
    avg         DOUBLE PRECISION NOT NULL,
    last        DOUBLE PRECISION NOT NULL,
    first_ts    BIGINT,
    last_ts     BIGINT
);

-- Convert to hypertable partitioned on time (idempotent).
SELECT create_hypertable('metrics_rollup', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_rollup_node_metric_time
    ON metrics_rollup (node_id, metric, time DESC);
CREATE INDEX IF NOT EXISTS idx_rollup_metric_time
    ON metrics_rollup (metric, time DESC);

-- Unique constraint on (time, node_id, metric) enables idempotent upserts
-- (ON CONFLICT DO UPDATE) when the same batch is delivered more than once.
-- TimescaleDB requires the unique constraint to include the partitioning
-- column (time), which this does. Created as a UNIQUE INDEX (IF NOT EXISTS)
-- so the bootstrap script is safe to re-run (e.g. container restart / upgrade)
-- without aborting on the already-existing constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rollup_time_node_metric
    ON metrics_rollup (time, node_id, metric);

-- ─── Continuous Aggregates ────────────────────────────────────────────
-- Hourly rollup: sum/count for accurate averages, min/max over window,
-- last() to carry the most recent value forward.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    node_id,
    metric,
    sum(count) AS count,
    sum(sum)   AS sum,
    min(min)   AS min,
    max(max)   AS max,
    last(last, time) AS last
FROM metrics_rollup
GROUP BY bucket, node_id, metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_hourly',
    start_offset     => INTERVAL '2 hours',
    end_offset       => INTERVAL '0',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists     => TRUE);

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    node_id,
    metric,
    sum(count) AS count,
    sum(sum)   AS sum,
    min(min)   AS min,
    max(max)   AS max,
    last(last, time) AS last
FROM metrics_rollup
GROUP BY bucket, node_id, metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_daily',
    start_offset     => INTERVAL '2 days',
    end_offset       => INTERVAL '0',
    schedule_interval => INTERVAL '1 day',
    if_not_exists     => TRUE);

-- ─── Compression (tiered, cheap long-term history) ─────────────────────
-- Continuous aggregates store the long-term history. Compressing their
-- materialized chunks keeps 5–10 years of hourly/daily data storage-cheap.
ALTER MATERIALIZED VIEW metrics_hourly SET (timescaledb.compress);
ALTER MATERIALIZED VIEW metrics_daily  SET (timescaledb.compress);

SELECT add_compression_policy('metrics_hourly', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('metrics_daily',  INTERVAL '7 days', if_not_exists => TRUE);

-- ─── Retention (tiered) ─────────────────────────────────────────────────
-- Raw 1-min rollups kept 30 days; continuous aggregates carry the long-term
-- history with *independent* retention windows:
--   • hourly : 1 year  (365 days)  — medium-range drill-down
--   • daily  : 10 years (3650 days) — permanent, research-grade history
-- Raw chunks dropped by the rollup retention policy do NOT remove already
-- materialized aggregate data, so the long history survives independently.
SELECT add_retention_policy('metrics_rollup', INTERVAL '30 days',  if_not_exists => TRUE);
SELECT add_retention_policy('metrics_hourly', INTERVAL '365 days',  if_not_exists => TRUE);
SELECT add_retention_policy('metrics_daily',  INTERVAL '3650 days', if_not_exists => TRUE);
