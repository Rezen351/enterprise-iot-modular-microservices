# 📓 Development Logs — IOT-Modular-Microservice

> **Format:** `[YYYY-MM-DD] [STATUS] Deskripsi`  
> **Status:** ✅ Done · 🟡 In Progress · ❌ Blocked · 🔁 Revised · 📝 Note

---

## 2026-07-10

### Inisialisasi Proyek

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Direktori proyek `IOT-Modular-Microservice/` dibuat |
| 2 | ✅ | Struktur folder `infra/`, `services/`, `docs/` dibuat via `mkdir -p` |
| 3 | ✅ | Rencana arsitektur didefinisikan: **Database-per-Service** (17 instance DB terpisah) |
| 4 | ✅ | `docker-compose.yml` dibuat — fase awal: `mariadb-auth`, `auth`, `nats`, `mosquitto`, `kong` |
| 5 | ✅ | `.env.example` dibuat dengan placeholder untuk semua kredensial |

### Kong Configuration

| # | Status | Aktivitas |
|---|---|---|
| 6 | ✅ | `infra/kong/kong.yml` dibuat dengan format deklaratif Kong 3.x |
| 7 | ✅ | Plugin **JWT** dikonfigurasi: `claims_to_verify: [exp, nbf]`, `key_claim_name: iss` |
| 8 | ✅ | Plugin **Rate Limiting** dikonfigurasi: 20 req/min untuk endpoint auth publik, 60 req/min untuk protected |
| 9 | ✅ | Plugin **CORS** dikonfigurasi: whitelist origin, credentials: true, preflight support |
| 10 | ✅ | Upstream health check aktif untuk `auth-upstream` via `/health` path |
| 11 | ✅ | Route terpisah: `/auth/login,/register,/refresh` (publik) vs `/auth/me,/users,/roles` (protected JWT) |

### NATS Configuration

| # | Status | Aktivitas |
|---|---|---|
| 12 | ✅ | `infra/nats/nats.conf` dibuat dengan **JetStream** aktif |
| 13 | ✅ | Per-service user auth dengan permission publish/subscribe terisolasi per subject |
| 14 | ✅ | Subject contract didefinisikan: `telemetry.ingest`, `alert.triggered`, `control.commands.>`, `audit.log`, dll |
| 15 | 📝 | Image NATS: `nats:2.10-alpine` dipilih (bukan scratch) karena healthcheck butuh `wget` |

### Auth Service — Database

| # | Status | Aktivitas |
|---|---|---|
| 16 | ✅ | `infra/mariadb/auth/init.sql` dibuat |
| 17 | ✅ | Schema RBAC: tabel `roles`, `permissions`, `role_permissions`, `users`, `user_roles` |
| 18 | ✅ | Tabel `refresh_tokens` dengan kolom `token_hash`, `expires_at`, `revoked_at` |
| 19 | ✅ | Seed data: role **Admin** (all perms), **Operator** (read/write/ack), **Viewer** (read-only) |
| 20 | ✅ | Index pada `users.email`, `users.deleted_at`, `refresh_tokens.expires_at` untuk performa |

### Dokumentasi

| # | Status | Aktivitas |
|---|---|---|
| 21 | ✅ | `planning.md` dibuat — arsitektur, struktur direktori, fase implementasi, kriteria selesai |
| 22 | ✅ | `logs.md` dibuat (dokumen ini) |

---

## 📌 Keputusan Teknis

| Tanggal | Keputusan | Alasan |
|---|---|---|
| 2026-07-10 | Database-per-Service = instance terpisah | Isolasi penuh, konsisten dengan prinsip microservice |
| 2026-07-10 | Kong DB-less (`KONG_DATABASE=off`) | Tidak perlu PostgreSQL tambahan, config via `kong.yml` deklaratif |
| 2026-07-10 | NATS `nats:2.10-alpine` (bukan scratch) | Healthcheck `wget` membutuhkan shell tools Alpine |
| 2026-07-10 | JWT HS256 (bukan RS256) | Lebih sederhana untuk fase awal; bisa upgrade ke RS256 nanti |
| 2026-07-10 | Refresh Token: hash (SHA-256) disimpan di DB | Raw token tidak disimpan; aman jika DB bocor |
| 2026-07-10 | Fase awal hanya Auth + NATS + Kong | Fokus pada fondasi keamanan dan event bus sebelum service lain |

---

## ⚠️ Isu & Catatan

