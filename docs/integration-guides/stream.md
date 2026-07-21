# Stream Service — Integration Guide

## 1. Overview

The **Stream Service** manages video streaming for CCTV and ESP32-CAM devices in the IoT aeroponic monitoring system. It acts as the metadata and control plane between the dashboard, MediaMTX (HLS/WebRTC/RTSP), MinIO (object storage), and the ML/Vision service.

| Property | Value |
|---|---|
| **Service** | Stream |
| **Port** | `8080` (configurable via `PORT`) |
| **Protocol** | REST/JSON (Chi router) |
| **Database** | MariaDB `stream_db` (per-service isolation) |
| **Object Storage** | MinIO bucket `stream` (snapshots/recordings) + `ml-result` (AI detections) |
| **Video Engine** | MediaMTX v3 Control API |
| **ML Integration** | HTTP client to ML/Vision service (`POST /ml/detect`) |
| **Auth** | Shared JWT (HMAC) via middleware; operator/admin role checks for write routes |
| **Gateway** | Routed through Kong (prefix `/v1` stripped by Kong) |

### Key Responsibilities
- Register and reconcile RTSP source paths in MediaMTX.
- Expose HLS and WebRTC playback URLs to the dashboard.
- Capture snapshots (plain frames or AI-detected frames) and store them in MinIO.
- Record video clips via ffmpeg and upload them to MinIO.
- Proxy private MinIO objects through JWT-authenticated endpoints.
- Self-heal MediaMTX path drift on restart via periodic reconciliation.

---

## 2. REST API Endpoints

All endpoints return JSON using the standard wrapper:

- **Success (2xx):** `{ "success": true, "data": <payload> }`
- **Error (4xx/5xx):** `{ "success": false, "error": { "code": "<ERROR_CODE>", "message": "<english_message>" } }`

### 2.1 Public Endpoints

#### `GET /health`
Liveness probe. No authentication.

**Response:**
```json
{ "success": true, "data": { "status": "ok" } }
```

---

### 2.2 Stream CRUD (`/streams`)

All stream routes require JWT authentication. Write routes additionally require role `admin` or `operator`.

#### `GET /streams`
List all streams, optionally scoped to a module.

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `module_id` | string | No | Filter streams by owning module UUID |

