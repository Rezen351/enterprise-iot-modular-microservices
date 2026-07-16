# 🧪 Dokumentasi Pengujian Implementasi — IoT-Modular-Microservice

> **Versi:** 1.0
> **Tanggal:** 2026-07-14
> **Tujuan:** Catatan pengujian (checklist) seluruh fitur yang sudah & belum diimplementasikan, plus target pengujian.
> **Sumber acuan:** `roadmap.md` (v2.7.0), `planning.md` (v2.7.0), `infra/kong/kong.yml`, kode `services/*`, `stress-test/`.
> **Bahasa UI/API:** English (sesuai AGENTS.md). Catatan pengujian ini internal → Bahasa Indonesia diperbolehkan.

---

## 🛠️ Setup Pra-Pengujian

### Environment
- Stack dijalankan via `docker compose up -d` (semua container `healthy`).
- Base URL eksternal (melalui Kong): `http://localhost:8000` (env `KONG_PUBLIC_URL`).
- MQTT broker (device): `MQTT_URL` (default remote `tcp://192.168.1.103:1884` — BUKAN container `mosquitto` lokal).
- Prometheus: `http://localhost:9090`. NATS monitor: `http://<nats>:8222`.
- MinIO console: `http://localhost:9001` (bucket `stream`, `ml-vision`, `ota`).

### Auth token (wajib untuk route terlindungi)
```bash
# 1. Login (public route Kong: /auth/login)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@smartfarm.local","password":"<ADMIN_PASSWORD>"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo $TOKEN

# Helper curl ber-otentikasi
api() { curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000$1"; }
```

### Tools yang tersedia (sudah ada di repo)
- `stress-test/` — toolkit load/soak/spike + pentest (`loadtest.py`, `wstest.py`, `mqtttest.py`, `pentest.py`, `metrics.py`, `report.py`, `cli.py`). Jalankan via `python3 cli.py <subcommand>`.
- `mosquitto_sub` / `mosquitto_pub` — verifikasi MQTT end-to-end.
- `nats` CLI — `nats sub "mqtt.<NODE_ID>"`, `nats sub "telemetry.ingest"`, dsb.

---

## 🔬 Metode Pengujian Manual (Manual Testing Methods)

> [!IMPORTANT]
> **Kepemilikan & Batasan Pengujian:** Semua pengujian manual yang tercantum dalam dokumen ini **wajib dieksekusi secara manual oleh Pengguna (User), bukan oleh AI Agent**. AI Agent hanya diperbolehkan untuk membantu merancang skenario pengujian baru, memverifikasi relevansi skenario terhadap fitur yang dikembangkan, atau memperbarui struktur dokumen ini. Pengisian status checklist (`[ ]` -> `[x]`) dilakukan oleh Pengguna setelah pengujian manual berhasil dilakukan secara langsung.

Untuk memastikan pengujian manual dilakukan secara konsisten, terstruktur, dan komprehensif, terapkan metode-metode pengujian berikut selama siklus pengujian:

### 1. Smoke Testing (Uji Kelayakan Awal)
*   **Tujuan**: Memastikan build baru cukup stabil untuk diuji lebih lanjut tanpa membuang waktu.
*   **Prosedur**:
    1. Jalankan `docker compose ps` dan pastikan semua container statusnya `healthy` / `running`.
    2. Lakukan request ke endpoint healthcheck (`/health`) di tiap service. Harus mengembalikan status `200 OK`.
    3. Coba lakukan login admin. Jika gagal login pada build baru, stop pengujian dan laporkan build rusak.

### 2. Functional Black-Box Testing (Uji Fungsional Input/Output)
*   **Tujuan**: Memvalidasi fungsionalitas API dan Dashboard sesuai dengan spesifikasi/kontrak tanpa melihat kode internal.
*   **Teknik**:
    *   **Equivalence Partitioning (Pembagian Ekuivalensi)**: Bagi input menjadi kategori valid dan tidak valid. Contoh pada registrasi user:
        *   Valid: Email berformat benar (`user@domain.com`), password $\ge$ 8 karakter.
        *   Tidak Valid: Email tanpa `@`, password < 8 karakter.
    *   **Boundary Value Analysis (Analisis Nilai Batas)**: Uji batas rentang data. Contoh pada parameter rating/skala:
        *   Jika batas input adalah `1 - 100`, uji nilai `0` (invalid), `1` (valid batas bawah), `100` (valid batas atas), dan `101` (invalid).

### 3. Exploratory Testing (Uji Eksploratif / Ad-hoc)
*   **Tujuan**: Menemukan bug tersembunyi atau skenario ekstrem yang tidak tertulis dalam checklist formal melalui kreativitas penguji.
*   **Skenario**:
    *   Mengirimkan request dengan field JSON acak atau tipe data salah (misalnya mengirim boolean pada field integer).
    *   Melakukan interaksi UI dengan cepat (seperti *double-clicking* tombol submit sebelum request selesai).
    *   Mematikan koneksi internet (atau mematikan container NATS) di tengah-tengah transaksi untuk melihat penanganan error (*resilience*).

### 4. Integration & E2E Testing (Uji Integrasi Alur Data)
*   **Tujuan**: Memverifikasi aliran data antar-service yang terisolasi melalui Event Bus (NATS) atau API Gateway (Kong).
*   **Skenario**:
    *   **Auth ➔ Audit**: Lakukan mutasi data di Auth Service (misal: tambah user/ubah password), lalu cek DB `mariadb-audit` atau `/audit/logs` apakah event audit dipublikasikan ke NATS dan disimpan dengan benar.
    *   **ESP32/Simulator ➔ Dashboard**: Kirim payload telemetri MQTT palsu, verifikasi data masuk ke TimescaleDB (Module & Analytics) dan terkirim secara *real-time* ke dashboard React via WS-Gateway.

### 5. Security & RBAC Manual Checks (Uji Keamanan Hak Akses)
*   **Tujuan**: Menjamin isolasi data dan hak akses antar-role berjalan dengan ketat sesuai aturan RBAC.
*   **Prosedur**:
    1. **Bypass Token**: Lakukan request ke endpoint terlindungi tanpa menyertakan header `Authorization`. Pastikan mengembalikan `401 Unauthorized`.
    2. **Escalation Role**: Login sebagai user dengan role `viewer`, lalu coba lakukan mutasi data (misalnya `POST /modules` atau `DELETE /users/{id}`). Pastikan mengembalikan `403 Forbidden`.
    3. **SQL/XSS Injection Test**: Coba masukkan karakter khusus seperti `' OR '1'='1` pada input login atau query search. Coba masukkan tag `<script>alert(1)</script>` pada input nama/tag. Sistem harus menolak atau menyaring data tersebut.

### 6. Usability & UX Testing (Uji Pengalaman Pengguna)
*   **Tujuan**: Menilai seberapa intuitif, responsif, dan ramah antarmuka dashboard bagi pengguna akhir.
*   **Fokus**:
    *   **Loading & Error States**: Pastikan ada visual loader saat fetching data dan pesan error berbahasa Inggris yang jelas (bukan *white screen* / crash JS) jika API mati.
    *   **Responsivitas**: Uji UI pada resolusi desktop, tablet, dan mobile.

---

## ✅ Legenda Checklist

- `[ ]` Belum diuji · `[x]` Lulus · `[!]` Diketahui gagal/bug · `[-]` Tidak berlaku
- Kolom **Target**: kapan harus selesai diuji (lihat bagian Target di bawah).

---

## 1. 🔴 Auth Service (`/auth`)

