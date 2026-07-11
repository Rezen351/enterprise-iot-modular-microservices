# 🗺️ Roadmap — IOT-Modular-Microservice

> **Versi:** 1.2.0  
> **Terakhir diperbarui:** 2026-07-11  
> **Status legend:** 🔴 P1 (Kritikal) · 🟡 P2 (Penting) · 🟢 P3 (Normal) · ⬜ Belum dijadwalkan  
> **Progress:** `[ ]` Belum · `[/]` In Progress · `[x]` Selesai

---

**Status keseluruhan:** Fase 1 (Auth + Observability) + Fase 2 (Module Service) + Fase 3 (Analytics Service) = SELESAI.
Yang sudah berjalan end-to-end: Auth Service lengkap, Module Service (onboarding + telemetry ingest + batch NATS), Analytics Service (subscribe `telemetry.batch` → `timescaledb-analytics` → continuous aggregate → dashboard via Kong), seed akun admin + Manajemen Akun, Prometheus + plugin Kong prometheus, WS-Gateway, dan dashboard React terhubung ke Kong (fitur Auth + Analytics; halaman lain di-hide). Target Prometheus `prometheus`, `auth-service`, `module-service`, `wsgateway-service`, `kong`, dan `analytics-service` UP.
Belum dikerjakan: Control, Alert, Notification, Stream, ML/Vision, Audit, OTA, Cloudflare Tunnel, dan halaman dashboard non-auth lainnya.

---

## 🔴 Fase 1 — Auth Service (P1 — Selesai)

> Fondasi keamanan sistem. Semua service lain bergantung pada Auth untuk validasi token.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Scaffold Go service | `go.mod`, `main.go`, struktur `internal/` |
| `[x]` | `POST /auth/register` | Registrasi user baru, hash password bcrypt |
| `[x]` | `POST /auth/login` | Validasi kredensial, issuing JWT + Refresh Token |
| `[x]` | `POST /auth/refresh` | Refresh Token rotation — revoke lama, issue baru |
| `[x]` | `POST /auth/logout` | Revoke refresh token aktif |
| `[x]` | `GET /auth/me` | Profil user aktif (dari JWT) |
| `[x]` | RBAC Middleware | Cek role (Admin/Operator/Viewer) per route |
| `[x]` | NATS publisher | Publish `audit.log` saat login/logout/register/error |
| `[x]` | Retention cron | Hapus `refresh_tokens` expired + soft-delete user inaktif > 365 hari |
| `[x]` | `GET /health` | Healthcheck endpoint untuk Kong upstream |
| `[x]` | Seed akun admin default | Auto-create admin (env `ADMIN_*`) saat migrasi pertama; idempoten |
| `[x]` | `GET /auth/users` | List semua akun (admin only) |
| `[x]` | `GET /auth/roles` | List role tersedia (admin only) |
| `[x]` | `PUT /auth/users/{id}` | Admin ubah status aktif + peran akun |
| `[x]` | `DELETE /auth/users/{id}` | Admin hapus (soft-delete) akun |
| `[x]` | Guard admin | Blokir self-deactivate/demote & hapus admin terakhir |
| `[x]` | `Dockerfile` multi-stage | Build Go binary + minimal runtime image |
| `[x]` | Prometheus `/metrics` | Instrumentasi HTTP (client_golang) + scrape via Prometheus server |

---

## 🔴 Fase 1 — Mosquitto Config (P1)

> Diperlukan segera agar ESP32 bisa terhubung ke broker MQTT.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | `mosquitto.conf` | Listener port 1883, persistence on, log level info |
| `[x]` | `acl.conf` | Per-topic per-service: Module bisa publish `sensor/#`, Control bisa publish `cmd/#` |
| `[x]` | Password file | Credentials ESP32 + Module Svc + Control Svc |

---

## 🔴 Fase 1 — Observability / Prometheus (P1)

> Metrics aggregator terpusat untuk seluruh service.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Prometheus server | `docker-compose` service + `prometheus.yml` (retention 15d) |
| `[x]` | Scrape Auth Service | Job `auth-service` → `auth:8080/metrics` (UP) |
| `[x]` | Scrape Kong Gateway | Plugin `prometheus` + job `kong` → `kong:8001/metrics` (UP) |
| `[x]` | Dashboard → Kong (Auth-only) | Login(identifier)/register/profile/Manajemen Akun via `VITE_API_URL`; halaman non-auth di-hide |

---

## 🟡 Fase 2 — Module Service (P2) — SELESAI

> Jembatan antara ESP32 dan backend. Menerima data sensor dan mendistribusikannya.

