# 🗺️ Roadmap — IOT-Modular-Microservice

> **Versi:** 2.0.0  
> **Terakhir diperbarui:** 2026-07-11  
> **Status legend:** 🔴 P1 (Kritikal) · 🟡 P2 (Penting) · 🟢 P3 (Normal) · ⬜ P4 (Opsional)  
> **Progress:** `[ ]` Belum · `[/]` In Progress · `[x]` Selesai

---

## 📊 Status Keseluruhan

**Fase 1 (Auth + Dashboard Auth) ✅ · Fase 2 (Module Service) ✅ · Fase 3 (Analytics + WS-Gateway Partial) ✅**

### Yang sudah berjalan end-to-end:
| Alur | Status |
|------|--------|
| Auth Service (register, login, JWT, refresh token, RBAC, manajemen akun) | ✅ |
| Module Service (onboarding device via MQTT discovery, pair/unpair, telemetry ingest, batch NATS) | ✅ |
| Analytics Service (subscribe `telemetry.batch` → `timescaledb-analytics` → continuous aggregate → dashboard via Kong) | ✅ |
| WS-Gateway (NATS → WebSocket bridge + JWT auth, route `/ws` via Kong) | ✅ |
| Dashboard React (Auth + Analytics + Module Management via Kong) | ✅ |
| Prometheus (scrape auth, module, analytics, wsgateway, kong — semua UP) | ✅ |
| Seed akun admin default + Manajemen Akun (Admin only) | ✅ |

### Yang belum dikerjakan:
| Service | Fase | Prioritas |
|---------|------|-----------|
| Control Service | Fase 4 | 🔴 P1 |
| Alert Service | Fase 5 | 🔴 P1 |
| Audit Service | Fase 8 | 🔴 P1 |
| Notification Service | Fase 5 | 🟡 P2 |
| Dashboard Device Management | Fase 9 | 🟡 P2 |
| Export Service / Data API | Fase 9b | 🟢 P3 |
| Stream Service | Fase 6 | 🟢 P3 |
| ML / Vision API | Fase 7 | 🟢 P3 |
| OTA Service | Fase 10 | ⬜ P4 |
| Prometheus Metrics Service | Fase 11 | ⬜ P4 |
| Cloudflare Tunnel | Fase 12 | ⬜ P4 |

---

## 🔴 Fase 1 — Auth Service (P1 — Selesai)

> Fondasi keamanan sistem. Semua service lain bergantung pada Auth untuk validasi token.

| Status | Item | Deskripsi | Endpoint / Detail |
|---|---|---|---|
| `[x]` | Scaffold Go service | `go.mod`, `main.go`, struktur `internal/` | `services/auth/` |
| `[x]` | `POST /auth/register` | Registrasi user baru, hash password bcrypt | Public route via Kong |
| `[x]` | `POST /auth/login` | Validasi kredensial (email/username), issuing JWT + Refresh Token | Public route via Kong |
| `[x]` | `POST /auth/refresh` | Refresh Token rotation — revoke lama, issue baru | Public route via Kong |
| `[x]` | `POST /auth/logout` | Revoke refresh token aktif | Protected (JWT) |
| `[x]` | `GET /auth/me` | Profil user aktif (dari JWT) | Protected (JWT) |
| `[x]` | RBAC Middleware | Cek role (Admin/Operator/Viewer) per route | 3 level akses |
| `[x]` | NATS publisher | Publish `audit.log` saat login/logout/register/error | Subject: `audit.log` |
| `[x]` | Retention cron | Hapus `refresh_tokens` expired + soft-delete user inaktif > 365 hari | Daily 02:00 / Sunday 03:00 |
| `[x]` | `GET /health` | Healthcheck endpoint untuk Kong upstream | `auth:8080/health` |
| `[x]` | Seed akun admin default | Auto-create admin (env `ADMIN_*`) saat migrasi pertama; idempoten | `admin@smartfarm.local` |
| `[x]` | `GET /auth/users` | List semua akun (admin only) | Protected (Admin) |
| `[x]` | `GET /auth/roles` | List role tersedia (admin only) | Protected (Admin) |
| `[x]` | `PUT /auth/users/{id}` | Admin ubah status aktif + peran akun | Protected (Admin) |
| `[x]` | `DELETE /auth/users/{id}` | Admin hapus (soft-delete) akun | Protected (Admin) |
| `[x]` | Guard admin | Blokir self-deactivate/demote & hapus admin terakhir | 403/409 error |
| `[x]` | `Dockerfile` multi-stage | Build Go binary + minimal runtime image | `golang:1.22-alpine` → `alpine:3.19` |
| `[x]` | Prometheus `/metrics` | Instrumentasi HTTP (client_golang) + scrape via Prometheus server | `auth:8080/metrics` |

