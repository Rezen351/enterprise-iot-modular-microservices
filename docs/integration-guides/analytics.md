# Analytics Service — Integration Guide

> **Service:** Analytics  
> **Version:** 1.0  
> **Status:** Production-ready  
> **Owner:** IoT Microservices Team

---

## 1. Overview

The Analytics Service is responsible for aggregating time-series telemetry data produced by the Module Service. It consumes 1-minute batch aggregates via NATS JetStream, persists them into a dedicated TimescaleDB instance (`timescaledb-analytics`), and exposes a read-only REST API for the Dashboard and downstream consumers.

### Key Characteristics

| Attribute | Value |
|-----------|-------|
| **Purpose** | Time-series rollup, storage, and query API for sensor telemetry |
| **Port** | `8080` (configurable via `PORT`) |
| **Protocol** | REST (HTTP/JSON) + NATS JetStream (consumer) |
| **Database** | TimescaleDB (`analytics_ts`) |
| **Auth** | JWT Bearer token (HS256, shared secret with Auth Service) |
| **Dependencies** | NATS, TimescaleDB |
| **Consumers** | Dashboard (via Kong), Export Service, future Alert/ML services |

### Architecture Position

```
Module Service --(NATS telemetry.batch)--> Analytics Service --(REST /v1)--> Dashboard
                                                       |
                                                       +--(REST /v1)--> Export Service
                                                       |
                                                       +--(future)--> Alert Service
```

---

## 2. REST API Endpoints

All endpoints are prefixed with `/analytics` (Kong strips `/v1`). Public endpoints do not require authentication; all `/analytics/*` endpoints require a valid JWT Bearer token.

### 2.1 Health Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Liveness probe for Kong upstream healthcheck |
| `GET` | `/analytics/health` | None | Duplicate health endpoint |

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### 2.2 Metrics Query

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/metrics` | JWT | Aggregated time-series for one or more nodes/metrics |

**Query Parameters:**

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `node_id` | Yes | `string` (CSV) | Comma-separated node IDs (e.g., `n1,n2`) |
| `metric` | Yes | `string` (CSV) | Comma-separated metric names (e.g., `temp,humidity`) |
| `interval` | No | `string` | Bucket interval: `1h`, `6h`, `12h`, `24h`, `7d`, `30d`, `90d` (default: `1h`) |
| `from` | No | `string` | Start time (RFC3339 or Unix seconds). Default: `now - interval` |
| `to` | No | `string` | End time (RFC3339 or Unix seconds). Default: `now` |
| `discrete` | No | `string` | `true` (all metrics digital) or comma-separated metric names for digital/state metrics |

**Limits:** Maximum query window is 31 days.

**Response:**
```json
{
  "success": true,
  "data": {
    "interval": "1h",
    "series": {
      "node-001": {
        "temperature": [
          {
            "t": "2026-07-21T00:00:00Z",
            "v": 24.5,
            "min": 23.0,
            "max": 26.0,
            "avg": 24.5
          }
        ],
        "humidity": [
          {
            "t": "2026-07-21T00:00:00Z",
            "v": 65.0,
            "min": 60.0,
            "max": 70.0,
            "avg": 65.0
          }
        ]
      }
    }
  }
}
```

**SeriesPoint Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `t` | `string` | Timestamp (RFC3339) |
| `v` | `float64` | Last value in bucket (used for digital/state detection) |
| `min` | `*float64` | Minimum value in bucket (analog metrics) |
| `max` | `float64` | Maximum value in bucket (analog metrics) |
| `avg` | `*float64` | Average value in bucket (analog metrics) |

### 2.3 Summary Statistics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/summary` | JWT | Statistical summary for a single node/metric over a window |

**Query Parameters:**

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `node_id` | Yes | `string` | Node ID |
| `metric` | Yes | `string` | Metric name |
| `from` | No | `string` | Start time (RFC3339 or Unix seconds). Default: `now - 24h` |
| `to` | No | `string` | End time (RFC3339 or Unix seconds). Default: `now` |

**Limits:** Maximum query window is 31 days.

