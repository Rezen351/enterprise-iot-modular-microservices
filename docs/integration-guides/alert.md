# Alert Service — Integration Guide

> **Service:** Alert Service  
> **Version:** 1.0.0  
> **Port:** `8080` (configurable via `PORT`)  
> **Protocol:** REST (HTTP) + NATS (event bus)  
> **Database:** MariaDB (`alert_db`) + Redis (`redis-shared`, logical DB `1`)  
> **Dependencies:** Kong (API Gateway), NATS, MariaDB, Redis  

---

## 1. Overview

The Alert Service evaluates incoming telemetry readings against configurable min/max thresholds. When a value falls outside its threshold range, the service creates an alert event, persists it, and publishes NATS events so downstream services (Notification, Webhook, Dashboard via WS-Gateway) can react. When the value returns to the acceptable range, the alert is automatically resolved.

### Key responsibilities

| Responsibility | Description |
|---|---|
| Threshold CRUD | Create, read, update, and delete threshold rules per `(node_id, metric)` pair. A wildcard `node_id = "*"` applies a threshold to every node for a given metric. |
| Real-time evaluation | Subscribes to `telemetry.ingest` on NATS and evaluates each reading against the matching threshold. |
| Alert lifecycle | Creates alerts on violation, resolves them when values return to range, and supports operator acknowledgement (`ack`). |
| Event relay | Publishes `alert.triggered` / `alert.resolved` and `system.status` events via the Transactional Outbox (ADR-007) so no event is lost during NATS outages. |
| Audit trail | Emits threshold lifecycle events (`alert.threshold.created`, `alert.threshold.updated`, `alert.threshold.deleted`) to the shared `audit.log` subject. |

### Ports & addresses

| Component | Address | Notes |
|---|---|---|
| HTTP API | `:8080` | Behind Kong (`/v1/alerts`, `/v1/thresholds`). |
| Health check | `:8080/health` | Public, no auth. |
| Prometheus metrics | `:8080/metrics` | Public, no auth. |
| NATS subscribe | `telemetry.ingest` | Queue group: `alert-workers`. |
| NATS publish (outbox relay) | `alert.triggered`, `alert.resolved`, `system.status` | Via outbox relay worker. |

---

## 2. REST API Endpoints

All endpoints follow the standard response envelope:

```jsonc
// Success (2xx)
{ "success": true, "data": <payload> }

// Error (4xx/5xx)
{ "success": false, "error": { "code": "<ERROR_CODE>", "message": "<english_message>" } }
```

### 2.1 Health

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/health` |
| **Auth** | None |

**Response:**

```json
{ "success": true, "data": { "status": "ok" } }
```

---

### 2.2 List Alerts

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/alerts` |
| **Auth** | JWT required (any authenticated user) |

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `node_id` | `string` | Filter by node ID. |
| `metric` | `string` | Filter by metric name. |
| `status` | `string` | Filter by status (`active`, `resolved`, `acked`). |
| `severity` | `string` | Filter by severity (`info`, `warning`, `critical`). |
| `from` | `RFC3339` | Filter `triggered_at >= from`. |
| `to` | `RFC3339` | Filter `triggered_at <= to`. |
| `limit` | `int` | Max 500, default 50. |
| `offset` | `int` | Default 0. |

**Response:**

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "uuid",
        "node_id": "node-1",
        "metric": "temperature",
        "value": 42.5,
        "threshold_value": 40.0,
        "severity": "warning",
        "status": "active",
        "message": "[warning] node node-1 metric \"temperature\" value 42.5 above max 40",
        "acked_by": null,
        "acked_at": null,
        "triggered_at": "2026-07-21T04:00:00Z",
        "resolved_at": null
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2.3 Acknowledge Alert

