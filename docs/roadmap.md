# 🗺️ Roadmap — IOT-Modular-Microservice

> **Versi:** 2.16.0  
> **Terakhir diperbarui:** 2026-07-16  
> **Status legend:** 🔴 P1 (Kritikal) · 🟡 P2 (Penting) · 🟢 P3 (Normal) · ⬜ P4 (Opsional)  
> **Progress:** `[ ]` Belum · `[/]` In Progress · `[x]` Selesai
> **Dokumen Terkait:** [planning.md](./planning.md) · [logs.md](./logs.md) · [testing-plan-agent.md](./testing-plan-agent.md) · [AGENTS.md](../AGENTS.md)

> **Penomoran Fase (diselaraskan dengan `planning.md`):** dokumen ini menggunakan skema fase **1–12** yang sama dengan `planning.md`. Roadmap versi lama menggunakan 1–14; penomoran lama dihapus untuk menghindari kebingungan.

---

## 📊 Status Keseluruhan

**Fase 0 (Infrastruktur) ✅ · Fase 1 (Auth + Dashboard Auth) ✅ · Fase 2 (Module) ✅ · Fase 3 (Analytics + WS-Gateway) ✅ · Fase 4 (Control) ✅ · Fase 5 (Alert + Stream + ML/Vision) ✅ · Monitor Service ✅ · Fase 6 (Snapshot→AI + CCTV Recording) ✅ · Audit Service ✅ · Dashboard Lengkap ✅**

### Yang sudah berjalan end-to-end:
| Alur | Status |
|------|--------|
| Auth Service (register, login, JWT, refresh token, RBAC, manajemen akun) | ✅ |
| Module Service (onboarding device via MQTT discovery, pair/unpair, telemetry ingest, batch NATS) | ✅ |
| Analytics Service (subscribe `telemetry.batch` → `timescaledb-analytics` → continuous aggregate → dashboard via Kong) | ✅ |
| WS-Gateway (NATS → WebSocket bridge + JWT auth, route `/ws` via Kong, realtime telemetry) | ✅ (alert/system-status notif ✅) |
| Stream Service (MediaMTX RTSP→HLS/WebRTC + MinIO snapshot/recording + CRUD stream via Kong) | ✅ |
| Monitor Service (snapshot resource container via `docker stats` untuk halaman Version/Security) | ✅ |
| Dashboard React (Auth + Analytics + Module + Control + Live View + Snapshot via Kong) | ✅ |
| Dashboard Control Panel (mode arbitration Manual/Otomatis/Emergency + Resume, manual override, editor jadwal + pagination) | ✅ |
| Dashboard Live View + Snapshot (player MediaMTX iframe, manajemen stream, galeri snapshot/recording + AI Detection) | ✅ |
| Dashboard Telemetri Real-time (WebSocket ke WS-Gateway di Node Detail) | ✅ |
| Control Service (manual + scheduler otomatis + emergency stop/resume via MQTT) | ✅ |
| Seed akun admin default + Manajemen Akun (Admin only) | ✅ |
| Alert Service (threshold eval + publish `alert.triggered`/`alert.resolved`/`system.status`) | ✅ |
| Audit Service (consume `audit.log` → `mariadb-audit`, `GET /audit/logs`) | ✅ |
| Observability (Prometheus + exporter: mysqld/postgres/redis/mosquitto/nats + node-exporter + cAdvisor) | ✅ |
| CCTV Capture Cron (`services/cctv-capture`) | ✅ (job eksternal, bukan microservice) |

### Yang belum dikerjakan (sisa) — selaras dengan `planning.md`:
| Service / Item | Fase (skema planning) | Prioritas | Kategori |
|---------|------|-----------|-----------|
| Notification Service | Fase 5 (Notification) | 🔴 P1 | Dikerjakan di TA (blocker fungsional) |
| Export Service / Data API | Fase 9b | 🟢 P3 | Future (sebagian via Analytics) |
| OTA Service | Fase 10 | ⬜ P4 | Future |
| Prometheus Metrics Service | Fase 11 | ⬜ P4 | Future |
| Cloudflare Tunnel | Fase 12 | ⬜ P4 | Future |
| Webhook Service | (belum bernomor) | ⬜ P4 | Future |
| **DLQ Saga (NATS Advisory)** | — | 🔴 P1 | **Dikerjakan di TA** |
| **CI/CD (GitHub Actions)** | — | 🟡 P2 | **Dikerjakan di TA** |
| **Unit Test 80%** | — | 🟡 P2 | **Dikerjakan di TA** |
| **Transactional Outbox** | — | 🟡 P2 | Dikerjakan di TA (lihat planning) |

> **Catatan:** Dashboard Alert & History (Fase 10 di skema lama) sudah **SELESAI** — halaman `ALERTS` (history + sub-tab Thresholds), notification bell di header, dan `NotificationContext` menormalisasi payload Alert Service (`system.status` + raw `alert.triggered`/`alert.resolved`). Notification Service (pengiriman ke Telegram/Email/Push) masih `⬜` — ini yang membuat alert "mati di ujung" dan wajib dikerjakan di TA.

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
| `smartfarm/actuator/{node_id}` | Control Service | ESP32 | Perintah kontrol `set_output` (pompa on/off, valve, PWM). ⚠️ Firmware subscribe topik ini, **bukan** `cmd/{device_id}` |
| `smartfarm/{node_id}/confirm` | ESP32 | Module→NATS→Control | ACK eksekusi command (`req_id`, status) |
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
| `[x]` | Redis status cache | `redis-shared` (DB0) menyimpan status realtime + TTL (last-seen) |
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
| `[x]` | Tag mapping (modular) | Tabel `node_tags` di MariaDB: source_key (dot-path) → tag_name DB (+ `label` untuk nama tampilan bersih di dashboard, `display_name`, `unit`, `data_type`, `enabled`), bisa diubah di UI tanpa kode |
| `[x]` | Simpan ke TimescaleDB | Insert ke hypertable `telemetry` (node_id, module_id, metric, value, raw) |
| `[x]` | Cache ke Redis | Nilai terbaru per node (`node:latest:{id}`, TTL) di `redis-shared` (DB0) |
| `[x]` | Publish NATS `telemetry.ingest` | Per reading (ke WS-Gateway/alert/analytics) |
| `[x]` | Publish NATS `telemetry.batch` | Setiap 1 menit (agregat count/sum/min/max/avg/last) — **✅ via JetStream** (stream `TELEMETRY_BATCH`, replay otomatis) |

### Database Module Service

| Database | Tabel/Fungsi |
|---|---|
| `mariadb-module` | `modules` (konfigurasi module), `nodes` (perangkat ESP32), `node_tags` (mapping sensor key → tag name) |
| `timescaledb-module` | Hypertable `telemetry` (time, node_id, module_id, metric, value, raw) — data mentah |
| `redis-shared` (DB0) | Cache status node (`node:status:{id}`), cache nilai terbaru (`node:latest:{id}`) |

---

## 🟡 Fase 3 — Analytics Service (P2 — SELESAI)

> Akuisisi data pada database Timescale, diproses oleh Analytics Service, lalu ditampilkan di dashboard.

| Status | Item | Detail |
|---|---|---|
| `[x]` | Subscribe `telemetry.batch` dari NATS | **JetStream** durable consumer `analytics-batch` (replay otomatis saat restart, ack eksplisit) |
| `[x]` | Upsert agregat ke `metrics_rollup` | Di `timescaledb-analytics` (Database-per-Service) — ON CONFLICT (time, node_id, metric) |
| `[x]` | Continuous aggregate `metrics_hourly` | `time_bucket('1h', time)` — refresh policy 1 jam |
| `[x]` | Continuous aggregate `metrics_daily` | `time_bucket('1d', time)` — refresh policy 1 hari |
| `[x]` | Data Retention Policy (berjenjang) | Raw `metrics_rollup` 30 hari, `metrics_hourly` 365 hari, **`metrics_daily` 3650 hari (10 tahun)** |
| `[x]` | Compression policy | 7 hari pada `metrics_hourly` & `metrics_daily` |
| `[x]` | `GET /analytics/export` | CSV bulk download riset — `?node_id=&metric=&resolution=day\|hour\|raw&from=&to=` (kolom count/sum/min/max/avg/last) |
| `[x]` | `GET /analytics/metrics` | Batch query series: `node_id` & `metric` boleh comma-list, respons `series[node_id][metric]` — 1 request untuk banyak metrik (hindari 429 rate-limit Kong); downsampling otomatis (rollup/hourly/daily) |
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