**Response:**
```json
{
  "success": true,
  "data": {
    "node_id": "node-001",
    "metric": "temperature",
    "count": 1440,
    "min": 18.5,
    "max": 32.0,
    "avg": 24.2,
    "last": 25.1,
    "first_ts": 1689907200,
    "last_ts": 1689993600
  }
}
```

### 2.4 List Nodes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/nodes` | JWT | List all nodes with telemetry and their available metrics |

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "node_id": "node-001",
        "module_id": "module-a",
        "metrics": ["temperature", "humidity", "soil_moisture"]
      },
      {
        "node_id": "node-002",
        "module_id": "module-b",
        "metrics": ["temperature", "light_intensity"]
      }
    ]
  }
}
```

### 2.5 CSV Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/export` | JWT | Bulk CSV export of aggregated telemetry for research |

**Query Parameters:**

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `node_id` | Yes | `string` | Node ID |
| `metric` | Yes | `string` | Metric name |
| `resolution` | No | `string` | `raw` (1-min), `hour` (hourly), `day` (daily, default) |
| `from` | No | `string` | Start time (RFC3339 or Unix seconds). Default: `now - 24h` |
| `to` | No | `string` | End time (RFC3339 or Unix seconds). Default: `now` |

**Limits:** Maximum query window is 366 days.

**Response:** `text/csv` with `Content-Disposition: attachment`

```
bucket,node_id,metric,count,sum,min,max,avg,last
2026-07-20T00:00:00Z,node-001,temperature,60,1470.0,22.0,26.0,24.5,25.0
2026-07-20T01:00:00Z,node-001,temperature,60,1476.0,23.0,27.0,24.6,26.0
```

### 2.6 Prometheus Metrics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/metrics` | None | Prometheus metrics exposition |

**Metrics Exposed:**

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `analytics_http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests |
| `analytics_http_request_duration_seconds` | Histogram | `method`, `path` | Request latency distribution |
| `analytics_http_requests_in_flight` | Gauge | — | Current in-flight requests |

---

## 3. Input Contracts (Inbound Events)

The Analytics Service is a **consumer** of the following NATS subject:

### 3.1 `telemetry.batch`

| Property | Value |
|----------|-------|
| **Subject** | `telemetry.batch` |
| **Protocol** | NATS JetStream |
| **Producer** | Module Service |
| **Consumer** | Analytics Service (durable consumer `analytics-batch`, queue group `analytics`) |
| **Stream** | `TELEMETRY_BATCH` |
| **Retention** | 24 hours, max 1,000,000 messages |
| **Delivery** | At-least-once (manual ack, redeliver on failure) |

**Message Format:**

```json
{
  "window": "2026-07-21T00:00:00Z",
  "row_count": 2,
  "ts": 1689907200000,
  "rows": [
    {
      "node_id": "node-001",
      "module_id": "module-a",
      "metric": "temperature",
      "count": 60,
      "sum": 1470.0,
      "min": 22.0,
      "max": 26.0,
      "avg": 24.5,
      "last": 25.0,
      "first_ts": 1689903900000,
      "last_ts": 1689907500000
    },
    {
      "node_id": "node-001",
      "module_id": "module-a",
      "metric": "humidity",
      "count": 60,
      "sum": 3900.0,
      "min": 60.0,
      "max": 70.0,
      "avg": 65.0,
      "last": 66.0,
      "first_ts": 1689903900000,
      "last_ts": 1689907500000
    }
  ]
}
```

**BatchRow Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `node_id` | `string` | Unique node identifier |
| `module_id` | `string` | Module/device group identifier |
| `metric` | `string` | Metric name (e.g., `temperature`, `humidity`) |
| `count` | `int` | Number of raw samples in this batch |
| `sum` | `float64` | Sum of all raw values |
| `min` | `float64` | Minimum raw value |
| `max` | `float64` | Maximum raw value |
| `avg` | `float64` | Average of raw values |
| `last` | `float64` | Last (most recent) raw value |
| `first_ts` | `int64` | Unix millis of first sample |
| `last_ts` | `int64` | Unix millis of last sample |

**Processing Guarantees:**
- Durable consumer with `DeliverAll()` — replays missed windows on restart
- Manual ack — message is acked only after successful upsert
- Idempotent upsert via `ON CONFLICT (time, node_id, metric) DO UPDATE`
- Partial failure tolerance — one bad row does not drop the entire batch

---

## 4. Output Contracts (Outbound Data)

The Analytics Service exposes data via the following channels:

### 4.1 REST API Responses

All REST responses follow the standard envelope (AGENTS.md §4.4):

**Success (2xx):**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error (4xx/5xx):**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "node_id and metric are required"
  }
}
```