| Tanggal | Jenis | Deskripsi | Status |
|---|---|---|---|
| 2026-07-10 | 📝 Note | NATS healthcheck: image scratch tidak punya `wget` → pakai alpine | ✅ Resolved |
| 2026-07-10 | 📝 Note | Kong JWT secret: disimpan di env `${KONG_JWT_SECRET_FRONTEND}` — harus ada di `.env` sebelum `docker compose up` | Perlu diperiksa |
| 2026-07-10 | 📝 Note | `mariadb-auth` healthcheck pakai flag `-p${MYSQL_ROOT_PASSWORD}` — pastikan tidak ada spasi di value env | Perlu diperiksa |

---

*Dokumen ini hanya mencatat aktivitas yang sudah dilakukan. Rencana ke depan ada di [`roadmap.md`](./roadmap.md).*
---

## 2026-07-10 (lanjutan) — Fase 1: Auth Service

### Struktur Service
| # | Status | Aktivitas |
|---|---|---|
| 23 | ✅ | Direktori services/auth/internal/{config,model,repository,service,handler,middleware,cron} dibuat |
| 24 | ✅ | go.mod — chi, mysql driver, jwt/v5, uuid, nats.go, cron, bcrypt |
| 25 | ✅ | go mod tidy + go get semua dependencies berhasil |

### Config & Model
| # | Status | Aktivitas |
|---|---|---|
| 26 | ✅ | config.go — load env: PORT, DB_DSN, JWT_SECRET, JWT_EXPIRY, REFRESH_EXPIRY, NATS_URL |
| 27 | ✅ | model.go — User, Role, Permission, RefreshToken (+ IsValid()), DTOs |

### Repository
| # | Status | Aktivitas |
|---|---|---|
| 28 | ✅ | user_repository.go — CreateUser, GetUserByEmail, GetUserByID, UpdateLastLogin |
| 29 | ✅ | GetUserRoles, AssignDefaultRole (assign viewer saat register) |
| 30 | ✅ | CreateRefreshToken, GetRefreshToken, RevokeRefreshToken, RevokeAllUserTokens |
| 31 | ✅ | Retention: DeleteExpiredRefreshTokens, SoftDeleteInactiveUsers, EmailExists, UsernameExists |
| 32 | ✅ | HashToken() — SHA-256 hex dari raw token (raw tidak disimpan di DB) |

### Service
| # | Status | Aktivitas |
|---|---|---|
| 33 | ✅ | Register — unique check, bcrypt hash, assign viewer role |
| 34 | ✅ | Login — validasi bcrypt, update last_login, issue token pair |
| 35 | ✅ | Refresh — validasi hash+expiry+revocation, rotation (revoke lama, issue baru) |
| 36 | ✅ | Logout — revoke semua refresh token aktif user |
| 37 | ✅ | GetMe — profil + roles dari DB |
| 38 | ✅ | issueTokenPair() — JWT HS256 (15 min) + random 32-byte refresh token |
| 39 | ✅ | publishAudit() — publish ke NATS audit.log; non-fatal jika NATS tidak tersedia |

### Middleware
| # | Status | Aktivitas |
|---|---|---|
| 40 | ✅ | JWTAuth — validasi Bearer token, inject user_id/username/roles ke context |
| 41 | ✅ | RequireRole — RBAC: izin jika user punya minimal 1 dari role yang diizinkan |

### Handler
| # | Status | Aktivitas |
|---|---|---|
| 42 | ✅ | POST /auth/register, POST /auth/login, POST /auth/refresh |
| 43 | ✅ | GET /auth/me, POST /auth/logout (protected JWT) |
| 44 | ✅ | GET /health (public, untuk Kong upstream healthcheck) |
| 45 | ✅ | Semua handler: validasi input + sentinel error mapping ke HTTP status |

### Cron & Entrypoint
| # | Status | Aktivitas |
|---|---|---|
| 46 | ✅ | retention.go — cron daily 02:00 hapus expired tokens, Sunday 03:00 soft-delete user inaktif |
| 47 | ✅ | main.go — wire config + DB (10x retry) + NATS + cron + chi router + graceful shutdown |
| 48 | ✅ | Dockerfile multi-stage: golang:1.22-alpine builder, alpine:3.19 runtime (non-root user) |
| 49 | ✅ | go build ./... — BUILD OK, tidak ada error kompilasi |

---

## 2026-07-11 — Fase 1: Observability (Prometheus) + Dashboard Auth

