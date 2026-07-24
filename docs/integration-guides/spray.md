# Spray Automation Service — Integration Guide

> **Service:** Spray Automation Service  
> **Version:** 1.0.0  
> **Port:** `8080` (configurable via `PORT`)  
> **Protocol:** REST (HTTP) + NATS (event bus) + MQTT (telemetry monitor) + HTTP (Stream/ML upstream)  
> **Database:** MariaDB (`spray_db`) + Redis Shared (`redis-shared` DB4)  
> **Dependencies:** Kong (API Gateway), NATS, Mosquitto, Module Service, Control Service, Stream Service, ML Service, MariaDB  
> **ADR References:** ADR-007 (Transactional Outbox)

---

## 1. Overview

The Spray Automation Service is the intelligence layer for the aeroponic misting/sprinkler system. It consumes AI detection results from the ML Service, correlates them with real-time telemetry from the Module Service, and automatically adjusts misting schedules via the Control Service.

### Key Responsibilities

| Responsibility | Description |
|---|---|
| AI-driven schedule optimization | Consume `detection.result` from ML Service, analyze root length and crop condition, compute optimal misting interval/duration. |
| Telemetry-triggered snapshot | Monitor `telemetry.ingest` for pump OFF events and periodic 8-hour triggers → call Stream Service to capture snapshot. |
| ML feedback loop | Send captured snapshots to ML Service for analysis, store results, and use them to refine schedules. |
| Schedule management | CRUD spray-specific schedules with dynamic params (interval, duration, intensity) and push updates to Control Service. |
| Audit trail | Log all schedule changes, snapshot triggers, and ML analysis results via `audit.log` NATS subject. |

---

## 2. REST API Endpoints

All routes are prefixed `/spray` (Kong strips `/v1`). Responses follow the platform-standard envelope:

```jsonc
// Success (2xx)
{ "success": true, "data": { ... } }

// Error (4xx / 5xx)
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

### 2.1 Health

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | None |

**Response:**
```json
{ "success": true, "data": { "status": "ok" } }
```

### 2.2 List Schedules

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/spray/schedules` | JWT required (any authenticated user) |

**Query parameters:** `node_id`, `enabled`, `ai_managed`

**Response:**
```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "id": "uuid",
        "node_id": "node-1",
        "output_name": "mister",
        "tag_name": "Misting Pump",
        "type": "interval",
        "params": { "on_sec": 10, "off_sec": 300, "value_on": 1, "value_off": 0 },
        "enabled": true,
        "ai_managed": true,
        "next_run_at": "2026-07-21T04:00:10Z",
        "created_at": "2026-07-21T03:00:00Z",
        "updated_at": "2026-07-21T03:00:00Z"
      }
    ],
    "count": 1
  }
}
```

### 2.3 Create Schedule

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/spray/schedules` | JWT required + role `admin` or `operator` |

**Request body (`SprayScheduleRequest`):**
```json
{
  "node_id": "node-1",
  "output_name": "mister",
  "type": "interval",
  "params": { "on_sec": 10, "off_sec": 300, "value_on": 1, "value_off": 0 },
  "enabled": true,
  "ai_managed": false
}
```

**Schedule types and `params` shapes:**

| Type | Params fields | Description |
|---|---|---|
| `interval` | `on_sec`, `off_sec`, `value_on` (default 1), `value_off` (default 0) | Repeating ON/OFF cycle. |
| `schedule` | `on_at` (`"HH:MM"`), `off_at` (`"HH:MM"`), `days` (0=Sun..6=Sat, empty=every day), `value_on`, `value_off` | Time-of-day ON/OFF (cron-like). |
| `threshold` | `source_key` (telemetry dot-path), `threshold_high`, `threshold_low`, `value_on`, `value_off` | Sensor-driven with hysteresis. |
| `duration` | `total_sec`, `value_on`, `value_off` | ON for `total_sec` once, then OFF (one-shot). |

**Response:** `201 Created` with the created `SpraySchedule` object.

### 2.4 Update Schedule

| Method | Path | Auth |
|--------|------|------|
| `PUT` | `/spray/schedules/{id}` | JWT required + role `admin` or `operator` |

**Request body:** Same `SprayScheduleRequest` shape as create (partial update supported).

**Response:** `200 OK` with updated `SpraySchedule` object.

### 2.5 Delete Schedule

| Method | Path | Auth |
|--------|------|------|
| `DELETE` | `/spray/schedules/{id}` | JWT required + role `admin` or `operator` |

**Response:**
```json
{ "success": true, "data": { "message": "schedule deleted" } }
```

### 2.6 List AI Analyses

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/spray/analyses` | JWT required (any authenticated user) |