| | |
|---|---|
| **Method** | `PUT` |
| **Path** | `/alerts/{id}/ack` |
| **Auth** | JWT required + role `admin` or `operator` |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "node_id": "node-1",
    "metric": "temperature",
    "value": 42.5,
    "threshold_value": 40.0,
    "severity": "warning",
    "status": "acked",
    "message": "[warning] node node-1 metric \"temperature\" value 42.5 above max 40",
    "acked_by": "user-123",
    "acked_at": "2026-07-21T04:05:00Z",
    "triggered_at": "2026-07-21T04:00:00Z",
    "resolved_at": null
  }
}
```

---

### 2.4 List Thresholds

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/thresholds` |
| **Auth** | JWT required (any authenticated user) |

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `node_id` | `string` | Filter by node ID. |
| `metric` | `string` | Filter by metric name. |

**Response:**

```json
{
  "success": true,
  "data": {
    "thresholds": [
      {
        "id": "uuid",
        "node_id": "node-1",
        "metric": "temperature",
        "min": 18.0,
        "max": 40.0,
        "enabled": true,
        "severity": "warning"
      }
    ],
    "total": 1
  }
}
```

---

### 2.5 Create Threshold

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/thresholds` |
| **Auth** | JWT required + role `admin` or `operator` |

**Request body:**

```json
{
  "node_id": "node-1",
  "metric": "temperature",
  "min": 18.0,
  "max": 40.0,
  "enabled": true,
  "severity": "warning"
}
```

**Field rules:**

| Field | Required | Constraints |
|---|---|---|
| `node_id` | Yes | Max 64 chars; pattern `^[A-Za-z0-9_.:*-]{1,64}$`; `"*"` is a valid wildcard. |
| `metric` | Yes | Max 128 chars; pattern `^[A-Za-z0-9_.-]{1,128}$`. |
| `min` | Conditional | At least one of `min` or `max` required. Must be `<= max` if both set. |
| `max` | Conditional | At least one of `min` or `max` required. |
| `enabled` | No | Default `true`. |
| `severity` | No | One of `info`, `warning`, `critical`; default `warning`. |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "generated-uuid",
    "node_id": "node-1",
    "metric": "temperature",
    "min": 18.0,
    "max": 40.0,
    "enabled": true,
    "severity": "warning"
  }
}
```

---

### 2.6 Update Threshold

| | |
|---|---|
| **Method** | `PUT` |
| **Path** | `/thresholds/{id}` |
| **Auth** | JWT required + role `admin` or `operator` |

**Request body (partial update):**

```json
{
  "max": 45.0,
  "severity": "critical"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "node_id": "node-1",
    "metric": "temperature",
    "min": 18.0,
    "max": 45.0,
    "enabled": true,
    "severity": "critical"
  }
}
```

---

### 2.7 Delete Threshold