### Database: `mariadb-auth`

| Tabel | Fungsi |
|---|---|
| `users` | Data user (email, username, password_hash, is_active, deleted_at) |
| `roles` | Daftar role (admin, operator, viewer) |
| `permissions` | Daftar permission (read, write, ack, manage_users, manage_system) |
| `role_permissions` | Mapping role → permission |
| `user_roles` | Mapping user → role |
| `refresh_tokens` | Token hash, expiry, revoked_at |

---

## 🔴 Fase 1 — Mosquitto Config (P1 — Selesai)

> Diperlukan segera agar ESP32 bisa terhubung ke broker MQTT.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | `mosquitto.conf` | Listener port 1883, persistence on, log level info |
| `[x]` | `acl.conf` | Per-topic per-service: Module bisa publish `sensor/#`, Control bisa publish `cmd/#` |
| `[x]` | Password file | Credentials ESP32 + Module Svc + Control Svc |

### MQTT Topic Contract

| Topic | Publisher | Subscriber | Fungsi |
|---|---|---|---|
| `smartfarm/discovery` | ESP32 | Module Service | Auto-register node saat pertama connect |
| `smartfarm/status/+` | ESP32 | Module Service | Online/offline LWT (Last Will Testament) |
| `smartfarm/{node}/telemetry` | ESP32 | Module Service | Data sensor real-time |
| `cmd/{device_id}` | Control Service | ESP32 | Perintah kontrol (pompa on/off, valve, dll) |
| `ota/push/{device}` | Module Service | ESP32 | URL firmware update |

---

## 🔴 Fase 1 — Observability / Prometheus (P1 — Selesai)

> Metrics aggregator terpusat untuk seluruh service.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Prometheus server | `docker-compose` service + `prometheus.yml` (retention 15d) |
| `[x]` | Scrape Auth Service | Job `auth-service` → `auth:8080/metrics` (UP) |
| `[x]` | Scrape Module Service | Job `module-service` → `module:8080/metrics` (UP) |
| `[x]` | Scrape Analytics Service | Job `analytics-service` → `analytics:8080/metrics` (UP) |
| `[x]` | Scrape WS-Gateway | Job `wsgateway-service` → `wsgateway:8090/metrics` (UP) |
| `[x]` | Scrape Kong Gateway | Plugin `prometheus` + job `kong` → `kong:8001/metrics` (UP) |
| `[x]` | Dashboard → Kong (Auth-only) | Login(identifier)/register/profile/Manajemen Akun via `VITE_API_URL`; halaman non-auth di-hide |

### Metrik yang Tersedia

| Metrik | Service | Deskripsi |
|---|---|---|
| `auth_http_requests_total` | Auth | Total request HTTP dengan status code |
| `module_http_requests_total` | Module | Total request HTTP dengan status code |
| `analytics_http_requests_total` | Analytics | Total request HTTP dengan status code |
| `kong_http_requests_total` | Kong | Total request via Kong dengan status code |
| `go_goroutines` | Semua Go service | Jumlah goroutine aktif |
| `go_memstats_alloc_bytes` | Semua Go service | Alokasi memori |

---

## 🟡 Fase 2 — Module Service (P2 — SELESAI)

> Jembatan antara ESP32 dan backend. Menerima data sensor dan mendistribusikannya.