### 4.2 Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid query parameters or time range |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | Valid token but insufficient permissions |
| `NOT_FOUND` | 404 | No data found for requested node/metric |
| `CONFLICT` | 409 | Data conflict (rare) |
| `INTERNAL_ERROR` | 500 | Database or internal service error |

### 4.3 Data Provided to Other Services

| Consumer | How | What |
|----------|-----|------|
| Dashboard | REST via Kong | Time-series, summaries, node lists, CSV export |
| Export Service | REST via Kong | CSV export of long-term history |
| Alert Service (future) | NATS or REST | Summary statistics for threshold evaluation |
| ML/Vision API (future) | REST via Kong | Historical telemetry for model training/inference |

---

## 5. Integration Steps

### 5.1 For New Frontend/Dashboard Clients

1. **Obtain JWT Token:**
   ```bash
   curl -X POST https://api.example.com/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"user","password":"pass"}'
   ```

2. **Query Metrics:**
   ```bash
   curl -X GET "https://api.example.com/v1/analytics/metrics?node_id=node-001&metric=temperature&interval=1h" \
     -H "Authorization: Bearer <token>"
   ```

3. **Query Summary:**
   ```bash
   curl -X GET "https://api.example.com/v1/analytics/summary?node_id=node-001&metric=temperature&from=2026-07-20T00:00:00Z&to=2026-07-21T00:00:00Z" \
     -H "Authorization: Bearer <token>"
   ```

4. **List Available Nodes:**
   ```bash
   curl -X GET "https://api.example.com/v1/analytics/nodes" \
     -H "Authorization: Bearer <token>"
   ```

5. **Export CSV:**
   ```bash
   curl -X GET "https://api.example.com/v1/analytics/export?node_id=node-001&metric=temperature&resolution=day&from=2026-06-01T00:00:00Z&to=2026-07-01T00:00:00Z" \
     -H "Authorization: Bearer <token>" \
     -o telemetry.csv
   ```

### 5.2 For New Microservices Producing Telemetry

If a new service needs to produce telemetry data that should be available in Analytics:

1. **Publish to NATS Subject:** Publish batch messages to `telemetry.batch` using the `BatchMessage` format described in Section 3.1.
2. **Use JetStream:** Ensure the producer uses JetStream persistence so Analytics can replay missed windows.
3. **Batch Format:** Follow the `BatchRow` schema — each row represents 1-minute aggregates for a single `(node_id, metric)` pair.

### 5.3 For New Microservices Consuming Analytics Data

If a new service needs to consume aggregated telemetry:

1. **REST API:** Call the Analytics REST endpoints via Kong with a valid JWT.
2. **Direct NATS (advanced):** For real-time push, subscribe to the original `mqtt.>` subjects via WS-Gateway, or implement a new NATS consumer that reacts to Analytics' output patterns.
3. **Database Isolation:** Do NOT query `timescaledb-analytics` directly. Always go through the Analytics REST API.

---

## 6. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | HTTP listen port |
| `TIMESCALE_DSN` | Yes | `postgres://analytics_user:analytics_pass@timescaledb-analytics:5432/analytics_ts?sslmode=disable` | TimescaleDB connection string (libpq format) |
| `NATS_URL` | Yes | `nats://nats:4222` | NATS server URL |
| `JWT_SECRET` | Yes (prod) | `""` (dev bypass) | HMAC secret for JWT validation (shared with Auth Service) |

**Example `.env` configuration:**
```env
PORT=8080
TIMESCALE_DSN=postgres://analytics_user:securepass@timescaledb-analytics:5432/analytics_ts?sslmode=disable
NATS_URL=nats://nats:4222
JWT_SECRET=your-shared-jwt-secret-here
```

