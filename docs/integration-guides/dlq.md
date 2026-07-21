# DLQ Service — Integration Guide

> **Service:** `dlq` (DLQ Saga Worker)  
> **Version:** 1.0  
> **Status:** Implementation Complete  
> **Related ADR:** [ADR-006 — DLQ Saga via NATS Advisory](file:///home/almuzky/TA/Microservices/docs/adr.md#adr-006--dlq-saga-via-nats-advisory-2026-07-16)

---

## 1. Overview

The DLQ service is the system-wide **Dead Letter Queue** worker for the IoT aeroponic microservices platform. Its sole responsibility is to capture messages that exceeded their JetStream consumer's `MaxDeliver` threshold and store them durably for investigation and replay.

| Attribute | Value |
|---|---|
| **Purpose** | Consume NATS JetStream `MaxDeliver` advisories, capture the original failed message, and persist it to a JetStream DLQ stream + MariaDB audit table |
| **Port** | `8080` (configurable via `PORT` env var) |
| **Process name** | `dlq-saga-worker` |
| **Dependencies** | NATS JetStream (`nats://nats:4222`), MariaDB `mariadb-audit` (`audit_db`) |
| **Database** | Reuses existing `mariadb-audit` instance (table `dlq_messages`) per ADR-006 — no new database instance |
| **Frameworks** | Chi (HTTP router), GORM (ORM), NATS Go client, golang-jwt (auth), Prometheus client |

The service runs two concurrent loops:
1. **HTTP server** — exposes health and admin listing endpoints.
2. **NATS advisory subscriber** — listens for `MaxDeliver` advisories on all streams/consumers, fetches the original message, republishes to the DLQ JetStream stream, and inserts an audit record.

---

## 2. REST API Endpoints

All endpoints follow the standard response envelope:

- **Success:** `{ "success": true, "data": <payload> }`
- **Error:** `{ "success": false, "error": { "code": "<CODE>", "message": "<english_message>" } }`

### 2.1 `GET /health`

Public health check. No authentication required. Used by Docker healthcheck and Kong probes.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime_s": 0
  }
}
```

### 2.2 `GET /v1/dlq/messages`

List captured DLQ messages. Requires a valid JWT bearer token with `role: admin`.

**Authentication:** JWT Bearer token (shared secret with Auth Service, validated via HMAC).  
**Authorization:** Role `admin` required.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `source_stream` | string | No | Filter by NATS JetStream source stream name |
| `trace_id` | string | No | Filter by distributed trace ID |
| `limit` | integer | No | Max results per page (default: 50, max: 200) |
| `offset` | integer | No | Pagination offset (default: 0) |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "trace_id": "trace-id-string",
        "source_stream": "ORDERS",
        "source_consumer": "ORDERS.processor",
        "stream_seq": 12345,
        "subject": "orders.created",
        "reason": "MaxDeliverExceeded",
        "payload": "{\"order_id\":\"abc\"}",
        "headers": "{\"Trace-Id\":[\"trace-id\"]}",
        "dlq_seq": 1,
        "created_at": "2026-07-16T12:00:00Z"
      }
    ],
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

**Error Responses:**

| Status | Code | Message |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing or malformed authorization header / invalid or expired token |
| 403 | `FORBIDDEN` | Insufficient role |
| 500 | `INTERNAL_ERROR` | Failed to list DLQ messages |

---

## 3. Input Contracts

The DLQ service receives two types of input:

### 3.1 NATS JetStream MaxDeliver Advisories

When any JetStream consumer exhausts its `MaxDeliver` retry limit, NATS publishes a server-generated advisory. The DLQ worker subscribes to this advisory and acts on it.

**Subject Pattern:**

```
$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.<stream>.<consumer>
```

A wildcard subscription covers all streams and consumers:

```
$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.>
```

**Advisory Payload (JSON body of the advisory message):**

```json
{
  "type": "io.nats.jetstream.advisory.consumer_max_deliveries",
  "id": "opaque-server-token",
  "timestamp": "2026-07-16T12:00:00Z",
  "stream": "ORDERS",
  "consumer": "ORDERS.processor",
  "consumer_seq": 123,
  "stream_seq": 12345,
  "domain": "jetstream",
  "reason": "MaxDeliverExceeded"
}
```

| Field | Type | Notes |
|---|---|---|
| `type` | string | Advisory type discriminator |
| `id` | any (string) | Opaque server-generated token |
| `timestamp` | ISO8601 | Advisory emission time |
| `stream` | string | Source JetStream stream name |
| `consumer` | string | Source consumer name |
| `consumer_seq` | uint64 | Consumer delivery sequence number |
| `stream_seq` | uint64 | **Key field** — sequence of the original message in the source stream |
| `domain` | string | Always `"jetstream"` |
| `reason` | string | Human-readable reason (e.g., `"MaxDeliverExceeded"`) |

**Propagation Headers:**

| Header | Purpose |
|---|---|
| `Trace-Id` | Distributed trace ID (UUIDv4, W3C-style compact form). If absent, DLQ worker generates one. |

The worker uses the advisory's `stream_seq` to fetch the **original message** from the source stream via `js.GetMsg(stream, stream_seq)` — not the advisory body itself.

### 3.2 Source Stream Message (fetched via `GetMsg`)

The DLQ worker retrieves the full original message from the source stream:

| Component | Source |
|---|---|
| Subject | `srcMsg.Subject` (falls back to `Nats-Subject` header) |
| Data | `srcMsg.Data` (raw payload bytes) |
| Headers | `srcMsg.Header` (all NATS headers, serialized as JSON) |

---

## 4. Output Contracts

### 4.1 JetStream DLQ Stream

The worker republishes every captured message into a dedicated JetStream stream.

**Stream Configuration:**

| Property | Value | Notes |
|---|---|---|
| **Name** | `DLQ` | |
| **Subject** | `dlq.msg` | Single-subject stream |
| **Retention** | `LimitsPolicy` | Bounded by `MaxAge` |
| **MaxAge** | 720 hours (30 days) | Configurable via `DLQ_MAX_AGE_HOURS` |
| **MaxMsgs** | 5,000,000 | Hard cap to prevent unbounded growth |
| **Storage** | `FileStorage` | Durable, persisted to disk |
| **Duplicates** | 2 minutes | Publisher-side dedup window |
| **Replicas** | 2 (prod) / 1 (dev single-node) | Falls back to 1 if NATS is non-clustered |

**Published Message Headers:**

| Header | Value |
|---|---|
| `Trace-Id` | Propagated trace ID from advisory/original message |
| `X-DLQ-Source-Stream` | Source stream name (e.g., `ORDERS`) |
| `X-DLQ-Source-Consumer` | Source consumer name (e.g., `ORDERS.processor`) |
| `X-DLQ-Stream-Seq` | Original stream sequence number |
| `Nats-Msg-Id` | UUID of the DLQ record (publisher-side dedup) |

**Published Message Body:** Identical to the original failed message payload (raw bytes).

### 4.2 MariaDB Audit Table (`dlq_messages`)

Every capture is persisted to the `dlq_messages` table inside `mariadb-audit`.

**Schema:**

```sql
CREATE TABLE dlq_messages (
  id             CHAR(36)      NOT NULL PRIMARY KEY,
  trace_id       VARCHAR(128)  NOT NULL,
  source_stream  VARCHAR(256)  NOT NULL,
  source_consumer VARCHAR(256) NOT NULL,
  stream_seq     BIGINT UNSIGNED NOT NULL,
  subject        VARCHAR(256)  NOT NULL,
  reason         VARCHAR(256),
  payload        LONGTEXT      NOT NULL,
  headers        LONGTEXT,
  dlq_seq        BIGINT UNSIGNED,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_source_stream (source_stream),
  INDEX idx_source_consumer (source_consumer),
  INDEX idx_stream_seq (stream_seq),
  INDEX idx_trace_id (trace_id),
  INDEX idx_created_at (created_at),
  INDEX idx_dlq_seq (dlq_seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

| Column | Type | Description |
|---|---|---|
| `id` | CHAR(36) | UUID primary key |
| `trace_id` | VARCHAR(128) | Distributed trace ID (indexed) |
| `source_stream` | VARCHAR(256) | Source JetStream stream name (indexed) |
| `source_consumer` | VARCHAR(256) | Source consumer name (indexed) |
| `stream_seq` | BIGINT UNSIGNED | Sequence in source stream (indexed) |
| `subject` | VARCHAR(256) | Original NATS subject |
| `reason` | VARCHAR(256) | Advisory reason (e.g., `MaxDeliverExceeded`) |
| `payload` | LONGTEXT | Original message body (JSON string) |
| `headers` | LONGTEXT | Original message headers as JSON string |
| `dlq_seq` | BIGINT UNSIGNED | Sequence within the DLQ stream |
| `created_at` | DATETIME(3) | Insertion timestamp (auto-set, indexed) |

### 4.3 Replay / Retry Capabilities

- **DLQ Stream Replay:** The `DLQ` JetStream stream retains messages for 30 days. Any consumer can subscribe to `dlq.msg` and replay messages. Operators or the Audit Service can build a replay consumer to reprocess dead-lettered events.
- **Database Query:** The `/v1/dlq/messages` endpoint allows filtering by `source_stream` and `trace_id`, enabling operators to investigate why specific messages failed.
- **JetStream GetMsg:** Individual DLQ messages can be fetched directly from the `DLQ` stream by sequence using `js.GetMsg("DLQ", seq)`.

---

## 5. Integration Steps for Other Services

To participate in the DLQ system, each JetStream-producing service must configure their consumers with `MaxDeliver`. When a message exceeds `MaxDeliver` attempts, NATS automatically emits the advisory that the DLQ worker captures.

### Step 1: Configure Consumer MaxDeliver

When creating a JetStream consumer (pull or push), set `MaxDeliver` to the desired retry limit. The DLQ worker captures messages that exceed this limit.

```go
// Example: Pull consumer with MaxDeliver = 3
consumer, err := js.AddConsumer("ORDERS", &nats.ConsumerConfig{
  Stream:       "ORDERS",
  Durable:      "ORDERS.processor",
  AckPolicy:    nats.AckExplicitPolicy,
  MaxDeliver:   3,            // After 3 failed deliveries, advisory fires
  FilterSubject: "orders.>",
})
```

```go
// Example: Push consumer with MaxDeliver = 5
_, err := js.AddConsumer("TELEMETRY", &nats.ConsumerConfig{
  Stream:       "TELEMETRY",
  Durable:      "TELEMETRY.ingest",
  AckPolicy:    nats.AckExplicitPolicy,
  MaxDeliver:   5,
  FilterSubject: "telemetry.ingest",
})
```

### Step 2: Use Explicit Ack

Consumers must use `AckExplicitPolicy` (or `AckAllPolicy`) so that unacknowledged messages are redelivered and eventually trigger the MaxDeliver advisory.

```go
// Pull-based consumer with manual ack
sub, err := js.PullSubscribe("orders.>", "ORDERS.processor",
  nats.Bind("ORDERS", "ORDERS.processor"),
)

msgs, err := sub.Fetch(10, nats.AckWait(5*time.Second))
for _, msg := range msgs {
  if err := process(msg.Data); err != nil {
    msg.Nak()  // Negative ack — message will be redelivered
    continue
  }
  msg.Ack()  // Positive ack — message removed from stream
}
```

### Step 3: Ensure Trace Propagation

To enable end-to-end tracing of dead-lettered messages, services should propagate the `Trace-Id` NATS header when publishing messages:

```go
headers := map[string][]string{"Trace-Id": {trace.New()}}
js.Publish("orders.created", data, nats.Header(headers))
```

If no `Trace-Id` is present, the DLQ worker generates one automatically.

### Step 4: Subscribe to DLQ Stream for Replay (Optional)

To replay dead-lettered messages, a service or operator can create a consumer on the `DLQ` stream:

```go
// Durable consumer for replay
replayConsumer, err := js.AddConsumer("DLQ", &nats.ConsumerConfig{
  Stream:       "DLQ",
  Durable:      "DLQ.replay",
  AckPolicy:    nats.AckExplicitPolicy,
  FilterSubject: "dlq.msg",
})
```

### NATS Subject Contracts Summary

| Subject | Direction | Producer | Consumer | Purpose |
|---|---|---|---|---|
| `$JS.EVENT.ADVISORY.CONSUMER.MaxDeliveries.>` | NATS → DLQ | NATS Server | `dlq` service | Advisory when MaxDeliver is exceeded |
| `dlq.msg` | DLQ → Consumers | `dlq` service | Any replay consumer | DLQ stream for durable retention and replay |
| `<service-specific-subjects>` | Services → NATS | Any service | Downstream consumers | Normal event flow (unchanged by DLQ integration) |

---

## 6. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | HTTP listen port |
| `DB_DSN` | No | `app:app1234@tcp(mariadb-audit:3306)/audit_db?parseTime=true&charset=utf8mb4` | MariaDB DSN pointing to `audit_db` on `mariadb-audit` |
| `NATS_URL` | No | `nats://nats:4222` | NATS server URL |
| `JWT_SECRET` | **Yes** | `""` (empty) | Shared HMAC secret for JWT validation (same as Auth Service) |
| `DLQ_MAX_AGE_HOURS` | No | `720` (30 days) | Retention window for DLQ JetStream stream in hours |
| `DLQ_REPLICAS` | No | `2` | JetStream stream replication factor (falls back to 1 on single-node NATS) |

> **Note:** `JWT_SECRET` must match the secret configured in the Auth Service. Both services validate tokens independently (defense-in-depth). The secret is shared across services per ADR-003.

---

## 7. Database Schema Overview

The DLQ service stores its data in the existing `mariadb-audit` database (instance `mariadb-audit`). It does **not** create or require a separate database instance.

**Instance:** `mariadb-audit`  
**Database:** `audit_db`  
**Table:** `dlq_messages`

**Migration:** Auto-migrated on service boot via GORM `AutoMigrate(&model.DLQMessage{})` in `migrate.go`.

**Indexes:**

| Index | Columns | Purpose |
|---|---|---|
| `PRIMARY` | `id` | UUID primary key |
| `idx_source_stream` | `source_stream` | Filter DLQ entries by source stream |
| `idx_source_consumer` | `source_consumer` | Filter by consumer name |
| `idx_stream_seq` | `stream_seq` | Look up by source stream sequence |
| `idx_trace_id` | `trace_id` | Trace correlation / distributed tracing |
| `idx_created_at` | `created_at` | Time-range queries, sorting |
| `idx_dlq_seq` | `dlq_seq` | DLQ stream sequence lookup |

---

## 8. Example curl Commands

### Health Check (No Auth)

```bash
curl -s http://localhost:8080/health | jq
```

**Expected output:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime_s": 0
  }
}
```

### List All DLQ Messages (Admin Auth Required)

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:8080/v1/dlq/messages?limit=20&offset=0" | jq
```