### 2a — Onboarding Perangkat

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Scaffold Module Service (Go) | Struktur `internal/` (config, model, repository, cache, service, mqtt, handler, middleware), mirror pola Auth |
| `[x]` | Skema `module_db` (MariaDB) | Tabel `modules` (konfigurasi) & `nodes` (perangkat) via GORM AutoMigrate |
| `[x]` | MQTT subscriber `discovery` | Subscribe `smartfarm/discovery` → auto-register node (unpaired) |
| `[x]` | MQTT subscriber `status/#` | Subscribe `smartfarm/status/+` (online/offline LWT) → update status + last_seen |
| `[x]` | Redis status cache | `redis-module` menyimpan status realtime + TTL (last-seen) |
| `[x]` | REST: Module CRUD | `POST/GET/PUT/DELETE /modules` via Kong |
| `[x]` | REST: Node onboarding | `GET /nodes`, `GET /nodes/discsovered`, `pair`, `unpair`, `DELETE` via Kong |
| `[x]` | NATS `audit.log` | Publish saat module/node created/paired/unpaired/deleted |
| `[x]` | TimescaleDB provisioning | `timescaledb-module` + hypertable `telemetry` siap |
| `[x]` | Dockerfile + healthcheck | Multi-stage + `/health` |
| `[x]` | Kong route + Prometheus scrape | `/modules`, `/nodes` via Kong; job `module-service` |

### 2b — Telemetry Ingest

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | MQTT subscriber telemetry | Subscribe `smartfarm/{node}/telemetry` → `IngestTelemetry` |
| `[x]` | Tag mapping (modular) | Tabel `node_tags` di MariaDB: source_key (dot-path) → tag_name DB, bisa diubah di UI tanpa kode |
| `[x]` | Simpan ke TimescaleDB | Insert ke hypertable `telemetry` (node_id, module_id, metric, value, raw) |
| `[x]` | Cache ke Redis | Nilai terbaru per node (`node:latest:{id}`, TTL) |
| `[x]` | Publish NATS `telemetry.ingest` | Per reading (ke WS-Gateway/alert/analytics) |
| `[x]` | Publish NATS `telemetry.batch` | Setiap 1 menit (agregat count/sum/min/max/avg/last) — **⚠️ via Core NATS, bukan JetStream** |

### Database Module Service

| Database | Tabel/Fungsi |
|---|---|
| `mariadb-module` | `modules` (konfigurasi module), `nodes` (perangkat ESP32), `node_tags` (mapping sensor key → tag name) |
| `timescaledb-module` | Hypertable `telemetry` (time, node_id, module_id, metric, value, raw) — data mentah |
| `redis-module` | Cache status node (`node:status:{id}`), cache nilai terbaru (`node:latest:{id}`) |

---

## 🟡 Fase 3 — Analytics Service (P2 — SELESAI)

> Akuisisi data pada database Timescale, diproses oleh Analytics Service, lalu ditampilkan di dashboard.

| Status | Item | Detail |
|---|---|---|
| `[x]` | Subscribe `telemetry.batch` dari NATS | Core NATS, mirror pola ws-gateway |
| `[x]` | Upsert agregat ke `metrics_rollup` | Di `timescaledb-analytics` (Database-per-Service) — ON CONFLICT (time, node_id, metric) |
| `[x]` | Continuous aggregate `metrics_hourly` | `time_bucket('1h', time)` — refresh policy 1 jam |
| `[x]` | Continuous aggregate `metrics_daily` | `time_bucket('1d', time)` — refresh policy 1 hari |
| `[x]` | Data Retention Policy | Raw 30d, hourly 365d, daily 730d |
| `[x]` | `GET /analytics/metrics` | Query series: `?node_id=&metric=&from=&to=&interval=` — downsampling otomatis (rollup/hourly/daily) |
| `[x]` | `GET /analytics/summary` | Ringkasan statistik per node/metric & window |
| `[x]` | `GET /analytics/nodes` | Daftar node yang punya data + metric tersedia |
| `[x]` | Dashboard halaman Analytics | Line chart (Chart.js), selector node + metric, range 1h/6h/24h/7d/30d |
| `[x]` | Prometheus target UP | `analytics-service` → `analytics:8080/metrics` |

### Database: `timescaledb-analytics`

| Tabel/View | Fungsi |
|---|---|
| `metrics_rollup` (hypertable) | Agregat 1-menit: count, sum, min, max, avg, last |
| `metrics_hourly` (continuous aggregate) | Agregat per-jam |
| `metrics_daily` (continuous aggregate) | Agregat per-hari |

---

## 🟡 Fase 3 — WS-Gateway (P2 — SEBAGIAN)