**Query parameters:** `node_id`, `analysis_type` (`periodic`, `pump_off`, `manual`), `limit` (max 500), `offset`

**Response:**
```json
{
  "success": true,
  "data": {
    "analyses": [
      {
        "id": "uuid",
        "detection_id": "det-uuid",
        "node_id": "node-1",
        "analysis_type": "periodic",
        "root_length_cm": 12.5,
        "potato_condition": "healthy",
        "confidence": 0.89,
        "recommended_interval_sec": 300,
        "recommended_duration_sec": 15,
        "action_taken": "schedule_updated",
        "schedule_id": "sched-uuid",
        "created_at": "2026-07-21T04:00:00Z"
      }
    ],
    "count": 1
  }
}
```

### 2.7 List Snapshot Triggers

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/spray/snapshots` | JWT required (any authenticated user) |

**Query parameters:** `node_id`, `trigger_type` (`periodic_8h`, `pump_off`, `manual`), `analyzed`, `limit`, `offset`

**Response:**
```json
{
  "success": true,
  "data": {
    "triggers": [
      {
        "id": "uuid",
        "trigger_type": "pump_off",
        "node_id": "node-1",
        "stream_id": "stream-1",
        "snapshot_id": "snap-uuid",
        "analyzed": true,
        "analysis_id": "analysis-uuid",
        "created_at": "2026-07-21T04:00:00Z"
      }
    ],
    "count": 1
  }
}
```

### 2.8 Trigger Manual Snapshot

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/spray/snapshots/trigger` | JWT required + role `admin` or `operator` |

**Request body:**
```json
{
  "node_id": "node-1",
  "stream_id": "stream-1",
  "trigger_type": "manual"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trigger_id": "uuid",
    "snapshot_id": "snap-uuid",
    "status": "captured"
  }
}
```

---

## 3. Input Contracts

### 3.1 From ML Service (via NATS)

The ML Service publishes `detection.result` events. The Spray Service subscribes and parses:

```json
{
  "detection_uid": "uuid-string",
  "model_id": "vision-aeroponik",
  "model_name": "Vision Aeroponik",
  "source_type": "upload",
  "source_ref": "photo.jpg",
  "original_url": "http://localhost:9000/ml/original/20260721_120000_abc123_photo.jpg",
  "annotated_url": "http://localhost:9000/ml/detected/20260721_120000_abc123_photo.jpg",
  "num_detections": 3,
  "classes": ["plant", "fruit", "potato"],
  "detections": [
    {
      "class_id": 0,
      "class_name": "plant",
      "confidence": 0.89,
      "bbox": { "x1": 120, "y1": 45, "x2": 340, "y2": 210 }
    },
    {
      "class_id": 1,
      "class_name": "fruit",
      "confidence": 0.76,
      "bbox": { "x1": 200, "y1": 100, "x2": 400, "y2": 300 }
    }
  ],
  "confidence_min": 0.65,
  "confidence_max": 0.89,
  "confidence_avg": 0.77,
  "execution_time_ms": 142.35,
  "status": "success"
}
```

**Parsing rules:**
- `root_length_cm` = derived from bbox height of `plant` class detection (scaled by known camera distance factor)
- `potato_condition` = derived from `fruit` class detection confidence and bbox area
- If no `fruit` class detected → `potato_condition = "unknown"`