---

## 7. Database Schema Overview

The Analytics Service owns the `analytics_ts` database on `timescaledb-analytics`. Schema is initialized from `infra/timescaledb/analytics/init.sql`.

### 7.1 Tables and Views

#### `metrics_rollup` (Hypertable)

The primary time-series table storing 1-minute aggregated telemetry.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `time` | `TIMESTAMPTZ` | NOT NULL | Bucket timestamp (aligned to minute) |
| `node_id` | `TEXT` | NOT NULL | Node identifier |
| `module_id` | `TEXT` | NULLABLE | Module/device group identifier |
| `metric` | `TEXT` | NOT NULL | Metric name |
| `count` | `INT` | NOT NULL DEFAULT 1 | Number of raw samples |
| `sum` | `DOUBLE PRECISION` | NOT NULL | Sum of raw values |
| `min` | `DOUBLE PRECISION` | NOT NULL | Minimum raw value |
| `max` | `DOUBLE PRECISION` | NOT NULL | Maximum raw value |
| `avg` | `DOUBLE PRECISION` | NOT NULL | Average of raw values |
| `last` | `DOUBLE PRECISION` | NOT NULL | Last (most recent) value |
| `first_ts` | `BIGINT` | NULLABLE | Unix millis of first sample in batch |
| `last_ts` | `BIGINT` | NULLABLE | Unix millis of last sample in batch |

**Constraints:**
- `UNIQUE (time, node_id, metric)` — enables idempotent upserts
- Partitioned by `time` (TimescaleDB hypertable)
- Indexes: `(node_id, metric, time DESC)`, `(metric, time DESC)`

**Retention:** 30 days of raw 1-minute rollups.

#### `metrics_hourly` (Continuous Aggregate)

Hourly rollup derived from `metrics_rollup`.

| Column | Type | Description |
|--------|------|-------------|
| `bucket` | `TIMESTAMPTZ` | Hour bucket start |
| `node_id` | `TEXT` | Node identifier |
| `metric` | `TEXT` | Metric name |
| `count` | `INT` | Sum of sample counts |
| `sum` | `DOUBLE PRECISION` | Sum of sums |
| `min` | `DOUBLE PRECISION` | Minimum across hour |
| `max` | `DOUBLE PRECISION` | Maximum across hour |
| `last` | `DOUBLE PRECISION` | Last value in hour |

**Refresh Policy:** Every 1 hour, looking back 2 hours.  
**Retention:** 365 days (1 year).  
**Compression:** Enabled after 7 days.

#### `metrics_daily` (Continuous Aggregate)

Daily rollup derived from `metrics_rollup`.

| Column | Type | Description |
|--------|------|-------------|
| `bucket` | `TIMESTAMPTZ` | Day bucket start |
| `node_id` | `TEXT` | Node identifier |
| `metric` | `TEXT` | Metric name |
| `count` | `INT` | Sum of sample counts |
| `sum` | `DOUBLE PRECISION` | Sum of sums |
| `min` | `DOUBLE PRECISION` | Minimum across day |
| `max` | `DOUBLE PRECISION` | Maximum across day |
| `last` | `DOUBLE PRECISION` | Last value in day |

**Refresh Policy:** Every 1 day, looking back 2 days.  
**Retention:** 3650 days (10 years).  
**Compression:** Enabled after 7 days.

### 7.2 Data Flow

```
telemetry.batch (NATS)
        |
        v
  [Analytics Service]
        |
        +---> metrics_rollup (1-min raw, 30-day retention)
        |         |
        |         +---> metrics_hourly (continuous agg, 1-year retention)
        |         |
        |         +---> metrics_daily (continuous agg, 10-year retention)
        |
        +---> REST API (queries appropriate view based on window)
```

### 7.3 Query Resolution Logic

The service automatically selects the appropriate data source based on the query window:

| Query Window | Source Table | Notes |
|--------------|--------------|-------|
| <= 24 hours | `metrics_rollup` | Raw 1-minute resolution |
| > 24 hours, <= 7 days | `metrics_hourly` | Hourly continuous aggregate |
| > 7 days | `metrics_daily` | Daily continuous aggregate |