> WebSocket bridge: NATS → Dashboard untuk data real-time.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Service `wsgateway` | NATS → WebSocket bridge, route `/ws` via Kong |
| `[x]` | Subscribe `mqtt.{node_id}` | Push realtime payload ke dashboard (`/ws/nodes/{node_id}/live`) |
| `[x]` | **Autentikasi koneksi WS via JWT** | Validasi access token (Bearer header / `?token=`) via `JWT_SECRET` yang sama dengan Auth Service |

---

## 🔴 Fase 4 — Control Service (P2 — PRIORITAS)

> Meneruskan perintah dari dashboard/API ke ESP32 lewat MQTT.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold Go service | Struktur `internal/` mirror pola Module Service | 1 hari |
| `[ ]` | `POST /control/command` | Terima perintah dari Kong (JWT Operator/Admin) | 1 hari |
| `[ ]` | NATS Request-Reply | Kirim command, tunggu ACK dari device (timeout 500 ms) | 1 hari |
| `[ ]` | Publish MQTT | Forward command ke `cmd/{device_id}` | 0.5 hari |
| `[ ]` | Simpan ke MariaDB | Log perintah + status di `mariadb-control` | 0.5 hari |
| `[ ]` | Publish `audit.log` | Setiap perintah terkirim/gagal | 0.5 hari |
| `[ ]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |
| `[ ]` | Kong route + Prometheus | `/control` via Kong, job prometheus | 0.5 hari |

**Total estimasi: 3-5 hari**

### Database: `mariadb-control`

| Tabel | Fungsi |
|---|---|
| `commands` | Log perintah (id, device_id, command, params, status, created_at, updated_at) |
| `command_status` | Status tracking (pending, sent, acked, done, failed, timeout) |

### Alur Control Command

```
Dashboard/API → Kong → Control Service → MariaDB (log)
                                        → NATS Request-Reply (timeout 500ms)
                                        → MQTT (cmd/{device_id})
                                        → ESP32 → ACK via MQTT
                                        → Control Service update status
                                        → NATS audit.log
```

---

## 🔴 Fase 5 — Alert Service (P2)

> Mengevaluasi data sensor terhadap threshold dan memicu notifikasi.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold Go service | Struktur `internal/` | 1 hari |
| `[ ]` | Subscribe NATS `telemetry.ingest` | Terima data sensor real-time | 0.5 hari |
| `[ ]` | Ambil threshold dari `mariadb-alert` | Konfigurasi threshold per node/metric | 0.5 hari |
| `[ ]` | Cache threshold di `redis-alert` | Akses cepat tanpa query DB tiap kali | 0.5 hari |
| `[ ]` | Evaluasi threshold | Bandingkan nilai sensor dengan batas min/max | 1 hari |
| `[ ]` | Publish `alert.triggered` | Jika threshold terlampaui | 0.5 hari |
| `[ ]` | Publish `alert.resolved` | Jika nilai kembali normal | 0.5 hari |
| `[ ]` | REST endpoint `GET /alerts` | List alert history | 0.5 hari |
| `[ ]` | REST endpoint `PUT /alerts/:id/ack` | Acknowledge alert oleh operator | 0.5 hari |
| `[ ]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |

**Total estimasi: 3-5 hari**

### Database: `mariadb-alert` + `redis-alert`

| Tabel/Key | Fungsi |
|---|---|
| `thresholds` | Konfigurasi threshold (node_id, metric, min, max, enabled) |
| `alerts` | History alert (id, node_id, metric, value, threshold, severity, status, acked_by, acked_at) |
| `redis-alert` | Cache threshold aktif, cache alert terbaru |

### Alur Alert

```
Module Service → NATS telemetry.ingest → Alert Service
                                        → Ambil threshold dari cache/DB
                                        → Evaluasi: value > max || value < min?
                                        → Ya → INSERT alert → Publish alert.triggered
                                        → Tidak → Publish alert.resolved (jika sebelumnya alert)
```

---

## 🟡 Fase 5 — Notification Service (P3)