### 3.2 From Module Service (via NATS)

The Module Service publishes `telemetry.ingest` events. The Spray Service monitors:

```json
{
  "node_id": "node-1",
  "module_id": "module-1",
  "ts": "2026-07-21T04:00:00Z",
  "tags": {
    "sensors.temperature": { "value": 26.5, "unit": "C" },
    "sensors.humidity": { "value": 75.0, "unit": "%" },
    "outputs.pump": { "value": 1, "unit": "" },
    "outputs.mister": { "value": 0, "unit": "" }
  }
}
```

**Pump OFF detection:**
- Key: `PUMP_OFF_TELEMETRY_KEY` (default: `outputs.pump`)
- Condition: `value < PUMP_OFF_THRESHOLD` (default: `0`)
- Debounce: 30 seconds (prevent rapid ON/OFF toggling from triggering multiple snapshots)

### 3.3 From Dashboard / REST

The Dashboard sends:
1. **Schedule management** — `POST/GET/PUT/DELETE /spray/schedules`
2. **Manual snapshot** — `POST /spray/snapshots/trigger`
3. **Analysis history** — `GET /spray/analyses`

---

## 4. Output Contracts

### 4.1 To Control Service (REST)

When AI determines a schedule change is needed, Spray Service calls Control Service:

**Endpoint:** `PUT /control/schedules/{schedule_id}`  
**Auth:** JWT Bearer token (same as dashboard)

**Request body:**
```json
{
  "params": { "on_sec": 15, "off_sec": 250, "value_on": 1, "value_off": 0 }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "node_id": "node-1",
    "output_name": "mister",
    "type": "interval",
    "params": { "on_sec": 15, "off_sec": 250, "value_on": 1, "value_off": 0 },
    "enabled": true,
    "next_run_at": "2026-07-21T04:00:15Z"
  }
}
```

### 4.2 To Stream Service (REST)

When a snapshot is triggered, Spray Service calls Stream Service:

**Endpoint:** `POST /streams/{stream_id}/snapshot?detect=true`  
**Auth:** JWT Bearer token

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "snapshot-uuid",
    "stream_id": "stream-1",
    "kind": "detection",
    "url": "http://localhost:9000/stream/cctv-front/2026-07-21_040000_abc123_frame.jpg",
    "created_at": "2026-07-21T04:00:00Z"
  }
}
```

### 4.3 To ML Service (REST)

When a snapshot is captured, Spray Service calls ML Service for analysis:

**Endpoint:** `POST /ml/detect/from-stream`  
**Auth:** JWT Bearer token

**Request body:**
```json
{
  "object_key": "cctv-front/2026-07-21_040000_abc123_frame.jpg",
  "model_id": "vision-aeroponik",
  "conf": 0.3
}
```

**Response:** Same as ML Service `DetectResponse` (see `docs/integration-guides/ml.md`)

### 4.4 NATS Subjects (Outbox Relay)

All events are written to the local `outbox` table and relayed to NATS by a background worker (ADR-007).

| Subject | Event | Payload Shape |
|---|---|---|
| `spray.schedule.updated` | Schedule changed by AI | `{"event":"spray.schedule.updated","service":"spray","data":{"schedule_id":"...","node_id":"...","params":{...},"reason":"root_analysis","msg_id":"..."}}` |
| `spray.snapshot.captured` | Snapshot triggered | `{"event":"spray.snapshot.captured","service":"spray","data":{"trigger_id":"...","node_id":"...","snapshot_id":"...","trigger_type":"pump_off","msg_id":"..."}}` |
| `spray.analysis.completed` | ML analysis done | `{"event":"spray.analysis.completed","service":"spray","data":{"analysis_id":"...","detection_id":"...","root_length_cm":12.5,"potato_condition":"healthy","action_taken":"schedule_updated","msg_id":"..."}}` |
| `audit.log` | Various | Standard audit events (`spray.schedule.created`, `spray.schedule.updated`, `spray.snapshot.triggered`, etc.) |

---

## 5. Integration Steps

### 5.1 Setting Up the Service

1. **Add database:** Add `mariadb-spray` to `docker-compose.yml` with init script.
2. **Add environment variables:** Add `SPRAY_*` variables to `.env.example`.
3. **Add Kong route:** Add `/v1/spray` route to Kong configuration with JWT validation.
4. **Add Prometheus scrape:** Add `spray-service` job to `prometheus.yml`.
5. **Add mysqld-exporter target:** Add `MYSQL_DSN_10` for `mariadb-spray` to `mysqld-exporter-all`.

### 5.2 Calling Spray Service from Dashboard

1. **Obtain a JWT** from the Auth Service (`POST /auth/login`).
2. **Call read endpoints** with `Authorization: Bearer <token>`:
   - `GET /spray/schedules?node_id=...` — list spray schedules
   - `GET /spray/analyses?node_id=...` — view AI analysis history
   - `GET /spray/snapshots?node_id=...` — view snapshot triggers
3. **Send commands** with a token that has role `admin` or `operator`:
   - `POST /spray/schedules` — create AI-managed schedule
   - `PUT /spray/schedules/{id}` — update schedule params
   - `POST /spray/snapshots/trigger` — manual snapshot

### 5.3 Consuming Spray Events

Subscribe to `spray.schedule.updated` and `spray.analysis.completed` on NATS to receive real-time updates:

```python
import asyncio
import nats