### 2a — Onboarding Perangkat (Aktif) — deteksi otomatis, pair/unpair

> Fokus saat ini: device bisa terdeteksi otomatis lewat sinyal `discovery`, lalu di-pair/unpair ke sebuah Module. Telemetry ingest menyusul di 2b.

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | Scaffold Module Service (Go) | Struktur `internal/` (config, model, repository, cache, service, mqtt, handler, middleware), mirror pola Auth |
| `[x]` | Skema `module_db` (MariaDB) | Tabel `modules` (konfigurasi) & `nodes` (perangkat) via GORM AutoMigrate |
| `[x]` | MQTT subscriber `discovery` | Subscribe `smartfarm/discovery` → auto-register node (unpaired) |
| `[x]` | MQTT subscriber `status/#` | Subscribe `smartfarm/status/+` (online/offline LWT) → update status + last_seen |
| `[x]` | Redis status cache | `redis-module` menyimpan status realtime + TTL (last-seen) |
| `[x]` | REST: Module CRUD | `POST/GET/PUT/DELETE /modules` |
| `[x]` | REST: Node onboarding | `GET /nodes`, `GET /nodes/discovered`, `pair`, `unpair`, `DELETE` |
| `[x]` | NATS `audit.log` | Publish saat module/node created/paired/unpaired/deleted |
| `[x]` | TimescaleDB provisioning | `timescaledb-module` + hypertable `telemetry` siap (ingest di fase 2b) |
| `[x]` | Dockerfile + healthcheck | Multi-stage + `/health` |
| `[x]` | Kong route + Prometheus scrape | `/modules`, `/nodes` via Kong; job `module-service` |

### 2b — Telemetry Ingest (belum)

| Status | Item | Deskripsi |
|---|---|---|
| `[x]` | MQTT subscriber telemetry | Subscribe `smartfarm/{node}/telemetry` → `IngestTelemetry` |
| `[x]` | Tag mapping (modular) | Tabel `node_tags` di MariaDB: source_key (dot-path) → tag_name DB, bisa diubah di UI tanpa kode |
| `[x]` | Simpan ke TimescaleDB | Insert ke hypertable `telemetry` (node_id, module_id, metric, value, raw) |
| `[x]` | Cache ke Redis | Nilai terbaru per node (`node:latest:{id}`, TTL) |
| `[x]` | Publish NATS | `telemetry.ingest` per reading (ke WS-Gateway/alert/analytics) |
| `[ ]` | Publish NATS | `telemetry.batch` setiap 1 menit (agregat) |

---

## 🟡 Fase 3 — Analytics Service (P2) — SELESAI

> Akuisisi data pada database Timescale (atau module), diproses oleh Analytics Service, lalu ditampilkan di dashboard.

| Status | Item |
|---|---|
| `[x]` | Subscribe `telemetry.batch` dari NATS (core NATS, mirror pola ws-gateway) |
| `[x]` | Upsert agregat ke `metrics_rollup` di `timescaledb-analytics` (Database-per-Service) |
| `[x]` | Agregasi & olah data: downsampling otomatis via continuous aggregate (`metrics_hourly`, `metrics_daily`) |
| `[x]` | Ekspos hasil agregasi ke Dashboard via Kong (`/analytics/metrics`, `/analytics/summary`, `/analytics/nodes`) |
| `[x]` | Continuous aggregate + Data Retention Policy (raw 30d, refresh policy 1j/1h) |

---

## 🟡 Fase 4 — Control Service (P2)

> Meneruskan perintah dari dashboard/API ke ESP32 lewat MQTT.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | `POST /control/command` | Terima perintah dari Kong (perlu JWT Operator/Admin) |
| `[ ]` | NATS Request-Reply | Kirim command, tunggu ACK dari device (timeout 500 ms) |
| `[ ]` | Publish MQTT | Forward command ke `cmd/{device_id}` |
| `[ ]` | Simpan ke MariaDB | Log perintah + status di `mariadb-control` |
| `[ ]` | Publish `audit.log` | Setiap perintah terkirim/gagal |
| `[ ]` | `Dockerfile` + healthcheck | |

---

## 🟢 Fase 5 — Alert Service (P3)

> Mengevaluasi data sensor terhadap threshold dan memicu notifikasi.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | Subscribe NATS | `telemetry.ingest` |
| `[ ]` | Ambil threshold | Dari `mariadb-alert`, cache di `redis-alert` |
| `[ ]` | Evaluasi threshold | Bandingkan nilai sensor dengan batas min/max |
| `[ ]` | Publish `alert.triggered` | Jika threshold terlampaui |
| `[ ]` | Publish `alert.resolved` | Jika nilai kembali normal |
| `[ ]` | REST endpoint | `GET /alerts`, `PUT /alerts/:id/ack` |
| `[ ]` | `Dockerfile` + healthcheck | |