> Mengirim notifikasi ke pengguna berdasarkan alert yang dipicu.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold Go service | Struktur `internal/` | 1 hari |
| `[ ]` | Subscribe NATS `alert.triggered` | Terima event alert | 0.5 hari |
| `[ ]` | Subscribe NATS `alert.resolved` | Terima event alert resolved | 0.5 hari |
| `[ ]` | Kirim Push Notification | Integrasi Firebase FCM | 1 hari |
| `[ ]` | Kirim Email | Integrasi SMTP | 1 hari |
| `[ ]` | Kirim Telegram | Bot API Telegram | 1 hari |
| `[ ]` | Queue di `redis-notification` | Antrian notifikasi (retry mechanism) | 0.5 hari |
| `[ ]` | Simpan log notifikasi | Di `mariadb-notification` | 0.5 hari |
| `[ ]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |

**Total estimasi: 3-5 hari**

### Database: `mariadb-notification` + `redis-notification`

| Tabel/Key | Fungsi |
|---|---|
| `notification_logs` | Log pengiriman notifikasi (id, alert_id, channel, status, sent_at) |
| `user_notification_settings` | Preferensi notifikasi per user (email, telegram, push) |
| `redis-notification` | Queue notifikasi (retry queue) |

---

## 🔴 Fase 8 — Audit Service (P2 — QUICK WIN)

> Mencatat semua aktivitas sistem untuk keperluan audit dan troubleshooting.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold Go service | Struktur `internal/` | 0.5 hari |
| `[ ]` | Subscribe `audit.log` dari NATS | Konsumsi event audit dari semua service | 0.5 hari |
| `[ ]` | Append-only insert ke `mariadb-audit` | Immutability log — tidak ada UPDATE/DELETE | 0.5 hari |
| `[ ]` | `GET /audit/logs` (admin only) | Query log dengan filter (service, action, user, time range) | 0.5 hari |
| `[ ]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |

**Total estimasi: 1-2 hari**

### Database: `mariadb-audit`

| Tabel | Fungsi |
|---|---|
| `audit_logs` | Append-only: id, service, action, user_id, payload (JSON), ip_address, created_at |

### Catatan Penting

> ⚠️ **Auth Service dan Module Service SUDAH publish `audit.log` ke NATS**, tapi belum ada service yang meng-consume. Data audit menumpuk sia-sia. Implementasi Audit Service adalah **quick win** dengan nilai besar dan effort kecil.

---

## 🟢 Fase 6 — Stream Service (P3)

> Manajemen streaming video dari kamera ESP32-CAM.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | Integrasi MediaMTX | Konfigurasi RTSP/HLS/WebRTC |
| `[ ]` | Metadata stream di `mariadb-stream` | Informasi stream per device |
| `[ ]` | Upload snapshot ke `minio-stream` | Capture periodik dari stream |
| `[ ]` | REST endpoint `GET /streams` | Daftar stream aktif |
| `[ ]` | REST endpoint `GET /streams/:id/snapshot` | Ambil snapshot terbaru |

---

## 🟢 Fase 7 — ML / Vision API (P3)

> Deteksi objek dan anomali visual menggunakan YOLOv8.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | YOLOv8 inference (Python FastAPI) | Service terpisah dari Go microservices |
| `[ ]` | Hasil deteksi ke `mariadb-ml` | Metadata deteksi (class, confidence, bounding box) |
| `[ ]` | Annotated image ke `minio-ml` | Gambar dengan bounding box |
| `[ ]` | Publish `detection.result` ke NATS | Event untuk dikonsumsi service lain |
| `[ ]` | REST endpoint `GET /vision/detect` | Trigger deteksi on-demand |

---

## 🟡 Fase 9 — Dashboard (Lengkap) [P3]

> Frontend React untuk seluruh fitur sistem.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Auth pages | Login, Register, Profile, Ubah Password, Sesi, Deactivate |
| `[x]` | Manajemen Akun (Admin) | Tabel user, toggle aktif/nonaktif, ubah role, hapus |
| `[x]` | Module Management | CRUD module, pair/unpair node, node config |
| `[x]` | Analytics page | Line chart, selector node + metric, range selector |
| `[ ]` | **Device Management (integrasi penuh)** | File `DeviceManagement.jsx` sudah ada, NodeConfigPage sudah ada, NodeDetailPanel sudah ada — tinggal integrasi sidebar & routing |
| `[ ]` | Tampilan telemetri real-time | Via WebSocket ke WS-Gateway |
| `[ ]` | Tampilan alert & history | Integrasi dengan Alert Service |
| `[ ]` | Panel kontrol device | Integrasi dengan Control Service |
| `[ ]` | Koneksi ke WS-Gateway dengan JWT auth | Autentikasi WebSocket |