## 🟡 Fase 3 — WS-Gateway (P2 — SELESAI, system-status notif ditunda)

> WebSocket bridge: NATS → Dashboard untuk data real-time.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Service `wsgateway` | NATS → WebSocket bridge, route `/ws` via Kong |
| `[x]` | Subscribe `mqtt.{node_id}` | Push realtime payload ke dashboard (`/ws/nodes/{node_id}/live`) |
| `[x]` | **Autentikasi koneksi WS via JWT** | Validasi access token (Bearer header / `?token=`) via `JWT_SECRET` yang sama dengan Auth Service |
| `[x]` | Realtime telemetry di Dashboard | `NodeDetailPanel` membuka WS ke `/ws/nodes/{id}/live` → render metrik sensor live |
| `[x]` | System-status notifications | Route `/ws/system-status` (JWT) di `services/wsgateway` sudah diimplementasikan — subscribe NATS `system.status`, stream ke `NotificationContext` dashboard. Notifikasi jalan begitu ada publisher (Alert/Monitor) ke subject tersebut |

---

## ✅ Fase 4 — Control Service (P2 — SELESAI)

> Meneruskan perintah dari dashboard/API ke ESP32 lewat MQTT, dengan dua mode: **Manual** (publish langsung) dan **Otomatis** (scheduler server-side: interval/jadwal/threshold nyala-mati). Firmware bersifat *dumb actuator* — semua kecerdasan penjadwalan berada di Control Service.

### ⚠️ Kontrak Nyata Firmware (hasil audit `firmware/aeroponic-node`)

> Skema di bawah **menggantikan** asumsi lama (`cmd/{device_id}` + NATS Request-Reply). Kontrak berikut adalah yang benar-benar diimplementasikan firmware.

| Aspek | Nilai Aktual Firmware | Sumber |
|---|---|---|
| Topik command (subscribe) | `smartfarm/actuator/{node_id}` | `ConfigManager.cpp:142`, `MqttManager.cpp:202` |
| Action yang didukung | Hanya `set_output` (eksekusi seketika, **tanpa** scheduler lokal) | `MqttManager.cpp:211` |
| Payload command | `{"action":"set_output","target":"<output_name>","value":<int>,"req_id":"<opsional>"}` | `MqttManager.cpp:207-213` |
| Nilai `value` | DIGITAL → `0`/`1` · PWM → `0–255` | `HardwareManager.cpp:293-305` |
| `target` | Harus cocok `HardwareOutputs[].name` | `HardwareManager.cpp:294` |
| ACK per-perintah | MQTT ke `smartfarm/{node_id}/confirm` → `{"req_id","target","value","status":"executed"}` | `MqttManager.cpp:216-222` |
| Verifikasi state | `smartfarm/{node_id}/telemetry` → `telemetry.outputs.{name}` (state kontinu tiap interval) | `HardwareManager.cpp:233-236` |
| Fitur lokal firmware | Local control threshold+histeresis (`LocalControlRule`) & emergency shutdown (interrupt → semua OFF → `/alert`) | `HardwareManager.cpp:69-91,174-193` |

> **Catatan integrasi:** ACK **bukan** NATS Request-Reply — firmware balas via MQTT `/confirm`. Module Service sudah fan-out semua topik per-node ke NATS/live-hub (`subscriber.go:76-99`), jadi Control Service mengkorelasikan `req_id` dari stream `/confirm` (bukan reply sinkron), dengan fallback verifikasi via `telemetry.outputs.{name}`.

### Type Control — Mode MANUAL (publish langsung seketika)

| Type | Deskripsi | Payload ke firmware |
|---|---|---|
| `set_state` | ON/OFF output DIGITAL | `{action:set_output, target, value:0\|1, req_id}` |
| `set_level` | PWM/dimmer 0–100% → map 0–255 | `{action:set_output, target, value:0..255, req_id}` |
| `toggle` | Balik state terakhir (baca dari cache/telemetry lalu kirim lawannya) | `set_output` value lawan |
| `pulse` | ON selama X detik lalu OFF (timer di Control Service) | ON → jadwalkan OFF |
| `emergency_stop` | Matikan semua output segera | broadcast `set_output` semua target=0 |

### Type Control — Mode OTOMATIS (scheduler **server-side** di Control Service)

| Type | Deskripsi | Cara kerja scheduler | Use case |
|---|---|---|---|
| `interval` ⭐ | Siklus **ON x detik / OFF y detik** berulang | publish ON → tunggu `on_sec` → publish OFF → tunggu `off_sec` → ulang | Pompa aeroponik (mis. ON 5s/OFF 300s) |
| `schedule` | Nyala/mati pada jam tertentu (cron-like) | cron `HH:MM ON` / `HH:MM OFF` + hari aktif | Lampu grow, sirkulasi harian |
| `threshold` | ON/OFF berdasar nilai sensor + histeresis | evaluasi telemetry `inputs`/`modbus` vs `min/max` | Kipas suhu, dosing pH/EC |
| `duration` | Nyala total selama durasi lalu OFF | ON → OFF setelah total durasi | Isi tandon, dosing sekali jalan |
| `ramp` | PWM naik/turun bertahap dalam rentang waktu | publish `set_level` bertingkat | Dimming sunrise/sunset |

> ⭐ Mode `interval` adalah pola inti aeroponik (nyala-mati berkala). Semua mode Otomatis dievaluasi & di-publish oleh Control Service; firmware tidak tahu sedang otomatis (tetap terima `set_output`).

### Checklist Implementasi

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[x]` | Scaffold Go service | Struktur `internal/` mirror pola Module Service | 1 hari |
| `[x]` | `POST /control/command` | Mode manual — publish `set_output` seketika (JWT Operator/Admin) | 1 hari |
| `[x]` | Publish MQTT | Forward ke `smartfarm/actuator/{node_id}` (bukan `cmd/{device_id}`) | 0.5 hari |
| `[x]` | Korelasi ACK | Subscribe/konsumsi `/confirm` (MQTT langsung), cocokkan `req_id`, timeout → `failed`/`timeout` | 1 hari |
| `[x]` | CRUD `schedules` | `POST/GET/PUT/DELETE /control/schedules` + enable/disable (interval/schedule/threshold/duration/ramp) | 1 hari |
| `[x]` | Scheduler engine (server-side) | Goroutine reconcile tiap 15s → publish ON/OFF per tipe | 1.5 hari |
| `[x]` | Toggle MANUAL/AUTO per output | `PUT /control/modes/{node}/{output}` + katalog target auto-discovery | 0.5 hari |
| `[x]` | Simpan ke MariaDB | Log perintah + status di `mariadb-control` (GORM AutoMigrate) | 0.5 hari |
| `[x]` | Publish `audit.log` | Setiap perintah terkirim/gagal/acked + event schedule | 0.5 hari |
| `[x]` | ACL Mosquitto | Aturan `smartfarm/actuator/#` didokumentasikan di `acl.conf` (dev: allow-all) | 0.25 hari |
| `[x]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |
| `[x]` | Kong route + Prometheus | `/control` via Kong, job `control-service` | 0.5 hari |

**Total estimasi: 5-7 hari — ✅ Selesai (backend + integrasi dashboard + uji end-to-end dengan device).**

### Penambahan (2026-07-12)

- **Persistensi mode pra-emergency:** kolom `prev_mode` di `control_modes` (AutoMigrate). `EnterEmergency` menyimpan mode aktif sebelum emergency; `ResumeNode` mengembalikan mode tersebut (default `AUTO` bila kosong) → **Resume restorasi mode sebelum emergency**, bukan selalu AUTO.
- **Dashboard Control Panel** (`dashboard/src/components/Dashboard/Pages/ControlPanel.jsx`):
  - Kartu *Control Mode*: badge status (MANUAL / OTOMATIS · BERJALAN NORMAL / EMERGENCY STOP), toggle Manual⇄Otomatis (disabled saat EMERGENCY), tombol Emergency Stop, tombol Resume (hanya saat EMERGENCY).
  - Perbaikan bug: `TargetTile` kini menerima prop `nodeMode` → tombol manual ON/OFF/Toggle/level aktif hanya di mode MANUAL.
  - Editor jadwal: create + **edit** (`PUT /control/schedules/{id}`, prefill form) + toggle enable/disable + delete, dengan **pagination** (PAGE_SIZE=4) agar rapi saat jadwal banyak.

### Database: `mariadb-control`

| Tabel | Fungsi |
|---|---|
| `control_targets` | Katalog output per node (node_id, output_name, type DIGITAL/PWM, label) |
| `control_modes` | Mode aktif per output (node_id, output_name, mode MANUAL/AUTO, active_schedule_id) |
| `schedules` | Definisi otomatis (id, node_id, output_name, type, params JSON, enabled, next_run_at) |
| `commands` | Log perintah (id, req_id, node_id, target, action, value, source manual/schedule, status, created_at, acked_at) |

Status command: `pending → sent → acked` (via `/confirm`) · atau `timeout` / `failed`.

Contoh `schedules.params` untuk `interval`: `{"on_sec":5,"off_sec":300,"value_on":1,"value_off":0}`

### Alur Control Command

```
# MANUAL
Dashboard/API → Kong → Control Service → MariaDB (log, status=pending)
                                        → MQTT publish smartfarm/actuator/{node_id} {set_output,req_id}