### Prometheus / Metrics
| # | Status | Aktivitas |
|---|---|---|
| 50 | ✅ | `go.mod` auth: tambah dependency `prometheus/client_golang` (sebelumnya `prometheus.go` ada tapi belum ter-declare → build gagal) |
| 51 | ✅ | Rebuild image `auth` → endpoint `/metrics` aktif (sebelumnya 404 karena image lama) |
| 52 | ✅ | Kong: aktifkan plugin **prometheus** global di `kong.yml` → metrik Kong di `kong:8001/metrics` |
| 53 | ✅ | Service `prometheus` dijalankan; fix permission `volumes/prometheus` (chown 65534) |
| 54 | ✅ | Verifikasi Prometheus targets **UP**: `prometheus`, `auth-service`, `kong` |
| 55 | ✅ | Metrik ter-scrape: `auth_http_requests_total`, `kong_http_requests_total` |

### Dashboard → Kong (fitur Auth saja)
| # | Status | Aktivitas |
|---|---|---|
| 56 | ✅ | Hapus mock backend (`src/mock/`), `src/api/stream.js`, interceptor di `main.jsx` |
| 57 | ✅ | `src/api/client.js` — HTTP client ke Kong (`VITE_API_URL`, default `http://localhost:8000`) |
| 58 | ✅ | `src/api/auth.js` — real endpoint: login/register/refresh/logout/me/profile/password/sessions/account |
| 59 | ✅ | Login pakai **email** (sesuai backend), simpan access+refresh token; logout revoke via Kong |
| 60 | ✅ | Sidebar disederhanakan → hanya **PROFILE** (fitur lain di-hide dulu) |
| 61 | ✅ | `DashboardLayout` di-slim: tanpa ModuleProvider/NotificationProvider/mock; render Profile saja |
| 62 | ✅ | Halaman Profile pakai data real `/auth/me`, ganti password, daftar sesi, deactivate account |
| 63 | ✅ | `vite.config.js` dibersihkan (hapus proxy node-red/go-dal/minio/mediamtx), proxy → Kong |
| 64 | ✅ | Kong CORS diverifikasi untuk origin dev `http://localhost:5173`; `npm run build` OK |

---

## 2026-07-11 — Admin: Default Seed + Manajemen Akun