### Halaman Dashboard (Saat Ini)

| Halaman | Route | Status | Akses |
|---|---|---|---|
| Profile | `/profile` | ✅ | Semua role |
| Module Management | `/module` | ✅ | Semua role |
| Analytics | `/analytics` | ✅ | Semua role |
| User Management | `/users` | ✅ | Admin only |
| Device Management | (via Module) | ✅ | Semua role |
| Node Config | (via Device Management) | ✅ | Semua role |
| Telemetri Real-time | (belum) | ⬜ | - |
| Alert & History | (belum) | ⬜ | - |
| Control Panel | (belum) | ⬜ | - |

---

## 🟢 Fase 9b — Export Service / Data API [P3 — AKSES DATA EKSTERNAL]

> Melayani akses data untuk mahasiswa/peneliti via REST API. Memungkinkan import langsung ke Python pandas, R, Excel, dan tools analisis data lainnya.

### Latar Belakang
Mahasiswa dan peneliti perlu mengakses data sensor, telemetri, alert, dan metadata untuk keperluan analisis, tugas akhir, dan penelitian. Data tersimpan di berbagai database (TimescaleDB, MariaDB) dan tidak bisa diakses langsung. Export Service menjembatani dengan menyediakan REST API yang menghasilkan output CSV/JSON/Parquet yang siap di-import ke pandas.

### Arsitektur
```
Mahasiswa (Python/Notebook)
  │ pd.read_csv("https://api.smartfarm.local/export/v1/telemetry?...")
  ▼
Kong API Gateway (JWT Auth + Rate Limiting: 5 req/min)
  │
  ▼
Export Service (Go/Python FastAPI)
  ├─ Query TimescaleDB (telemetry raw + aggregate)
  ├─ Query MariaDB (metadata node, module, alert, audit)
  ├─ Multi-format: CSV, JSON, Parquet, Excel (XLSX)
  ├─ Streaming response (tidak load semua ke memory)
  ├─ Caching query results (redis-export)
  └─ Discover endpoint (self-documenting schema)
```

### Endpoint

| Method | Endpoint | Deskripsi | Format Output |
|--------|----------|-----------|---------------|
| `GET` | `/export/v1/telemetry` | Data telemetri mentah | CSV, JSON, Parquet |
| `GET` | `/export/v1/telemetry/aggregate` | Data agregat (hourly/daily) | CSV, JSON |
| `GET` | `/export/v1/nodes` | Metadata node & module | CSV, JSON |
| `GET` | `/export/v1/alerts` | History alert | CSV, JSON |
| `GET` | `/export/v1/commands` | Log perintah kontrol | CSV, JSON |
| `GET` | `/export/v1/audit` | Audit log (admin only) | CSV, JSON |
| `GET` | `/export/v1/discover` | List semua tabel & kolom yang tersedia | JSON |

### Parameter Query

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `format` | string | `csv` | `csv`, `json`, `parquet`, `xlsx` |
| `from` | ISO8601 | -7 hari | Awal time range |
| `to` | ISO8601 | sekarang | Akhir time range |
| `node_id` | string | semua | Filter per node |
| `metric` | string | semua | Filter per metric |
| `module_id` | string | semua | Filter per module |
| `limit` | int | 10000 | Max baris per response |
| `offset` | int | 0 | Pagination |
| `sort` | string | `time` | Kolom sorting |
| `order` | string | `desc` | `asc` / `desc` |
| `compress` | bool | `false` | GZip response |

### Contoh Penggunaan dari Python