ESP32 → MQTT smartfarm/{node_id}/confirm {req_id,status:executed}
     → Module Service fan-out ke NATS → Control Service korelasi req_id → status=acked
     → (timeout tanpa confirm → status=failed) → NATS audit.log

# OTOMATIS (server-side scheduler)
Control Service Scheduler (interval/schedule/threshold/duration/ramp)
     → saat trigger → publish set_output (ON/OFF) → alur sama seperti MANUAL
```

---

## 🔴 Fase 7 — Alert Service (P1 — ✅ SELESAI)

> Mengevaluasi data sensor terhadap threshold dan memicu notifikasi.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[x]` | Scaffold Go service | Struktur `internal/` (config, model, repository, cache, service, handler, middleware) | 1 hari |
| `[x]` | Subscribe NATS `telemetry.ingest` | Queue group `alert-workers` (Core NATS) terima data sensor real-time | 0.5 hari |
| `[x]` | Ambil threshold dari `mariadb-alert` | Konfigurasi threshold per node/metric (fallback wildcard `node_id="*"`) | 0.5 hari |
| `[x]` | Cache threshold di `redis-shared` (DB1) | Cache hasil resolve threshold (TTL 60s) + marker alert aktif untuk dedup | 0.5 hari |
| `[x]` | Evaluasi threshold | Bandingkan nilai sensor dengan batas min/max; dedup sampai resolve | 1 hari |
| `[x]` | Publish `alert.triggered` | Jika threshold terlampaui | 0.5 hari |
| `[x]` | Publish `alert.resolved` | Jika nilai kembali normal | 0.5 hari |
| `[x]` | REST endpoint `GET /alerts` | List alert history (filter node/metric/status/severity + time window + paginasi) | 0.5 hari |
| `[x]` | REST endpoint `PUT /alerts/:id/ack` | Acknowledge alert oleh operator/admin | 0.5 hari |
| `[x]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |
| `[x]` | Threshold CRUD | `GET/POST/PUT/DELETE /thresholds` (operator/admin) + cache-coherent invalidation | 0.5 hari |
| `[x]` | Kong route + Prometheus | `/alerts`, `/thresholds` via Kong; job `alert-service` | 0.5 hari |

**Total estimasi: 3-5 hari — ✅ Selesai (backend + infra + wiring). Dashboard Alert & History (Fase 10) menyusul.**

> **Catatan integrasi notifikasi:** Alert Service mem-publish `alert.triggered`/`alert.resolved` **dan** `system.status` (envelope notifikasi). WS-Gateway (`/ws/system-status`) sudah subscribe ketiga subject → dashboard `NotificationContext` menerima alert real-time. Threshold dikelola via REST (wildcard `*` untuk semua node per metric).

### Database: `mariadb-alert` + `redis-shared` (DB1)

| Tabel/Key | Fungsi |
|---|---|
| `thresholds` | Konfigurasi threshold (node_id, metric, min, max, enabled) |
| `alerts` | History alert (id, node_id, metric, value, threshold, severity, status, acked_by, acked_at) |
| `redis-shared` (DB1) | Cache threshold aktif, cache alert terbaru |

### Alur Alert

```
Module Service → NATS telemetry.ingest → Alert Service
                                        → Ambil threshold dari cache/DB
                                        → Evaluasi: value > max || value < min?
                                        → Ya → INSERT alert → Publish alert.triggered
                                        → Tidak → Publish alert.resolved (jika sebelumnya alert)
```

---

## 🔴 Fase 5 — Notification Service (P1 — Prioritas TA)

> Mengirim notifikasi ke pengguna berdasarkan alert yang dipicu. **Ini blocker fungsional**: Alert Service sudah publish `alert.triggered`/`alert.resolved` tapi belum ada subscriber → alert "mati di ujung". Wajib dikerjakan di TA (selaras `planning.md` TA-Scale Roadmap).

> Mengirim notifikasi ke pengguna berdasarkan alert yang dipicu.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold Go service | Struktur `internal/` | 1 hari |
| `[ ]` | Subscribe NATS `alert.triggered` | Terima event alert | 0.5 hari |
| `[ ]` | Subscribe NATS `alert.resolved` | Terima event alert resolved | 0.5 hari |
| `[ ]` | Kirim Push Notification | Integrasi Firebase FCM | 1 hari |
| `[ ]` | Kirim Email | Integrasi SMTP | 1 hari |
| `[ ]` | Kirim Telegram | Bot API Telegram | 1 hari |
| `[ ]` | Queue di `redis-shared` (DB2) | Antrian notifikasi (retry mechanism) | 0.5 hari |
| `[ ]` | Simpan log notifikasi | Di `mariadb-notification` | 0.5 hari |
| `[ ]` | `Dockerfile` + healthcheck | Multi-stage + `/health` | 0.5 hari |

**Total estimasi: 3-5 hari**

### Database: `mariadb-notification` + `redis-shared` (DB2)

| Tabel/Key | Fungsi |
|---|---|
| `notification_logs` | Log pengiriman notifikasi (id, alert_id, channel, status, sent_at) |
| `user_notification_settings` | Preferensi notifikasi per user (email, telegram, push) |
| `redis-shared` (DB2) | Queue notifikasi (retry queue) |

---

## 🔴 Fase 9 — Audit Service (P2 — ✅ SELESAI)

> Mencatat semua aktivitas sistem untuk keperluan audit dan troubleshooting.

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[x]` | Scaffold Go service | Struktur `internal/` (`config`, `handler`, `middleware`, `model`, `repository`, `service`) | 0.5 hari |
| `[x]` | Subscribe `audit.log` dari NATS | Konsumsi event audit dari semua service (queue group `audit-workers`, Core NATS) | 0.5 hari |
| `[x]` | Append-only insert ke `mariadb-audit` | Immutability log — tidak ada UPDATE/DELETE (GORM AutoMigrate) | 0.5 hari |
| `[x]` | `GET /audit/logs` | Query log dengan filter `event` + `search` (payload LIKE) + paginasi `limit`/`offset` | 0.5 hari |
| `[x]` | JWT auth (admin only) | Validasi Bearer token via `JWT_SECRET` + middleware `RequireRole("admin")` — route `/audit` via Kong | — |
| `[x]` | `Dockerfile` + healthcheck + compose | Multi-stage + `/health`; `mariadb-audit` + `audit` + `mysqld-exporter-audit`; route Kong `/audit`; scrape Prometheus | 0.5 hari |

**Total estimasi: 1-2 hari — ✅ Selesai (backend + wiring infra + build/vet).**
**Catatan:** dashboard halaman Audit/History (Fase 10) menyusul. Endpoint `GET /audit/logs` telah dikunci hanya untuk peran `admin` saja demi alasan keamanan data sensitif.

### Database: `mariadb-audit`

| Tabel | Fungsi |
|---|---|
| `audit_logs` | Append-only: `id` (uuid), `event` (varchar, indexed), `payload` (longtext JSON `{event,data}`), `received_at` (datetime, indexed) |

### Catatan Penting

> ⚠️ **Auth Service dan Module Service SUDAH publish `audit.log` ke NATS**, tapi belum ada service yang meng-consume. Data audit menumpuk sia-sia. Implementasi Audit Service adalah **quick win** dengan nilai besar dan effort kecil. ✅ Sekarang sudah di-consume (seluruh event `module.*`, `node.*`, `control.*`, `auth.*` mengalir ke `mariadb-audit`).