| | |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/thresholds/{id}` |
| **Auth** | JWT required + role `admin` or `operator` |

**Response:**

```json
{
  "success": true,
  "data": { "status": "deleted", "id": "uuid" }
}
```

---

## 3. Input Contracts (NATS)

### 3.1 Subject: `telemetry.ingest`

The Alert Service subscribes to this subject using a **queue group** named `alert-workers`. Multiple Alert Service replicas can share the load.

**Wire format:**

```jsonc
{
  "node_id": "node-1",     // string, required
  "metric": "temperature",  // string, required
  "value": 42.5,            // float64, required
  "ts": 1690000000000       // int64, unix milliseconds, optional
}
```

**Evaluation logic:**

1. Look up the threshold for `(node_id, metric)` — first exact match, then wildcard `("*", metric)`.
2. If no enabled threshold is found, the message is ignored.
3. Evaluate: `value < min` or `value > max` → violation.
4. On violation: if no active alert exists for `(node_id, metric)`, create one and publish events.
5. On in-range: if an active alert exists, resolve it and publish resolution events.

---

## 4. Output Contracts (NATS)

All outbound events are written to the **outbox table** first (ADR-007) and relayed to NATS by a background worker. Each published message carries a `Nats-Msg-Id` header and a top-level `msg_id` field for consumer-side idempotency.

### 4.1 Subject: `alert.triggered`

Published when a new threshold violation creates an alert.

**Payload:**

```jsonc
{
  "msg_id": "uuid",
  "id": "alert-uuid",
  "node_id": "node-1",
  "metric": "temperature",
  "value": 42.5,
  "threshold_value": 40.0,
  "severity": "warning",
  "status": "active",
  "message": "[warning] node node-1 metric \"temperature\" value 42.5 above max 40",
  "triggered_at": "2026-07-21T04:00:00Z"
}
```

### 4.2 Subject: `alert.resolved`

Published when an active alert is resolved because the value returned to the acceptable range.

**Payload:**

```jsonc
{
  "msg_id": "uuid",
  "id": "alert-uuid",
  "node_id": "node-1",
  "metric": "temperature",
  "value": 35.0,
  "threshold_value": 40.0,
  "severity": "warning",
  "status": "resolved",
  "message": "[warning] node node-1 metric \"temperature\" value 35.0 above max 40",
  "triggered_at": "2026-07-21T04:00:00Z",
  "resolved_at": "2026-07-21T04:10:00Z"
}
```

### 4.3 Subject: `system.status`

A human-friendly notification pushed to the Dashboard NotificationContext via WS-Gateway.

**Payload:**

```jsonc
{
  "msg_id": "uuid",
  "type": "alert",
  "level": "warning",
  "node_id": "node-1",
  "metric": "temperature",
  "value": 42.5,
  "message": "[warning] node node-1 metric \"temperature\" value 42.5 above max 40",
  "status": "triggered",
  "event": "triggered",
  "ts": 1690000005000
}
```

The `status` and `event` fields are either `"triggered"` or `"resolved"`.

### 4.4 Subject: `audit.log`

Published for every threshold lifecycle change so the Audit Service can persist an immutable compliance record.

**Payload format:**

```jsonc
{
  "msg_id": "uuid",
  "event": "alert.threshold.created",
  "service": "alert",
  "data": {
    "threshold_id": "uuid",
    "node_id": "node-1",
    "metric": "temperature",
    "severity": "warning",
    "by": "user-123"
  }
}
```

Valid `event` values:

| Event | Trigger |
|---|---|
| `alert.threshold.created` | Threshold created via API. |
| `alert.threshold.updated` | Threshold updated via API. |
| `alert.threshold.deleted` | Threshold deleted via API. |

---

## 5. Integration Steps for a New Service

### 5.1 Consuming telemetry (Module Service pattern)

If your service produces sensor telemetry, publish to `telemetry.ingest`:

```jsonc
{
  "node_id": "node-1",
  "metric": "temperature",
  "value": 42.5,
  "ts": 1690000000000
}
```

The Alert Service will automatically evaluate the reading against configured thresholds.

### 5.2 Reacting to alerts (Notification / Webhook pattern)

Subscribe to `alert.triggered` and `alert.resolved` to react to threshold violations:

```go
nc, _ := nats.Connect(natsURL)
nc.Subscribe("alert.triggered", func(m *nats.Msg) {
    // Send email, SMS, push notification, or webhook call
})
nc.Subscribe("alert.resolved", func(m *nats.Msg) {
    // Clear notification, send resolution notice
})
```

### 5.3 Querying alert history

Call the REST API (via Kong) to fetch alert history:

```
GET /v1/alerts?node_id=node-1&status=active&limit=50
```

### 5.4 Managing thresholds

Use the REST API to create and manage thresholds:

```
POST /v1/thresholds
PUT /v1/thresholds/{id}
DELETE /v1/thresholds/{id}
GET /v1/thresholds?node_id=node-1
```

### 5.5 Acknowledging alerts

Operators can acknowledge alerts via the API:

```
PUT /v1/alerts/{alert_id}/ack
```

Requires role `admin` or `operator`.

---

## 6. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port. |
| `DB_DSN` | `alert_user:alert_pass@tcp(mariadb-alert:3306)/alert_db?parseTime=true&charset=utf8mb4` | MariaDB DSN for `alert_db`. |
| `NATS_URL` | `nats://nats:4222` | NATS server URL. |
| `JWT_SECRET` | `""` | Shared HMAC secret for JWT validation. When empty, auth is bypassed (dev mode). |
| `REDIS_ADDR` | `redis-shared:6379` | Redis address (uses logical DB `REDIS_DB`). |
| `REDIS_PASSWORD` | `""` | Redis password. |
| `REDIS_DB` | `0` | Redis logical database number (Alert Service uses DB `1` in production). |

