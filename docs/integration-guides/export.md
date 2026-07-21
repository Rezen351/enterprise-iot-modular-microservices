# Export Service — Integration Guide

> **Module:** `services/export/`  
> **Language:** Go 1.25  
> **Port:** `8080`  
> **Protocol:** REST (HTTP)  
> **Status:** ✅ Running

---

## 1. Overview

The Export Service provides **historical telemetry export** from the IoT monitoring system. It reads raw sensor telemetry stored in the Module Service's TimescaleDB hypertable (`module_ts.telemetry`) and streams it to clients as **CSV files** with cursor-based pagination.

### Purpose

- Allow the dashboard, analytics tools, or Python research pipelines to extract large volumes of time-series telemetry without overloading the primary Module Service.
- Provide a stable, rate-limited, read-only interface to time-series data.
- Enforce RBAC so only `admin` and `operator` roles can export data.

### Key Characteristics

| Characteristic | Detail |
|---|---|
| Access mode | **Read-only** against TimescaleDB (`module_ts`) |
| Supported formats | **CSV** (streamed attachment) |
| Pagination | **Keyset cursor** `(time, node_id, metric)` — stable under concurrent inserts |
| Row cap | 5,000,000 rows per file response; additional pages fetched via cursor |
| Window limit | Maximum 366-day span per request (DoS guard) |
| NATS | None — this service is REST-only |
| MinIO / Object storage | None |

### Dependencies

| Dependency | Purpose | Direction |
|---|---|---|
| **TimescaleDB** (`timescaledb-module`, database `module_ts`) | Source telemetry store | Inbound read |
| **Redis** (`redis-shared`, logical DB 3) | Query cache (optional, currently unused for correctness) | Inbound read |
| **Auth Service** | JWT validation (shared secret) | Outbound call (embedded verification) |
| **Kong API Gateway** | Single entry point for all external traffic | Inbound proxy |

---

## 2. REST API Endpoints

All `/export/v1/*` routes require **JWT authentication** and **RBAC** (`admin` or `operator` roles). The `/health` and `/metrics` endpoints are public.

### 2.1 `GET /health`

Liveness probe for Kong upstream health checks.

**Auth:** None (public)

**Response:** `200 OK`

```json
{ "status": "ok" }
```

---

### 2.2 `GET /export/v1/telemetry`

Streams a paginated CSV export of raw telemetry rows.

**Auth:** JWT Bearer token + role `admin` or `operator`

**Query Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `node_id` | Yes | Comma-separated node IDs (e.g. `node_1,node_2`) |
| `metric` | Yes | Comma-separated metric names (e.g. `temperature,humidity`) |
| `from` | No | Start time — RFC3339 or unix seconds (default: 24 hours ago) |
| `to` | No | End time — RFC3339 or unix seconds (default: now) |
| `limit` | No | Rows per page (default 10,000; hard cap 100,000) |
| `cursor` | No | Opaque base64 keyset cursor from `X-Export-Next-Cursor` header |

**Response Headers:**

| Header | Description |
|---|---|
| `Content-Type` | `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename=telemetry_{nodes}_{metrics}_{from}_{to}.csv` |
| `X-Export-Next-Cursor` | Present only if more pages exist; pass as `?cursor=` on next request |

**Response Body (CSV):**

```
time,node_id,module_id,metric,value
2026-07-20T10:00:00Z,node_1,mod_1,temperature,28.5
2026-07-20T10:00:00Z,node_1,mod_1,humidity,65.2
...
```

**Error Codes:**

| Status | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Missing `node_id`/`metric`, invalid time format, or window > 366 days |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but role is not `admin` or `operator` |
| 500 | `INTERNAL_ERROR` | TimescaleDB query failure |

---

### 2.3 `GET /export/v1/meta`

Returns metadata for an export window without streaming a file. Useful for the dashboard to preview row counts and determine whether to trigger a download.

**Auth:** JWT Bearer token + role `admin` or `operator`

**Query Parameters:** Same as `/export/v1/telemetry` (`node_id`, `metric`, `from`, `to`).

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "node_ids": ["node_1", "node_2"],
    "metrics": ["temperature", "humidity"],
    "from": "2026-07-19T12:00:00Z",
    "to": "2026-07-20T12:00:00Z",
    "total": 14832
  }
}
```

---

### 2.4 `GET /export/v1/nodes`

Lists all nodes that have telemetry data and their available metrics. Used for discovery / dropdown population in the dashboard.

**Auth:** JWT Bearer token + role `admin` or `operator`

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "node_id": "node_1",
        "module_id": "mod_1",
        "metrics": ["temperature", "humidity", "light"]
      },
      {
        "node_id": "node_2",
        "module_id": "mod_2",
        "metrics": ["temperature", "soil_moisture"]
      }
    ]
  }
}
```