---

## 🟢 Fase 5 — Notification Service (P3)

> Mengirim notifikasi ke pengguna berdasarkan alert yang dipicu.

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | Subscribe NATS | `alert.triggered`, `alert.resolved` |
| `[ ]` | Kirim Push/Email | Integrasi SMTP atau Firebase FCM |
| `[ ]` | Kirim Telegram | Bot API Telegram |
| `[ ]` | Queue di Redis | `redis-notification` sebagai antrian notifikasi (retry) |
| `[ ]` | Simpan log notif | Di `mariadb-notification` |
| `[ ]` | `Dockerfile` + healthcheck | |

---

## ⬜ Fase 6 — Stream Service

| Status | Item |
|---|---|
| `[ ]` | Integrasi MediaMTX (HLS/WebRTC) |
| `[ ]` | Metadata stream di `mariadb-stream` |
| `[ ]` | Upload snapshot ke `minio-stream` |

---

## ⬜ Fase 7 — ML / Vision API

| Status | Item |
|---|---|
| `[ ]` | YOLOv8 inference (Python FastAPI) |
| `[ ]` | Hasil deteksi ke `mariadb-ml` |
| `[ ]` | Annotated image ke `minio-ml` |
| `[ ]` | Publish `detection.result` ke NATS |

---

## ⬜ Fase 8 — Audit Service

| Status | Item |
|---|---|
| `[ ]` | Subscribe `audit.log` dari NATS |
| `[ ]` | Append-only insert ke `mariadb-audit` |
| `[ ]` | Endpoint `GET /audit/logs` (admin only) |

---

## 🟡 Fase 9 — WS-Gateway

| Status | Item |
| --- | --- |
| `[x]` | Service `wsgateway` (NATS → WebSocket bridge), route `/ws` via Kong |
| `[x]` | Subscribe `mqtt.{node_id}` → push realtime payload ke dashboard (`/ws/nodes/{node_id}/live`) |
| `[ ]` | Autentikasi koneksi WS via JWT |
| `[ ]` | `system-status` / notifikasi multi-subject (NotificationContext) |

---

## ⬜ Fase 10 — Dashboard

| Status | Item |
|---|---|
| `[ ]` | React app (reuse dari Aeroponik-Docker) |
| `[ ]` | Tampilan telemetri real-time |
| `[ ]` | Tampilan alert & history |
| `[ ]` | Panel kontrol device |
| `[ ]` | Koneksi ke WS-Gateway |

---

## ⬜ Fase 11 — OTA Service

| Status | Item |
|---|---|
| `[ ]` | Upload firmware ke `minio-ota` |
| `[ ]` | Trigger update ke ESP32 via MQTT |
| `[ ]` | Verifikasi checksum firmware |

---

## ⬜ Fase 12 — Prometheus Metrics Service [P11]

| Status | Item | Deskripsi |
|---|---|---|
| `[ ]` | Subscriber NATS | Subscribe subject `metrics.health` dari seluruh service |
| `[ ]` | Aggregasi metrik | Kumpulkan metrik health & performa sistem |
| `[ ]` | Expose `/metrics` | Endpoint untuk Prometheus scraping |
| `[ ]` | Metrik terkumpul | request count, error rate, response time, uptime, resource usage |
| `[ ]` | Publisher `metrics.health` | Publish metrik health aggregator sendiri |

> **📝 Catatan (dari implementasi Fase 1):** Saat ini metrik **tidak lewat NATS** — tiap service (Auth) langsung expose HTTP `/metrics` dan Prometheus **scrape langsung** (`auth:8080/metrics`, `kong:8001/metrics`). Pada Fase 12 ini HARUS diubah ke desain awal: service publish ke NATS subject `metrics.health` → "Prometheus Service" subscribe & aggregasi → expose `/metrics`. Jadi perlu buat service penengah (aggregator) baru; jangan biarkan scrape langsung saja jika ingin konsisten dengan arsitektur event-driven.

---

## ⬜ Fase 13 — Cloudflare Tunnel

| Status | Item |
|---|---|
| `[ ]` | `cloudflared tunnel run` → Kong:8000 |
| `[ ]` | TLS end-to-end |
| `[ ]` | Custom domain mapping |

---

*Perbarui status item saat mulai (`[/]`) dan selesai (`[x]`) mengerjakan masing-masing item. Catat aktivitas harian di [`logs.md`](./logs.md).*