### Seed Akun Admin Default
| # | Status | Aktivitas |
|---|---|---|
| 65 | ✅ | `config.go` — tambah env `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (default admin / admin@smartfarm.local / admin1234) |
| 66 | ✅ | `migrate.go` — `seedAdmin()` buat akun admin (role `admin`) jika belum ada; idempoten (skip bila ada) |
| 67 | ✅ | `docker-compose.yml` + `.env.example` — inject env admin ke service auth |
| 68 | ✅ | DB lama punya user `admin` (email `admin@admin`, role viewer) → diperbaiki jadi `admin@smartfarm.local` + role `admin`, password reset ke `admin1234` |

### Endpoint Manajemen Akun (Admin Only)
| # | Status | Aktivitas |
|---|---|---|
| 69 | ✅ | `model.go` — `UserSummary`, `AdminUpdateUserRequest{is_active,roles}` |
| 70 | ✅ | Repository: `ListUsers`, `SetUserActive`, `SetUserRoles`, `CountAdmins`, `GetAllRoles` |
| 71 | ✅ | Service: `ListUsers`, `ListRoles`, `AdminUpdateUser` (ubah status + role), `AdminDeleteUser` |
| 72 | ✅ | Guard: blokir self-deactivate/demote, blokir hapus/demote **admin terakhir** (409), tolak role invalid (400) |
| 73 | ✅ | Handler: `GET /auth/users`, `GET /auth/roles`, `PUT /auth/users/{id}`, `DELETE /auth/users/{id}` (route Kong `/auth/users` protected) |
| 74 | ✅ | `prometheus.go` — normalize `/auth/users/{id}` & `/auth/roles` |
| 75 | ✅ | Verifikasi: login admin ✅, list users ✅, deactivate ✅, ubah role ✅, self-deactivate 403 ✅, invalid role 400 ✅, last-admin demote 409 ✅ |

### Dashboard — Halaman Manajemen Akun
| # | Status | Aktivitas |
|---|---|---|
| 76 | ✅ | `api/auth.js` — `adminListUsers`, `adminListRoles`, `adminUpdateUser`, `adminDeleteUser` |
| 77 | ✅ | `Pages/UserManagement.jsx` — tabel akun, toggle aktif/nonaktif, modal ubah peran, hapus akun |
| 78 | ✅ | `Sidebar` + `DashboardLayout` — menu **MANAJEMEN AKUN** hanya muncul untuk user ber-role `admin` (baca `sessionStorage.user.roles`) |
| 79 | ✅ | `index.css` — style tabel, role-chip, status-dot, modal. `npm run build` OK, Vite dev server jalan di :5173 |

---

## 2026-07-11 — Penyelesaian Fase 2 (Module Service: telemetry.batch)

### Telemetry Batch Aggregation
| # | Status | Aktivitas |
|---|---|---|
| 80 | ✅ | `internal/service/batch.go` — `telemetryBatcher` (map mutex) akumulasi reading per (node, metric) per window 1 menit |
| 81 | ✅ | `batch.add()` dipanggil di `IngestTelemetry` tiap reading sukses ditulis ke TimescaleDB |
| 82 | ✅ | `StartBatchPublisher(ctx, interval)` — goroutine ticker 1 menit, flush + publish `telemetry.batch` (agregat count/sum/min/max/avg/last) |
| 83 | ✅ | Final flush saat context cancel (shutdown) agar tidak ada reading terbuang |
| 84 | ✅ | Wire `go svc.StartBatchPublisher(bgCtx, time.Minute)` di `main.go`; `New()` buat batcher |
| 85 | ✅ | `go build ./...` + `go vet ./...` lolos; roadmap Fase 2 (2a+2b) ditandai selesai |

---

## 2026-07-11 — Fase 3: Analytics Service + Dashboard

### Infrastruktur & Scaffold
| # | Status | Aktivitas |
|---|---|---|
| 86 | ✅ | `docs/phase3-analytics-plan.md` dibuat — rencana detail Fase 3 (Analytics Service) |
| 87 | ✅ | `infra/timescaledb/analytics/init.sql` — hypertable `metrics_rollup` + continuous aggregate `metrics_hourly`/`metrics_daily` + retention 30d |
| 88 | ✅ | `services/analytics/` scaffold (Go 1.25): config, model, tsdb, nats, service, handler, middleware, main.go, Dockerfile |
| 89 | ✅ | `go.mod` analytics: chi, pgx/v5, nats.go, prometheus/client_golang, uuid; `go mod tidy` + `go build` + `go vet` lolos |

### Ingest & Aggregation
| # | Status | Aktivitas |
|---|---|---|
| 90 | ✅ | `internal/nats/subscriber.go` — subscribe `telemetry.batch` (core NATS, mirror ws-gateway), decode → `IngestBatch` |
| 91 | ✅ | `tsdb.UpsertRollup` — align menit via `last_ts`, upsert idempoten ON CONFLICT (time, node_id, metric) |
| 92 | ✅ | `tsdb.QuerySeries` — pilih source otomatis: rollup (≤1h), hourly (≤24h), daily (>24h); value = sum/count |
| 93 | ✅ | `tsdb.QuerySummary` / `ListNodes` — statistik + daftar node beserta metric tersedia (string_agg) |

### API, Kong, Prometheus, Compose
| # | Status | Aktivitas |
|---|---|---|
| 94 | ✅ | Handler: `GET /analytics/metrics` (node_id, metric, interval, from, to), `/analytics/summary`, `/analytics/nodes`, `/health` |
| 95 | ✅ | `infra/kong/kong.yml` — `analytics-upstream` + `analytics-service` route `/analytics` (rate-limit 120/m); `docker-compose.yml` tambah `timescaledb-analytics` + `analytics` |
| 96 | ✅ | `infra/prometheus/prometheus.yml` — job `analytics-service` → `analytics:8080/metrics`; `.env`/`.env.example` tambah `TIMESCALE_ANALYTICS_*` |
| 97 | ✅ | `middleware/prometheus.go` — `analytics_http_requests_total` + durasi; healthcheck `/health` di compose |

### Dashboard — Halaman Analytics
| # | Status | Aktivitas |
|---|---|---|
| 98 | ✅ | `src/api/analytics.js` — `listNodes`, `getMetrics`, `getSummary` via Kong (auth: true) |
| 99 | ✅ | `Pages/Analytics.jsx` — selector node + metric, range 1h/6h/24h/7d/30d, Line chart (chart.js), kartu summary, empty/loading/error state |
| 100 | ✅ | `Sidebar.jsx` tambah menu **ANALYTICS** ( semua role); `DashboardLayout.jsx` route `analytics` → `<Analytics/>` |
| 101 | ✅ | `npm run build` lolos; halaman Analytics tampil di dashboard via Kong |

### Catatan
| # | Jenis | Deskripsi | Status |
|---|---|---|---|
| 1 | 📝 Note | `telemetry.batch` dipublish Module ke core NATS (bukan JetStream) → Analytics pakai plain subscribe ( konsisten ws-gateway); pesan saat Analytics mati tidak di-buffer | Perlu diperhatikan |
| 2 | 📝 Note | Cross-DB: Analytics tidak baca `timescaledb-module`; hanya konsumsi `telemetry.batch` → jaga Database-per-Service | ✅ Sesuai prinsip |

### Deployment & Verifikasi (pasca-build)
| # | Status | Aktivitas |
|---|---|---|
| 102 | ✅ | `docker compose build analytics` → image `microservices-analytics` |
| 103 | ✅ | `docker compose up -d timescaledb-analytics` → init.sql jalan (hypertable + cagg + retention OK) |
| 104 | ✅ | `docker compose up -d analytics` → healthy, subscribe `telemetry.batch`, NATS+TimescaleDB connected |
| 105 | ✅ | `docker compose restart kong` → route `/analytics` aktif; `curl localhost:8000/analytics/nodes` → 200 |
| 106 | ✅ | `curl -X POST localhost:9090/-/reload` → job `analytics-service` aktif & target **UP** |

### Bugfix Pasca-Deploy (data kosong di dashboard)
| # | Status | Aktivitas |
|---|---|---|
| 107 | 🔁 | Analitik kosong padahal `timescaledb-module.telemetry` punya 3882 row (node `ECE334219870`, metric `cwt1_*`). Root cause: upsert gagal `ON CONFLICT` karena `metrics_rollup` tidak punya unique constraint `(time,node_id,metric)` (SQLSTATE 42P10) |
| 108 | ✅ | `ALTER TABLE metrics_rollup ADD CONSTRAINT uq_rollup_time_node_metric UNIQUE (time,node_id,metric)` + tambahkan ke `infra/timescaledb/analytics/init.sql` agar fresh deploy konsisten |
| 109 | ✅ | Backfill historis: agregat 1-menit dari `timescaledb-module.telemetry` → `COPY` ke `analytics.metrics_rollup` (348 row, 05:46–07:41) |
| 110 | 🔁 | `summary` 500: `sum(sum)`/`min`/`max`/`last` (float) di-scan ke `int64` → `cannot losslessly convert`. Fix tipe di `tsdb.QuerySummary` (countSum/firstTS/lastTS int64, sisanya float64) |
| 111 | ✅ | `CALL refresh_continuous_aggregate` hourly & daily (terpisah, hindari transaction block) → cagg terisi; rebuild + `up -d analytics` (restart saja tidak ambil image baru) |
| 112 | ✅ | Verifikasi: `/analytics/nodes` (node+3 metric), `/analytics/metrics` 1h=59/24h=3/7d=1 point, `/analytics/summary` 200 (count 1390, avg 27.83); rollup tumbuh live (348→360) tanpa error |

### Dashboard Analytics — penyempurnaan tampilan
| # | Status | Aktivitas |
|---|---|---|
| 113 | ✅ | `Analytics.jsx`: label node dipendek (contoh `ECE334…9870`), metric selector dihapus → semua metric digambar di 1 multi-line chart |
| 114 | ✅ | Tambah histogram per-metric + matriks korelasi Pearson (heatmap) dihitung client-side |
| 115 | ✅ | Deteksi metric boolean (semua nilai 0/1) → dipisah ke panel "Digital states" dengan step-line chart + ringkasan ON/OFF & %on; metric analog tetap di trend kontinyu. Analog input otomatis masuk trend (numeric) |
| 116 | 🔁 | Input digital `input1..4` (data_type bool) tidak muncul di telemetry/analytics padahal tag & payload ada. Root cause: `module` `toFloat` hanya terima `bool` JSON, padahal device kirim angka (`"input1":0` → float64) → dibuang |
| 117 | ✅ | Fix `toFloat` case `bool` terima float64/float32/int (0/1) & string (true/false/on/off/yes/no); rebuild + restart `module`. `input1..4` kini mengalir ke telemetry → `telemetry.batch` → `metrics_rollup` (0/1) → tampil di panel Digital states |