```python
import pandas as pd

# Setup autentikasi
headers = {"Authorization": "Bearer student-api-key-xxx"}

# Satu baris: export telemetri langsung ke DataFrame
df = pd.read_csv(
    "https://api.smartfarm.local/export/v1/telemetry",
    params={"from": "2026-07-01", "to": "2026-07-11"},
    headers=headers
)

# Filter spesifik per node & metric
df_node = pd.read_csv(
    "https://api.smartfarm.local/export/v1/telemetry",
    params={"node_id": "ECE334219870", "metric": "cwt1_temperature"},
    headers=headers
)

# Data agregat (lebih ringan)
df_agg = pd.read_csv(
    "https://api.smartfarm.local/export/v1/telemetry/aggregate",
    params={"bucket": "hourly", "from": "2026-06-01", "to": "2026-07-11"},
    headers=headers
)

# Multi-tabel untuk analisis lengkap
nodes = pd.read_csv("https://api.smartfarm.local/export/v1/nodes", headers=headers)
telemetry = pd.read_csv("https://api.smartfarm.local/export/v1/telemetry", params={...}, headers=headers)
alerts = pd.read_csv("https://api.smartfarm.local/export/v1/alerts", params={...}, headers=headers)
df = telemetry.merge(nodes, on="node_id").merge(alerts, on="node_id", how="left")

# Export Parquet untuk big data
import requests
resp = requests.get("https://api.smartfarm.local/export/v1/telemetry",
                    params={"format": "parquet", "limit": 1000000},
                    headers=headers)
with open("data.parquet", "wb") as f:
    f.write(resp.content)
df = pd.read_parquet("data.parquet")
```

### Keamanan & Access Control

| Aspek | Implementasi |
|-------|-------------|
| Autentikasi | JWT via Kong (sama seperti service lain) |
| Role-based Access | Viewer: data non-sensitif. Admin: semua termasuk audit log |
| Rate Limiting | 5 req/min untuk non-admin, 30 req/min untuk admin |
| Data Limit | Maks 100.000 baris per request (admin: 1.000.000) |
| Time Range Limit | Maks 90 hari per request untuk non-admin |
| API Key Tiers | Student Basic (50 req/hari, 10rb baris, 7 hari), Student Research (200 req/hari, 100rb baris, 90 hari), Admin (unlimited) |

### Checklist Implementasi

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold service (Go/Python) | Struktur internal, go.mod/requirements.txt | 1 hari |
| `[ ]` | Koneksi ke TimescaleDB (module + analytics) | Read-only query pool | 0.5 hari |
| `[ ]` | Koneksi ke MariaDB (module + auth) | Read-only query untuk metadata | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/telemetry` | Query + streaming CSV/JSON/Parquet | 1 hari |
| `[ ]` | Endpoint `/export/v1/telemetry/aggregate` | Query continuous aggregate | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/nodes` | Metadata node & module | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/alerts` | History alert | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/commands` | Log perintah kontrol | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/audit` (admin only) | Audit log | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/discover` | Self-documenting schema | 0.5 hari |
| `[ ]` | Redis caching (`redis-export`) | Cache query results, TTL configurable | 0.5 hari |
| `[ ]` | Kong route + rate limiting | `/export` route, 5 req/min limit | 0.5 hari |
| `[ ]` | Dockerfile + healthcheck | Multi-stage + `/health` | 0.5 hari |
| `[ ]` | Prometheus metrics | `export_http_requests_total` | 0.5 hari |
| `[ ]` | Dokumentasi API untuk mahasiswa | Contoh pandas, R, Excel | 1 hari |

**Total estimasi: 5-7 hari**

---

## ⬜ Fase 10 — OTA Service (P4)

> Update firmware ESP32 Over-The-Air.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | Upload firmware ke `minio-ota` | Binary firmware disimpan di MinIO |
| `[ ]` | Trigger update ke ESP32 via MQTT | Push URL firmware ke device |
| `[ ]` | Tracking status update | Per device: pending, downloading, installing, done, failed |
| `[ ]` | Verifikasi checksum firmware | SHA-256 hash untuk integritas |

---

## ⬜ Fase 11 — Prometheus Metrics Service (P4)

> Service aggregator metrik via NATS (menggantikan scrape langsung).

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | Subscriber NATS `metrics.health` | Subscribe dari seluruh service |
| `[ ]` | Aggregasi metrik | Kumpulkan metrik health & performa sistem |
| `[ ]` | Expose `/metrics` | Endpoint untuk Prometheus scraping |
| `[ ]` | Metrik terkumpul | request count, error rate, response time, uptime, resource usage |

> **📝 Catatan:** Saat ini metrik **tidak lewat NATS** — tiap service langsung expose HTTP `/metrics` dan Prometheus **scrape langsung**. Fase ini akan mengubah ke desain awal: service publish ke NATS subject `metrics.health` → "Prometheus Service" subscribe & aggregasi → expose `/metrics`.

---