---

## 🟢 Fase 5 — Stream Service (P3 — SELESAI)

> Manajemen streaming video dari kamera ESP32-CAM / CCTV via MediaMTX, capture snapshot & recording ke MinIO, dan playback HLS/WebRTC di dashboard.

### Infrastruktur Pendukung
| Komponen | Fungsi |
|---|---|
| `mediamtx` | RTSP pull (`:8554`) → HLS (`:8888`) / WebRTC (`:8889`); API `:9997` (internal `iot-net`). Path diregistrasi dinamis oleh Stream Service (`sourceOnDemand`). |
| `minio` + `minio-setup` | **Instance MinIO bersama** — bucket `stream` untuk snapshot & cover recording (Stream Service). Bucket lain: `ml-vision` (ML), `ota` (OTA). Access key ter-scoping per service |
| `mariadb-stream` | Metadata stream & snapshot (`streams`, `snapshots`) via GORM AutoMigrate |
| `nginx` (dashboard) | Serve dashboard di `/app` + proxy player MediaMTX (`/live/{name}/`) |

### Checklist Implementasi
| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Scaffold Go service | Struktur `internal/` (config, model, repository, service, handler, client/mediamtx, client/minio, middleware) |
| `[x]` | `GET /streams` | List stream + status live (MediaMTX source state) + URL playback |
| `[x]` | `POST /streams` | Register CCTV/ESP32-CAM (name, device_label, location, source_rtsp opsional → `CCTV_RTSP_URL`) → register path MediaMTX |
| `[x]` | `GET /streams/{id}` | Detail stream + URL HLS/WebRTC |
| `[x]` | `PUT /streams/{id}` | Update label/location/enabled/name/source (re-register path MediaMTX) |
| `[x]` | `DELETE /streams/{id}` | Unregister path + hapus row DB |
| `[x]` | `POST /streams/{id}/snapshot` | Capture frame → upload MinIO (`kind=snapshot`) |
| `[x]` | `POST /streams/{id}/snapshot?detect=true` | Capture frame → kirim ke ML Vision (`vision-aeroponik`) → simpan hasil deteksi sebagai `kind=detection` (bbox JSON) di tab Gallery DETECTION |
| `[x]` | `GET /snapshots` | List snapshot/recording (`?kind=`) |
| `[x]` | `GET /snapshots/{id}` · `DELETE /snapshots/{id}` | Get/delete snapshot |
| `[x]` | `POST /streams/{id}/record/start` | Mulai rekam video via `ffmpeg` (pull RTSP relay MediaMTX `rtsp://mediamtx:8554/{name}`) → file `.mp4` temp (`-c copy`) |
| `[x]` | `POST /streams/{id}/record/stop` | Finalisasi `ffmpeg` (SIGINT → moov atom) → upload MP4 ke MinIO (`recordings/<stream>/<uuid>.mp4`, `video/mp4`) → simpan `kind=recording` (playable + downloadable di Gallery tab RECORDING) |
| `[x]` | Kolom `duration` | Tabel `snapshots` menyimpan durasi rekaman (detik, diukur `ffprobe`) — ditampilkan di notifikasi stop, tile & lightbox Gallery |
| `[x]` | Integrisi MediaMTX client | Register/update/remove path via API `:9997` |
| `[x]` | Integrisi MinIO client | Upload/download object bucket `stream` |
| `[x]` | JWT middleware | Proteksi endpoint (Operator/Admin untuk mutasi) |
| `[x]` | Prometheus `/metrics` | `stream_http_requests_total` + scrape job `stream-service` |
| `[x]` | `Dockerfile` + healthcheck | Multi-stage + `/health` |
| `[x]` | Kong route | `/streams`, `/snapshots` via Kong + reverse proxy player MediaMTX |

### Dashboard
| Status | Halaman | Route | Akses |
|---|---|---|---|
| `[x]` | Live View | `/live` | Semua role (player MediaMTX iframe HLS/WebRTC + manajemen stream) |
| `[x]` | Snapshot | `/snapshot` | Semua role (galeri snapshot, recording & **detection** dari MinIO; tab ALL/SNAPSHOT/RECORDING/DETECTION; toolbar AI Capture untuk admin/operator) |

### Database: `mariadb-stream`
| Tabel | Fungsi |
|---|---|
| `streams` | Metadata stream (id, name=path MediaMTX, device_label, location, source_rtsp, module_id, enabled) — stream diikat ke **module** (bukan node); field Node dihapus dari form pendaftaran CCTV |
| `snapshots` | Capture frame + rekaman video + hasil deteksi AI (stream_id, stream_name, module_id, object_key, url, content_type, size, kind; `kind=recording` menyimpan video MP4 `video/mp4`; kolom `duration` simpan durasi detik; untuk `kind=detection`: model_id, model_name, num_detections, classes, detections JSON bbox, confidence_avg) |

---

## 🟢 Monitor Service (P3 — SELESAI)

> CLI ringan yang mengambil `docker stats` (CPU, memori, net IO, block IO, PIDs, status) untuk pemantauan resource container, dikonsumsi halaman **Version & Security → Service/Container Versions** di dashboard.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Scaffold Go CLI | `services/monitor/main.go` — parse `docker ps` + `docker stats --no-stream` |
| `[x]` | Agregasi metric container | CPU%, MemUsage/MemLimit, MemPerc, NetIO (Rx/Tx), BlockIO (R/W), PIDs, Status |
| `[x]` | Sorting & output terformat | Tabel ringkasan resource per container |
| `[x]` | `Dockerfile` | Build image `monitor` (di-orchestrate compose) |

> **Catatan:** Monitor Service adalah tool observability operasional (bukan HTTP service); melengkapi Prometheus/exporter untuk visibility resource di level container.

---

## 🟢 Fase 6 — ML / Vision API (P3)

> Deteksi objek visual menggunakan YOLOv8 (Python / FastAPI). Service ini **berdiri sendiri** dari Go microservices dan terintegrasi penuh ke arsitektur: MariaDB (`mariadb-ml`), MinIO bersama (bucket `ml-vision` untuk hasil, bucket `stream` read-only untuk frame sumber), NATS (`detection.result`), Kong (route `/ml`), dan Prometheus (`/metrics`). **Storage:** menulis hasil anotasi ke bucket `ml-vision` di **instance MinIO bersama** (lihat Catatan Keputusan Konsolidasi MinIO).

### Konsep Inti — Model Registry (penggantian model dengan `model_id`)

Model YOLO (mis. `best.pt` hasil training) **didaftarkan** ke registry dan memperoleh `model_id` stabil. Konsumen API memilih model melalui `model_id` saat inferensi; bila dikosongkan, digunakan model `is_default` (aktif). Hal ini memungkinkan **swap model tanpa restart** dan multi-model dalam satu service.

- Weights dapat berasal dari: (a) file yang sudah ada di volume `models/` (`file_path` saat register, default mencari `best.pt`), atau (b) di-upload lewat `POST /ml/models/{id}/weights`.
- Load YOLO dilakukan **lazy + cache di memory** per `model_id`; update config (threshold/imgsz) atau upload weights memicu reload otomatis.
- Warmup model default saat startup.

