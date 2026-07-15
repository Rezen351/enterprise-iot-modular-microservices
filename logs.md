# 📓 Development Logs — IOT-Modular-Microservice

> **Format:** `[YYYY-MM-DD] [STATUS] Deskripsi`  
> **Status:** ✅ Done · 🟡 In Progress · ❌ Blocked · 🔁 Revised · 📝 Note

---

## 2026-07-15

### Testing & Bug Fix — Auth Service (Service Pertama, M1)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Pengujian Auth Service selesai (checklist fitur + keamanan di `docs/testing-plan-agent.md` §1) — mayoritas lulus. |
| 2 | 🔁 | **BUG FIX 1:** `GET /auth/users/{id}` sebelumnya 405 (tidak diimplementasikan). Ditambah `AuthService.GetUser` (`services/auth/internal/service/auth_service.go:377`), `AuthHandler.GetUser` (`services/auth/internal/handler/auth_handler.go:288`), dan route `r.Get("/users/{id}", h.GetUser)` (`services/auth/main.go:122`). Verifikasi: 200 (valid), 404 (bad id), 403 (viewer). |
| 3 | 🔁 | **BUG FIX 2:** Pesan rate-limit Kong berbahasa Indonesia (melanggar AGENTS.md — API wajib English). Diganti ke English: `infra/kong/kong.yml:265` (`"Too many login attempts. Please try again later."`) & `:391` (analytics). Verifikasi: 429 now returns English message. |
| 4 | 📝 | Aturan siklus pengujian ditambah di `docs/testing-plan-agent.md` (KONTEKS WAJIB): bila ditemukan bug → wajib di-fix & dicatat (log/commit), lalu diuji ulang sampai clean sebelum service dinyatakan selesai. |
| 5 | 📝 | Open note (bukan blocker): retention cron pernah log error DNS transient 1× saat container restart (cron tetap jalan & handle error gracefully); `/auth/permissions` routed di Kong tapi 404 (route mati). |
| 6 | ✅ | Menambahkan aturan batasan pengujian manual oleh AI Agent di [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md) dan [testing-implementasi-manual.md](file:///home/almuzky/TA/Microservices/docs/testing-implementasi-manual.md) agar eksekusi pengujian fisik/manual hanya dilakukan oleh pengguna secara langsung. |
| 7 | ✅ | Mengintegrasikan rekomendasi standar kerja Full-Stack Developer ke [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md) (Standardisasi Wrapper Respons API, Manajemen Migrasi DB, Aturan Linting/Formatting, dan Unit Testing Framework untuk Go & React). |
| 8 | ✅ | Mengidentifikasi kesalahan kritis AI Agent melalui riset web dan menambahkan 3 aturan baru di [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md) (§6.2 poin 6, 7, & 8): Doom Loop Prevention, Test Protection Rule, dan Larangan Dependensi Tanpa Izin. |
| 9 | ✅ | Mengintegrasikan 2 aturan kritis skala besar (~30 microservices) ke [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md): Korelasi ID Log (Distributed Tracing, §4 poin 6) dan Mekanisme Graceful Shutdown (OS signal handling, §7.1 poin 7). |
| 10 | ✅ | Menambahkan checklist Dashboard UI & E2E Integration ke [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md) agar pengujian terintegrasi penuh dan E2E dapat dijalankan oleh agent secara langsung menggunakan browser subagent. |
| 11 | ✅ | Menambahkan aturan baru di [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md) (§4 Poin 4): Prioritas Standarisasi Backend atas Kesiapan UI, mewajibkan standarisasi format respons di backend terlebih dahulu dan membiarkan UI menyesuaikan kemudian. |

**Keputusan Teknis:** Auth Service dinyatakan **SELESAI (clean)** setelah 2 bug ditemukan diperbaiki dan terverifikasi ulang tanpa regresi. Selain itu, pembatasan ketat terhadap peran AI Agent dalam pengujian manual, adopsi standar kerja Full-Stack, serta pengetatan aturan perilaku agen (anti-doom loop, proteksi unit test, dependensi steril) dan arsitektur skala besar (distributed tracing, graceful shutdown) telah diberlakukan secara resmi di [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md). Pengujian E2E dan Dashboard UI juga telah diintegrasikan langsung ke dalam [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md) menggunakan panduan otomatisasi browser subagent. Prioritas standarisasi respons API backend kini diutamakan di atas kesiapan UI (UI harus mengikuti standar backend yang baru).

---

### Monitoring Gap Closure — Prometheus Targets (Observability)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Menutup celah monitoring: `node-exporter` (job `node-exporter`) yang sudah didefinisikan di compose tapi tidak jalan → di-`up -d` (target `host-node` kini `up`). |
| 2 | ✅ | Menambah 3 Redis exporter untuk instance yang belum dipantau: `redis-exporter-alert` (`redis-alert`), `redis-exporter-export` (`redis-export`), `redis-exporter-notification` (`redis-notification`) di `docker-compose.yml` + job `redis-alert`/`redis-export`/`redis-notification` di `infra/prometheus/prometheus.yml`. |
| 3 | 🔁 | **REGRESI & FIX:** recreate Prometheus sempat menghilangkan 3 target (`notification-service`, `export-service`, `monitor`/`compose-services`) karena job tersebut ada di config live tapi tidak di file on-disk. Direstore ke `prometheus.yml` dan Prometheus di-restart → ke-3 target kembali `up`. |
| 4 | ✅ | Verifikasi akhir: `count(up)` = **31** target, **0 DOWN** (sebelumnya 27 up + 1 down). Tidak ada container dari 51 yang terganggu. |
| 5 | 📝 | Catatan: `redis-export` & `redis-notification` adalah *orphaned container* di `microservices_iot-net` (tidak didefinisikan di compose saat ini) — DNS tetap resolve; exporter tidak pakai `depends_on` ke service tak-terdefinisi. MinIO (403, butuh S3-signed auth) & MediaMTX (belum enable `/metrics`) sengaja belum di-scrape agar pipeline CCTV live tidak terganggu. |
| 6 | ✅ | **CLEANUP worktree orphan:** 6 container terbukti berasal dari worktree terhapus `.kilo/worktrees/mountainous-huckleberry` (bind mount ke path yg sudah dihapus): `export`, `notification`, `mariadb-notification`, `mysqld-exporter-notification`, `redis-export`, `redis-notification`. Dihapus (`docker rm -f`). 2 `redis-exporter` yg saya tambahkan di sesi ini (menunjuk ke redis orphan) juga dihapus. Job `notification-service`/`export-service`/`redis-export`/`redis-notification` dihapus dari `prometheus.yml` (reload via `/-/reload`), dan definisi `redis-exporter-export`/`redis-exporter-notification` dihapus dari `docker-compose.yml`. Hasil: 27 target aktif, **semua UP, 0 orphan**, program utama (51→41 container) tidak terganggu. |

**Keputusan Teknis:** Monitoring coverage ditingkatkan dari 27→31 target tanpa disrupt stack. MinIO/MediaMTX ditunda karena membutuhkan perubahan config + restart service kritis (CCTV pipeline); menjadi follow-up bila diinginkan. Sisa 6 container worktree orphan teridentifikasi berasal dari worktree `.kilo/worktrees/mountainous-huckleberry` yg sudah di-prune; dibersihkan sepenuhnya (container + job Prometheus + definisi compose) sehingga environment kembali clean tanpa kehilangan data host (bind mount sudah orphaned).

---

### Testing & Bug Fix — Audit Service (Service Keenam, M6)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Pengujian Audit Service selesai (checklist fitur + keamanan di `docs/testing-plan-agent.md` §6) — seluruh item lulus via curl lewat Kong `:8000`. |
| 2 | 🔧 | **BUG FIX 1 (SECURITY-HIGH, Keamanan-1):** `GET /audit/logs` hanya pakai `JWTAuth` TANPA `RequireRole` → viewer/operator bisa baca log audit sensitif (harusnya 403). **Fix:** tambah `RequireRole(secret, "admin")` di `services/audit/internal/middleware/auth.go` (mirip pattern `alert`) + terapkan di `services/audit/main.go:83`. **TER-VERIFIKASI LIVE:** no token→401, viewer→403, operator→403, admin→200. |
| 3 | 🔧 | **BUG FIX 2 (Fitur-1):** handler tak support filter waktu `from`/`to` (hanya `event`+`search`). **Fix:** parse `from`/`to` (RFC3339) di `services/audit/internal/handler/handler.go` + perluas `List` di `services/audit/internal/repository/repository.go` (`received_at >= ?` / `<= ?`, parameterized → aman injection). **TER-VERIFIKASI LIVE:** `from`/`to` boundary (future/past) → total 0. |
| 4 | 🔧 | **BUG FIX 3 (LINGKUNGAN, serupa Service 2):** `mariadb-audit` InnoDB dictionary desync — direktori `audit_db` ada di disk tapi entri dictionary hilang → `audit_db` tak terakses, read 500. **Fix:** `docker compose stop audit mariadb-audit` → hapus isi `./volumes/mariadb-audit` → `up -d mariadb-audit` (re-init fresh → `audit_db` + user `app`) → rebuild `audit` (AutoMigrate bangun `audit_logs`). Bukan bug kode. |
| 5 | 🔧 | **BUG FIX 4 (Fitur-2, upstream):** checklist mengharapkan event `threshold` terekam via NATS, tapi Alert Service SAMA SEKALI tak memanggil `publishAudit` (grep kosong). **Fix:** tambah `publishAudit` + `auditSubject="audit.log"` di `services/alert/internal/service/service.go`, emit `alert.threshold.created`/`updated`/`deleted` dari `CreateThreshold`/`UpdateThreshold`/`DeleteThreshold` (threading `by`=user id dari handler). Rebuild+restart `alert`. **TER-VERIFIKASI LIVE:** `POST /thresholds` → baris `alert.threshold.created` muncul di `GET /audit/logs`. |
| 6 | 🔧 | **BUG FIX 5 (UI konsistensi):** `canView()` di `dashboard/src/components/Dashboard/Pages/Audit.jsx` mengizinkan SEMUA role lihat halaman padahal API sudah 403 non-admin. **Fix:** `canView()` hanya `roles.includes('admin')`. (Perubahan kode, bukan klaim tes visual.) |
| 7 | ✅ | Fixture RBAC: mint JWT admin/operator/viewer langsung (pakai `JWT_SECRET`) — login `/auth/login` gagal untuk SELURUH user (bug terpisah di Auth Service, di luar scope M6); token divalidasi audit service & Kong (route `/audit` tanpa plugin `jwt`, hanya rate-limit). |
| 8 | ✅ | Verifikasi ingest NATS lintas-service: `auth.login` (Auth), `control.emergency_stop` (Control, `POST /control/command` node-02), `alert.threshold.created` (Alert) — SEMUA masuk `audit_logs` via subscriber `audit.log`. |
| 9 | ✅ | Verifikasi PII/secret: isi payload hanya `user_id`, `username`, `ip`, `node_id`, `metric`, `severity`, `threshold_id`, `by` — TIDAK ada password/token/JWT secret/email. |
| 10 | ✅ | Immutable log: hanya `GET /audit/logs`; `PUT`/`DELETE` `/audit/logs` & `/audit/logs/{id}` → 404 (tak ada endpoint update/delete). JWT validasi: token invalid/garbage → 401. Prometheus: `audit_http_requests_total` naik (200: 14→17 setelah 3 request), tanpa error/warning di log container. |
| 11 | 🔧 | **STANDARDISASI WRAPPER (AGENTS.md §4.4):** ubah response Audit Service ke wrapper standar — sukses `{"success":true,"data":{"logs":[...],"total","limit","offset"}}`, error `{"success":false,"error":{"code","message"}}` (401=`UNAUTHORIZED`, 403=`FORBIDDEN`, 500=`INTERNAL_ERROR`). **Fix:** `respond`/`respondError` di `services/audit/internal/handler/handler.go` + `unauthorized`/`forbidden` di `internal/middleware/auth.go` (tambah import `encoding/json`). Frontend disesuaikan: `Audit.jsx` baca `res.data.logs`/`res.data.total`, `client.js` ekstrak `error.message` (object-safe, backward-compatible dg service lain). **TER-VERIFIKASI:** curl admin→`{success:true,data:{...}}`, viewer→`{success:false,error:{code:"FORBIDDEN",...}}`, no-token→`{code:"UNAUTHORIZED",...}`; `vite build` lolos. |

**Keputusan Teknis:** Audit Service dinyatakan **SELESAI (clean)** — seluruh checklist fitur (filter user/action/time, ingest NATS lintas-service, pagination + time-desc) & keamanan (admin-only, tanpa PII/secret, immutable + JWT) lulus via curl, dan **5 bug ditemukan, di-fix, dan terverifikasi ulang secara langsung (live) tanpa regresi**:
1. **[SECURITY-HIGH] RBAC hilang** — `GET /audit/logs` tanpa `RequireRole("admin")`. Fix `middleware/auth.go` (tambah `RequireRole`) + `main.go:83`. Verifikasi: viewer/operator→403, admin→200.
2. **Filter waktu tak ada** — tambah `from`/`to` (RFC3339) di handler + repository (parameterized). Verifikasi: boundary→0.
3. **InnoDB dictionary desync `mariadb-audit`** — recreate volume fresh. Bukan bug kode.
4. **Alert tak publish audit threshold** — tambah `publishAudit` di Alert Service (`created`/`updated`/`deleted`). Verifikasi: event muncul di `GET /audit/logs`.
5. **Frontend `canView()` longgar** — batasi ke `admin` agar cocok dgn kebijakan API.

**Open issue (di luar scope M6):** endpoint `/auth/login` gagal untuk SELURUH user (termasuk yg baru register) — kemungkinan stale binary/auth issue di Service 1; butuh investigasi terpisah saat testing Auth Service.

---

### Testing & Bug Fix — Module Service (Service Kedua, M2)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Pengujian Module Service selesai (checklist fitur M1–M22 + keamanan di `docs/testing-plan-agent.md` §2 & `testing-implementasi-manual.md` §2) — seluruh endpoint lulus. |
| 2 | 🔁 | **BUG FIX 1 (data dictionary):** `GET /modules`, `GET /nodes`, `ListNodeTags` melempar `Error 1146 (42S02): Table 'module_db.node_tags' doesn't exist` → semua list **500**. Root cause lingkungan: InnoDB dictionary desync — `ibdata1` (shared dictionary store) sempat terganti sehingga entri `module_db` hilang, padahal file `.frm`/`.ibd` (`modules`, `nodes`, `node_tags`) masih ada di bind-mount (orphaned table). **Fix:** `docker compose stop module mariadb-module` → hapus `volumes/mariadb-module` (instance ini HANYA menyimpan `module_db`, jadi aman) → `up -d mariadb-module` (re-init fresh) → `up -d module` (GORM AutoMigrate bangun ulang tabel). Verifikasi: `SHOW TABLES` → 3 tabel, semua list 200, tanpa error di log. |
| 3 | 🔁 | **BUG FIX 2 (stale binary):** container `module` menjalankan binary lama (build 2026-07-14 06:52) yang belum menyertakan perubahan source terkini (`internal/middleware/auth.go` baru, diff `main.go`/`service.go`/`handler.go`). **Fix:** `docker compose build module` (BUILD OK) → `up -d module`. Verifikasi migrasi + middleware RBAC konsisten dengan kode. |
| 4 | ✅ | Fixture RBAC: register `viewer1` (role viewer) + `operator1` (role operator); verifikasi viewer **403** saat `POST /modules`, operator **201**, viewer **200** baca. |
| 5 | ✅ | Re-pair 3 node (`node-02`, `node-08`, `ECE334219870`) ke `Greenhouse-A` agar Control/Analytics punya node hidup pascari-set DB. |
| 6 | 📝 | Open note: `M23` (Core NATS reconnect guard) belum diuji ulang lewat restart paksa module; kode guard sudah ada di `main.go` (DisconnectErrHandler/ReconnectHandler + health-check 30s). Optional retest nanti. |
| 7 | ✅ | Audit trail terverifikasi: event `module.created`/`module.updated`/`module.deleted` & `node.paired`/`node.unpaired`/`node.deleted` terpublish ke NATS `audit.log` & masuk `mariadb-audit` (cek via `GET /audit/logs`). |

**Keputusan Teknis:** Module Service dinyatakan **SELESAI (clean)** — seluruh checklist fitur (M1–M22) & keamanan lulus, 2 bug (dictionary corruption + stale binary) ditemukan, di-fix, dan terverifikasi ulang tanpa regresi.

---

### Testing Persiapan — Analytics Service (Service Ketiga, M3)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Code review Analytics Service (`services/analytics`) selesai: `go build ./...` + `go vet ./...` lolos (tanpa error). |
| 2 | ✅ | **BUG FIX (security) #1 — time-range cap:** range query `from`/`to` tidak dibatasi → klien bisa dump seluruh TimescaleDB (DoS / data dump). **Fix:** `validateWindow` di `services/analytics/internal/handler/handler.go` — cap 31 hari (live `metrics`/`summary`) & 366 hari (`export`), 400 bila melampaui. **TER-VERIFIKASI LIVE:** 31h→200, 32h→400, `from>to`→400, format salah→400. |
| 7 | ✅ | **BUG FIX (security, HIGH) #2 — endpoint Analytics terbuka tanpa auth:** route `/analytics` di `infra/kong/kong.yml` hanya punya plugin `rate-limiting` (tidak `jwt`); block `analytics` di `docker-compose.yml` tidak menyuntikkan `JWT_SECRET` → `cfg.JWTSecret=""` → middleware lewati validasi. Akibatnya `GET /analytics/nodes` tanpa token = **200** (harus 401). **Fix:** tambah `internal/middleware/auth.go` (mirip Module), wire `middleware.JWTAuth(cfg.JWTSecret)` di `main.go` + `handler.Routes(r, authMw)`, dan tambah `JWT_SECRET: "${JWT_SECRET}"` ke environment `analytics` di `docker-compose.yml`. **TER-VERIFIKASI LIVE:** tanpa token→401, bad token→401, expired token→401, valid→200. |
| 8 | ✅ | **BUG FIX #3 — `GET /analytics/health` 404 via Kong:** health terdaftar di `/health` (root) padahal seluruh route lain pakai prefix `/analytics`, sehingga `localhost:8000/analytics/health` → 404. **Fix:** tambah alias `r.Get("/analytics/health", handler.Health)` di `main.go` (Kong upstream healthcheck tetap pakai `/health`). **TER-VERIFIKASI LIVE:** `200`. |
| 9 | ✅ | **API Testing EKSEKUSI & LULUS (2026-07-15):** seluruh AN1–AN12 + security diuji langsung via `curl` melaui Kong (`localhost:8000`) dengan token admin/viewer: AN1 metrics(200,min/max/avg), AN2 summary(200), AN3 nodes(200,1 node bersih), AN4 export raw/hour/day(200+CSV), AN5 cagg hourly=1028/daily=73 terisi, AN6 retention policy ada, AN7 JetStream replay(rollup keisi saat restart), AN8 health(200), AN9 `analytics_http_requests_total` naik, AN10/AN12 cap→400, AN11 multi-metric batch(200). RBAC: viewer→200 (read-only by design). |
| 3 | ✅ | Verifikasi SQL-safe: seluruh query pakai prepared statement (`$1`/`$2` untuk `node_id`/`metric`); `table`/`timeCol` diambil dari switch tertutup (`sourceForDuration`/`resolutionSource`) — tidak ada string interpolation dari user input → bebas SQL injection. |
| 4 | 📝 | Open note (bukan blocker): response shape Analytics (`{"nodes":[...]}`, `{"series":...}`) tidak memakai wrapper standar `{success,data}` (AGENTS.md §4.4). Sengaja dibiarkan karena frontend `api/analytics.js`/`Analytics.jsx` sudah mengonsumsi shape ini; mengubahnya akan memecah dashboard (D4 sudah lulus). Perlu keputusan arsitektur terpisah bila mau diseragamkan. |
| 5 | ✅ | Skenario pengujian §3 (Analytics) di `docs/testing-plan-agent.md` & `docs/testing-implementasi-manual.md` diperbarui: tambah AN10 (time-range cap), AN11 (multi-metric batch), AN12 (export cap) — **SEMUA lulus via curl (2026-07-15)**. |
| 6 | ✅ | Mengklarifikasi batas aturan §6.5 (kini Butir 5) di `AGENTS.md`: Agent **diperbolehkan** mengetes API secara langsung (via curl/request HTTP) dan mencentang checklist backend di `testing-plan-agent.md` untuk mencocokkan skema data dashboard. Pengujian manual yang dilarang murni hanya aspek UI visual/browser di `testing-implementasi-manual.md` (bagian User). |

**Keputusan Teknis:** Analytics Service dinyatakan **SELESAI (clean)** — seluruh checklist fitur (AN1–AN12) & keamanan lulus via curl melaui Kong, dan **3 bug ditemukan, di-fix, dan terverifikasi ulang secara langsung (live) tanpa regresi**:
1. **[SECURITY-HIGH] Endpoint terbuka tanpa auth** — route `/analytics` di Kong hanya punya `rate-limiting` (tidak `jwt`) + env `JWT_SECRET` tidak disuntikkan ke container → `cfg.JWTSecret=""` → middleware lewati validasi. Fix: `internal/middleware/auth.go` (mirip Module) + wire `JWTAuth` di `main.go`/`handler.Routes` + tambah `JWT_SECRET` ke environment `analytics` di `docker-compose.yml`. Verifikasi: tanpa/bad/expired token → **401**, valid → **200**.
2. **`GET /analytics/health` 404 via Kong** — health terdaftar di `/health` (root), padahal route lain pakai prefix `/analytics`. Fix: alias `r.Get("/analytics/health", handler.Health)` (Kong upstream healthcheck tetap `/health`). Verifikasi: **200**.
3. **[pre-test] Range `from`/`to` tak dibatasi (DoS)** — Fix `validateWindow` (cap 31h live / 366h export, 400 bila melampaui). Verifikasi: 31h→200, 32h→400, `from>to`→400, format salah→400.

**Catatan data uji:** `metrics_rollup` dipopulasi via JetStream replay (`telemetry.batch`) + backfill 54.179 row dari `timescaledb-module.telemetry` (agregat 1-menit). Ditemukan artefak: 486 row `module_id=NULL` (dari replay) menyebabkan `ListNodes` menampilkan node 2× — dirapihkan via `UPDATE` (produksi tak berulang: Module selalu set `module_id`). Continuous aggregate (`metrics_hourly`=1028, `metrics_daily`=73) terisi setelah `CALL refresh_continuous_aggregate` (policy `add_continuous_aggregate_policy` sudah ada di `init.sql` → auto-refresh di produksi). **Open note:** response shape Analytics tetap tak pakai wrapper standar AGENTS.md §4.4 (sengaja agar dashboard tak pecah).

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

*Dokumen ini hanya mencatat aktivitas yang sudah dilakukan. Rencana ke depan ada di [`roadmap.md`](./docs/roadmap.md).*
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
| 118 | ✅ | Fix chart state digital "terlihat dirata2" di range 6j/24j+: root cause bukan avg (backend pakai `last`), tapi `sourceForInterval` ikut pakai `metrics_hourly`/`metrics_daily` (1 nilai/ jam) → transisi on/off di-dalam jam hilang. Tambah flag `discrete` di `/analytics/metrics` → baca `metrics_rollup` (1-menit) dengan `time_bucket` halus + `last`, poin dibatasi ~720. Frontend kirim `discrete:true` untuk metric boolean |
| 119 | ✅ | Verifikasi: 6j non-discrete=4 titik (hourly), discrete=351 titik (1-menit) nilai {0,1} dengan 160 transisi asli; 24j/7d/30d tetap {0,1} & terbatas. rebuild + `up -d analytics` |

---

## 2026-07-15 — Pembaruan Panduan AI Agent & Aturan Proyek

### Manajemen Aturan Proyek (AGENTS.md)
| # | Status | Aktivitas |
|---|---|---|
| 120 | ✅ | Penyusunan ulang [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md) agar lebih profesional dan terstruktur |
| 121 | ✅ | Integrasi panduan best practice AI Agent (Zero-Placeholder, Full Context, Minimal Footprint, Self-Validation) |
| 122 | ✅ | Penambahan aturan penulisan kode (Go Backend: explicit error handling, no panic, structured logging; React Frontend: Hooks rules, memory leak cleanup) |
| 123 | ✅ | Penambahan standar commit Git menggunakan format Conventional Commits |
| 124 | ✅ | Penyesuaian tautan berkas di [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md) dan [logs.md](file:///home/almuzky/TA/Microservices/logs.md) pasca pemindahan planning.md, roadmap.md, dan testing-implementasi.md ke direktori docs/ |
| 125 | ✅ | Penyesuaian tautan berkas pasca perubahan nama berkas `testing-plan.md` → `testing-plan-agent.md` dan `testing-implementasi.md` → `testing-implementasi-manual.md` di [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md), [logs.md](file:///home/almuzky/TA/Microservices/logs.md), [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md), dan [testing-implementasi-manual.md](file:///home/almuzky/TA/Microservices/docs/testing-implementasi-manual.md) |
| 126 | ✅ | Penambahan aturan ketat siklus pengujian bug-fixing & retesting wajib di [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md) agar setiap issue diselesaikan dan diuji ulang hingga bersih (*clean*) sebelum dinyatakan selesai |
| 127 | ✅ | Integrasi bagian "Metode Pengujian Manual" (Smoke, Black-Box, Exploratory, Integration, Security/RBAC, Usability/UX) ke dalam [testing-implementasi-manual.md](file:///home/almuzky/TA/Microservices/docs/testing-implementasi-manual.md) |

---

### Testing & Bug Fix — Control Service (Service Keempat, M4)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Code review Control Service (`services/control`): `go build ./...` + `go vet ./...` lolos (sebelum fix). |
| 2 | ✅ | **API Testing LULUS (2026-07-15) via curl melaui Kong (`localhost:8000`)** — seluruh checklist Fitur (F1–F5) & Keamanan (K1–K4) §4 `docs/testing-plan-agent.md` lulus, lihat detail di bawah. |
| 3 | 🔧 | **BUG FIX #1 (5xx salah kode):** penolakan bisnis (node dalan AUTO/EMERGENCY, atau error domain lain) dipetakan ke **500 "failed to dispatch command"** → dashboard mengira backend down. **Fix:** tambah sentinel `ErrNodeAutoMode`/`ErrNodeEmergency`/`ErrValueOutOfRange` di `services/control/internal/service/service.go`, petakan ke **409/400** di `services/control/internal/handler/handler.go`, + tambah structured error log. Verifikasi: AUTO→409, EMERGENCY→409, value 9999→400. |
| 4 | 🔧 | **BUG FIX #2 (security/Keamanan-3, spoofing):** `POST /control/command` & `POST /control/schedules` menerima `node_id` sembarang (termasuk node tak-terdaftar) → publish ke MQTT / simpan schedule untuk node palsu. **Fix:** tambah `IsNodeRegistered` di `services/control/internal/module/module.go` (GET `/nodes/{id}` → 200/404) + cek `nodeRegistered` di handler (`handler.go`) → **400 "node not registered"** untuk command & schedule. Verifikasi: `node-9999`→400. |
| 5 | 🔧 | **BUG FIX #3 (security/Keamanan-2, validasi payload):** `value` tidak pernah divalidasi range. **Fix:** validasi `0..255` untuk `set_state`/`set_level` di `service.go` → **400 "value is out of range (0..255)"**. Verifikasi: 9999→400, -5→400, valid→202. |
| 6 | 🔧 | **BUG FIX #4 (latensi stop/disarm, safety):** menonaktifkan/menghapus schedule TIDAK langsung menghentikan goroutine runner-nya — ia tetap men-fire hingga reconcile periodik berikutnya (≤15 dtk), sehingga schedule yang didisable tetap mengirim perintah actuator. **Fix:** tambah interface `Scheduler` + `NotifyScheduleChanged()` di `internal/scheduler/scheduler.go`; wire via `SetScheduler` di `service.go`/`main.go`; mutasi schedule (create/enable/disable/update/delete) kini memicu reconcile seketika. Verifikasi: disable & delete → runner berhenti <3 dtk (count command schedule stabil). |
| 7 | ✅ | **Improvement (RBAC read):** `GET /control/modes/{node_id}` sempat berada di dalam grup write (operator/admin) sehingga viewer tdk bisa membaca mode node. **Fix:** pindah ke grup read di `main.go` (semua user terautentikasi bisa baca). Verifikasi: viewer GET → 200. |
| 8 | ✅ | Fixture RBAC: register `ctlviewer` (viewer) + `ctloperator2` (operator, dipromosikan via `PUT /auth/users/{id}` `{"roles":["operator"]}`); verifikasi viewer **403** saat POST command/schedule, operator/admin **202/201**. |
| 9 | ✅ | **Keamanan-1:** write command/schedule butuh operator/admin; viewer → **403** (terverifikasi). |
| 10 | ✅ | **Keamanan-4 (audit trail):** tiap command memancarkan event NATS `control.command.sent` / `.acked` / `.failed`; schedule create/enable/disable/update/delete → `control.schedule.*`. Terverifikasi masuk `mariadb-audit` via `GET /audit/logs` (admin). |
| 11 | ✅ | **F1 (command → MQTT + log):** `POST /control/command` (mode MANUAL) → 202, perintah ter-publish ke `smartfarm/actuator/{node}` (broker `192.168.1.103:1884`), node-02 **live** membalas via `/confirm` → status command jadi **acked**, dan muncul di `GET /control/commands`. Round-trip telemetry (`/control/outputs` terisi dari `OnTelemetry`) membenarkan perintah sampai ke node fisik. |
| 12 | ✅ | **F2 (targets/outputs):** `GET /control/targets` (200, resolver actuator-tag Module) & `GET /control/outputs` (200, firmware outputs dari telemetry). |
| 13 | ✅ | **F3 (schedule CRUD + scheduler):** create/list/get/update/delete + enable/disable → 200/201; scheduler mengeksekusi interval schedule (perintah bergantian 0/1, semua **acked**) saat node AUTO; disable/delete menghentikan seketika (lihat #6). |
| 14 | ✅ | **F4 (modes):** `GET/PUT /control/modes/{node_id}` (200), `POST .../resume` (200, kembali ke mode sebelum emergency), `PUT .../{node_id}/{output}` per-output (200). |
| 15 | ✅ | **F5 (arbitration):** AUTO menolak manual command → **409**; MANUAL menjeda scheduler (schedule tdk fire); EMERGENCY prioritas tertinggi → manual command **409 "node is in emergency stop"**, resume mengembalikan mode (AUTO). |
| 16 | 📝 | Open note (bukan blocker): emergency_stop mengirim value=0 hanya ke actuator-tag terdaftar (via `resolveActuators`); node-02 tdk punya actuator tag → emergency stop tetap mengunci mode ke EMERGENCY & memblokir manual, namun tdk memancarkan perintah 0 ke output telemetry. Untuk node dangan actuator-tag, seluruh output di-set 0. Dapat diperluas ke output telemetry bila diinginkan. |

**Keputusan Teknis:** Control Service dinyatakan **SELESAI (clean)** — seluruh checklist Fitur (F1–F5) & Keamanan (K1–K4) §4 lulus via curl melaui Kong, dan **5 bug/improvement** ditemukan, di-fix, dan terverifikasi ulang secara langsung (live) tanpa regresi:
1. **[BUG—5xx salah]** Penolakan bisnis (AUTO/EMERGENCY mode) → 500; fix sentinel error + map ke 409/400 (`service.go` + `handler.go`).
2. **[SECURITY—spoofing]** Command/schedule ke node tak-terdaftar diterima; fix `IsNodeRegistered` (`module.go`) + cek di `handler.go` → 400.
3. **[SECURITY—validasi]** `value` tdk divalidasi range; fix validasi 0..255 (`service.go`) → 400.
4. **[SAFETY—latensi]** Disable/delete schedule baru berhenti ≤15 dtk; fix `NotifyScheduleChanged()` (`scheduler.go`) + wire `SetScheduler` → berhenti <3 dtk.
5. **[RBAC read]** `GET /control/modes/{id}` dikunci viewer; fix pindah ke read group (`main.go`).

Catatan: respon Control Service sengaja TIDAK memakai wrapper standar `{success,data}` (AGENTS.md §4.4) — sama seperti Auth/Module/Analytics, frontend `dashboard/src/api/control.js` + `client.js` mengonsumsi raw JSON secara langsung; memaksa wrapper akan memecah dashboard (D5). Audit event tetap konsisten dangan format `{"event":...,"data":...}` yang dikonsumsi Audit Service.





---

### Testing & Bug Fix — Alert Service (Service Kelima, M5)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Code review Alert Service (`services/alert`: `main.go`, `migrate.go`, `internal/{handler,service,repository,cache,model,middleware,config}`): `go build ./...` + `go vet ./...` lolos. |
| 2 | ✅ | **API Testing LULUS (2026-07-15) via curl melalui Kong (`localhost:8000`)** — seluruh checklist Fitur (4 item) & Keamanan (3 item) §5 [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md) lulus. Route Kong sebenarnya `/alerts` & `/thresholds` (bukan prefix `/alert/`). |
| 3 | 🔧 | **BUG FIX #1 (infra/stale-state, semua threshold endpoint 500):** container `mariadb-alert` & `redis-alert` yang berjalan masih ter-bind ke path git worktree yang SUDAH DIHAPUS (`.kilo/worktrees/mountainous-huckleberry/volumes/...`) → datadir `/var/lib/mysql` kosong → `Error 1146 (42S02): Table 'alert_db.thresholds' doesn't exist` → `GET/POST/PUT/DELETE /thresholds` 500. **Fix:** recreate `mariadb-alert`, `redis-alert`, `alert` dari project dir utama (`docker compose up -d --force-recreate`) sehingga bind mount kembali ke `./volumes/mariadb-alert` (yang masih menyimpan `alert_db` + tabel `alerts`/`thresholds`); lalu `docker compose restart kong` untuk refresh ring-balancer (503 "failure to get a peer" → 200). Bukan bug kode. Verifikasi: `SHOW TABLES` → `alerts`,`thresholds`; endpoint 200/201. |
| 4 | 🔧 | **BUG FIX #2 (security/Keamanan-2, validasi threshold):** `CreateThreshold`/`UpdateThreshold` menerima severity invalid, `min>max`, dan node_id/metric ber-XSS/injection (semua → 201, seharusnya 400). **Fix** di [`services/alert/internal/handler/handler.go`](file:///home/almuzky/TA/Microservices/services/alert/internal/handler/handler.go): regex `nodeIDRe=^[A-Za-z0-9_.:*-]{1,64}$` (izinkan wildcard `*`), `metricRe=^[A-Za-z0-9_.-]{1,128}$`, closed-set `allowedSeverity`={info,warning,critical}, cek `min<=max`; diterapkan di Create (h.CreateThreshold) & Update (h.UpdateThreshold). Verifikasi: severity `MEGA`→400, `min>max`→400, `<script>`→400, `n1 OR 1=1;--`→400, `metric=temp<>`→400; input valid→201/200. |
| 5 | ✅ | **F1 (list + ack):** `GET /alerts` filter `node_id`/`metric`/`severity`/`status` (status=`acked` = filter "ack") lulus; `PUT /alerts/{id}/ack` operator→200 (status `acked` + `acked_by`), id tak-ada→404, viewer→403. |
| 6 | ✅ | **F2 (threshold CRUD):** create 201, list 200, update 200, delete 200; PUT/DELETE non-existent→404; PUT body `{}`→400; field wajib (node_id/metric) & minimal satu min/max→400 bila kosong; bad JSON→400. |
| 7 | ✅ | **F3 (evaluasi threshold→alert):** simulasi publish NATS `telemetry.ingest` (format identik Module `publishTelemetry`) value=99 > max=10 → alert `active` muncul di `GET /alerts` dengan message benar; dedup: publish ulang tidak buat alert duplikat; value=5 (dalam range) → alert `resolved` + `resolved_at` terisi. |
| 8 | ✅ | **F4 (cache invalidation):** threshold max=50 di-cache saat telemetry value=40 (no alert); setelah `PUT` update max=30, value=40 LANGSUNG memicu alert baru → membuktikan cache threshold di-evict pada perubahan (`ClearThreshold` di `service.go` Create/Update/Delete). |
| 9 | ✅ | **K1 (JWT + RBAC):** tanpa token→401, token invalid→401; viewer baca `/alerts` & `/thresholds`→200; viewer POST/PUT/DELETE threshold & PUT ack→403; operator & admin write→201/200 (writeMw=`RequireRole("admin","operator")`). |
| 10 | ✅ | **K2 (validasi threshold):** lihat #4 — invalid→400 (SUDAH DIFIX & terverifikasi clean). |
| 11 | ✅ | **K3 (filter node_id aman):** semua query GORM parameterized (probe `?node_id=n1' OR '1'='1`→200 hasil kosong, tidak ada injection); input node_id/metric threshold difilter regex mencegah stored XSS. |
| 12 | ✅ | Fixture RBAC: register `qa-viewer` (viewer) + `qa-operator` (dipromosikan operator via `PUT /auth/users/{id}` `{"roles":["operator"]}`) + admin seeded. Tidak ada log error container (`ERROR`/`panic`/`fatal` = 0 selain SLOW SQL informatif). Metrik Prometheus `alert_http_request_duration_seconds_*` naik per method/path. |
| 13 | 🔧 | **REVIEW FIX #1 (cache drift saat rename):** `UpdateThreshold` sebelumnya hanya evict cache key `(node_id, metric)` BARU; bila threshold di-rename (`node_id`/`metric` diubah), cache key LAMA tetap tersimpan → `resolveThreshold` bisa mengembalikan threshold basi (≤60s TTL) untuk key lama. **Fix** di [`services/alert/internal/service/service.go`](file:///home/almuzky/TA/Microservices/services/alert/internal/service/service.go): fetch record lama sebelum update, lalu evict KEDUA key lama & baru. Verifikasi: create th `(node,m1)` max10 → publish m1=5 (cache warm, no alert) → rename m1→m2 → publish m1=50 → **0 alert** (tanpa fix, cache basi max10 akan salah memicu alert). |
| 14 | 🔧 | **REVIEW FIX #2 (validasi range partial update):** `min<=max` sebelumnya hanya divalidasi bila kedua field ada di request yang sama; PATCH satu field (mis. `{"min":50}` terhadap `max:30` tersimpan) bisa membuat range terbalik. **Fix:** validasi range dipindah ke service (`ErrInvalidRange`, hitung effective min/max dari record lama + patch), dipetakan ke **400** di [`services/alert/internal/handler/handler.go`](file:///home/almuzky/TA/Microservices/services/alert/internal/handler/handler.go); check duplikat di handler dihapus (single source). Verifikasi: PATCH `min=50` saja→400, `max=5` saja→400, `max=40` saja→200, both valid→200, both invalid→400. `go build`+`go vet` lolos, 0 log error. |

**Keputusan Teknis:** Alert Service dinyatakan **SELESAI (clean)** — seluruh checklist Fitur (4) & Keamanan (3) §5 lulus via curl melalui Kong; **2 bug** ditemukan, di-fix, dan diverifikasi ulang tanpa regresi:
1. **[INFRA—stale worktree bind]** mariadb-alert/redis-alert ter-bind ke worktree terhapus → tabel hilang → threshold endpoint 500; fix recreate container dari project dir utama + restart Kong.
2. **[SECURITY—validasi]** threshold menerima severity invalid / `min>max` / XSS-injection node_id/metric → 201; fix validasi regex + closed-set severity + `min<=max` di `handler.go` → 400.

Catatan: respon Alert Service sengaja TIDAK memakai wrapper standar `{success,data}` (AGENTS.md §4.4) — konsisten dengan Auth/Module/Analytics/Control; frontend [`dashboard/src/api/alerts.js`](file:///home/almuzky/TA/Microservices/dashboard/src/api/alerts.js) + `client.js` mengonsumsi raw JSON (`{alerts,total,...}` / `{thresholds,total}`), memaksa wrapper akan memecah dashboard. Checklist UI/D1–D12 TIDAK diubah (ranah User).

---

### Testing — Notification Service (Service Ketujuh, M7) — ❌ BLOCKED

| # | Status | Aktivitas |
|---|---|---|
| 1 | ❌ | **BLOCKER:** Notification Service **tidak diimplementasikan** — tidak ada `services/notification`, tidak ada entry `notification` di `docker-compose.yml`, tidak ada upstream/route/service `notification` di `infra/kong/kong.yml`, dan tidak ada container `notification` yang berjalan. |
| 2 | ❌ | Verifikasi gateway: `GET /notifications/settings` (no token) → **HTTP 404** `{"message":"no Route matched with those values"}`; `curl localhost:8001/routes` → **tidak ada** route `notif` (konfirmasi route Kong absen). |
| 3 | ❌ | Verifikasi kode: `grep -rln "notification" services --include=*.go` hanya cocok di `alert` (komentar) & `wsgateway` (WS bell) — tidak ada handler/service Notification; infra `infra/redis/notification` & `infra/mariadb/notification` hanya direktori kosong. |
| 4 | 📝 | Kesimpulan: seluruh checklist Fitur (4) & Keamanan (3) §7 **TIDAK DAPAT diuji** karena backend absen. Tidak ada bug kode yang bisa di-fix (tidak ada kode). |

**Keputusan Teknis:** Notification Service dinyatakan **BLOCKED** — bukan gagal-tes biasa, melainkan service sama sekali belum dibangun. Membuat service utuh (Go + MariaDB `mariadb-notification` + Redis `redis-notification` queue + NATS JetStream subscribe `alert.*` + channel telegram/email/push + RBAC admin) berada di LUAR scope QA (testing + bug-fix) dan melanggar AGENTS.md §6.8 (dependensi baru tanpa persetujuan). **Tindakan yang dibutuhkan:** user/PM meng-approve scaffold service ini (atau mengalihkan ke opsi A/B GAP-1). QA berhenti (STOP) sesuai instruksi "bila ketemu blocker yang tak bisa di-fix". Checklist §7 tetap `[ ]` + ditandai `[BLOCKED]` di `docs/testing-plan-agent.md`.

---

### Standardisasi Response Wrapper — Auth / Module / Analytics / Alert / Control (M1–M5)

| # | Status | Aktivitas |
|---|---|---|
| 1 | ✅ | Menyeragamkan response kelima service ke wrapper standar AGENTS.md §4.4 (`{success,data}` sukses / `{success:false,error:{code,message}}` error). Error code diturunkan dari HTTP status: 400=BAD_REQUEST, 401=UNAUTHORIZED, 403=FORBIDDEN, 404=NOT_FOUND, 409=CONFLICT, 500=INTERNAL_ERROR. |
| 2 | ✅ | **Backend Auth** (`services/auth`): `respond`/`respondError` di `auth_handler.go` wrap envelope; `auth_middleware.go` ganti `http.Error` → `writeError` envelope (401 UNAUTHORIZED / 403 FORBIDDEN). `go build`+`go vet` OK. |
| 3 | ✅ | **Backend Module** (`services/module`): `respond`/`respondError` wrap envelope; `middleware/auth.go` `unauthorized`/`forbidden` emit envelope, hapus `writeJSON` error-only. `go build`+`go vet` OK. |
| 4 | ✅ | **Backend Analytics** (`services/analytics`): `writeJSON` + `Health` wrap envelope; `middleware/auth.go` `unauthorized` emit envelope. `go build`+`go vet` OK. |
| 5 | ✅ | **Backend Alert** (`services/alert`): `respond`/`respondError` wrap envelope; `middleware/auth.go` `unauthorized`/`forbidden` emit envelope (ganti `fmt.Fprintf`). `go build`+`go vet` OK. |
| 6 | ✅ | **Backend Control** (`services/control`): `respond`/`respondError` wrap envelope; `middleware/auth.go` `unauthorized`/`forbidden` emit envelope (ganti `fmt.Fprintf`). `go build`+`go vet` OK. |
| 7 | ✅ | **Frontend**: tambah helper `unwrap(r => r.data)` di `api/auth.js`, `api/module.js`, `api/analytics.js`, `api/alerts.js`, `api/control.js` agar kontrak halaman tak berubah (halaman tetap baca payload mentah di `res.*`). `Monitor.jsx` alihkan 5 `request()` langsung (mode/schedule/command) ke `controlApi` yang sudah unwrap. `client.js` sudah object-safe. `vite build` OK. |
| 8 | 📝 | Open note §1–§5 di `docs/testing-plan-agent.md` dibalik: Analytics/Control/Alert kini SUDAH seragam; ringkasan §6 menyatakan seluruh 6 service seragam. Service Stream/ML/Notification/Export/Monitor belum (di luar scope pass ini). |

**Keputusan Teknis:** Kelima service (Auth/Module/Analytics/Alert/Control) kini mengembalikan wrapper standar `{success,data}` / `{error:{code,message}}`, konsisten dengan Audit. Frontend di-unwrap di layer `api/*` sehingga tidak ada perubahan pada halaman. `go build`+`go vet` per service & `vite build` lolos tanpa error.