## ⬜ Fase 12 — Cloudflare Tunnel (P4)

> Akses publik yang aman ke sistem.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | `cloudflared tunnel run` → Kong:8000 | Tunnel dari Cloudflare ke Kong |
| `[ ]` | TLS end-to-end | Enkripsi dari client ke server |
| `[ ]` | Custom domain mapping | Domain khusus untuk sistem |

---

## 📋 Ringkasan Semua Service

| # | Service | Bahasa | Database | Status | Prioritas |
|---|---------|--------|----------|--------|-----------|
| 1 | Auth | Go | MariaDB | ✅ Selesai | P1 |
| 2 | Module | Go | MariaDB + TimescaleDB + Redis | ✅ Selesai | P1 |
| 3 | Analytics | Go | TimescaleDB | ✅ Selesai | P2 |
| 4 | WS-Gateway | Go | - | 🟡 Sebagian | P2 |
| 5 | Control | Go | MariaDB | ⬜ Belum | **P1** |
| 6 | Alert | Go | MariaDB + Redis | ⬜ Belum | **P1** |
| 7 | Audit | Go | MariaDB | ⬜ Belum | **P1** |
| 8 | Notification | Go | MariaDB + Redis | ⬜ Belum | P2 |
| 9 | Export / Data API | Go/Python | TimescaleDB (read) + Redis | ⬜ Belum | P3 |
| 10 | Stream | Go | MariaDB + MinIO | ⬜ Belum | P3 |
| 11 | ML/Vision | Python | MariaDB + MinIO | ⬜ Belum | P3 |
| 12 | OTA | Go | MariaDB + MinIO | ⬜ Belum | P4 |
| 13 | Webhook | Go | MariaDB | ⬜ Belum | P4 |
| 14 | Prometheus Metrics | Go | - | ⬜ Belum | P4 |

---

## 📊 Timeline yang Direkomendasikan

| Minggu | Fokus | Service | Deliverable |
|--------|-------|---------|-------------|
| **Minggu 1** | 🔴 P1 | Control Service | ESP32 bisa dikontrol dari dashboard |
| **Minggu 2** | 🔴 P1 | Alert Service + Audit Service | Threshold evaluation + audit log aktif |
| **Minggu 3** | 🟡 P2 | Notification Service + WS JWT Auth | Notifikasi Telegram/Email + WS aman |
| **Minggu 4** | 🟡 P2 | Dashboard Device Management | Halaman device management full |
| **Minggu 5** | 🟢 P3 | Stream Service | Streaming video dari ESP32-CAM |
| **Minggu 6-7** | 🟢 P3 | ML / Vision API | Deteksi hama/penyakit via YOLOv8 |
| **Minggu 8+** | ⬜ P4 | OTA + Metrics Service + Cloudflare | OTA update, pipeline metrik, deployment |

---

## ⚠️ Risiko & Mitigasi

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|-------------|----------|
| Core NATS untuk `telemetry.batch` | Kehilangan data saat restart | Tinggi | Upgrade ke JetStream stream |
| WS tanpa autentikasi | Data real-time bocor | Rendah | ✅ JWT handshake sudah diimplementasikan pada WS-Gateway |
| 18 instance database | Biaya & kompleksitas operasional | Sedang | Evaluasi apakah semua instance diperlukan; pertimbangkan shared DB untuk service non-kritis |
| Tidak ada backup database | Data hilang permanen jika container crash | Sedang | Cron job dump SQL + backup ke MinIO/cloud storage |
| Tidak ada CI/CD | Human error saat build/deploy | Sedang | Setup GitHub Actions untuk auto-build & test |
| Tidak ada unit test | Regression bug tidak terdeteksi | Tinggi | Target minimal 80% code coverage untuk setiap service |

---

## 📝 Catatan Perubahan

| Tanggal | Versi | Perubahan |
|---------|-------|-----------|
| 2026-07-11 | 2.0.0 | Sinkronisasi dengan planning.md; update status Fase 2 & 3 selesai; tambah tabel ringkasan, timeline, risiko; perbaiki inkonsistensi penomoran fase; tambah detail database per service |

---

*Perbarui status item saat mulai (`[/]`) dan selesai (`[x]`) mengerjakan masing-masing item. Catat aktivitas harian di [`logs.md`](./logs.md).*