---

### 2.5 `GET /export/v1/openapi`

Returns the embedded OpenAPI 3.0.3 specification for the Export Service as JSON.

**Auth:** JWT Bearer token + role `admin` or `operator`

**Response:** `200 OK` with `Content-Type: application/json`

---

### 2.6 `GET /metrics`

Prometheus metrics exposition endpoint.

**Auth:** None (public — scraped by Prometheus)

**Metrics produced:**

| Metric | Type | Labels |
|---|---|---|
| `export_http_requests_total` | Counter | `method`, `path`, `status` |
| `export_http_request_duration_seconds` | Histogram | `method`, `path` |
| `export_http_requests_in_flight` | Gauge | — |

---

## 3. Input Contracts

This service receives export requests from the Dashboard (React) or external tools via Kong. There are no inbound NATS events.

### 3.1 Export Request (Telemetry Query)

**Source:** Dashboard "Export" button or external tool  
**Delivery:** REST `GET /export/v1/telemetry?node_id=&metric=&from=&to=&limit=&cursor=`

**Contract:**

```json
{
  "node_id": "node_1,node_2",
  "metric": "temperature,humidity",
  "from": "2026-07-19T00:00:00Z",
  "to": "2026-07-20T00:00:00Z",
  "limit": 10000,
  "cursor": "eyJ0IjogIjIwMjYtMDctMjBUMjA6MDA6MDAu... (base64)"
}
```

All parameters are query-string values; there is no JSON request body for this endpoint.

### 3.2 Metadata Preview Request

**Source:** Dashboard "Export" preview pane  
**Delivery:** REST `GET /export/v1/meta?node_id=&metric=&from=&to=`

Same parameters as the telemetry query. The service returns total row count only.

### 3.3 Node Discovery Request

**Source:** Dashboard "Export" page load (populate node/metric dropdowns)  
**Delivery:** REST `GET /export/v1/nodes`

No parameters. Returns the full list of nodes and their available metrics.

---

## 4. Output Contracts

### 4.1 CSV Export File

**Consumer:** Dashboard download handler, browser, Python `pandas.read_csv()`, external analytics tools

**Format:** UTF-8 CSV with header row

```
time,node_id,module_id,metric,value
2026-07-20T10:00:00Z,node_1,mod_1,temperature,28.5
2026-07-20T10:00:00Z,node_1,,humidity,65.2
```

**Notes:**

- `time` is RFC3339 UTC.
- `module_id` is nullable; omitted values appear as empty strings in CSV.
- `value` is a float; formatting uses `strconv.FormatFloat` with `'f', -1, 64` (no trailing zeros).

### 4.2 Pagination Cursor

When a response has more rows than the single-file cap (5,000,000) or the requested `limit`, the response includes:

```
X-Export-Next-Cursor: eyJ0IjogIjIwMjYtMDctMjBUMjA6MDA6MDAu...
```

**Consumer action:** Pass this value as `?cursor=` in the next request to continue from where the previous page ended.

**Cursor encoding:** Base64 URL-safe encoding of JSON `{ "t": "<RFC3339>", "n": "<node_id>", "m": "<metric>" }`.

### 4.3 JSON Metadata Response

```json
{
  "success": true,
  "data": {
    "node_ids": ["node_1"],
    "metrics": ["temperature"],
    "from": "2026-07-19T00:00:00Z",
    "to": "2026-07-20T00:00:00Z",
    "total": 8640
  }
}
```

---

## 5. Integration Steps

### 5.1 From the Dashboard (Frontend)

1. **Discover available nodes and metrics**  
   Call `GET /export/v1/nodes` with the user's JWT. Use the response to populate dropdown selectors.

2. **Preview row count**  
   Call `GET /export/v1/meta?node_id=&metric=&from=&to=`. If `total` exceeds a reasonable threshold (e.g. 100,000 rows), warn the user before download.

3. **Trigger CSV download**  
   Call `GET /export/v1/telemetry?node_id=&metric=&from=&to=&limit=100000`.  
   The response has `Content-Disposition: attachment` — the browser will prompt a file save.

4. **Handle pagination**  
   Check for the `X-Export-Next-Cursor` response header. If present, issue a follow-up request with `?cursor=<value>` to fetch the next page. Repeat until the header is absent.

### 5.2 From an External Python / Research Tool