| # | Tes | Metode & Endpoint (via Kong) | Ekspektasi | Status | Target |
|---|-----|------------------------------|------------|--------|--------|
| A1 | Register user baru | `POST /auth/register` | 201, hash bcrypt, audit.log publish | [ ] | M1 |
| A2 | Login via email | `POST /auth/login` | 200, `access_token` + `refresh_token` | [ ] | M1 |
| A3 | Login via username (`identifier`) | `POST /auth/login` | 200 (field identifier fleksibel) | [ ] | M1 |
| A4 | Login kredensial salah | `POST /auth/login` | 401 | [ ] | M1 |
| A5 | Refresh token (rotation) | `POST /auth/refresh` | token lama revoke, baru issue | [ ] | M1 |
| A6 | Logout (revoke all) | `POST /auth/logout` | refresh token aktif revoked | [ ] | M1 |
| A7 | Get profile | `GET /auth/me` | 200 profil dari JWT | [ ] | M1 |
| A8 | Update profile | `PUT /auth/me` | 200 | [ ] | M1 |
| A9 | Change password | `PUT /auth/password` | 200, session lain tetap valid? | [ ] | M1 |
| A10 | List sessions | `GET /auth/sessions` | 200 daftar sesi | [ ] | M1 |
| A11 | Deactivate account | `DELETE /auth/account` | soft-delete | [ ] | M1 |
| A12 | List users (admin) | `GET /auth/users` | 200 (hanya admin) | [ ] | M1 |
| A13 | List roles (admin) | `GET /auth/roles` | 200 daftar role | [ ] | M1 |
| A14 | Update user (admin) | `PUT /auth/users/{id}` | ubah status/role | [ ] | M1 |
| A15 | Delete user (admin) | `DELETE /auth/users/{id}` | soft-delete | [ ] | M1 |
| A16 | Guard: self-deactivate/demote | `PUT/DELETE` akun sendiri | 403 | [ ] | M1 |
| A17 | Guard: hapus admin terakhir | `DELETE` admin terakhir | 409 | [ ] | M1 |
| A18 | Seed admin default | start pertama (idempoten) | `admin@smartfarm.local` ada | [ ] | M1 |
| A19 | Retention cron | jalankan manual/cek log | token expired + user inaktif >365h dihapus | [ ] | M3 |
| A20 | JWT tanpa header | `GET /auth/me` tanpa token | 401 | [ ] | M1 |
| A21 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| A22 | Prometheus `/metrics` | `GET /metrics` | `auth_http_requests_total` naik | [ ] | M2 |

**Catatan:** Auth publish `audit.log` ke NATS — verifikasi subject `audit.log` aktif (lihat A18/bagian Audit).

---

## 2. 🟡 Module Service (`/modules`, `/nodes`)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| M1 | List modules | `GET /modules` | 200 array | [x] | M1 |
| M2 | Create module | `POST /modules` (op/adm) | 201; invalid name `<>` & missing name → 400 | [x] | M1 |
| M3 | Get module | `GET /modules/{id}` | 200; bad id → 404 | [x] | M1 |
| M4 | Update module | `PUT /modules/{id}` (op/adm) | 200 | [x] | M1 |
| M5 | Delete module | `DELETE /modules/{id}` (op/adm) | 200 (unpair node terikat) | [x] | M1 |
| M6 | List nodes | `GET /nodes` | 200 | [x] | M1 |
| M7 | List discovered | `GET /nodes/discovered` | node unpaired | [x] | M1 |
| M8 | Get node | `GET /nodes/{node_id}` | 200 detail + status | [x] | M1 |
| M9 | Pair node | `POST /nodes/{node_id}/pair` (op/adm) | status paired + audit.log; bad module_id → 400 | [x] | M1 |
| M10 | Unpair node | `POST /nodes/{node_id}/unpair` (op/adm) | unpaired | [x] | M1 |
| M11 | Delete node | `DELETE /nodes/{node_id}` (op/adm) | 200; bad id → 404 | [x] | M1 |
| M12 | Get node tags | `GET /nodes/{node_id}/tags` | mapping source_key→tag | [x] | M1 |
| M13 | Save node tags | `PUT /nodes/{node_id}/tags` (op/adm) | 200, invalidasi cache | [x] | M1 |
| M14 | Get actuator tags | `GET /nodes/{node_id}/actuators` | katalog output | [x] | M1 |
| M15 | Create actuator tag | `POST /nodes/{node_id}/actuators` (op/adm) | 201; missing source_key → 400 | [x] | M1 |
| M16 | Delete actuator tag | `DELETE /nodes/{node_id}/actuators/{id}` (op/adm) | 200 | [x] | M1 |
| M17 | MQTT discovery auto-register | ESP publish `smartfarm/discovery` | node muncul di discovered (10 node re-populasi otomatis) | [x] | M1 |
| M18 | MQTT status LWT | ESP online/offline | status + last_seen update (Redis); 9 node `online` | [x] | M1 |
| M19 | Telemetry ingest | ESP publish `smartfarm/{node}/telemetry` | masuk TimescaleDB (`telemetry` 767k+ rows) + Redis `node:latest` + NATS `telemetry.ingest` + `telemetry.batch` (JetStream) | [x] | M1 |
| M20 | Tag mapping modular | ubah tag di UI → telemetry pakai tag baru | SaveNodeTags 200, mapping tersimpan | [x] | M2 |
| M21 | Healthcheck | `GET /health` | 200 | [x] | M1 |
| M22 | Prometheus `/metrics` | `GET /metrics` | `module_http_requests_total` naik; target `module-service` UP | [x] | M2 |
| M23 | Core NATS reconnect guard | `docker restart microservices-module-1` saat live monitor jalan | live WS tidak "loading" terus (lihat troubleshooting `planning.md`) | [ ] | M2 |

> **Bug ditemukan & SUDAH DIFIX (2026-07-15):** InnoDB dictionary desync pada `mariadb-module` — seluruh tabel `module_db` (`modules`, `nodes`, `node_tags`) hilang dari data dictionary padahal file `.frm`/`.ibd` fisik masih ada (orphaned table). Akibatnya `GET /modules`/`GET /nodes`/`ListNodeTags` melempar `Error 1146 (42S02): Table 'module_db.node_tags' doesn't exist` → semua list **500**. Root cause lingkungan: `ibdata1` (shared dictionary store) sempat terganti/desync sehingga entri `module_db` hilang. **Fix:** stop `module`+`mariadb-module`, hapus volume bind-mount `volumes/mariadb-module` (instance ini hanya menyimpan `module_db`, aman), `up -d mariadb-module` (re-init fresh), lalu `up -d module` (GORM AutoMigrate bangun ulang tabel). Tabel tercipta ulang & node hidup kembali lewat MQTT discovery. Juga rebuild image `microservices-module` dari source terkini (binary lama belum menyertakan `middleware/auth.go` baru). Verifikasi: `SHOW TABLES` → 3 tabel, semua endpoint list 200, tanpa error di log.

> **Bug known:** `PublishLive` diam-diam buang pesan bila Core NATS putus (planning §Troubleshooting). Uji: restart module saat node online → cek `nats sub "mqtt.<NODE_ID>"` masih mengalir.

---

## 3. 🟡 Analytics Service (`/analytics`)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| AN1 | Query metrics (downsample) | `GET /analytics/metrics?node_id=&metric=&from=&to=&interval=` | series sesuai rollup/hourly/daily | [x] | M2 |
| AN2 | Summary statistik | `GET /analytics/summary` | count/sum/min/max/avg/last | [x] | M2 |
| AN3 | List nodes+metrics | `GET /analytics/nodes` | node punya data + metric tersedia | [x] | M2 |
| AN4 | Export CSV (raw/hour/day) | `GET /analytics/export?resolution=day\|hour\|raw&...` | CSV kolom count/sum/min/max/avg/last | [x] | M2 |
| AN5 | Continuous aggregate | cek `metrics_hourly`/`metrics_daily` terisi | [x] | M3 |
| AN6 | Retention policy | raw 30h, hourly 365h, daily 3650h | [x] | M3 |
| AN7 | JetStream replay | restart Analytics saat batch jalan | window 1-menit tidak hilang (durable `analytics-batch`) | [x] | M2 |
| AN8 | Healthcheck | `GET /analytics/health` (via Kong) | 200 | [x] | M1 |
| AN9 | Prometheus `/metrics` | `GET /metrics` | `analytics_http_requests_total` | [x] | M2 |
| AN10 | Time-range cap (DoS) | `GET /analytics/metrics?from=2020-01-01T00:00:00Z&to=2026-07-15T00:00:00Z` | 400 `requested time range exceeds the 31-day limit` | [x] | M2 |
| AN11 | Multi-metric batch | `GET /analytics/metrics?node_id=ECE334219870&metric=cwt1_temp,cwt1_hum&interval=1h` | series per metric dalam 1 response | [x] | M2 |
| AN12 | Export time-range cap | `GET /analytics/export?node_id=&metric=&from=2020-01-01&to=2026-07-15&resolution=day` | 400 jika >366 hari, else CSV valid | [x] | M2 |

