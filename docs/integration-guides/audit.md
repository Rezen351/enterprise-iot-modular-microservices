# Audit Service — Integration Guide

> **Service:** Audit  
> **Language:** Go (chi router + GORM + NATS)  
> **Database:** MariaDB (`audit_db`)  
> **Status:** ✅ Running  

---

## 1. Overview

The Audit Service is the centralized, append-only audit log collector for the IoT microservices platform. It receives structured audit events from other services via NATS and persists them to MariaDB. A protected REST API allows administrators to query and search audit logs.

| Attribute | Value |
|-----------|-------|
| **Purpose** | Collect, persist, and serve audit events published by other services |
| **Port** | `8080` (configurable via `PORT`) |
| **Protocols** | NATS (consumer), HTTP/REST (query) |
| **Dependencies** | MariaDB (`audit_db`), NATS, JWT Secret (shared with Auth Service) |
| **Database Isolation** | Dedicated `audit_db` database — no cross-service queries |

### Key Design Decisions
- **Consumer-side idempotency:** Uses a `processed_msgs` table to deduplicate redelivered NATS messages (ADR-007).
- **Append-only:** Audit logs are never updated or deleted; only inserted.
- **Shared JWT secret:** Same secret as Auth Service so this service can validate access tokens internally.

---

## 2. REST API Endpoints

All API responses follow the standard envelope:

```jsonc
// Success (2xx)
{ "success": true, "data": <payload> }

// Error (4xx/5xx)
{ "success": false, "error": { "code": "<ERROR_CODE>", "message": "<english_message>" } }
```

### 2.1 `GET /health`

**Auth:** Public (no token required)

**Response:**
```json
{ "success": true, "data": { "status": "ok" } }
```

---

### 2.2 `GET /metrics`

**Auth:** Public (no token required)

Prometheus metrics endpoint. Exposed by `promhttp.Handler()`.

---

### 2.3 `GET /audit/logs`

**Auth:** JWT Bearer token + `admin` role required.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Page size (1–500, default `50`) |
| `offset` | integer | No | Pagination offset (default `0`) |
| `event` | string | No | Filter by event name prefix (e.g., `auth.login`) |
| `search` | string | No | Free-text search across `payload` column |
| `from` | RFC3339 timestamp | No | Lower bound for `received_at` |
| `to` | RFC3339 timestamp | No | Upper bound for `received_at` |