For digital/state metrics (`discrete=true`), the service uses `time_bucket` with adaptive resolution:
- <= 24h: 1-minute buckets
- <= 7d: 15-minute buckets
- <= 30d: 1-hour buckets
- > 30d: 3-hour buckets

---

## 8. Example curl Commands

### 8.1 Health Check
```bash
curl -s http://localhost:8080/health | jq
```

### 8.2 Query Metrics (with JWT)
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -s -X GET "http://localhost:8080/v1/analytics/metrics?node_id=node-001&metric=temperature&interval=1h&from=2026-07-20T00:00:00Z&to=2026-07-21T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8.3 Query Multiple Nodes and Metrics (batched)
```bash
curl -s -X GET "http://localhost:8080/v1/analytics/metrics?node_id=node-001,node-002&metric=temperature,humidity&interval=6h" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8.4 Query Summary Statistics
```bash
curl -s -X GET "http://localhost:8080/v1/analytics/summary?node_id=node-001&metric=temperature&from=2026-07-01T00:00:00Z&to=2026-07-21T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8.5 List All Nodes with Telemetry
```bash
curl -s -X GET "http://localhost:8080/v1/analytics/nodes" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8.6 Export CSV (Daily Resolution)
```bash
curl -s -X GET "http://localhost:8080/v1/analytics/export?node_id=node-001&metric=temperature&resolution=day&from=2026-06-01T00:00:00Z&to=2026-07-01T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  -o telemetry_export.csv

head -5 telemetry_export.csv
```

### 8.7 Prometheus Metrics
```bash
curl -s http://localhost:8080/metrics | grep "^analytics_"
```

### 8.8 Direct NATS Test (Module Service Simulation)

For testing the NATS consumer without running the full Module Service:

```bash
# Install nats CLI
nats pub telemetry.batch '{
  "window": "2026-07-21T00:00:00Z",
  "row_count": 1,
  "ts": 1689907200000,
  "rows": [
    {
      "node_id": "test-node",
      "module_id": "test-module",
      "metric": "temperature",
      "count": 60,
      "sum": 1470.0,
      "min": 22.0,
      "max": 26.0,
      "avg": 24.5,
      "last": 25.0,
      "first_ts": 1689903900000,
      "last_ts": 1689907500000
    }
  ]
}'
```

---

## 9. Notes for Integrators

1. **JWT Secret:** The `JWT_SECRET` must be identical to the Auth Service's secret. Tokens are validated locally using HS256 — no call to Auth Service is required.

2. **Rate Limiting:** The `/analytics/metrics` endpoint supports batched queries (multiple nodes and metrics in one request) to stay within Kong's rate limits. Use comma-separated `node_id` and `metric` parameters.

3. **Time Format:** The `from` and `to` parameters accept RFC3339 strings or Unix seconds (as strings). Examples: `2026-07-21T00:00:00Z` or `1689907200`.

4. **Digital/State Metrics:** For binary metrics (e.g., pump on/off, LED state), pass `discrete=true` or a comma-separated list of metric names. This preserves exact 0/1 values instead of averaging them.

5. **Graceful Degradation:** If a node/metric has no data in the requested window, the service progressively widens the search (6x, 24x, 7d, 30d) to return the most recent available data instead of an empty chart.

6. **Prometheus Scraping:** The `/metrics` endpoint is unauthenticated and intended for Prometheus scraping. It exposes service-level HTTP metrics only — database metrics are scraped separately via `postgres-exporter-all`.

7. **Kong Routing:** All external traffic goes through Kong. The Analytics Service should not be exposed directly. Kong validates JWT and forwards to the Analytics upstream.

---

## 10. Related Documentation

- [planning.md](file:///home/almuzky/TA/Microservices/docs/planning.md) — System architecture and bounded contexts
- [adr.md](file:///home/almuzky/TA/Microservices/docs/adr.md) — Architecture Decision Records
- [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md) — Backend API testing checklist
- [runbook.md](file:///home/almuzky/TA/Microservices/docs/runbook.md) — Operational runbook and troubleshooting
