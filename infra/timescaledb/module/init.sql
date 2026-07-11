-- =====================================================================
-- TimescaleDB — module_ts
-- Time-series telemetry store for the Module Service.
--
-- Provisioned & hypertable-ready during the onboarding phase.
-- Telemetry ingest (writes) is wired in the NEXT phase of the Module Service;
-- for now this only guarantees the schema exists so ingest can drop straight in.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS telemetry (
    time        TIMESTAMPTZ      NOT NULL DEFAULT now(),
    node_id     TEXT             NOT NULL,
    module_id   TEXT,
    metric      TEXT             NOT NULL,   -- e.g. "inputs.tank_level", "modbus.ph"
    value       DOUBLE PRECISION,
    raw         JSONB
);

-- Convert to hypertable partitioned on time (idempotent).
SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_telemetry_node_time  ON telemetry (node_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_metric_time ON telemetry (metric, time DESC);

-- Retention: drop raw telemetry older than 30 days (adjust in later phase).
SELECT add_retention_policy('telemetry', INTERVAL '30 days', if_not_exists => TRUE);