**Response:**
```json
{
  "success": true,
  "data": {
    "streams": [
      {
        "id": "uuid",
        "name": "cam-01",
        "device_label": "Front Gate",
        "location": "Zone A",
        "source_rtsp": "rtsp://user:pass@192.168.1.100:554/stream",
        "node_id": "node-uuid",
        "module_id": "module-uuid",
        "enabled": true,
        "status": "ready",
        "hls_url": "http://localhost:8000/hls/cam-01/index.m3u8",
        "webrtc_url": "http://localhost:8889/cam-01/whep",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

> **Note:** `source_rtsp` is redacted in responses (credentials stripped) for security.

#### `GET /streams/{id}`
Retrieve a single stream with live status and playback URLs.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "cam-01",
    "device_label": "Front Gate",
    "location": "Zone A",
    "source_rtsp": "rtsp://192.168.1.100:554/stream",
    "node_id": "node-uuid",
    "module_id": "module-uuid",
    "enabled": true,
    "status": "ready",
    "hls_url": "http://localhost:8000/hls/cam-01/index.m3u8",
    "webrtc_url": "http://localhost:8889/cam-01/whep",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 404 | `NOT_FOUND` | Stream does not exist |

#### `POST /streams`
Register a new CCTV stream. Writes to DB and registers path in MediaMTX.

**Request Body:**
```json
{
  "name": "cam-01",
  "device_label": "Front Gate",
  "location": "Zone A",
  "source_rtsp": "rtsp://user:pass@192.168.1.100:554/stream",
  "node_id": "node-uuid",
  "module_id": "module-uuid"
}
```

**Field Rules:**
- `name` (required): Alphanumeric, `.`, `_`, `-` only. Max 64 chars. Must be a valid MediaMTX path segment.
- `source_rtsp` (optional): If omitted, the service falls back to the configured `CCTV_RTSP_URL` default.
- `node_id` (optional): Bind to a device node for dashboard scoping.
- `module_id` (optional): Bind to a module for dashboard scoping.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "cam-01",
    "device_label": "Front Gate",
    "location": "Zone A",
    "source_rtsp": "rtsp://192.168.1.100:554/stream",
    "node_id": "node-uuid",
    "module_id": "module-uuid",
    "enabled": true,
    "status": "idle",
    "hls_url": "http://localhost:8000/hls/cam-01/index.m3u8",
    "webrtc_url": "http://localhost:8889/cam-01/whep",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid body or missing `name` |
| 409 | `CONFLICT` | Stream name already exists |
| 502 | `BAD_GATEWAY` | Failed to register path with MediaMTX |

#### `PUT /streams/{id}`
Patch stream metadata. Changing `name` or `source_rtsp` triggers MediaMTX path re-registration (old path removed, new path added).

**Request Body:**
```json
{
  "name": "cam-02",
  "device_label": "Back Door",
  "location": "Zone B",
  "source_rtsp": "rtsp://user:pass@192.168.1.101:554/stream",
  "enabled": false,
  "node_id": "node-uuid-2",
  "module_id": "module-uuid-2"
}
```

All fields are optional (partial update).

**Response (200):** Same shape as `GET /streams/{id}`.

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid stream name (path traversal risk) |
| 404 | `NOT_FOUND` | Stream does not exist |
| 502 | `BAD_GATEWAY` | Failed to re-register MediaMTX path |

#### `DELETE /streams/{id}`
Remove the MediaMTX path and delete the DB row.

**Response:**
```json
{ "success": true, "data": { "message": "stream deleted" } }
```

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 404 | `NOT_FOUND` | Stream does not exist |
| 502 | `BAD_GATEWAY` | Failed to remove MediaMTX path |

---

### 2.3 Snapshot & Recording (`/streams/{id}`)

Write routes require `admin` or `operator` role.

#### `POST /streams/{id}/snapshot`
Capture the current frame from the live stream.

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `detect` | boolean | No | Set `true` or `1` to run AI object detection on the captured frame |

**Behavior:**
- `detect=false` (default): Frame is uploaded to MinIO bucket `stream` under `snapshots/{name}/{uuid}.jpg`. A `Snapshot` row with `kind="snapshot"` is stored in the DB.
- `detect=true`: Frame is sent to the ML/Vision service (`POST /ml/detect`). The result (frame + detection JSON + annotated image) is stored in the shared `ml-result` bucket. No row is written to the Stream DB's `snapshots` table for detections.

**Response (201) — plain snapshot:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "stream_id": "stream-uuid",
    "stream_name": "cam-01",
    "module_id": "module-uuid",
    "url": "/storage/stream/snapshots/cam-01/uuid.jpg",
    "kind": "snapshot",
    "size": 102400,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

**Response (201) — AI detection:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "stream_id": "stream-uuid",
    "stream_name": "cam-01",
    "kind": "detection",
    "size": 102400,
    "created_at": "2026-01-01T00:00:00Z",
    "model_id": "yolov8n",
    "model_name": "YOLOv8 Nano",
    "num_detections": 2,
    "classes": "[\"person\", \"car\"]",
    "detections": "[{\"class_id\":0,\"class_name\":\"person\",\"confidence\":0.92,\"bbox\":{\"x1\":10,\"y1\":20,\"x2\":100,\"y2\":200}}]",
    "confidence_avg": 0.88
  }
}
```

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid stream ID |
| 502 | `BAD_GATEWAY` | MediaMTX snapshot failed, or ML detection failed |

#### `POST /streams/{id}/record/start`
Begin recording the stream via ffmpeg (RTSP pull from MediaMTX relay).

**Response:**
```json
{ "success": true, "data": { "message": "recording started" } }
```

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 502 | `BAD_GATEWAY` | ffmpeg failed to start, or recording already in progress |