async def main():
    nc = await nats.connect("nats://nats:4222")
    
    # Subscribe to schedule updates
    sub = await nc.subscribe("spray.schedule.updated")
    async for msg in sub.messages:
        print(f"Schedule updated: {msg.data.decode()}")
    
    # Subscribe to analysis completions
    sub2 = await nc.subscribe("spray.analysis.completed")
    async for msg in sub2.messages:
        print(f"Analysis completed: {msg.data.decode()}")

asyncio.run(main())
```

### 5.4 Integrating with Existing Services

#### Module Service (Telemetry)
- Spray Service subscribes to `telemetry.ingest` (Core NATS, no durable consumer needed for monitoring).
- No changes required to Module Service.

#### Control Service (Schedule Updates)
- Spray Service calls Control Service REST API (`PUT /control/schedules/{id}`).
- Control Service already supports schedule updates; no changes required.

#### Stream Service (Snapshots)
- Spray Service calls Stream Service REST API (`POST /streams/{id}/snapshot?detect=true`).
- Stream Service already supports snapshot capture with detection; no changes required.

#### ML Service (Analysis)
- Spray Service calls ML Service REST API (`POST /ml/detect/from-stream`).
- ML Service already supports inference from stream bucket; no changes required.

---

## 6. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `DB_DSN` | `spray_user:spray_pass@tcp(mariadb-spray:3306)/spray_db?parseTime=true&charset=utf8mb4` | MariaDB DSN |
| `NATS_URL` | `nats://nats:4222` | NATS server URL |
| `JWT_SECRET` | `""` | Shared HMAC secret for JWT validation (same as Auth Service) |
| `REDIS_ADDR` | `redis-shared:6379` | Redis address |
| `REDIS_PASSWORD` | `""` | Redis password |
| `REDIS_DB` | `4` | Redis logical DB for spray cache |
| `MODULE_URL` | `http://module:8080` | Module Service base URL |
| `CONTROL_URL` | `http://control:8080` | Control Service base URL |
| `STREAM_URL` | `http://stream:8080` | Stream Service base URL |
| `ML_URL` | `http://ml:8080` | ML Service base URL |
| `SNAPSHOT_INTERVAL_HOURS` | `8` | Periodic snapshot interval in hours |
| `PUMP_OFF_TELEMETRY_KEY` | `outputs.pump` | Telemetry key to monitor for OFF events |
| `PUMP_OFF_THRESHOLD` | `0` | Value below which pump is considered OFF |
| `TIMEZONE` | `UTC` | IANA timezone for schedule evaluation |
| `SCHEDULE_UPDATE_COOLDOWN_MIN` | `30` | Minimum minutes between AI schedule updates |
| `AUTO_APPLY_SCHEDULE` | `true` | If `true`, AI updates are applied automatically |