### NATS credentials

The Alert Service connects to NATS using the shared server URL. Per-service NATS passwords are defined in `.env.example` (e.g., `ALERT_NATS_PASSWORD`) and enforced via NATS ACLs in `infra/nats/`.

---

## 7. Database Schema

Schema is managed exclusively by **GORM AutoMigrate** at startup (`migrate.go`). The `infra/mariadb/alert/init.sql` file contains only privilege grants, no DDL.

### 7.1 `thresholds`

```sql
CREATE TABLE thresholds (
  id         CHAR(36) PRIMARY KEY,
  node_id    VARCHAR(64) NOT NULL,
  metric     VARCHAR(128) NOT NULL,
  min        DOUBLE,
  max        DOUBLE,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  severity   VARCHAR(16) NOT NULL DEFAULT 'warning',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_node_metric (node_id, metric)
);
```

### 7.2 `alerts`

```sql
CREATE TABLE alerts (
  id              CHAR(36) PRIMARY KEY,
  node_id         VARCHAR(64) NOT NULL,
  metric          VARCHAR(128) NOT NULL,
  value           DOUBLE NOT NULL,
  threshold_value DOUBLE,
  severity        VARCHAR(16) NOT NULL DEFAULT 'warning',
  status          VARCHAR(16) NOT NULL DEFAULT 'active',
  message         VARCHAR(512),
  threshold_id    CHAR(36),
  acked_by        VARCHAR(64),
  acked_at        TIMESTAMP NULL,
  triggered_at    TIMESTAMP NOT NULL,
  resolved_at     TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_alert_node_metric (node_id, metric)
);
```

### 7.3 `outbox`

```sql
CREATE TABLE outbox (
  id         CHAR(36) PRIMARY KEY,
  msg_id     VARCHAR(64) NOT NULL UNIQUE,
  subject    VARCHAR(128) NOT NULL,
  payload    LONGTEXT NOT NULL,
  sent       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at    TIMESTAMP NULL,
  INDEX idx_sent (sent)
);
```

### Alert status transitions

```
active  →  resolved  (value returns to [min, max])
active  →  acked     (operator acknowledges)
```

---

## 8. Example curl Commands

```bash
# Health check (public)
curl -s http://localhost:8000/v1/health

# List alerts (requires JWT)
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/v1/alerts?node_id=node-1&status=active&limit=10"

# Acknowledge alert (requires admin or operator role)
curl -s -X PUT -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/v1/alerts/alert-uuid/ack"

# List thresholds
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/v1/thresholds?node_id=node-1"

# Create threshold
curl -s -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"node_id":"node-1","metric":"temperature","min":18,"max":40,"severity":"warning"}' \
  "http://localhost:8000/v1/thresholds"

# Update threshold
curl -s -X PUT -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max":45,"severity":"critical"}' \
  "http://localhost:8000/v1/thresholds/threshold-uuid"

# Delete threshold
curl -s -X DELETE -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/v1/thresholds/threshold-uuid"

# Publish telemetry (simulate Module Service publishing to telemetry.ingest)
nats pub telemetry.ingest '{"node_id":"node-1","metric":"temperature","value":42.5,"ts":1690000000000}'
```

---

## 9. Caching Strategy

| Cache key pattern | TTL | Purpose |
|---|---|---|
| `threshold:{node_id}:{metric}` | 60 seconds | Resolved thresholds to reduce DB queries. |
| `threshold:*:{metric}` | 60 seconds | Wildcard thresholds. |
| `alert:active:{node_id}:{metric}` | 24 hours | Dedup marker to prevent re-firing the same alert on every telemetry reading. |

Cache is invalidated on threshold create/update/delete (both exact and wildcard keys).

---

## 10. Prometheus Metrics

Exposed at `/metrics`:

| Metric | Type | Labels |
|---|---|---|
| `alert_http_requests_total` | Counter | `method`, `path`, `status` |
| `alert_http_request_duration_seconds` | Histogram | `method`, `path` |
| `alert_http_requests_in_flight` | Gauge | — |