### Checklist Implementasi

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[x]` | Scaffold Python service | Struktur `app/` (config, database, schemas, security, vision_engine, storage, messaging, metrics, routers) | 1 hari |
| `[x]` | **Model Registry CRUD** | `POST/GET/PUT/DELETE /ml/models`, `POST /ml/models/{id}/activate`, `POST /ml/models/{id}/weights` (upload `.pt`) | 1.5 hari |
| `[x]` | YOLOv8 inference (lazy load + cache) | `ultralytics` YOLO, resolusi `model_id` → default, reload otomatis saat config berubah | 1 hari |
| `[x]` | **`POST /ml/detect`** | Upload 1..N gambar → deteksi (class, confidence, bbox) + gambar teranotasi | 1 hari |
| `[x]` | `POST /ml/detect/base64` | Inferensi dari image base64 (JSON) | 0.5 hari |
| `[x]` | `POST /ml/detect/from-stream` | Inferensi dari frame di bucket `stream` (read-only) | 0.5 hari |
| `[x]` | Hasil deteksi ke `mariadb-ml` | Tabel `vision_detections` (history) + `vision_models` (registry) via SQLAlchemy AutoCreate | 0.5 hari |
| `[x]` | Annotated image ke bucket `ml-vision` (MinIO bersama) | Original + detected JPEG; `ml-svc-key` scoped rw `ml-vision`, ro `stream` | 0.5 hari |
| `[x]` | Publish `detection.result` ke NATS | Event (best-effort) untuk service lain (Alert/Analytics/Export) | 0.5 hari |
| `[x]` | JWT / RBAC middleware | Validasi Bearer JWT (HS256, secret sama dengan Auth); write = admin/operator, read = semua role | 0.5 hari |
| `[x]` | Prometheus `/metrics` | `vision_inferences_total`, `vision_detections_total`, `vision_inference_seconds`, `vision_models_loaded` + instrumentator FastAPI | 0.5 hari |
| `[x]` | `GET /health` + `GET /ml/detections` | Healthcheck + history deteksi (paginated) | 0.5 hari |
| `[x]` | `Dockerfile` multi-stage ringan + `mariadb-ml` + `mysqld-exporter-ml` | Build Python:3.11-slim, healthcheck, volumes `ml-models` | 1 hari |
| `[x]` | Kong route + Prometheus scrape | Upstream `ml-upstream`, route `/ml`, job `ml-service` + `mariadb-ml` | 0.5 hari |

**Total estimasi: 7-14 hari — ✅ Selesai (backend service + integrasi infra).**

### Database: `mariadb-ml`

| Tabel | Fungsi |
|---|---|
| `vision_models` | Registry model: id, name, slug, file_path, class_names, input_size, confidence/iou threshold, status (registered/active/failed/disabled), is_default, metadata JSON |
| `vision_detections` | History inferensi: detection_uid, model_id, source_type, original/annotated URL, detections JSON (class/conf/bbox), confidence stats, execution_time_ms, status |

### Endpoint Lengkap

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| `POST` | `/ml/models` | Admin/Operator | Daftarkan model baru (beri `file_path` atau upload nanti) → dapat `model_id` |
| `GET` | `/ml/models` | All | List model (`?status=`) |
| `GET` | `/ml/models/{id}` | All | Detail model (+ flag `loaded`, `num_classes`) |
| `PUT` | `/ml/models/{id}` | Admin/Operator | Update metadata / threshold / status / `is_default` |
| `POST` | `/ml/models/{id}/activate` | Admin/Operator | Jadikan model default (aktif) |
| `POST` | `/ml/models/{id}/weights` | Admin/Operator | Upload weights `.pt` dan ikat ke model |
| `DELETE` | `/ml/models/{id}` | Admin/Operator | Hapus model dari registry |
| `GET` | `/ml/models/{id}/count` | All | Jumlah deteksi yang dihasilkan model |
| `POST` | `/ml/detect` | Admin/Operator | Upload gambar → YOLO → deteksi + URL anotasi (batch) |
| `POST` | `/ml/detect/base64` | Admin/Operator | Inferensi dari base64 JSON |
| `POST` | `/ml/detect/from-stream` | Admin/Operator | Inferensi dari object key bucket `stream` |
| `GET` | `/ml/detections` | All | History deteksi (paginated: `?model_id=&limit=&offset=`) |
| `GET` | `/ml/detections/{id}` | All | Detail 1 hasil deteksi |
| `GET` | `/health` | Public | Healthcheck (models_loaded, default_model) |
| `GET` | `/metrics` | Internal | Prometheus metrics |

### Contoh Penggunaan

```bash
# 1) Daftarkan model (weights best.pt sudah ada di volume models/)
curl -X POST http://localhost:8000/ml/models \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"best-ptn","slug":"best-ptn","file_path":"/app/models/best.pt",
       "confidence_threshold":0.25,"is_default":true}'

# 2) Atau upload weights lewat API (id dari response sebelumnya)
curl -X POST http://localhost:8000/ml/models/$MODEL_ID/weights \
  -H "Authorization: Bearer $TOKEN" -F "file=@best.pt"

# 3) User memilih model (model_id) lalu kirim gambar → dianalisis
curl -X POST http://localhost:8000/ml/detect \
  -H "Authorization: Bearer $TOKEN" \
  -F "model_id=$MODEL_ID" -F "files=@tanaman.jpg"

# → {"count":1,"results":[{"detections":[{"class_name":"umbi",
#     "confidence":0.91,"bbox":{"x1":..,"y1":..,"x2":..,"y2":..}}],
#     "annotated_url":"http://.../ml/detected/...jpg","execution_time_ms":42.1}]}
```

### Alur Inference

```
User (dashboard/API) ──Kong /ml/detect──▶ Vision API
        │ model_id (atau default)
        ▼
  Model Registry ── resolve(model_id) ──▶ YOLO weights (cache memory)
        │ image (upload / base64 / stream bucket)
        ▼
  model.predict() ──▶ detections (class, conf, bbox) + annotated JPEG
        ├─▶ upload original + detected ──▶ MinIO bucket ml-vision
        ├─▶ INSERT vision_detections ────▶ mariadb-ml
        └─▶ publish detection.result ────▶ NATS (JetStream)