### Filter by Source Stream

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:8080/v1/dlq/messages?source_stream=ORDERS&limit=50" | jq
```

### Filter by Trace ID

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:8080/v1/dlq/messages?trace_id=abc123def456" | jq
```

### Combined Filters with Pagination

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:8080/v1/dlq/messages?source_stream=TELEMETRY&trace_id=abc123&limit=10&offset=20" | jq
```

### Generate an Admin JWT (for testing)

```bash
# Using the Auth Service token endpoint (adjust path/port as configured)
curl -s -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@iot.local","password":"admin123"}' | jq -r '.data.token'
```

### Unauthorized Request (Missing Token)

```bash
curl -s http://localhost:8080/v1/dlq/messages | jq
```

**Expected output:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "missing or malformed authorization header"
  }
}
```

### Forbidden Request (Non-Admin Role)

```bash
curl -s -H "Authorization: Bearer $USER_JWT" \
  "http://localhost:8080/v1/dlq/messages" | jq
```

**Expected output:**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "insufficient role"
  }
}
```

---

## 9. NATS Advisory Subject Reference

### Full Subject Format

```
$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.<stream>.<consumer>
```

### Wildcard Subscription (used by DLQ worker)

```
$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.>
```

### Example Advisories

| Full Subject | Stream | Consumer |
|---|---|---|
| `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.ORDERS.ORDERS.processor` | `ORDERS` | `ORDERS.processor` |
| `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.TELEMETRY.TELEMETRY.ingest` | `TELEMETRY` | `TELEMETRY.ingest` |
| `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.ALERTS.ALERTS.evaluator` | `ALERTS` | `ALERTS.evaluator` |

> **Note:** Stream names may contain dots. The DLQ worker parses the subject by splitting off the last token as the consumer name and treating the remainder as the stream name.

---

## 10. Operational Notes

### Graceful Shutdown

The service handles `SIGINT` and `SIGTERM`. On shutdown:
1. The advisory subscriber goroutine unsubscribes from the NATS advisory subject.
2. The NATS connection is drained (`nc.Drain()`).
3. The HTTP server shuts down with a 10-second timeout.

### DLQ Stream Maintenance

- **Retention:** Messages older than 30 days (configurable) are automatically purged by NATS.
- **Max Messages:** Hard cap of 5,000,000 messages to prevent disk exhaustion.
- **Monitoring:** Prometheus metrics are exposed at `GET /metrics` on the same port.

### Correlation ID Propagation

All DLQ operations carry a `trace_id` (UUIDv4, compact W3C-style format without dashes). This ID is:
- Read from the NATS advisory header `Trace-Id` (or generated if absent).
- Logged with every DLQ operation.
- Stored in the `trace_id` column of `dlq_messages`.
- Forwarded on the republished DLQ message header `Trace-Id`.

### Replica Handling

In development (single-node NATS), `Replicas: 2` is rejected by NATS. The DLQ worker transparently falls back to `Replicas: 1` and logs a warning. In production (3-node NATS cluster per planning.md), `Replicas: 2` is fully supported.

---

## 11. Service Dependencies Diagram

```
NATS JetStream
  ├─ Advisory: $JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.>
  │     └─ DLQ Service (subscriber)
  │           ├─ GetMsg(source_stream, stream_seq)   ← fetches original
  │           ├─ Publish → DLQ stream (dlq.msg, 30d)  ← durable retention
  │           └─ INSERT dlq_messages (mariadb-audit)  ← audit trail
  │
  └─ Stream: DLQ (dlq.msg)
        └─ Replay consumers (operator / Audit Service / etc.)

MariaDB (mariadb-audit)
  └─ audit_db.dlq_messages

Kong API Gateway
  └─ /v1/dlq/messages → DLQ Service :8080 (admin-only)
```

---

## 12. Troubleshooting

### Advisory Not Captured

1. Verify the source consumer has `MaxDeliver` set (> 0).
2. Confirm the source consumer uses `AckExplicitPolicy` or `AckAllPolicy` (not `AckNone`).
3. Check NATS connectivity: `NATS_URL` env var and network policies.
4. Review DLQ service logs for advisory decode errors or `GetMsg` failures.

### DLQ Stream Not Created

- On single-node NATS, the worker falls back to `Replicas: 1`. Check logs for the fallback message.
- Ensure the NATS user has JetStream management permissions (`JS` scope in NATS ACL).

### Database Insert Failures

- The advisory handler logs failures but does not retry the DB insert. A transient outage will cause the advisory to be redelivered by NATS, triggering a retry.
- Check `mariadb-audit` connectivity and `DB_DSN` configuration.

### JWT Validation Failures

- Ensure `JWT_SECRET` matches the Auth Service secret.
- Verify the token has `role: admin` in its claims.
- Check that Kong is forwarding the `Authorization` header if requests go through the gateway.