```python
import requests

TOKEN = "eyJhbGciOiJIUzI1NiIs..."
BASE_URL = "http://localhost:8000/export/v1"

headers = {"Authorization": f"Bearer {TOKEN}"}

# Step 1: List available nodes
resp = requests.get(f"{BASE_URL}/nodes", headers=headers)
nodes = resp.json()["data"]["nodes"]

# Step 2: Export telemetry for a node
params = {
    "node_id": "node_1",
    "metric": "temperature",
    "from": "2026-07-01T00:00:00Z",
    "to": "2026-07-20T00:00:00Z",
    "limit": 100000,
}
resp = requests.get(f"{BASE_URL}/telemetry", headers=headers, params=params)

with open("telemetry.csv", "wb") as f:
    f.write(resp.content)

# Step 3: Paginate if needed
while "X-Export-Next-Cursor" in resp.headers:
    params["cursor"] = resp.headers["X-Export-Next-Cursor"]
    resp = requests.get(f"{BASE_URL}/telemetry", headers=headers, params=params)
    with open("telemetry.csv", "ab") as f:
        f.write(b"\n")  # separator between pages if needed
        f.write(resp.content)
```

### 5.3 From Another Microservice

The Export Service is **REST-only** and does not consume NATS events. If another internal service needs to trigger or coordinate an export:

1. Make an HTTP call to the Export Service (via Kong or direct) using the standard JWT.
2. The Export Service reads directly from TimescaleDB (`module_ts`) — there is no export event published to NATS.
3. If you need to notify other services that an export is complete, publish an event to NATS from your calling service after receiving the CSV response.

---

## 6. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `TIMESCALE_DSN` | `postgres://app:app1234@timescaledb-module:5432/module_ts?sslmode=disable` | TimescaleDB connection string (Module Service's `module_ts` database) |
| `REDIS_ADDR` | `redis-shared:6379` | Redis shared instance address |
| `REDIS_PASSWORD` | `""` | Redis password |
| `REDIS_DB` | `3` | Redis logical database number (Export owns DB 3 per ADR-004) |
| `JWT_SECRET` | `""` | Shared HMAC secret for validating Auth Service JWT tokens. Empty = dev mode (skip validation). |

> **Security note:** In production, `JWT_SECRET` must match the secret configured in the Auth Service and Kong. Leave it empty only in isolated development environments.

---

## 7. Database Schema Overview

The Export Service has **read-only** access to the Module Service's TimescaleDB database (`module_ts`).

### 7.1 Table: `telemetry` (hypertable)

This is the hypertable managed by the Module Service. The Export Service queries only public columns.

```sql
-- Conceptual schema (managed by Module Service migrations)
CREATE TABLE telemetry (
    time        TIMESTAMPTZ       NOT NULL,
    node_id     TEXT              NOT NULL,
    module_id   TEXT,
    metric      TEXT              NOT NULL,
    value       DOUBLE PRECISION  NOT NULL,
    raw         JSONB             -- internal; NOT selected by Export Service
);
SELECT create_hypertable('telemetry', 'time');
```

### 7.2 Columns Selected by Export Service

| Column | Type | Nullable | Description |
|---|---|---|---|
| `time` | `TIMESTAMPTZ` | No | Timestamp of the reading |
| `node_id` | `TEXT` | No | Device / sensor node identifier |
| `module_id` | `TEXT` | Yes | Logical module grouping (nullable) |
| `metric` | `TEXT` | No | Metric name (e.g. `temperature`) |
| `value` | `DOUBLE PRECISION` | No | Numeric sensor value |

**Explicitly excluded:** `raw` (JSONB) — the internal sensor payload is never leaked through the export API.

### 7.3 Indexes Used

The Module Service's migrations create indexes optimized for the query patterns used by the Export Service. The keyset pagination query benefits from a composite index on `(time, node_id, metric)`.

### 7.4 Access Model

| Principle | Implementation |
|---|---|
| Database isolation | Export reads `module_ts` owned by Module Service (exception per planning) |
| Read-only | Export Service connection has no write permissions on `module_ts` |
| No cross-service queries | Export does not join or query any other service's tables |
| Input validation | `node_id` and `metric` values are validated against a strict allow-list (`[a-zA-Z0-9_.-:]`) before being used in queries |

---

## 8. Example curl Commands

### 8.1 List available nodes and metrics

```bash
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8000/export/v1/nodes | jq .
```

### 8.2 Preview export row count

```bash
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/export/v1/meta?node_id=node_1&metric=temperature&from=2026-07-01T00:00:00Z&to=2026-07-20T00:00:00Z" | jq .
```