---

## 7. Database Schema Overview

The Spray Service owns `spray_db` with four tables, managed by GORM AutoMigrate.

### 7.1 `spray_schedules`

Spray-specific schedule definitions.

| Column | Type | Key | Description |
|---|---|---|---|
| `id` | `char(36)` | PK | UUID |
| `node_id` | `varchar(100)` | Index | Target node |
| `output_name` | `varchar(100)` | — | Target output (e.g., `mister`, `pump`) |
| `tag_name` | `varchar(128)` | — | Friendly tag name |
| `type` | `varchar(16)` | — | `interval`, `schedule`, `threshold`, `duration` |
| `params` | `longtext` | — | JSON object, shape depends on `type` |
| `enabled` | `bool` | — | Default `0` |
| `ai_managed` | `bool` | — | `1` if schedule is controlled by AI |
| `next_run_at` | `timestamp` | — | Next scheduled execution time |
| `created_at` | `timestamp` | — | Creation time |
| `updated_at` | `timestamp` | — | Last update time |

### 7.2 `ai_analyses`

History of ML analysis results.

| Column | Type | Key | Description |
|---|---|---|---|
| `id` | `char(36)` | PK | UUID |
| `detection_id` | `varchar(64)` | Index | ML detection UID (from `detection.result`) |
| `node_id` | `varchar(100)` | Index | Target node |
| `analysis_type` | `varchar(32)` | — | `periodic`, `pump_off`, `manual` |
| `root_length_cm` | `float` | — | Estimated root length from ML |
| `potato_condition` | `varchar(32)` | — | `healthy`, `moderate`, `poor`, `diseased` |
| `confidence` | `float` | — | ML confidence score |
| `recommended_interval_sec` | `int` | — | AI-recommended misting interval |
| `recommended_duration_sec` | `int` | — | AI-recommended misting duration |
| `action_taken` | `varchar(32)` | — | `schedule_updated`, `no_change`, `manual_review` |
| `schedule_id` | `char(36)` | Index | Schedule that was updated (if any) |
| `raw_detections` | `longtext` | — | Full ML detection JSON |
| `created_at` | `timestamp` | — | Analysis time |

### 7.3 `snapshot_triggers`

Log of snapshot triggers.

| Column | Type | Key | Description |
|---|---|---|---|
| `id` | `char(36)` | PK | UUID |
| `trigger_type` | `varchar(16)` | — | `periodic_8h`, `pump_off`, `manual` |
| `node_id` | `varchar(100)` | Index | Target node |
| `stream_id` | `varchar(100)` | — | Stream identifier |
| `snapshot_id` | `varchar(64)` | Index | Snapshot ID from Stream Service |
| `analyzed` | `bool` | — | `1` if ML analysis completed |
| `analysis_id` | `char(36)` | Index | FK to `ai_analyses.id` |
| `created_at` | `timestamp` | — | Trigger time |

### 7.4 `outbox`

Transactional Outbox table (ADR-007).

| Column | Type | Key | Description |
|---|---|---|---|
| `id` | `char(36)` | PK | UUID |
| `msg_id` | `varchar(64)` | Unique index | Idempotency key (also sent as NATS `Nats-Msg-Id` header) |
| `subject` | `varchar(128)` | Index | NATS subject |
| `payload` | `longtext` | — | JSON event payload |
| `sent` | `bool` | Index | `0` = pending, `1` = delivered |
| `created_at` | `timestamp` | — | Row creation time |
| `sent_at` | `timestamp` | — | Set after successful NATS publish |