**Response:**
```jsonc
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid-string",
        "event": "auth.login",
        "payload": "{\"user_id\":\"...\",\"ip\":\"...\"}",
        "received_at": "2026-07-21T04:30:00Z"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

**Notes:**
- `event` filter uses a `LIKE` prefix match (`event%`).
- `search` filter uses a `LIKE` wildcard match across the `payload` column.
- Results are ordered by `received_at DESC`.
- `total` reflects the count before pagination is applied.

---

## 3. Input Contracts

### 3.1 NATS — Audit Event Ingestion

**Subject:** `audit.log`

**Subscription Pattern:** Queue subscription with group `audit-workers`. Multiple Audit Service replicas can share the load.

**Wire Format (JSON):**

```jsonc
{
  "event": "auth.login",           // Event name (required; falls back to "unknown")
  "data": {                        // Arbitrary event payload object
    "user_id": "uuid",
    "ip": "10.0.0.1",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Alternative wire format:** If the payload is not valid JSON, the raw body bytes are stored as-is in the `payload` column with `event` set to `"unknown"`.

**Idempotency Key:** The subscriber deduplicates messages using:
1. NATS header `Nats-Msg-Id` (preferred).
2. Payload field `msg_id` (fallback when NATS header is absent).

### 3.2 REST — Query Endpoint

Administrators query audit logs via `GET /audit/logs` (see Section 2.3).

---

## 4. Output Contracts

### 4.1 Audit Log Record (`AuditLogDTO`)

Returned in `GET /audit/logs` responses:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier for this audit record |
| `event` | `string` | Event name (e.g., `auth.login`, `sensor.registered`) |
| `payload` | `string` (raw JSON) | Original event data as a JSON string |
| `received_at` | `string` (RFC3339) | Timestamp when the event was persisted |

### 4.2 Search & Filter Capabilities

| Filter | Behavior |
|--------|----------|
| **Event prefix** | `event LIKE '<prefix>%'` — matches event names starting with the given prefix |
| **Free-text search** | `payload LIKE '%<search>%'` — matches anywhere in the raw payload string |
| **Time window** | `received_at >= from` and `received_at <= to` (RFC3339) |

---

## 5. Integration Steps — Publishing Audit Events

Any service that needs to emit audit events should publish to the NATS subject `audit.log` with the wire format described in Section 3.1.

### 5.1 Prerequisites

- NATS connection configured (URL: `nats://nats:4222` in Docker Compose).
- For idempotency, set the NATS header `Nats-Msg-Id` to a UUID for every audit event.

### 5.2 Publishing an Audit Event (Go + nats.go)

```go
import (
    "encoding/json"
    "github.com/nats-io/nats.go"
    "github.com/google/uuid"
)

type AuditEvent struct {
    Event string                 `json:"event"`
    Data  map[string]interface{} `json:"data"`
}

func publishAudit(nc *nats.Conn, eventName string, data map[string]interface{}) error {
    payload, err := json.Marshal(AuditEvent{
        Event: eventName,
        Data:  data,
    })
    if err != nil {
        return err
    }

    msgID := uuid.NewString()
    return nc.Publish("audit.log", func(m *nats.Msg) {
        m.Data = payload
        m.Header.Set("Nats-Msg-Id", msgID)
    })
}
```

### 5.3 Recommended Event Taxonomy

| Event Name Pattern | Example | Description |
|--------------------|---------|-------------|
| `auth.<action>` | `auth.login`, `auth.logout`, `auth.register` | Authentication lifecycle events |
| `sensor.<action>` | `sensor.registered`, `sensor.updated` | Device/sensor onboarding events |
| `control.<action>` | `control.command_sent` | Actuator control events |
| `stream.<action>` | `stream.created`, `stream.deleted` | Video stream lifecycle events |
| `alert.<action>` | `alert.triggered`, `alert.resolved` | Alert threshold events |
| `system.<action>` | `system.status_changed` | System-level operational events |

### 5.4 Idempotency Best Practices

- Always set `Nats-Msg-Id` header to a unique UUID per logical event.
- Do not reuse message IDs across different events.
- The Audit Service handles deduplication automatically via the `processed_msgs` table.

---

## 6. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | HTTP listen port |
| `DB_DSN` | Yes | `audit_user:audit_pass@tcp(mariadb-audit:3306)/audit_db?parseTime=true&charset=utf8mb4` | MariaDB DSN for `audit_db` |
| `NATS_URL` | No | `nats://nats:4222` | Core NATS server URL |
| `JWT_SECRET` | No | `""` (empty = dev mode, skip validation) | Shared HMAC secret for JWT validation (same as Auth Service) |

> **Note:** When `JWT_SECRET` is empty, JWT validation and role checks are bypassed. This is intended for local development only. Production deployments must set this value.

---

## 7. Database Schema Overview

The schema is managed via GORM `AutoMigrate` at startup. The file `infra/mariadb/audit/init.sql` is intentionally empty.

### 7.1 `audit_logs`

The append-only store for all audit events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `char(36)` | `PRIMARY KEY` | UUID v4 generated by the service |
| `event` | `varchar(128)` | `NOT NULL`, indexed | Event name (e.g., `auth.login`) |
| `payload` | `longtext` | `NOT NULL` | Raw JSON payload of the event |
| `received_at` | `timestamp` | `autoCreateTime`, indexed | Timestamp of ingestion |

### 7.2 `processed_msgs`

Tracks consumed message IDs for consumer-side idempotency.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `msg_id` | `varchar(64)` | `PRIMARY KEY` | NATS `Nats-Msg-Id` or payload `msg_id` |
| `subject` | `varchar(128)` | `NOT NULL` | NATS subject (always `audit.log`) |
| `created_at` | `timestamp` | `autoCreateTime` | When the message was first processed |

---

## 8. Example curl Commands

### 8.1 Health Check

```bash
curl -s http://localhost:8000/v1/health | jq
```

### 8.2 Query All Audit Logs (default page)

```bash
curl -s "http://localhost:8000/v1/audit/logs" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" | jq
```

### 8.3 Query with Filters

Filter by event prefix:

```bash
curl -s "http://localhost:8000/v1/audit/logs?event=auth.login" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" | jq
```

Free-text search in payload:

```bash
curl -s "http://localhost:8000/v1/audit/logs?search=10.0.0.1" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" | jq
```

Time window (RFC3339):

```bash
curl -s "http://localhost:8000/v1/audit/logs?from=2026-07-01T00:00:00Z&to=2026-07-21T23:59:59Z&limit=100" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" | jq
```

Combined filters:

```bash
curl -s "http://localhost:8000/v1/audit/logs?event=sensor&search=node_42&from=2026-07-01T00:00:00Z&limit=20&offset=40" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" | jq
```

### 8.4 Publish an Audit Event via NATS (using `nats` CLI)

```bash
nats publish audit.log '{"event":"test.manual","data":{"message":"hello from CLI"}}' \
  --header "Nats-Msg-Id: $(uuidgen)"
```

### 8.5 Prometheus Metrics

```bash
curl -s http://localhost:8080/metrics
```

Exposed metrics (namespace `audit`):
- `audit_http_requests_total` (labels: `method`, `path`, `status`)
- `audit_http_request_duration_seconds` (labels: `method`, `path`)
- `audit_http_requests_in_flight`

---

## 9. NATS Subject Reference

| Subject | Direction | Publisher | Consumer | Description |
|---------|-----------|-----------|----------|-------------|
| `audit.log` | Async event | Any service | Audit Service | Structured audit events for persistence |

> **Note:** The Audit Service is a one-way consumer. It does not publish events back to NATS.