```

---

## 🟡 Fase 10 — Dashboard (Lengkap) [P3]

> Frontend React untuk seluruh fitur sistem.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Auth pages | Login, Register, Profile, Ubah Password, Sesi, Deactivate |
| `[x]` | Manajemen Akun (Admin) | Tabel user, toggle aktif/nonaktif, ubah role, hapus |
| `[x]` | Module Management | CRUD module, pair/unpair node, node config |
| `[x]` | Analytics page | Line chart, selector node + metric, range selector |
| `[x]` | **Control Panel** | Mode arbitration (Manual/Otomatis/Emergency/Resume), manual override (ON/OFF/Toggle/level), editor jadwal (create/edit/toggle/delete) + pagination |
| `[x]` | **Live View** | Player MediaMTX (HLS/WebRTC iframe) + manajemen stream (create/edit/delete) |
| `[x]` | **Snapshot** | Galeri snapshot & recording dari MinIO (capture/delete) |
| `[x]` | **Telemetri Real-time** | Via WebSocket ke WS-Gateway (`NodeDetailPanel`) |
| `[x]` | **System Notifications** | Via WebSocket `/ws/system-status` (NotificationContext) — route server sudah ada (rebuild `wsgateway`); notifikasi alert real-time (triggered/resolved) mengalir dari Alert Service |
| `[x]` | **Audit Log page** | Halaman `AUDIT` (sidebar) → `GET /audit/logs`: filter event/search + paginasi + live refresh; konsumsi audit trail dari Audit Service (Fase 9) |
| `[x]` | **Alert & History page** | Halaman `ALERTS` (sidebar) → `GET /alerts`: tabel history (severity/status/node/metric/value/threshold/message/triggered/acked) + filter + paginasi + Live toggle + Ack (operator/admin); sub-tab **Thresholds** (`GET/POST/PUT/DELETE /thresholds`, wildcard `*` per metric) untuk seed alert |
| `[x]` | **Notification Bell** | Icon bell di header dashboard → konsumsi `useNotification()` (unread badge + dropdown); `NotificationContext` menormalisasi payload Alert Service (`system.status` + raw `alert.triggered`/`alert.resolved`) → notifikasi real-time |
| `[x]` | Panel kontrol device | Integrasi dengan Control Service (Control Panel) |

### Halaman Dashboard (Saat Ini)

| Halaman | Route | Status | Akses |
|---|---|---|---|
| Profile | `/profile` | ✅ | Semua role |
| Module Management | `/module` | ✅ | Semua role |
| Analytics | `/analytics` | ✅ | Semua role |
| User Management | `/users` | ✅ | Admin only |
| Device Management | (via Module) | ✅ | Semua role |
| Node Config | (via Device Management) | ✅ | Semua role |
| Telemetri Real-time | (Node Detail WS) | ✅ | Semua role |
| Live View | `/live` | ✅ | Semua role |
| Snapshot | `/snapshot` | ✅ | Semua role |
| Control Panel | `/control` | ✅ | Operator/Admin |
| Alert & History | `/alerts` | ✅ | Semua role (Ack: Operator/Admin) |

### Penambahan (2026-07-14) — Dashboard Alert & History (Fase 10)

- **Halaman `ALERTS`** (`dashboard/src/components/Dashboard/Pages/Alerts.jsx`): tab **Alerts** (history) + tab **Thresholds** (manajemen threshold).
  - *Alerts history*: tabel kolom Severity / Status / Node / Metric / Value / Threshold / Message / Triggered / Acked + tombol **Ack** per baris (hanya `status=active`, enable untuk operator/admin, **disabled** untuk viewer), filter (node_id, metric, status, severity) + quick-chip, paginasi + page-size, toggle **Live** (auto-refresh 10s), expandable row untuk raw payload.
  - *Thresholds*: list + form create/edit (node_id menerima `*` wildcard, metric, min, max, enabled, severity) + delete dengan konfirmasi. Seed threshold dari UI agar alert bisa ter-trigger.
  - Bahasa UI **English** (sesuai AGENTS.md). Akses semua role; Ack butuh operator/admin (backend `RequireRole`).
- **Notification Bell** (`NotificationBell.jsx`): icon bell di header (dekat ClockWidget) → `useNotification()`; badge unread + dropdown list notifikasi terbaru (relative time, warna severity). `NotificationProvider` di-mount di `main.jsx`.
- **Normalisasi payload** di `NotificationContext.jsx`: `normalizeAlert()` menangani tiga shape — legacy wrapped (`data.*`), Alert Service `system.status` (flat: `type:'alert'`, `level`, `node_id`, `metric`, `value`, `message`, `status:'triggered'|'resolved'`, `ts`), dan raw `alert.triggered`/`alert.resolved` (`severity`, `status:'active'|'resolved'`, `triggered_at`). Mapping: `level`/`severity` → `warning`/`critical`; `resolved` → `success`; `category:'alert'`; `module_id` ← `node_id`; `timestamp` ← `ts`/`triggered_at`. Dedup 5s by message+status menangani event ganda (WS bridge forward `system.status` **dan** raw `alert.*`).
- **Backend fixes (ditemukan saat E2E):**
  1. `wsgateway` image stale — route `/ws/system-status` 404 di binary lama; **rebuild** agar route (sudah ada di source) ter-deploy.
  2. `services/alert` bug: `Service` dibuat dengan NATS conn = `nil` (karena `service.New(...)` dipanggil *sebelum* `nats.Connect`), sehingga `publishAlert`/`publishSystem` sellau early-return → alert tidak pernah di-publish ke `system.status`/`alert.*`. Fix: tambah `Service.SetNATS(nc)` dan panggil setelah koneksi NATS established di `main.go`. Sekarang notifikasi mengalir end-to-end (WS → wsgateway → `NotificationContext`).

> **Verifikasi E2E (2026-07-14):** via Kong — buat threshold (`*`, `e2e_test_ph`, min 5.5/max 7) → publish telemetry di luar range → alert `active` + WS terima `system.status`(triggered) & raw `alert.triggered`; balik ke range → `resolved` + `system.status`(resolved) & raw `alert.resolved`; Ack sebagai admin → `status:acked` + `acked_by`/`acked_at`; viewer → LIST 200 tapi ACK **403** (`forbidden: insufficient role`). Build dashboard `npm run build` ✅.

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
   ├─ Caching query results (redis-shared DB3)
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
| `[x]` | Endpoint `/export/v1/telemetry/aggregate` | **Delivered via Analytics Service `GET /analytics/export`** (CSV, resolusi day/hour/raw) — lihat keputusan Opsi A | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/nodes` | Metadata node & module | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/alerts` | History alert | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/commands` | Log perintah kontrol | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/audit` (admin only) | Audit log | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/discover` | Self-documenting schema | 0.5 hari |
| `[ ]` | Redis caching (`redis-shared` DB3) | Cache query results, TTL configurable | 0.5 hari |
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
| `[ ]` | Upload firmware ke bucket `ota` (MinIO bersama) | Binary firmware disimpan di MinIO |
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

> **📝 Catatan:** Saat ini metrik **tidak lewat NATS** — tiap service langsung expose HTTP `/metrics` dan Prometheus **scrape langsung**. Fase 11 akan mengubah ke desain (selaras `planning.md`): service publish ke NATS subject `metrics.health` → "Prometheus Service" subscribe & aggregasi → expose `/metrics`.

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

> **Catatan penomoran:** nomor 1–15 mengikuti `planning.md` (database-per-service). Item cross-cutting (DLQ/CI/Test/Outbox) tidak bernomor karena lintas service.

| # | Service | Bahasa | Database | Status | Prioritas | Fase |
|---|---------|--------|----------|--------|-----------|------|
| 1 | Auth | Go | MariaDB | ✅ Selesai | P1 | Fase 1 |
| 2 | Module | Go | MariaDB + TimescaleDB + Redis (shared DB0) | ✅ Selesai | P1 | Fase 2 |
| 3 | Analytics | Go | TimescaleDB | ✅ Selesai | P2 | Fase 3 |
| 4 | WS-Gateway | Go | - | ✅ Selesai | P2 | Fase 3 |
| 5 | Control | Go | MariaDB | ✅ Selesai | P1 | Fase 4 |
| 6 | Stream | Go | MariaDB + MinIO (bucket `stream`, shared) | ✅ Selesai | P3 | Fase 5/6 |
| 7 | Monitor | Go (CLI) | - (docker stats) | ✅ Selesai | P3 | — |
| 8 | ML/Vision | Python | MariaDB + MinIO (bucket `ml-vision`, shared) | ✅ Selesai | P3 | Fase 6 |
| 9 | Alert | Go | MariaDB + Redis (shared DB1) | ✅ Selesai | P1 | Fase 5 |
| 10 | Notification | Go | MariaDB + Redis (shared DB2) | ⬜ Belum | **P1** | Fase 5 |
| 11 | Audit | Go | MariaDB | ✅ Selesai | P1 | Fase 8 (Audit) |
| 12 | Export / Data API | Go/Python | TimescaleDB (read) + Redis (shared DB3) | ⬜ Belum | P3 | Fase 9b |
| 13 | OTA | Go | MariaDB + MinIO (bucket `ota`, shared) | ⬜ Belum | P4 | Fase 10 |
| 14 | Prometheus Metrics | Go | - | ⬜ Belum | P4 | Fase 11 |
| 15 | Webhook | Go | MariaDB | ⬜ Belum | P4 | (belum bernomor) |
| — | **DLQ Saga (NATS Advisory)** | Go | mariadb-audit | ⬜ Belum | **P1** | Cross-cutting (TA) |
| — | **CI/CD (GitHub Actions)** | YAML | - | ⬜ Belum | 🟡 P2 | Cross-cutting (TA) |
| — | **Unit Test 80%** | Go | - | ⬜ Belum | 🟡 P2 | Cross-cutting (TA) |
| — | **Transactional Outbox** | Go | per-service `outbox` | ⬜ Belum | 🟡 P2 | Cross-cutting (TA) |

> **Catatan:** `services/cctv-capture` (job cron snapshot CCTV, dijalankan via `docker-compose.yml`) **sudah ada & jalan** namun **tidak masuk ringkasan di atas** karena bukan microservice (bukan punya API/DB sendiri — hanya pull frame MediaMTX saat pompa OFF lalu simpan ke MinIO `stream`).

---

## 📊 Timeline yang Direkomendasikan

| Minggu | Fokus | Service | Deliverable |
|--------|-------|---------|-------------|
| **Minggu 1** | 🟢 P3 | Stream Service + Monitor Service + Live View/Snapshot | Streaming kamera (MediaMTX HLS/WebRTC) + snapshot/recording MinIO + pemantauan resource container ✅ |
| **Minggu 2** | 🔴 P1 | Alert Service + Audit Service | Threshold evaluation + audit log aktif (consume `audit.log`) |
| **Minggu 3** | 🟡 P2 | Notification Service + WS JWT Auth | Notifikasi Telegram/Email/Push + WS aman ✅ (WS sudah) |
| **Minggu 4** | 🟡 P2 | Dashboard Lengkap (Device Mgmt, realtime, alert) | Halaman dashboard lengkap (realtime & control sudah; alert menyusul) |
| **Minggu 5** | 🟢 P3 | Export / Data API | Akses data eksternal (pandas/Parquet) |
| **Minggu 6+** | ⬜ P4 | OTA + Prometheus Metrics + Cloudflare | OTA update, pipeline metrik, deployment |

### Rekomendasi Eksekusi TA-Scale (selaras `planning.md` TA-Scale Roadmap)