---

## 8. Example curl Commands

Assume Kong is reachable at `http://localhost:8000` and JWT token is stored in `$TOKEN`.

```bash
# Health
curl -s http://localhost:8000/health | jq

# List schedules for a node
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/spray/schedules?node_id=node-1" | jq

# Create AI-managed schedule
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "node-1",
    "output_name": "mister",
    "type": "interval",
    "params": {"on_sec": 10, "off_sec": 300, "value_on": 1, "value_off": 0},
    "enabled": true,
    "ai_managed": true
  }' \
  http://localhost:8000/v1/spray/schedules | jq

# Update schedule params (AI-driven)
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"params": {"on_sec": 15, "off_sec": 250, "value_on": 1, "value_off": 0}}' \
  http://localhost:8000/v1/spray/schedules/<schedule-id> | jq

# List AI analyses
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/spray/analyses?node_id=node-1&limit=10" | jq

# List snapshot triggers
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/spray/snapshots?node_id=node-1" | jq

# Manual snapshot trigger
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"node_id":"node-1","stream_id":"stream-1","trigger_type":"manual"}' \
  http://localhost:8000/v1/spray/snapshots/trigger | jq

# Delete schedule
curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/spray/schedules/<schedule-id> | jq
```

---

## 9. Error Reference

| HTTP Status | Error Code | Meaning |
|---|---|---|
| `400` | `BAD_REQUEST` | Invalid input (missing fields, value out of range, unknown type). |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT. |
| `403` | `FORBIDDEN` | Authenticated but insufficient role. |
| `404` | `NOT_FOUND` | Schedule or resource not found. |
| `409` | `CONFLICT` | Schedule is AI-managed and cannot be modified manually. |
| `502` | `UPSTREAM_ERROR` | Failed to reach upstream service (Control/Stream/ML/Module). |
| `503` | `INTERNAL_ERROR` | Service unavailable (NATS/DB down). |
| `500` | `INTERNAL_ERROR` | Unexpected server error. |

---

## 10. Resilience & Operational Notes

- **NATS unavailability:** Events are buffered in the `outbox` table and relayed once NATS recovers (ADR-007).
- **Stream Service dependency:** Snapshot capture requires Stream Service. If unavailable, the trigger is queued in Redis (DB4) and retried.
- **ML Service dependency:** Analysis requires ML Service. If unavailable, snapshot is captured but analysis is deferred.
- **Control Service dependency:** Schedule updates require Control Service. If unavailable, updates are queued and retried.
- **Schedule cooldown:** Prevents rapid schedule oscillation by enforcing a minimum interval between AI updates (`SCHEDULE_UPDATE_COOLDOWN_MIN`).
- **Graceful shutdown:** Drains in-flight requests, cancels the periodic snapshot cron, stops the outbox relay, and disconnects NATS cleanly on `SIGINT`/`SIGTERM`.

---

## 11. File Layout Reference

```
services/spray/
├── Dockerfile
├── go.mod
├── go.sum
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── model/
│   │   └── model.go
│   ├── repository/
│   │   ├── schedule_repo.go
│   │   ├── analysis_repo.go
│   │   ├── snapshot_repo.go
│   │   └── outbox_repo.go
│   ├── cache/
│   │   └── redis.go
│   ├── service/
│   │   ├── schedule_service.go
│   │   ├── analysis_service.go
│   │   ├── snapshot_service.go
│   │   ├── ai_engine.go
│   │   └── outbox_relay.go
│   ├── handler/
│   │   └── handler.go
│   ├── middleware/
│   │   └── middleware.go
│   ├── nats/
│   │   ├── telemetry_sub.go
│   │   └── detection_sub.go
│   └── cron/
│       └── periodic_snapshot.go
└── main.go
```

---

*Dokumen ini berisi kontrak integrasi untuk Spray Automation Service. Untuk arsitektur dan rencana implementasi, lihat `docs/spray-automation.md`.*