#### `POST /streams/{id}/record/stop`
Stop the active ffmpeg recording, finalize the MP4, upload to MinIO, and create a `kind="recording"` snapshot row.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "stream_id": "stream-uuid",
    "stream_name": "cam-01",
    "module_id": "module-uuid",
    "url": "/storage/stream/recordings/cam-01/uuid.mp4",
    "kind": "recording",
    "size": 5242880,
    "duration": 12.5,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 502 | `BAD_GATEWAY` | No active recording, or stream unavailable |

---

### 2.4 Snapshots Gallery (`/snapshots`)

All snapshot routes require JWT. Delete requires `admin` or `operator`.

#### `GET /snapshots`
List all snapshots/recordings (newest first).

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `kind` | string | No | Filter by `snapshot`, `recording`, or `detection` |
| `module_id` | string | No | Filter by owning module UUID |

**Response:**
```json
{
  "success": true,
  "data": {
    "snapshots": [
      {
        "id": "uuid",
        "stream_id": "stream-uuid",
        "stream_name": "cam-01",
        "module_id": "module-uuid",
        "url": "/storage/stream/snapshots/cam-01/uuid.jpg",
        "kind": "snapshot",
        "size": 102400,
        "created_at": "2026-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

#### `GET /snapshots/{id}`
Retrieve a single snapshot view.

**Response:** Same as a single element from `ListSnapshots`.

#### `DELETE /snapshots/{id}`
Delete the snapshot row and remove the object from MinIO.

**Response:**
```json
{ "success": true, "data": { "message": "snapshot deleted" } }
```

---

### 2.5 Object Storage Proxy (`/storage/*`)

#### `GET /storage/{bucket}/{key...}`
Stream a private MinIO object through the Stream Service using its scoped credentials. The bucket must be one of: `stream`, `ml-result`, `mlbucket`, `ml`, `ota`.

**Headers:**
| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt>` |
| `Content-Type` | Set from MinIO object metadata |
| `Content-Length` | Set from MinIO object size |
| `Cache-Control` | `private, max-age=300` |

**Error Codes:**
| HTTP | Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid storage path (expected `/storage/{bucket}/{key}`) |
| 404 | `NOT_FOUND` | Object not found in MinIO |

---

## 3. Input Contracts

### 3.1 From Dashboard / REST Clients
The Stream Service receives standard HTTP requests through Kong:

| Input | Source | Format |
|---|---|---|
| Stream CRUD | Dashboard | JSON body with stream metadata |
| Snapshot/Recording commands | Dashboard | URL params (`?detect=true`) |
| Object reads | Dashboard `<img>` / `<video>` | Proxied `GET /storage/*` with JWT in header or `?token=` query param |
| Module scoping | Dashboard | `?module_id=` query param on list endpoints |

### 3.2 From MediaMTX (video engine)
The service interacts with MediaMTX via its Control API (v3):

| Direction | Endpoint | Purpose |
|---|---|---|
| Outbound | `POST /v3/config/paths/add/{name}` | Register RTSP source path |
| Outbound | `DELETE /v3/config/paths/delete/{name}` | Remove path on stream delete |
| Outbound | `GET /v3/config/paths/get/{name}` | Check if path exists (idempotent reconcile) |
| Outbound | `GET /v3/paths/get/{name}` | Read runtime state (`idle`/`waiting`/`ready`/`running`) |
| Outbound | `PATCH /v3/config/paths/patch/{name}` | Toggle recording flag |
| Outbound | `rtsp://mediamtx:8554/{name}` | Pull single frame via ffmpeg for snapshots |
| Outbound | `http://mediamtx:8888/{name}/index.m3u8` | HLS playback origin |
| Outbound | `http://localhost:8889/{name}/whep` | WebRTC WHEP playback (host-direct, cannot traverse Kong) |

### 3.3 From MinIO (object storage)
| Direction | Method | Purpose |
|---|---|---|
| Outbound | `PutObject` | Upload snapshots (`snapshots/{name}/{uuid}.jpg`) |
| Outbound | `PutObject` | Upload recordings (`recordings/{name}/{uuid}.mp4`) |
| Outbound | `PutObject` | Upload ML results to `ml-result` bucket (`frames/`, `results/`, `annotated/`) |
| Outbound | `GetObject` | Serve objects via `/storage/*` proxy |
| Outbound | `RemoveObject` | Delete objects when snapshot is deleted |

### 3.4 From ML / Vision Service
| Direction | Method | Purpose |
|---|---|---|
| Outbound | `POST /ml/detect` (multipart) | Run object detection on captured JPEG frame |

The Stream Service mints a short-lived service JWT (15 min TTL) with roles `admin` + `operator` using the shared `JWT_SECRET` so it satisfies the ML Service's RBAC without contacting the Auth Service at runtime.

---

## 4. Output Contracts

### 4.1 Playback URLs
Every `StreamView` includes two playback URLs consumed by the dashboard:

| Field | Format | Notes |
|---|---|---|
| `hls_url` | `{KONG_PUBLIC_URL}/hls/{name}/index.m3u8` | Played via HLS.js or native HLS |
| `webrtc_url` | `http://{KONG_HOSTNAME}:8889/{name}/whep` | WHEP offer/answer; host-direct because WebRTC media/STUN cannot traverse Kong |

### 4.2 Object URLs
Snapshots and recordings are stored in MinIO and surfaced as same-origin proxy URLs:

| Type | URL Pattern | MinIO Bucket | Prefix |
|---|---|---|---|
| Plain snapshot | `/storage/stream/snapshots/{name}/{uuid}.jpg` | `stream` | `snapshots/` |
| Recording | `/storage/stream/recordings/{name}/{uuid}.mp4` | `stream` | `recordings/` |
| AI detection frame | `/storage/ml-result/frames/{name}/{ts}.jpg` | `ml-result` | `frames/` |
| AI detection JSON | `/storage/ml-result/results/{name}/{ts}.json` | `ml-result` | `results/` |
| AI annotated image | `/storage/ml-result/annotated/{name}/{ts}.jpg` | `ml-result` | `annotated/` |

### 4.3 NATS Subjects
The Stream Service does **not** publish or subscribe to any NATS subjects. It is a pure REST service with outbound HTTP dependencies (MediaMTX, MinIO, ML).

---

## 5. Integration Steps for New Services

### 5.1 Consuming Stream Metadata
If your service needs to know which streams exist or their status:

1. Call `GET /v1/streams` (any authenticated user).
2. Filter by `module_id` if your service is scoped to a specific module.
3. Use `status` to determine if a stream is `ready`/`running` before depending on it.

### 5.2 Triggering Snapshots / Recordings
1. Authenticate with a user JWT that has `admin` or `operator` role.
2. `POST /v1/streams/{id}/snapshot?detect=true` to capture an AI-detected frame.
3. `POST /v1/streams/{id}/record/start` and `POST /v1/streams/{id}/record/stop` to create a recording clip.

### 5.3 Reading Stored Media
1. Authenticate with any valid user JWT.
2. Call `GET /v1/storage/{bucket}/{key}` where `bucket` is one of the allowed buckets.
3. Alternatively, call `GET /v1/snapshots` and follow the `url` field (also a `/storage/*` path).

### 5.4 Calling the Stream Service from Another Service
If you need to call the Stream Service from another backend service (e.g., a cron job or alert handler):

1. Use the internal Docker network hostname: `http://stream:8080`.
2. Strip the `/v1` prefix (Kong strips it at the edge, but internal calls go directly to the service).
3. Include the JWT in the `Authorization` header, or mint a service JWT using the shared `JWT_SECRET`.

---

## 6. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `DB_DSN` | `app:app1234@tcp(mariadb-stream:3306)/stream_db?parseTime=true&charset=utf8mb4` | MariaDB connection string |
| `MEDIAMTX_API_URL` | `http://mediamtx:9997` | MediaMTX Control API base URL |
| `MEDIAMTX_HTTP_URL` | `http://mediamtx:8888` | MediaMTX HTTP/HLS server base URL |
| `MEDIAMTX_RTSP_URL` | `rtsp://mediamtx:8554` | MediaMTX RTSP server base URL |
| `CCTV_RTSP_URL` | `""` | Default RTSP source when `source_rtsp` is omitted on create |
| `KONG_PUBLIC_URL` | `http://localhost:8000` | Public Kong URL; used to build `hls_url` |
| `JWT_SECRET` | `""` | Shared HMAC secret for JWT validation. Empty disables enforcement (dev only). |
| `MINIO_ENDPOINT` | `minio:9000` | MinIO server endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_USE_SSL` | `false` | Enable HTTPS for MinIO |
| `MINIO_STREAM_BUCKET` | `stream` | Bucket for snapshots and recordings |
| `MINIO_RESULT_BUCKET` | `ml-result` | Shared bucket for AI detection results |
| `ML_BASE_URL` | `http://ml:8080` | ML/Vision service root URL |
| `ML_VISION_MODEL_ID` | `""` | Default model ID for AI detection |
| `RECONCILE_INTERVAL_SECONDS` | `30` | Periodic MediaMTX path reconcile interval (0 = startup only) |

---

## 7. Database Schema Overview

The Stream Service uses a single MariaDB database (`stream_db`) with two tables. Schema is managed by GORM AutoMigrate at startup.

### 7.1 `streams`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `char(36)` | PRIMARY KEY | UUID |
| `name` | `varchar(64)` | UNIQUE, NOT NULL | MediaMTX path name |
| `device_label` | `varchar(128)` | NULLABLE | Human-readable device name |
| `location` | `varchar(128)` | NULLABLE | Physical location tag |
| `source_rtsp` | `varchar(512)` | NOT NULL | RTSP source URL (may include CCTV credentials) |
| `node_id` | `char(36)` | INDEX, NULLABLE | Owning device node UUID |
| `module_id` | `char(36)` | INDEX, NULLABLE | Owning module UUID (denormalized for filtering) |
| `enabled` | `bool` | NOT NULL, DEFAULT true | Soft enable/disable |
| `created_at` | `datetime` | autoCreateTime | |
| `updated_at` | `datetime` | autoUpdateTime | |

### 7.2 `snapshots`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `char(36)` | PRIMARY KEY | UUID |
| `stream_id` | `char(36)` | INDEX, NULLABLE | Parent stream UUID |
| `stream_name` | `varchar(64)` | NULLABLE | Parent stream name (denormalized) |
| `module_id` | `char(36)` | INDEX, NULLABLE | Owning module UUID (denormalized from stream) |
| `object_key` | `varchar(512)` | NOT NULL | MinIO object key |
| `url` | `varchar(1024)` | NOT NULL | Proxied URL (`/storage/...`) |
| `content_type` | `varchar(64)` | NULLABLE | MIME type (`image/jpeg`, `video/mp4`) |
| `size` | `bigint` | NULLABLE | Object size in bytes |
| `kind` | `varchar(16)` | DEFAULT `snapshot` | One of: `snapshot`, `recording`, `detection` |
| `model_id` | `varchar(64)` | NULLABLE | ML model ID (for `detection` kind) |
| `model_name` | `varchar(255)` | NULLABLE | ML model display name |
| `num_detections` | `int` | NULLABLE | Number of detected objects |
| `classes` | `text` | NULLABLE | JSON array of class names |
| `detections` | `mediumtext` | NULLABLE | JSON array of detection objects |
| `confidence_avg` | `double` | NULLABLE | Average confidence across detections |
| `duration` | `double` | NULLABLE | Recording length in seconds (for `recording` kind) |
| `created_at` | `datetime` | autoCreateTime | |

---

## 8. Example curl Commands

Assumptions:
- Kong public URL: `http://localhost:8000`
- JWT token: stored in `$TOKEN`
- Stream ID: `stream-uuid-123`
- Stream name: `cam-01`

### 8.1 Health Check
```bash
curl -s http://localhost:8080/health
```

### 8.2 List Streams
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/streams
```

### 8.3 List Streams Scoped to Module
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/streams?module_id=module-uuid-456"
```

### 8.4 Create Stream
```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cam-01",
    "device_label": "Front Gate",
    "location": "Zone A",
    "source_rtsp": "rtsp://user:pass@192.168.1.100:554/stream",
    "node_id": "node-uuid",
    "module_id": "module-uuid"
  }' \
  http://localhost:8000/v1/streams
```

### 8.5 Get Stream
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/streams/stream-uuid-123
```

### 8.6 Update Stream
```bash
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_label": "Back Door",
    "enabled": false
  }' \
  http://localhost:8000/v1/streams/stream-uuid-123
```

### 8.7 Delete Stream
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/streams/stream-uuid-123
```

### 8.8 Capture Snapshot (plain)
```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/streams/stream-uuid-123/snapshot
```

### 8.9 Capture Snapshot with AI Detection
```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/streams/stream-uuid-123/snapshot?detect=true"
```

### 8.10 Start Recording
```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/streams/stream-uuid-123/record/start
```

### 8.11 Stop Recording
```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/streams/stream-uuid-123/record/stop
```

### 8.12 List Snapshots
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/snapshots?module_id=module-uuid-456&kind=snapshot"
```

### 8.13 Get Snapshot
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/snapshots/snapshot-uuid-789
```

### 8.14 Delete Snapshot
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/snapshots/snapshot-uuid-789
```

### 8.15 Serve Object from MinIO
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/storage/stream/snapshots/cam-01/uuid.jpg \
  -o frame.jpg
```

### 8.16 Direct HLS Playback (browser)
```html
<video controls autoplay
  src="http://localhost:8000/hls/cam-01/index.m3u8"
  type="application/x-mpegURL">
</video>
```

### 8.17 Direct WebRTC Playback (WHEP, host-direct)
The WebRTC WHEP endpoint requires an HTTP POST with an SDP offer. The `webrtc_url` field in the stream response gives the exact endpoint. Because WebRTC media cannot traverse Kong, the URL points directly at MediaMTX's WebRTC port (`8889`) on the host.

Example using `curl` to test the WHEP handshake:
```bash
curl -s -X POST \
  -H "Content-Type: application/sdp" \
  --data-binary @offer.sdp \
  "http://localhost:8889/cam-01/whep"
```

---

## 9. Security & Resilience Notes

- **JWT Enforcement:** When `JWT_SECRET` is set, all protected routes reject requests without a valid Bearer token. The middleware also accepts `?token=` as a query parameter fallback for `<img>`/`<video>` elements that cannot set headers.
- **Role Checks:** Write operations (`POST`, `PUT`, `DELETE` on streams; `DELETE` on snapshots; `POST` on recordings/snapshots) require `admin` or `operator` role.
- **RTSP Credential Redaction:** `source_rtsp` is stripped of embedded credentials (`rtsp://user:pass@host`) before being returned in API responses or logs.
- **Path Traversal Guard:** Stream names must match `^[A-Za-z0-9_.-]{1,64}$`. Slashes, `..`, whitespace, and NUL bytes are rejected to prevent MediaMTX path escape.
- **MediaMTX Path Drift:** API-registered paths are ephemeral and lost on MediaMTX restart. The service reconciles paths at startup and on a configurable timer (`RECONCILE_INTERVAL_SECONDS`). `GetStream` also lazily re-registers missing paths.
- **Graceful Degradation:** If MinIO is unreachable at startup, the service continues running (snapshots/recordings will fail with "client not configured"). If MediaMTX is down, stream metadata still works but playback URLs will return errors until MediaMTX recovers.
- **WriteTimeout:** The HTTP server uses a 120-second write timeout to accommodate snapshot capture retries and ML inference without Kong returning 504.