| Urutan | Item | Kategori | Alasan |
|---|---|---|---|
| 1 | **DLQ Saga (NATS Advisory)** | 🔴 P1 | Bukti nyata resilience; subscriber ke `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.*` → `mariadb-audit` |
| 2 | **Lengkapi Audit Compliance** | 🔴 P1 | Pastikan semua service publish `audit.log` (Control/Stream/ML/Notification) |
| 3 | **Notification Service** | 🔴 P1 | Menyelesaikan alert "mati di ujung" |
| 4 | **CI/CD (GitHub Actions)** | 🟡 P2 | `go build` + `go vet` + `docker build` tiap push |
| 5 | **Unit Test 80%** | 🟡 P2 | AGENTS.md wajibkan; fokus layer `service`/`repository` |
| 6 | **Transactional Outbox** | 🟡 P2 | Atasi dual-write problem (DB + NATS publish) |

---

## ⚠️ Risiko & Mitigasi

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|-------------|----------|
| Core NATS untuk `telemetry.batch` | Kehilangan data saat restart | Tinggi | ✅ Selesai (2026-07-13): upgrade ke JetStream — stream `TELEMETRY_BATCH` (file storage, retention 24h) + durable consumer `analytics-batch`, replay otomatis |
| WS tanpa autentikasi | Data real-time bocor | Rendah | ✅ JWT handshake sudah diimplementasikan pada WS-Gateway |
| 17 instance database | Biaya & kompleksitas operasional | Sedang | Evaluasi apakah semua instance diperlukan; ✅ MinIO sudah dikonsolidasi jadi 1 instance bersama (multi-bucket + scoped key) |
| Tidak ada backup database | Data hilang permanen jika container crash | Sedang | ✅ Sudah ada DR Strategy di `planning.md` (cron dump SQL per asset, RPO/RTO) |
| Tidak ada CI/CD | Human error saat build/deploy | Sedang | 🟡 Dikerjakan di TA: GitHub Actions (`go build` + `go vet` + `docker build`) |
| Tidak ada unit test | Regression bug tidak terdeteksi | Tinggi | 🟡 Dikerjakan di TA: target 80% coverage layer `service`/`repository` |
| NATS/Kong single-instance SPOF | Event bus / gateway mati → sistem lumpuh | Sedang | ✅ Sudah didokumentasikan HA strategy di `planning.md` (NATS 3-node cluster + JetStream R=2, Kong 2+ replica di prod) |
| DLQ saga belum ada | Kegagalan terdistribusi tak terinvestigasi | Sedang | 🔴 Dikerjakan di TA: DLQ via NATS Advisory `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.*` → `mariadb-audit` |

---

## 📝 Catatan Perubahan