### 8.3 Export CSV (first page)

```bash
curl -s -L -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/export/v1/telemetry?node_id=node_1&metric=temperature&from=2026-07-01T00:00:00Z&to=2026-07-20T00:00:00Z&limit=100000" \
  -o telemetry_page1.csv
```

### 8.4 Export CSV with pagination

```bash
#!/bin/bash
CURSOR=""
PAGE=1
while true; do
  URL="http://localhost:8000/export/v1/telemetry?node_id=node_1&metric=temperature&from=2026-07-01T00:00:00Z&to=2026-07-20T00:00:00Z&limit=100000"
  if [ -n "$CURSOR" ]; then
    URL="${URL}&cursor=${CURSOR}"
  fi

  echo "Fetching page $PAGE..."
  RESP=$(curl -s -D - -H "Authorization: Bearer $JWT_TOKEN" "$URL" -o "page_${PAGE}.csv")

  # Check for next cursor
  CURSOR=$(echo "$RESP" | grep -i "^X-Export-Next-Cursor:" | awk '{$1=""; print $0}' | tr -d '\r\n\r')
  if [ -z "$CURSOR" ]; then
    echo "No more pages."
    break
  fi
  PAGE=$((PAGE + 1))
done

# Concatenate all pages (skip header from page 2+)
tail -q -n +2 page_*.csv >> telemetry_full.csv
```

### 8.5 Fetch OpenAPI specification

```bash
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8000/export/v1/openapi | jq .
```

---

## 9. NATS Subjects

The Export Service does **not** publish or subscribe to any NATS subjects. It is a pure REST read service.

If downstream systems need to be notified when an export completes, the calling service (dashboard backend, analytics pipeline, etc.) should publish an event to NATS after receiving the CSV response.

---

## 10. Error Handling Reference

| HTTP Status | Error `code` | Typical Cause | Client Action |
|---|---|---|---|
| 400 | `BAD_REQUEST` | Missing `node_id` or `metric`; invalid time format; window > 366 days | Fix query parameters |
| 401 | `UNAUTHORIZED` | Missing, malformed, or expired JWT | Re-authenticate via Auth Service |
| 403 | `FORBIDDEN` | Valid JWT but role is `viewer` (not `admin`/`operator`) | Request elevated role from Auth Service |
| 500 | `INTERNAL_ERROR` | TimescaleDB connection failure or query error | Retry with backoff; check service health |
| 500 | `INTERNAL_ERROR` | Window exceeds 366-day limit | Split query into smaller time ranges |

---

## 11. Architecture Notes

### Why Export Reads Module's TimescaleDB Directly

The Export Service is granted read access to `timescaledb-module` (database `module_ts`) as a **designated exception** to the Database-per-Service isolation rule. This avoids duplicating the entire telemetry hypertable into an analytics copy and keeps the export path simple and efficient.

The Module Service is the **sole writer** to `module_ts`. The Export Service is a **read-only consumer**. There are no consistency conflicts because:

1. The Export Service queries historical data (time-bounded windows).
2. Keyset pagination on `(time, node_id, metric)` is stable under concurrent inserts — new rows do not shift the cursor position.

### RBAC Enforcement

Both Kong and the Export Service enforce RBAC:

- **Kong** can apply rate-limiting and JWT validation at the gateway level.
- **Export Service** independently validates the JWT and checks for `admin` or `operator` roles. This is defense-in-depth: even if Kong is bypassed (e.g. direct container access in dev), the service still rejects unauthorized requests.

### Cursor-Based Pagination Stability

Unlike `OFFSET/LIMIT` pagination, keyset pagination does not shift or duplicate rows when new telemetry is inserted concurrently. The cursor encodes the last seen `(time, node_id, metric)` tuple, and the next query uses `WHERE (time, node_id, metric) > (cursor_time, cursor_node, cursor_metric)`. This guarantees every row is returned exactly once across all pages.

---

## 12. Related Documentation

- [Planning — Architecture Overview](/home/almuzky/TA/Microservices/docs/planning.md)
- [ADR-004 — Redis Consolidation](/home/almuzky/TA/Microservices/docs/adr.md)
- [Security Audit — JWT/RBAC Hardening](/home/almuzky/TA/Microservices/docs/security-audit.md)
- [Grafana Service Health — Monitoring Guide](/home/almuzky/TA/Microservices/docs/grafana-service-health.md)
- [Testing Plan Agent — Backend API Checklist](/home/almuzky/TA/Microservices/docs/testing-plan-agent.md)