> **Review kode (AI Agent, 2026-07-15):** `go build` + `go vet` lolos. **Bug fix (security):** range `from`/`to` tidak dibatasi (potensi dump DB). Ditambah `validateWindow` di `services/analytics/internal/handler/handler.go` — cap 31 hari (live: metrics/summary) & 366 hari (export), 400 bila melampaui. Semua query pakai prepared statement; `table`/`timeCol` diambil dari switch tertutup (`sourceForDuration`/`resolutionSource`) → tidak ada SQL injection. **Open note:** response shape Analytics tidak memakai wrapper standar AGENTS.md §4.4 (sengaja, agar dashboard tidak pecah). Checklist di atas (pengujian manual/UI) statusnya `[ ]` — eksekusi dilakukan oleh User (sesuai [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md#L132-L138) Butir 5); AI Agent tidak mencentang checklist pengujian manual.

> **API Testing SELESAI (AI Agent, 2026-07-15):** Analytics lulus manual API test — seluruh AN1–AN12 lulus via `curl` melaui Kong (`localhost:8000`) dengan token admin/viewer. **3 bug ditemukan & di-fix selama pengujian:**
> 1. **[SECURITY-TINGGI] Endpoint terbuka tanpa auth** — route `/analytics` di `kong.yml` hanya punya `rate-limiting` (tidak `jwt`); block `analytics` di `docker-compose.yml` tak menyuntikkan `JWT_SECRET` → `cfg.JWTSecret=""` → middleware lewati validasi → `GET /analytics/nodes` tanpa token = 200 (harus 401). **Fix:** `internal/middleware/auth.go` (mirip Module) + wire `JWTAuth(cfg.JWTSecret)` di `main.go`/`handler.Routes` + tambah `JWT_SECRET` ke environment `analytics`. Verifikasi: tanpa/bad/expired token → **401**, valid → **200**.
> 2. **`GET /analytics/health` 404 via Kong** — health di `/health` (root), route lain pakai `/analytics`. **Fix:** alias `r.Get("/analytics/health", handler.Health)` (Kong healthcheck tetap `/health`). Verifikasi: **200**.
> 3. **[pre-test] Range `from`/`to` tak dibatasi (DoS)** — `validateWindow` cap 31h live / 366h export, 400 bila melampaui. Verifikasi: 31h→200, 32h→400, `from>to`→400, format salah→400.
> **Catatan data:** `metrics_rollup` di-replay JetStream + backfill 54.179 row dari `timescaledb-module.telemetry`; 486 row `module_id=NULL` (artefak replay) dirapihkan via `UPDATE`; cagg `metrics_hourly`=1028 / `metrics_daily`=73 terisi (policy `add_continuous_aggregate_policy` di `init.sql` → auto-refresh). **Open note:** response shape Analytics tak pakai wrapper §4.4 (sengaja, agar dashboard tak pecah).

---

## 4. 🟡 WS-Gateway (`/ws`)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| W1 | WS live telemetry (JWT Bearer) | `GET /ws/nodes/{node_id}/live` (header `Authorization: Bearer`) | stream payload realtime | [ ] | M2 |
| W2 | WS live telemetry (JWT query) | `GET /ws/nodes/{node_id}/live?token=` | stream payload | [ ] | M2 |
| W3 | WS tanpa token | koneksi tanpa auth | 401 / reject | [ ] | M2 |
| W4 | WS token invalid/expired | reject | [ ] | M2 |
| W5 | Subject benar | WS subscribe `mqtt.{node_id}` (bukan `cmd/...`) | [ ] | M2 |
| W6 | Replay payload terakhir | connect saat device jarang report | tidak "loading" terus | [ ] | M3 |
| W7 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| W8 | Prometheus `/metrics` | `GET /metrics` | naik | [ ] | M2 |
| W9 | System-status notification | `GET /ws/system-status?token=` | notifikasi push (GAP-1 ✅ SUDAH terimplementasi di backend) | [ ] | M4 |

> **Catatan backend (QA Agent, 2026-07-16):** handler `SystemStatus` (`/ws/system-status`) & `NodeLive` (`/ws/nodes/{node_id}/live`) SUDAH ada & terverifikasi lewat API test (`testing-plan-agent.md` §11): no token→401, bad token→401, valid token→101, path traversal→400. GAP-1 (system-status) tertutup di sisi backend. Checklist manual di atas tetap `[ ]` menunggu validasi visual User.

> **Open note (GAP-2, frontend):** `NodeDetailPanel.jsx` & `NodeConfigPage.jsx` membuka WS tanpa `?token=` → 401 (gateway reject). Ini fix sisi dashboard (tambah `?token=`, samakan `Monitor.jsx`). Status tetap `[ ]` menunggu perbaikan frontend + validasi visual User (lihat D8).

---

## 5. ✅ Control Service (`/control`)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| C1 | List commands | `GET /control/commands` | log perintah | [ ] | M2 |
| C2 | List targets | `GET /control/targets` | katalog output per node | [ ] | M2 |
| C3 | List outputs | `GET /control/outputs` | [ ] | M2 |
| C4 | List schedules | `GET /control/schedules` | [ ] | M2 |
| C5 | Get schedule | `GET /control/schedules/{id}` | [ ] | M2 |
| C6 | Manual `set_state` ON/OFF | `POST /control/command` `{action:set_state,...}` (op/adm) | publish `smartfarm/actuator/{node_id}` `set_output`; ESP eksekusi | [ ] | M2 |
| C7 | Manual `set_level` PWM | `POST /control/command` `{action:set_level,...}` | value 0–255 | [ ] | M2 |
| C8 | Manual `toggle` | arah lawan state terakhir | [ ] | M2 |
| C9 | Manual `pulse` | ON X detik → OFF (timer server) | [ ] | M2 |
| C10 | `emergency_stop` | semua output=0 (broadcast) | [ ] | M2 |
| C11 | ACK korelasi `req_id` | ESP balas `smartfarm/{node_id}/confirm` | status `pending→sent→acked` | [ ] | M2 |
| C12 | ACK timeout | tidak ada `/confirm` | status `failed`/timeout + audit.log | [ ] | M2 |
| C13 | CRUD schedule | `POST/PUT/enable/disable/DELETE /control/schedules[/...]` (op/adm) | [ ] | M2 |
| C14 | Scheduler `interval` | ON x / OFF y berulang | [ ] | M2 |
| C15 | Scheduler `schedule` (cron) | nyala/mati jam tertentu | [ ] | M3 |
| C16 | Scheduler `threshold` | ON/OFF by sensor + histeresis | [ ] | M3 |
| C17 | Scheduler `duration` | nyala total durasi → OFF | [ ] | M3 |
| C18 | Scheduler `ramp` | PWM bertahap | [ ] | M3 |
| C19 | Set node mode | `PUT /control/modes/{node_id}` (op/adm) | MANUAL/AUTO | [ ] | M2 |
| C20 | Get node mode | `GET /control/modes/{node_id}` | [ ] | M2 |
| C21 | Resume (restore prev_mode) | `POST /control/modes/{node_id}/resume` | kembalikan mode pra-emergency (bukan selalu AUTO) | [ ] | M2 |
| C22 | Set output mode | `PUT /control/modes/{node_id}/{output}` | [ ] | M2 |
| C23 | Arbritasi: manual ditolak di AUTO/EMERGENCY | `POST /control/command` saat mode AUTO (bukan emergency_stop) | 4xx | [ ] | M2 |
| C24 | Scheduler pause di MANUAL/EMERGENCY | mode MANUAL → schedule di-pause | [ ] | M2 |
| C25 | RBAC viewer diblokir mutasi | `POST /control/command` sebagai viewer | 403 | [ ] | M2 |
| C26 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| C27 | Prometheus `/metrics` | `GET /metrics` | naik | [ ] | M2 |

> **Catatan backend (QA Agent):** Section 5 sudah diuji via API test (`testing-plan-agent.md` §4): command→MQTT→confirm→acked, arbitration AUTO→409, scheduler interval jalan, resume mengembalikan mode pra-emergency, viewer mutasi→403. Checklist manual di atas tetap `[ ]` menunggu validasi UI/firmware riil oleh User.

> **Kontrak firmware (wajib):** command topic = `smartfarm/actuator/{node_id}`, action hanya `set_output`, payload `{"action":"set_output","target":...,"value":...,"req_id":...}`. ACK via MQTT `/confirm` (bukan NATS Request-Reply).

---

## 6. 🟢 Stream Service (`/streams`, `/snapshots`)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| S1 | List streams | `GET /streams` | + status live MediaMTX + URL playback | [ ] | M2 |
| S2 | Create stream | `POST /streams` (op/adm) | register path MediaMTX | [ ] | M2 |
| S3 | Get stream | `GET /streams/{id}` | URL HLS/WebRTC | [ ] | M2 |
| S4 | Update stream | `PUT /streams/{id}` (op/adm) | re-register path | [ ] | M2 |
| S5 | Delete stream | `DELETE /streams/{id}` (op/adm) | unregister + hapus DB | [ ] | M2 |
| S6 | Capture snapshot | `POST /streams/{id}/snapshot` (op/adm) | frame → MinIO bucket `stream` `kind=snapshot` | [ ] | M2 |
| S7 | Snapshot + AI detect | `POST /streams/{id}/snapshot?detect=true` (op/adm) | panggil ML `vision-aeroponik` → `kind=detection` (bbox JSON) | [ ] | M2 |
| S8 | List snapshots | `GET /snapshots?kind=` | ALL/SNAPSHOT/RECORDING/DETECTION | [ ] | M2 |
| S9 | Get snapshot | `GET /snapshots/{id}` | [ ] | M2 |
| S10 | Delete snapshot | `DELETE /snapshots/{id}` (op/adm) | hapus object MinIO + DB | [ ] | M2 |
| S11 | Start recording | `POST /streams/{id}/record/start` (op/adm) | MediaMTX rekam | [ ] | M3 |
| S12 | Stop recording | `POST /streams/{id}/record/stop` (op/adm) | cover `kind=recording` | [ ] | M3 |
| S13 | Playback HLS/WebRTC | buka URL via proxy `/live/{name}/` | player MediaMTX tampil | [ ] | M2 |
| S14 | Kong write_timeout 120s | capture+detect besar | tidak 504 (hardening timeout) | [ ] | M2 |
| S15 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| S16 | Prometheus `/metrics` | `GET /metrics` | `stream_http_requests_total` | [ ] | M2 |

> **Catatan backend (QA Agent, 2026-07-15):** Section 6 sudah diuji via API test (`testing-plan-agent.md` §8): CRUD 201/200/404/409 + RBAC, snapshot→MinIO, recording→mp4, HLS via Kong proxy, storage proxy multi-segment fix. Checklist manual di atas tetap `[ ]` menunggu validasi UI/playback riil oleh User.

> **OPEN NOTE (AI Detection gallery `?detect=true`):** Gallery DETECTION (`S8` kind=DETECTION, `D7` AI Capture, `E2E5`) **hanya akan terisi bila ada model YOLO aktif yang terdaftar di ML Service** (lihat §7 V6 `activate`, V15 auto-seed `vision-aeroponik`). Bila gallery DETECTION kosong / `snapshot?detect=true` tidak menghasilkan bbox, kemungkinan besar **belum ada model YOLO yang di-register/di-activate di ML Service**, BUKAN bug kode. Verifikasi: `GET /ml/models` harus punya minimal 1 model dengan flag `loaded`/`is_default` true sebelum menguji deteksi.

## 7. 🟢 ML / Vision API (`/ml`)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| V1 | Health | `GET /ml/health` (public) | `models_loaded`, `default_model` | [ ] | M2 |
| V2 | List models | `GET /ml/models` (all) | registry | [ ] | M2 |
| V3 | Get model | `GET /ml/models/{id}` | + flag `loaded`, `num_classes` | [ ] | M2 |
| V4 | Register model | `POST /ml/models` (op/adm) | 201 `model_id` | [ ] | M2 |
| V5 | Update model | `PUT /ml/models/{id}` (op/adm) | threshold/status/is_default | [ ] | M2 |
| V6 | Activate model | `POST /ml/models/{id}/activate` (op/adm) | jadi default | [ ] | M2 |
| V7 | Upload weights | `POST /ml/models/{id}/weights` (op/adm) | `.pt` terikat | [ ] | M2 |
| V8 | Delete model | `DELETE /ml/models/{id}` (op/adm) | [ ] | M2 |
| V9 | Model count | `GET /ml/models/{id}/count` | [ ] | M3 |
| V10 | Detect upload | `POST /ml/detect` (op/adm, multi-file) | deteksi + URL anotasi + bbox | [ ] | M2 |
| V11 | Detect base64 | `POST /ml/detect/base64` | [ ] | M2 |
| V12 | Detect from-stream | `POST /ml/detect/from-stream` | frame bucket `stream` (read-only) | [~] | M2 |
| V13 | Detection history | `GET /ml/detections?limit=&offset=` | paginated | [ ] | M2 |
| V14 | Detection detail | `GET /ml/detections/{id}` | [ ] | M2 |
| V15 | Auto-seed `vision-aeroponik` | start ML tanpa registrasi manual | model default siap | [ ] | M2 |
| V16 | Lazy load + cache | pertama detect lambat, berikutnya cepat | reload otomatis saat config/weights berubah | [ ] | M3 |
| V17 | Publish `detection.result` | NATS event saat deteksi | [ ] | M3 |
| V18 | RBAC read=all / write=op+adm | viewer `POST /ml/detect` | 403 | [ ] | M2 |
| V19 | Prometheus `/metrics` | `GET /ml/metrics` | `vision_inferences_total` dll | [ ] | M2 |

> **Catatan backend (QA Agent, 2026-07-16):** Section 7 sudah diuji via API test (`testing-plan-agent.md` §9) dengan wrapper standar. V12 = `[~]` karena bucket `stream` kosong di env (limitation env, bukan bug). Checklist manual di atas tetap `[ ]` menunggu validasi UI oleh User.

---

## 8. 🟢 Monitor Service (CLI)

| # | Tes | Cara | Ekspektasi | Status | Target |
|---|-----|------|------------|--------|--------|
| MO1 | `docker stats` agregasi | jalankan binary monitor | CPU%, Mem, NetIO, BlockIO, PIDs, Status per container | [ ] | M3 |
| MO2 | Sorting & format tabel | output terformat | [ ] | M3 |
| MO3 | Konsumsi dashboard | halaman Version/Security → Service/Container Versions | data tampil | [ ] | M3 |

> **Catatan:** Monitor Service ✅ di `roadmap.md` (CLI ambil `docker stats`/`docker ps`, agregasi resource, dikonsumsi halaman dashboard Version/Security). Checklist manual tetap `[ ]` menunggu validasi UI oleh User.

---

## 9. 🔐 Keamanan Lintas-Service (Cross-cutting)

| # | Tes | Cakupan | Ekspektasi | Status | Target |
|---|-----|---------|------------|--------|--------|
| SEC1 | JWT validasi di semua protected route | semua service | 401 tanpa token | [ ] | M1 |
| SEC2 | RBAC Admin/Operator/Viewer | semua mutasi | 403 bila role tidak cukup | [ ] | M2 |
| SEC3 | Kong rate-limit auth publik | `/auth/login` 60/min | 429 | [ ] | M2 |
| SEC4 | Kong rate-limit route lain | 60–120/min (export 300/min) | 429 saat melampaui | [ ] | M2 |
| SEC5 | MQTT ACL | Control publish `smartfarm/actuator/#`, Module subscribe `smartfarm/#` | ESP tidak bisa publish `cmd/` | [~] | M2 |
| SEC6 | NATS ACL | per-subject per-user | service tidak bisa publish subject bukan miliknya | [~] | M3 |
| SEC7 | CORS whitelist | origin `localhost:3000/5173/FRONTEND_URL` | bukan wildcard | [ ] | M2 |
| SEC8 | WS JWT handshake | `/ws` | tolak tanpa token | [ ] | M2 |
| SEC9 | Pentest suite | `python3 cli.py pentest` | lihat laporan `report.py` | [~] | M4 |
| SEC10 | Refresh token rotation & revocation | Auth | token lama tidak bisa dipakai | [ ] | M2 |

> **Catatan backend (QA Agent):** SEC1–SEC4, SEC7, SEC8, SEC10 sudah diuji via API test (`testing-plan-agent.md` §1, §13): tanpa/bad token→401, viewer mutasi→403, rate-limit→429 di attempt ke-61 (auth 60/min), CORS preflight benar. SEC5/SEC6 = `[~]`: `allow_anonymous true` masih aktif di Mosquitto & NATS ACL template ter-comment (remediation siap di `infra/mosquitto/config/acl.conf` & `infra/nats/nats.conf`) — enforcement penuh ditunda butuh distribusi kredensial. SEC9 (pentest suite) belum dijalankan penuh. Checklist manual tetap `[ ]` menunggu validasi User.

---

## 10. 📡 MQTT & NATS Contract

| # | Tes | Subject/Topic | Ekspektasi | Status | Target |
|---|-----|---------------|------------|--------|--------|
| MSG1 | ESP discovery | `smartfarm/discovery` | Module auto-register | [ ] | M1 |
| MSG2 | ESP status LWT | `smartfarm/status/+` | online/offline | [ ] | M1 |
| MSG3 | ESP telemetry | `smartfarm/{node}/telemetry` | Module ingest | [ ] | M1 |
| MSG4 | Control command | `smartfarm/actuator/{node_id}` | ESP eksekusi `set_output` | [ ] | M2 |
| MSG5 | ESP ACK | `smartfarm/{node_id}/confirm` | Control korelasi req_id | [ ] | M2 |
| MSG6 | OTA push | `ota/push/{device}` | (belum diimplementasikan) | [-] | — |
| MSG7 | NATS `telemetry.ingest` | Core NATS | live fan-out WS | [ ] | M1 |
| MSG8 | NATS `telemetry.batch` | **JetStream** `TELEMETRY_BATCH` | persistent + replay | [ ] | M2 |
| MSG9 | NATS `audit.log` | Core NATS | dipublish Auth/Module/Control/Stream & di-consume Audit Service | [ ] | M2 |
| MSG10 | NATS `detection.result` | Pub/Sub | dipublish ML | [ ] | M3 |
| MSG11 | `alert.triggered`/`alert.resolved` | Pub/Sub | dipublish Alert Service → Notification/WS | [ ] | M2 |

> **Catatan backend (QA Agent):** MSG1–MSG5, MSG7–MSG11 sudah diuji via API/NATS test (`testing-plan-agent.md` §11–§13). MSG6 = `[-]` (OTA Service belum diimplementasikan, `planning.md` Future P4). Checklist manual tetap `[ ]` menunggu validasi User. MQTT broker `allow_anonymous` masih true (lihat SEC5).

---

## 11. 📊 Observability & Monitoring

| # | Tes | Target | Ekspektasi | Status | Target |
|---|-----|--------|------------|--------|--------|
| OBS1 | Prometheus scrape targets | `prometheus:9090/targets` | auth/module/analytics/wsgateway/kong/stream/ml/notification/export/audit UP (31 target, 0 DOWN) | [ ] | M2 |
| OBS2 | Container health | `docker ps` | semua `healthy` | [ ] | M1 |
| OBS3 | Grafana dashboard | `grafana-service-health.md` | panel service health tampil | [ ] | M3 |
| OBS4 | Exporter UP | mysqld/postgres/redis/mosquitto/nats | UP | [ ] | M3 |
| OBS5 | Audit trail di Prometheus | metrik request per service | naik sesuai trafik | [ ] | M3 |

---

## 12. 🖥️ Dashboard (React) — UI Checklist

| # | Halaman | Route | Tes utama | Status | Target |
|---|---------|-------|-----------|--------|--------|
| D1 | Login / Register / Profile | `/` | auth flow + ubah password + sesi + deactivate | [ ] | M1 |
| D2 | User Management | `/users` | admin: toggle aktif, ubah role, hapus (guard) | [ ] | M1 |
| D3 | Module Management | `/module` | CRUD module, pair/unpair, node config, tags | [ ] | M1 |
| D4 | Analytics | `/analytics` | line chart, selector node+metric, range 1h–30d | [ ] | M2 |
| D5 | Control Panel | `/control` | mode badge, toggle Manual⇄Otomatis, Emergency Stop, Resume; manual ON/OFF/Toggle/level; editor jadwal create/edit/toggle/delete + pagination | [ ] | M2 |
| D6 | Live View | `/live` | player MediaMTX HLS/WebRTC + manajemen stream | [ ] | M2 |
| D7 | Snapshot | `/snapshot` | galeri ALL/SNAPSHOT/RECORDING/DETECTION; AI Capture (op/adm) | [ ] | M2 |
| D8 | Telemetri Real-time | Node Detail WS | live metric via `/ws/nodes/{id}/live` | [ ] | M2 |
| D9 | System Notifications | Notification Bell (header) + `/alerts` | push via `/ws/system-status` (GAP-1 backend ✅; GAP-2 frontend `?token=` pending); halaman ALERTS history + ack (§14a) | [ ] | M4 |
| D10 | Version/Security | Monitor | Service/Container Versions dari Monitor CLI | [ ] | M3 |
| D11 | Bahasa UI English | semua halaman | tidak ada teks Indonesia statis | [ ] | M1 |
| D12 | Audit Log | `/audit` (sidebar AUDIT) | tabel audit trail dari `GET /audit/logs`; filter event (prefix) + search; paginasi 25/50/100; quick-filter Auth/Module/Node/Control; Live auto-refresh 10s | [ ] | M3 |

---

## 13. 🔄 End-to-End Flow (Skenario Integrasi)

| # | Skenario | Alur | Status | Target |
|---|----------|------|--------|--------|
| E2E1 | Telemetry → Dashboard | ESP → MQTT → Module → TimescaleDB/Redis → NATS → Analytics → Dashboard chart | [ ] | M2 |
| E2E2 | Telemetry realtime | ESP → Module → NATS `mqtt.{id}` → WS → Dashboard live | [ ] | M2 |
| E2E3 | Control → ESP32 | Dashboard → Kong → Control → MQTT `actuator` → ESP → `/confirm` → Control acked | [ ] | M2 |
| E2E4 | Scheduler otomatis | Control scheduler trigger → publish set_output → ESP eksekusi | [ ] | M3 |
| E2E5 | Stream → ML → MinIO | Stream snapshot?detect → ML detect → bucket `ml-vision`/`stream` + DB detection | [ ] | M2 |
| E2E6 | Auth → RBAC → akses | login → token → route terlindungi + manajemen akun | [ ] | M1 |
| E2E7 | Emergency → Resume | Emergency Stop → semua OFF → Resume → mode pra-emergency pulih | [x] | M2 |

---

## 14. 🔜 Service Future / Belum Lengkap (Checklist)

| Service | Fase | Prioritas | Checklist impl. | Status |
|---------|------|-----------|-----------------|--------|
| OTA Service | 12 | ⬜ P4 | upload MinIO `ota`, trigger MQTT, tracking status, checksum SHA-256 | [ ] |
| Prometheus Metrics Svc | 13 | ⬜ P4 | sub `metrics.health`, aggregasi, `/metrics` | [ ] |
| Cloudflare Tunnel | 14 | ⬜ P4 | `cloudflared tunnel` → Kong, TLS, domain | [ ] |
| Webhook Service | — | ⬜ P4 | eksternal webhook + retry + `webhook.delivery` log | [ ] |

> **Catatan:** Alert Service, Notification Service, Audit Service, dan Export Service **SUDAH diimplementasikan & lulus API test** (lihat `roadmap.md` + `testing-plan-agent.md` §5/§6/§7/§10). Mereka dipindahkan ke section mandiri di bawah (§14a–§14d) dengan checklist manual di-reset ke `[ ]` menunggu validasi UI oleh User.

### 14a. ✅ Alert Service (sudah diimplementasikan — backend + infra)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| AL1 | List alerts | `GET /alerts` | filter node/metric/severity/status | [ ] | M2 |
| AL2 | Ack alert | `PUT /alerts/{id}/ack` (op/adm) | status `acked` + `acked_by` | [ ] | M2 |
| AL3 | Threshold CRUD | `GET/POST/PUT/DELETE /thresholds` (op/adm) | [ ] | M2 |
| AL4 | Evaluasi threshold | telemetry lewat threshold → alert | [ ] | M2 |
| AL5 | Publish `alert.triggered`/`resolved` | NATS | → Notification/WS | [ ] | M2 |
| AL6 | Cache invalidation | ubah threshold → eval pakai nilai baru | [ ] | M2 |
| AL7 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| AL8 | Prometheus `/metrics` | `GET /metrics` | naik | [ ] | M2 |
| AL9 | Dashboard: halaman ALERTS | tabel history + Thresholds tab | [ ] | M3 |
| AL10 | Dashboard: ack + filter + live | operator/adm bisa ack, filter, toggle live | [ ] | M3 |

> Backend sudah lulus API test (`testing-plan-agent.md` §5). Checklist manual di-reset `[ ]` menunggu validasi UI User.

### 14b. ✅ Notification Service (sudah diimplementasikan — backend)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| N1 | Get/put settings | `GET/PUT /notifications/settings` | PUT admin-only (403 viewer) | [ ] | M2 |
| N2 | Test send | `POST /notifications/test` | enqueue (admin) / 403 viewer | [ ] | M2 |
| N3 | Logs | `GET /notifications/logs` | + total | [ ] | M2 |
| N4 | Channel telegram/email/push | retry via queue saat gagal | [ ] | M2 |
| N5 | Subscribe `alert.*` | alert → +3 log | [ ] | M2 |
| N6 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| N7 | Dashboard: Notification Bell | `NotificationContext` consume WS `/ws/system-status` | [ ] | M4 |

> Backend sudah lulus API test (`testing-plan-agent.md` §7). Channel eksternal (Telegram/SMTP/Push) disimulasikan sukses di DevMode bila transport tak terkonfigurasi. Checklist manual di-reset `[ ]`.
>
> **Update (2026-07-16):** GAP-1 (WS `/ws/system-status`) SUDAH TERTUTUP di backend — handler `SystemStatus` di `services/wsgateway` terverifikasi (logs M11), publish `system.status` + `alert.triggered`/`alert.resolved` → client WS terima frame. Sehingga N7 (Notification Bell) kini memiliki sumber data WS nyata; uji di browser apakah `NotificationContext` merender notifikasi alert real-time. **Status item B1 (2026-07-16):** service `notification` SUDAH ditambahkan ke `docker-compose.yml` (bersama `export-service`, `mariadb-notification`, dan exporter terkonsolidasi) — kini jalan saat `docker compose up -d`. Redis dikonsolidasi ke `redis-shared` (ADR-004) dan exporter dikonsolidasi (ADR-005); lihat `docs/system-update.md`.

### 14c. ✅ Audit Service (sudah diimplementasikan — backend + infra)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| AU1 | Healthcheck | `GET /audit/health` | 200 | [ ] | M3 |
| AU2 | Subscribe `audit.log` | NATS Core, queue `audit-workers` | event `module.*`/`node.*`/`control.*`/`auth.*` masuk `audit_logs` | [ ] | M3 |
| AU3 | List logs (default) | `GET /audit/logs` | array + `total` | [ ] | M3 |
| AU4 | Filter by event | `GET /audit/logs?event=control.command.sent` | hanya event tsb | [ ] | M3 |
| AU5 | Free-text search | `GET /audit/logs?search=node_id` | payload LIKE match | [ ] | M3 |
| AU6 | Pagination | `?limit=&offset=` | slice sesuai | [ ] | M3 |
| AU7 | JWT required | `GET /audit/logs` tanpa token (via Kong) | 401 | [ ] | M3 |
| AU8 | Prometheus `/metrics` | `GET /audit/metrics` | `audit_http_requests_total` | [ ] | M3 |
| AU9 | Append-only | coba UPDATE/DELETE | tidak ada endpoint mutasi (immutable) | [ ] | M3 |
| AU10 | Event prefix filter | `GET /audit/logs?event=auth` | cocok `auth.login`, `auth.register`, dst (LIKE prefix) | [ ] | M3 |
| AU11 | Dashboard: buka halaman AUDIT | sidebar → `AUDIT` | tabel audit trail tampil, tidak error | [ ] | M3 |
| AU12 | Dashboard: filter & search | input event + search | request `?event=&search=` ke Kong, tabel ter-filter | [ ] | M3 |
| AU13 | Dashboard: pagination | ganti page size / Prev-Next | `offset` bergeser, `total` akurat | [ ] | M3 |
| AU14 | Dashboard: Live refresh | toggle Live | tabel refresh tiap 10s | [ ] | M3 |

> Dashboard halaman **Audit Log** (`/audit`, Fase 10) ✅ sudah diimplementasikan: `dashboard/src/components/Dashboard/Pages/Audit.jsx` + `api/audit.js`, di-wire ke Sidebar & DashboardLayout.

> Backend sudah lulus API test (`testing-plan-agent.md` §6). Checklist manual di-reset `[ ]` menunggu validasi UI User.

### 14d. ✅ Export Service (sudah diimplementasikan — backend)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| EX1 | Export telemetry CSV | `GET /export/v1/telemetry` | CSV valid + cursor pagination | [ ] | M2 |
| EX2 | Export nodes/alerts/commands | `GET /export/v1/nodes` dll | CSV/JSON | [ ] | M3 |
| EX3 | OpenAPI discover | `GET /export/v1/openapi` | JSON OpenAPI 3.0.3 | [ ] | M3 |
| EX4 | Time-range cap | `from` >366d | 400 | [ ] | M2 |
| EX5 | RBAC | viewer → 403, admin/operator → 200 | [ ] | M2 |
| EX6 | Rate-limit | >300/min | 429 | [ ] | M2 |
| EX7 | Healthcheck | `GET /health` | 200 | [ ] | M1 |
| EX8 | Dashboard: wire export ke UI | `src/api/export.js` + halaman | (GAP-3: belum di-UI) | [ ] | M3 |

> Backend sudah lulus API test (`testing-plan-agent.md` §10). Endpoint file export mengembalikan CSV murni + header `X-Export-Next-Cursor`. GAP-3: belum ada halaman UI (response wrapper sudah standar). Checklist manual di-reset `[ ]`.
>
> **Update (2026-07-16):** EX8 (wire export ke UI) masih terbuka — belum ada `src/api/export.js`/halaman. Service `export` SUDAH ada di kode & lulus tes, tapi **BELUM didefinisikan di `docker-compose.yml`** — harus di-add (lihat `docs/system-update.md` item B2). Endpoint `GET /export/v1/telemetry` sudah ter-route Kong (`/export` + `/analytics/export` → `export-upstream`).

> **Rekomendasi urutan pengujian fitur baru:** Audit (quick win) → Alert → Notification → Dashboard Alert/History → Export → OTA → sisanya P4.

### 14e. 🔔 Notification Bell & Real-time Alert (UI)

| # | Tes | Sumber | Ekspektasi | Status | Target |
|---|-----|--------|------------|--------|--------|
| NB1 | Bell terima notifikasi WS | `GET /ws/system-status?token=` (via `NotificationContext`) | alert/resolved frame muncul di bell | [ ] | M4 |
| NB2 | Badge increment saat triggered | Alert Service publish `alert.triggered` → WS | badge angka naik + dropdown item baru | [ ] | M4 |
| NB3 | Hilang/berubah warna saat resolved | publish `alert.resolved` → WS | item hilang atau warna berubah (resolved) | [ ] | M4 |
| NB4 | Dropdown list & baca | klik bell | daftar notifikasi terurut, tombol "mark read" | [ ] | M4 |

> **Catatan backend (GAP-1 ✅):** Handler `SystemStatus` (`/ws/system-status`) di `services/wsgateway` SUDAH tertutup di backend (terverifikasi `testing-plan-agent.md` §11, `logs.md` M11) — mempublikasikan `system.status` + `alert.triggered`/`alert.resolved` → client WS terima frame. Sumber data WS nyata sudah ada; uji di browser apakah `NotificationContext` merender notifikasi alert real-time & memperbarui bell. Lihat juga §14b (N7) & D9. Checklist manual di atas tetap `[ ]` menunggu validasi visual User.

### 14f. 📤 Export Data (UI)

| # | Tes | Endpoint | Ekspektasi | Status | Target |
|---|-----|----------|------------|--------|--------|
| EX9 | Halaman/modal export CSV | `GET /export/v1/telemetry` (via UI) | download file `.csv` valid (header + baris) | [ ] | M3 |
| EX10 | Filter node/metric/window | UI → query param node/metric/from/to | CSV ter-filter sesuai pilihan | [ ] | M3 |
| EX11 | Rate-limit 429 | request >300/min | response `429 Too Many Requests` | [ ] | M3 |
| EX12 | RBAC di UI | viewer klik Export | dialog/403 (viewer dilarang) | [ ] | M3 |

> **Catatan (GAP-3):** Backend Export Service SUDAH diimplementasikan & lulus API test (`testing-plan-agent.md` §10), endpoint `GET /export/v1/telemetry` sudah ter-route Kong. Namun **belum ada halaman/modal UI** — `src/api/export.js` belum ada (lihat §14d EX8). User perlu menguji visual setelah halaman export dibuat di dashboard. Checklist manual di atas tetap `[ ]` menunggu validasi visual User.

---

## 15. 🚀 Performance & Penetration (pakai `stress-test/`)

Jalankan dari `stress-test/` (`python3 cli.py <cmd>`). Trafik lewat Kong (`KONG_PUBLIC_URL`).

| # | Tes | Perintah | Metrik korelasi | Status | Target |
|---|-----|----------|-----------------|--------|--------|
| PERF1 | HTTP load | `loadtest` (load/soak/spike) | Prometheus before/after (`metrics.py`) | [ ] | M4 |
| PERF2 | WebSocket load | `wstest` | koneksi `/ws` stabil | [ ] | M4 |
| PERF3 | MQTT telemetry load | `mqtttest` | ingest Module tidak drop | [ ] | M4 |
| PERF4 | Pentest | `pentest` | lihat `report.py` (auth bypass, rate-limit, RBAC) | [ ] | M4 |
| PERF5 | Report | `report` | teks + JSON | [ ] | M4 |
| PERF6 | Bottleneck identifikasi | korelasi metrik | temukan hot-path (lihat audit fix Module N+1 & JetStream) | [ ] | M4 |

---

## 🎯 Target Pengujian (Timeline)

| Minggu | Fokus | Scope pengujian | Deliverable |
|--------|-------|----------------|-------------|
| **M1** | Auth + Module + Infra | A1–A22, M1–M19, SEC1, MSG1–4/7, OBS2, D1–D3/D11, E2E1/6 | Semua endpoint Auth & Module + onboarding device lulus |
| **M2** | Control + Stream + ML + WS + Analytics + Alert/Notification | C1–C27, S1–S16, V1–V19, W1–W9, AN1–AN12, SEC2–8/10, MSG5/8/9/11, AL1–AL8, N1–N6, D4–D9, E2E2–5/7 | Fitur inti operasional lulus + kontrak firmware valid |
| **M3** | Scheduler lanjut + Monitor + Observability | C14–C18, S11–S12, MO1–3, OBS1/OBS3–5, AN5–AN6, V16–V17 | Mode otomatis + monitoring container |
| **M4** | Security & Performance | SEC3–9, PERF1–6, W9, D9 | Pentest + load test + laporan bottleneck |

> **Kriteria kelulusan keseluruhan (dari planning "Kriteria Selesai"):**
> - Semua container `healthy` pasca `docker compose up -d` ✅
> - Tidak ada service akses DB service lain (cek env/network) ✅
> - End-to-end ESP→Module→NATS→WS→Dashboard ✅
> - Module→Analytics→Dashboard ✅
> - Control→ESP32 ✅
> - Stream→ML→MinIO ✅
> - Kong JWT validation semua protected routes ✅
> - WS Gateway JWT ✅
> - Unit test minimal 80% coverage per service (⚠️ belum ada test suite — usulkan tambah `go test`/`pytest` per service)

---

## 📌 Catatan & Known Issues (wajib diuji ulang bila di-fix)

1. **Module Core NATS disconnect** — `PublishLive` buang pesan diam-diam bila Core NATS putus; live monitor "loading". Mitigasi: `docker restart module`. Permanent fix: reconnect handler + health-check publish + WS replay payload terakhir. (M23, W6)
2. **`audit.log` sudah di-consume** — Auth & Module (dan Control) publish, kini di-consume oleh **Audit Service** (`services/audit`) → `mariadb-audit` (`audit_logs`). Data tidak lagi menumpuk sia-sia. Uji: `GET /audit/logs` via Kong. (MSG9, Audit Service §14 — ✅ backend)
3. **`system-status` WS (GAP-1) SUDAH terimplementasi di backend** — handler `SystemStatus` (`/ws/system-status`) di `services/wsgateway` sudah ada & terverifikasi lewat API test (`testing-plan-agent.md` §11): publish `system.status` + `alert.triggered` → WS client terima frame, `NotificationContext` dashboard menormalisasi payload. Sisa: GAP-2 (tambah `?token=` di `NodeDetailPanel`/`NodeConfigPage`, lihat W9/D8) menunggu perbaikan frontend + validasi UI User.
4. **Unit test belum ada** — roadmap target 80% coverage; belum ada `go test`/`pytest` di repo. Usulkan tambah sebelum M4.
6. **[DOC-SYNC 2026-07-16] Notification & Export service ada di kode & lulus API test, tapi BELUM di `docker-compose.yml`** — keduanya (`services/notification`, `services/export`) lulus tes via Kong (logs M7/M10) namun belum punya definisi service di `docker-compose.yml`, sehingga tidak jalan saat `docker compose up -d`. Action: lihat `docs/system-update.md` item B1/B2 (tambah `notification:` + `export-service:` + `REDIS_ADDR` ke instance Redis yang sesuai).

7. **[DOC-SYNC 2026-07-16] ADR-004 (Redis consolidation) & ADR-005 (Exporter consolidation) tertulis ✅ di `planning.md` tapi BELUM diterapkan di `docker-compose.yml`** — compose masih punya 4 Redis terpisah (`redis-module/alert/notification/export`) & 12 exporter terpisah. Pilih terapkan konsolidasi (disarankan) atau revert dokumen (lihat `docs/system-update.md` item C/D).

8. **[SECURITY OPEN] Mosquitto `allow_anonymous true` masih aktif** — `acl.conf` ter-comment; koneksi anonim diterima (logs Keamanan #1 berulang). Enforcement (`allow_anonymous false` + `password_file` + distribusi `MQTT_USER`/`MQTT_PASS`) ditunda karena butuh kredensial ke seluruh stack + firmware. `planning.md` Security table menandai MQTT ACL ✅ — harus diubah ke 🟡 (lihat `docs/system-update.md` item E1).

9. **[SECURITY OPEN] MinIO masih pakai root credential** — belum scoped access key per-service (planning klaim scoped). Open note di logs; ubah Security table ke 🟡 (item E1).

10. **[SECURITY OPEN] OTA firmware belum verifikasi signature** — `WebConfigPortal.cpp` `/api/ota` hanya cek `checkAuthToken()`, tidak verifikasi ED25519/ECDSA sebelum `Update.begin`. Catat di planning/roadmap (item E3).

5. **[FIXED 2026-07-14] Emergency stop "jalan/resume sendiri"** — Kolom `control_modes.mode` (dan `prev_mode`) hanya `varchar(8)`, sedangkan nilai `"EMERGENCY"` = 9 karakter. Saat Emergency Stop, `EnterEmergency` gagal dengan `Error 1406 (22001): Data too long for column 'mode'` (error di-log saja, tidak dipropagasi). Akibatnya mode tetap `AUTO`, scheduler **tidak pernah dijeda**, dan output (mis. `relay_pump`) dinyalakan lagi oleh schedule → tampak "resume/jalan sendiri" padahal belum di-resume. **Fix:** perlebar `mode`/`prev_mode` → `varchar(16)` di `services/control/migrate.go` + `ALTER TABLE control_modes MODIFY mode varchar(16)` untuk DB existing (AutoMigrate GORM tidak konsisten memperlebar kolom `NOT NULL DEFAULT`). Diverifikasi E2E: mode kini menjadi `EMERGENCY`, scheduler berhenti, pompa tetap OFF. **Race window ditutup:** guard `GetNodeMode` ditambahkan di `scheduler.Engine.dispatch` (`services/control/internal/scheduler/scheduler.go`) — setiap tick schedule di-skip bila node bukan `AUTO` (MANUAL/EMERGENCY), sehingga tick yang masih in-flight tidak bisa menyalakan output sebelum reconcile membatalkan runner. Diverifikasi E2E: setelah emergency, tidak ada satu pun perintah `source=schedule` yang ter-dispatch.

---

## 16. 🔁 Siklus Pengujian & Kesiapan Produksi

Pengujian tidak cukup sekali jalan. Untuk memastikan sistem **siap produksi** (production-grade) tanpa kekurangan, setiap checklist di atas harus dilewati dalam beberapa **siklus (pass)** berulang. Setiap siklus menambal celah yang ditemukan di siklus sebelumnya.

### Jumlah Perulangan (Siklus) yang Disarankan

| Siklus | Nama | Fokus | Kapan selesai |
|--------|------|-------|---------------|
| **Pass 1** | Smoke & Functional | Jalankan semua checklist M1–M4 sekali penuh; catat semua `[!]`/gagal & bug | Semua item minimal pernah dijalankan 1× |
| **Pass 2** | Fix & Re-test (regresi) | Perbaiki semua item gagal di Pass 1, lalu **ulangi hanya item yang gagal + item terkait** | Tidak ada item `[!]`/gagal tersisa |
| **Pass 3** | Stability / Soak | Ulangi E2E + load test (`stress-test/`) dalam durasi panjang (soak) & spike; cek leak/down | Tidak ada crash/regresi setelah beban berkelanjutan |
| **Pass 4** | Production Gate | Ulangi subset kritis (auth/RBAC, control→ESP, data integrity, security/pentest) di environment mirip produksi (Kong + TLS/Cloudflare bila ada) | Lulus semua gate di bawah |

> **Minimal 3 siklus penuh** (Pass 1–3) untuk fitur yang sudah jalan; **Pass 4 (Production Gate)** wajib sebelum rilis. Bila ada item berubah status `[!]`→lulus di Pass 3, wajib ada **Pass 3.5** (re-test cepat) untuk memastikan tidak ada regresi.

### Aturan Iterasi (Exit Criteria per Siklus)

- Setiap item yang gagal di satu siklus **harus** diuji ulang di siklus berikutnya (tidak boleh dilewati).
- Bila ditemukan bug baru saat re-test, catat di **Catatan & Known Issues** dan buka siklus tambahan.
- Deployment antar siklus direkomendasikan via **CI/CD** (GitHub Actions) agar hasil reproducible; hindari uji manual di container yang tidak deterministic.

### 🚦 Gate Kesiapan Produksi (Semua Harus ✅)

Sistem dinyatakan **SIAP PRODUKSI** hanya jika seluruh kondisi berikut terpenuhi setelah siklus pengujian selesai:

| # | Gate Produksi | Syarat Lulus |
|---|---------------|--------------|
| G1 | Functional completeness | 100% checklist fitur yang **sudah diimplementasikan** (bagian 1–13) berstatus `[x]` — tidak ada `[ ]`/`[!]` tersisa |
| G2 | No known defects | Tidak ada item berstatus `[!]` (known failed/bug) yang belum di-fix |
| G3 | Regression clean | Pass 2 & Pass 3 tidak mengembalikan bug lama (zero regression) |
| G4 | Security passed | SEC1–SEC10 lulus + `pentest` (`stress-test/`) tidak ada temuan kritis/tinggi |
| G5 | Performance passed | `loadtest`/`wstest`/`mqtttest` stabil; tidak ada bottleneck/5xx berlebih di bawah beban target; metrik Prometheus sehat |
| G6 | Resilience | Container `healthy` setelah restart; JetStream replay (`telemetry.batch`) terbukti; WS tidak "loading" setelah reconnect module |
| G7 | RBAC enforced | Tidak ada route mutasi yang bisa diakses role di bawahnya (viewer diblokir) |
| G8 | Data integrity | TimescaleDB/Redis/MinIO konsisten; retention & backup (dump SQL → MinIO/cloud) terverifikasi |
| G9 | Observability | Semua target Prometheus UP; Grafana service-health tampil; audit trail (bila Audit Svc sudah ada) tercatat |
| G10 | Test coverage | Unit test tersedia dengan minimal 80% coverage per service (sesuai roadmap) — bila belum ada, ini **blocker** produksi |
| G11 | Documentation | `testing-implementasi-manual.md`, `roadmap.md`, `planning.md` sinkron dengan state kode terakhir |

### Deklarasi Produksi

```
STATUS: [ ] BELUM SIAP  /  [ ] SIAP PRODUKSI (SELESAI)
Tanggal deklarasi: ____-____-____
Siklus terakhir lulus: Pass ___
Daftar kekurangan tersisa (jika ada): ___________________________________
Ditandatangani (tester): __________________
```

> **Catatan:** Service yang **belum diimplementasikan** (bagian 14: OTA, Prometheus Metrics, Cloudflare Tunnel, Webhook) bukan bagian dari gate produksi fitur inti, tetapi harus dicatat sebagai *known limitations* pada saat deklarasi produksi. Alert, Notification, Audit, dan Export **SUDAH diimplementasikan** (lihat §14a–§14d) dan backend-nya lulus API test; checklist manual di-reset `[ ]` menunggu validasi UI User. Sistem tetap bisa dinyatakan "siap produksi" untuk fitur yang sudah ada, dengan catatan limitation tersebut.