| Tanggal | Versi | Perubahan |
|---------|-------|-----------|
| 2026-07-11 | 2.0.0 | Sinkronisasi dengan planning.md; update status Fase 2 & 3 selesai; tambah tabel ringkasan, timeline, risiko; perbaiki inkonsistensi penomoran fase; tambah detail database per service |
| 2026-07-12 | 2.2.0 | **Reorder fase pasca-Fase 4.** Stream Service & ML/Vision API dipindah lebih awal (Fase 5 & 6) sebagai blok fitur vision terpadu; Alert (F7), Notification (F8), Audit (F9), Dashboard (F10), Export (F11), OTA (F12), Prometheus Metrics (F13), Cloudflare (F14) menyusul. Tabel ringkasan, timeline, dan catatan perubahan disesuaikan. |
| 2026-07-12 | 2.1.0 | **Fase 4 (Control Service) SELESAI.** Backend: arbitrasi mode node-level, kolom `prev_mode` + `EnterEmergency`/`ResumeNode` (Resume restorasi mode pra-emergency). Dashboard: halaman Control Panel (kartu Control Mode, toggle Manual⇄Otomatis, Emergency Stop, Resume), perbaikan bug `TargetTile` (`nodeMode` prop), editor jadwal (create/edit/toggle/delete) + pagination (PAGE_SIZE=4). Ringkasan service & tabel halaman dashboard diperbarui. |
| 2026-07-12 | 2.3.0 | **Fase 5 (Stream Service) SELESAI + Monitor Service SELESAI + WS-Gateway SELESAI.** Stream: MediaMTX (RTSP→HLS/WebRTC), MinIO snapshot/recording, CRUD stream + snapshot/recording via Kong, dashboard Live View & Snapshot. Monitor: CLI `docker stats` untuk halaman Version/Security. WS-Gateway: realtime telemetry (`NodeDetailPanel`) + system-status notifications terhubung ke dashboard. Dashboard realtime/control/live/snapshot ditandai selesai; ringkasan service, timeline, dan tabel halaman diperbarui. |
| 2026-07-12 | 2.4.0 | **Konsolidasi MinIO (Opsi C).** Tidak lagi instance MinIO per service → **1 instance MinIO bersama** (`minio`) multi-bucket (`stream`, `ml-vision`, `ota`) + access key scoped per service. Stream tetap owner bucket `stream`. Fase 6 ML/Vision diubah ke bucket `ml-vision` (bukan `minio-ml`). Total instance turun 18 → 17. Tabel ringkasan service & risiko disesuaikan. |
| 2026-07-12 | 2.5.0 | **Fase 6 (ML / Vision API) SELESAI.** Service Python/FastAPI terpisah: Model Registry (CRUD + upload weights + activate → `model_id` stabil untuk swap model tanpa restart), inference YOLOv8 (lazy load + cache per `model_id`) via `POST /ml/detect` (upload/batch), `/detect/base64`, `/detect/from-stream`, history `GET /ml/detections`. Persistensi `mariadb-ml` (`vision_models`, `vision_detections`), hasil anotasi ke bucket `ml-vision` (MinIO bersama), publish `detection.result` ke NATS, JWT/RBAC middleware (HS256, secret sama dengan Auth), Prometheus `/metrics`, `mariadb-ml` + `mysqld-exporter-ml`, route Kong `/ml`, scrape `ml-service` + `mariadb-ml`. Weights `best.pt` di-seed ke volume `ml-models`. |
| 2026-07-13 | 2.7.0 | **Audit fix — komunikasi & bottleneck (2 item).** (1) Module Service: cache in-memory (TTL 2m) untuk tag mapping + module id per node dan `TouchNode` di-batch via `StartTouchFlusher` (1× UPDATE/node/30 detik) → tiap telemetry reading tidak lagi memicu 2× SELECT + 1× UPDATE MariaDB (menghilangkan N+1 di hot-path). (2) `telemetry.batch` di-upgrade Core NATS → **JetStream** (stream `TELEMETRY_BATCH`, file storage, retention 24h) dengan durable consumer `analytics-batch` → window agregat 1-menit replay otomatis saat Analytics restart (ack eksplisit, redeliver on failure). Kedua service lolos `go build` + `go vet`. |
| 2026-07-13 | 2.8.0 | **Telemetry retention berjenjang + ekspor CSV (Opsi A).** `infra/timescaledb/analytics/init.sql`: retensi berjenjang — raw 30 hari, hourly 365 hari, **daily 3650 hari (10 tahun)** — + compression policy 7 hari pada `metrics_hourly`/`metrics_daily` (history riset 5–10 tahun tetap murah). Idempotensi bootstrap diperbaiki: `ALTER TABLE ... ADD CONSTRAINT` → `CREATE UNIQUE INDEX IF NOT EXISTS` (versi lama gagal saat re-run/upgrade sehingga CAGG & policy tidak terbuat). Analytics Service: endpoint baru `GET /analytics/export` (CSV, kolom `bucket,node_id,metric,count,sum,min,max,avg,last`, resolusi `day`/`hour`/`raw`) untuk unduh history telemetri mahasiswa tanpa scaffolding service `export/` terpisah. Lolos `go build` + `go vet` + pengujian end-to-end (TimescaleDB fresh + service: verifikasi policy retensi/kompresi, continuous aggregate, ekspor CSV range 4 tahun). |
| 2026-07-14 | 2.10.0 | **Analytics: batch endpoint + label tampilan + scoping modul.** Perbaikan akar masalah dashboard Analytics kosong di timeframe 1 jam: (1) `GET /analytics/metrics` di-upgrade jadi **batch** (`node_id` & `metric` comma-list, respons `series[node_id][metric]`) → 19 metrik dalam 1 request, menghilangkan burst N×M yang memicu 429 rate-limit Kong; (2) scoping modul diperketat (modul tanpa telemetry tetap kosong); (3) hanya metrik ber-tag `enabled=true` yang ditampilkan. Node tag dapat kolom `label` (AutoMigrate GORM, `COALESCE(label,'')` di SELECT) — Analytics menampilkan `label` sebagai judul/legend tiap metrik, fallback `tag_name` lalu source_key. Editor tag (NodeDetailPanel & NodeConfigPage) dapat input `Label`. Lolos `go build` + `go vet` + e2e. |
| 2026-07-14 | 2.11.0 | **Analytics: resolusi per-menit data diskrit (≤24h) + envelope min–max analog.** (1) `tsdb.go` `discreteStep`: data diskrit/digital kini di-bucket **1 menit** untuk seluruh window `≤24h` (sebelumnya 5 menit di 24h) → transisi ON/OFF tetap tiap menit; range multi-hari tetap coarsen bertahap (15 m / 1 j / 3 j) agar payload aman. (2) `model.SeriesPoint` diperluas `min`/`max`/`avg` (`*float64`, omitempty); `queryRange` analog kini memilih `last` + `avg=sum/NULLIF(count,0)` + `min` + `max` dari `metrics_rollup`/`metrics_hourly`/`metrics_daily` (CAGG tak simpan avg → dihitung ulang); tambah `scanSeriesRange`. (3) Dashboard `Analytics.jsx`: tren analog menggambar **envelope min–max** (band terisi antara nilai rendah/tinggi tiap bucket) + garis `avg`, dataset band disembunyikan dari legend & tooltip; kartu ringkasan menghitung **true** min/max/avg via `statsOf` (rentang tak lagi hilang di range lebar). Analog tetap per-jam (≤24h) & per-hari (>24h) sesuai keputusan. Lolos `go build` + `go vet` + ESLint (tanpa error baru). |
| 2026-07-14 | 2.12.0 | **Sinkronisasi dokumen ↔ kode.** (1) Koreksi status `system-status notifications` WS-Gateway: ✅ → ⬜ Belum (route `/ws/system-status` belum diimplementasikan di `services/wsgateway`; hanya sisi dashboard `NotificationContext` yang siap). (2) Tambah catatan `services/cctv-capture` (job cron snapshot CCTV, sudah jalan via compose) yang sebelumnya tidak ada di ringkasan service. (3) Konfirmasi 0 unit test di seluruh service → produksi blocker (gate G10). |
| 2026-07-14 | 2.13.0 | **Fase 9 — Audit Service SELESAI.** Service Go baru `services/audit`: subscribe `audit.log` (Core NATS, queue group `audit-workers`) → insert append-only ke `mariadb-audit` (`audit_logs`), endpoint `GET /audit/logs` (filter `event`/`search` + paginasi). Wire: `mariadb-audit` + `audit` + `mysqld-exporter-audit` (compose), upstream+route `/audit` (Kong, JWT), scrape job `audit-service`+`mariadb-audit` (Prometheus). Lolos `go build` + `go vet` + `docker compose config`. Dashboard Audit/History (Fase 10) menyusul. |
| 2026-07-14 | 2.14.0 | **Fase 10 — Dashboard Audit Log page SELESAI.** Halaman `AUDIT` (sidebar, ikon `ScrollText`) di `dashboard/src/components/Dashboard/Pages/Audit.jsx`: tabel audit trail immutable dari `GET /audit/logs` via Kong, filter `event` (prefix) + `search` (payload), paginasi (25/50/100) + quick-filter chip (Auth/Module/Node/Control), tombol Live (auto-refresh 10s). Penyempurnaan backend: filter `event` di Audit Service diubah jadi prefix `LIKE` agar dashboard bisa filter `auth`/`control`/dll. Lolos `npm run build` (vite) + ESLint (sesuai baseline repo). Sidebar & DashboardLayout di-wire. |
| 2026-07-16 | 2.16.0 | **Sinkronisasi penuh dengan `planning.md` (v2.16.0).** (1) Versi & tanggal → 2.16.0 / 2026-07-16; (2) Tambah link *Dokumen Terkait* (planning/logs/testing/AGENTS); (3) **Seragamkan penomoran fase ke skema planning (1–12)**: Notification → Fase 5 (P1), Export → Fase 9b, OTA → Fase 10, Prometheus Metrics → Fase 11, Cloudflare → Fase 12; (4) Prioritas Notification → **P1** (blocker fungsional, alert "mati di ujung"); (5) Tambah item cross-cutting TA-Scale ke tabel "Yang belum dikerjakan" & Ringkasan Service: **DLQ Saga (P1), CI/CD (P2), Unit Test 80% (P2), Transactional Outbox (P2), Webhook (#15)**; (6) Tambah sub-bab "Rekomendasi Eksekusi TA-Scale" di Timeline; (7) Perbarui Risk table: backup→sudah ada DR strategy, CI/CD & unit test → 🟡 dikerjakan di TA, tambah risiko SPOF NATS/Kong & DLQ saga. |

---

## 📝 Catatan Keputusan Arsitektur — Konsolidasi MinIO (2026-07-12)

**Konteks:** Awalnya direncanakan `minio-stream` (snapshot/recording), `minio-ml` (anotasi YOLOv8), `minio-ota` (firmware) sebagai instance terpisah. Muncul usulan: MinIO hanya milik ML, Stream cukup handle API MediaMTX dan menaruh snapshot/recording ke MinIO ML.

**Keputusan:** **Opsi C — 1 instance MinIO bersama, multi-bucket, scoped access key.** Bukan Opsi A (Stream bergantung MinIO ML) dan bukan Opsi B (2+ instance MinIO di host sama).

**Alasan singkat:**
1. **Urutan deploy & bounded context** — Stream sudah `✅`, ML belum. Stream memproduksi snapshot/recording → harus punya storage sendiri (bucket `stream`) agar tidak bergantung ML.
2. **Performa** — bottleneck MinIO adalah disk I/O + network, bukan proses. Membelah di host/disk sama malah kontensi. 1 instance + SSD/NVMe lebih dari cukup untuk beban TA.
3. **Resilience** — SPOF diatasi dengan **erasure-coding multi-drive** pada 1 instance, bukan membelah container di 1 disk.
4. **Isolasi** — bucket terpisah + access key scoped (`stream`/`ml-vision`/`ota`) memenuhi *Zero-Trust Internal*.
5. **Efisiensi** — kurangi container & beban backup; menjawab risiko "terlalu banyak instance".

**Skema akhir:**
```
minio (1 instance, erasure-coding multi-drive bila memungkinkan)
 ├─ bucket: stream      owner: Stream Service  (rw: stream-svc-key)
 ├─ bucket: ml-vision   owner: ML / Vision API (rw: ml-svc-key, ro: stream)
 └─ bucket: ota         owner: OTA Service     (rw: ota-svc-key)  [Fase 12]
```
ML baca frame sumber dari `stream` (key read-only) untuk inferensi; retensi per bucket bisa berbeda.


*Perbarui status item saat mulai (`[/]`) dan selesai (`[x]`) mengerjakan masing-masing item. Catat aktivitas harian di [`logs.md`](./logs.md).*
---

## 🛡️ Audit Fix #3 — Gateway & Service Hardening (2026-07-14) — ✅ Selesai

Hasil *stress test & penetration test* (`stress-test/`) ditemukan & diperbaiki:

| Item | Prioritas | Status | Detail |
|------|-----------|--------|--------|
| Enforce JWT + RBAC di Module Service (`/modules`, `/nodes`) | 🔴 P1 | [x] | `middleware/auth.go` (stdlib HS256) + wiring di `main.go` |
| Naikkan rate limit Kong (global/auth-public/terlindungi) | 🟡 P2 | [x] | `infra/kong/kong.yml` |
| Header keamanan + sembunyikan `Server` via `response-transformer` | 🟡 P2 | [x] | `infra/kong/kong.yml` + `KONG_NGINX_HTTP_SERVER_TOKENS: off` |
| Validasi input XSS di Module Service | 🟡 P2 | [x] | `handler.go` |
| Metrik host (node-exporter + cAdvisor) di Prometheus | 🟢 P3 | [x] | `docker-compose.yml` + `infra/prometheus/prometheus.yml` |

**Verifikasi:** jalankan `python3 stress-test/cli.py pentest` (ekspektasi: *Protected routes reject unauthenticated access* → PASS) dan `python3 stress-test/cli.py metrics` (ekspektasi job `node-exporter` & `cadvisor` muncul).
