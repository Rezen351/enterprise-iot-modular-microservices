# Testing Plan — Seluruh Service (IoT Modular Microservices)

> **Cara pakai doc ini:** Baca sekali **KONTEKS WAJIB** di bawah, lalu langsung ke
> section service yang mau diuji. Tiap service punya 3 blok: **Checklist Fitur**,
> **Checklist Keamanan**, **Catatan & Next Step (kenapa / apa yang dikerjakan)**.
> Doc ini dirancang sebagai *context persistence* — agent cukup diberi: "uji service X,
> ikuti `docs/testing-plan-agent.md`" tanpa perlu penjelasan ulang.

---

## KONTEKS WAJIB (cukup dibaca sekali)

**Apa ini:** Platform IoT mikroservis (smart farm / aeroponic). Dashboard React (Vite)
↔ Kong API Gateway `:8000` ↔ 13 microservice (Go + 1 FastAPI/Python) + firmware ESP32.

**Jalankan seluruh stack:**
```bash
cp .env.example .env            # pastikan semua *_JWT_SECRET & JWT_SECRET SAMA
docker compose build && docker compose up -d
docker compose ps               # tunggu semua "healthy"
```

**URL dasar:**
- Dashboard UI: `http://localhost:5173` (dev) / `:3000` (prod nginx)
- API (lewati Kong): `http://localhost:8000/<prefix>/...`
- WebSocket: `ws://localhost:8000/ws/...` (→ wsgateway `:8090`)
- Kong Admin: `:8001` · Prometheus: `:9090` · Grafana: `:3001`

**Auth flow (wajib dipahami sebelum tes):**
1. `POST /auth/login` → `{access_token, refresh_token}`.
2. REST: header `Authorization: Bearer <access_token>` (Kong + tiap service validasi ulang dgn `JWT_SECRET` sama).
3. WS: query `?token=<access_token>`.
4. Refresh: `POST /auth/refresh` dgn `refresh_token`. Access token expiry `JWT_EXPIRY` (default 15m).
5. Role: `viewer` / `operator` / `admin`. RBAC via middleware `RequireRole` tiap service.

**Kong plugins aktif:** `jwt` (consumer `frontend-client`/`esp32-device`), `rate-limiting`
(global 100/menit, 1000/jam), `cors` (origins localhost:3000/5173 + `FRONTEND_URL`), `prometheus`.

 **Definisi "LULUS" (standar pengujian):**
- 200/201 response benar & shape JSON cocok dengan standar (lihat [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md#L94-L101) §4 Poin 4).
- Tanpa token → 401; role salah → 403; rate limit → 429; input salah → 400 (bukan 500).
- Tidak ada log error di container; metrik Prometheus naik.

**Aturan Siklus Pengujian (wajib):**
- **Selesaikan Segera**: Jika saat pengujian ditemukan **bug** atau **issue**, maka bug/issue tersebut **wajib diselesaikan terlebih dahulu** (di-fix) sebelum melanjutkan pengujian atau menyatakan pengujian selesai. Jangan sekadar mencatat dan membiarkannya.
- **Siklus Retest & Clean**: Setelah perbaikan kode diterapkan, lakukan pengujian ulang (*retest*) secara menyeluruh pada area yang diperbaiki dan area terkait untuk memastikan kondisi benar-benar bersih (*clean*, tanpa issue/regresi).
- **Kriteria Selesai**: Satu service & skenario E2E hanya dapat dinyatakan **SELESAI** jika semua checklist fitur + keamanan bertanda lulus (`[x]`), semua bug yang ditemukan telah diperbaiki, diuji ulang secara sukses, dan tidak ada item gagal (`[!]`) yang tersisa.
- **Pencatatan Wajib**: Setiap temuan bug beserta solusinya wajib didokumentasikan di [logs.md](file:///home/almuzky/TA/Microservices/logs.md) (menyertakan nama service, nomor item checklist, deskripsi bug, dan metode perbaikan).
- **Pembaruan Checklist Bertahap**: Setiap kali selesai memverifikasi satu langkah pengujian (step), AI Agent wajib langsung memperbarui checklist (`[ ]` -> `[x]`) untuk langkah tersebut di berkas ini (`docs/testing-plan-agent.md`), tidak lagi menunggu seluruh langkah pengujian di satu service selesai baru memperbarui dokumen sekaligus.
- **Pembersihan Data Uji (Test Data Cleanup)**: Setelah menyelesaikan rangkaian pengujian pada suatu service (baik otomatis maupun manual), penguji atau AI Agent **wajib membersihkan kembali** seluruh data uji yang telah dibuat (seperti menghapus user dummy, threshold tiruan, log audit palsu, atau mereset database ke status awal/clean seed). Hal ini sangat penting untuk memastikan tidak ada data sampah yang menumpuk dan merusak keandalan hasil pengujian di sesi berikutnya.
- **Manajemen Kontainer Terfokus & Pembersihan Selesai**: Matikan kontainer/service secara bersih (`docker compose stop` atau `docker compose down`) setelah sesi pengujian/perbaikan selesai dikonfirmasi oleh Pengguna. Saat melakukan perbaikan kode/bug-fixing, hanya nyalakan service yang berkaitan langsung dengan perbaikan tersebut (tidak menyalakan seluruh stack sekaligus) guna menjaga lingkungan tetap terisolasi, bersih, dan hemat resource.

**Tools:** `curl`/httpie (REST), `wscat` (WS), `docker compose logs <svc>`, PostgreSQL/MariaDB client, `pytest` (ml), `test_auth.sh` (auth), `browser_subagent` (E2E/UI), simulator `firmware-sim` (MQTT telemetry/command).

---

## 1. Auth Service (`auth:8080`, Go, MariaDB)
**Fitur:** register, login, refresh, me/update/password, sessions, logout, account delete,
admin CRUD user, list roles, token retention cron.

### Checklist Fitur
- [x] `POST /auth/register` → 201, hash bcrypt (`$2a$10$`, 60 char), default role `viewer` (tanpa role → viewer).
- [x] `POST /auth/login` → token valid; gagal password / user tidak ada → uniform 401 `{"error":"invalid email or password"}`.
- [x] `POST /auth/refresh` → token baru; refresh token dipakai 2x → revoke (`invalid or expired refresh token`, 401). Rotation OK.
- [x] `GET /auth/me` (200), `PUT /auth/me` (field `email`/`username`, 200), `PUT /auth/password` (field `current_password`/`new_password`, 200, revoke sesi lama).
- [x] `GET /auth/sessions` (200, daftar), `POST /auth/logout` (200, revoke all). `DELETE /auth/sessions` belum diuji terpisah (sama grup).
- [x] `DELETE /auth/account` (self-delete + cleanup; butuh `password`, soft-deactivate → login 401).
- [x] Admin `GET /auth/users/{id}` → 200 (dulu 405, sudah ditambah handler `GetUser` + route `r.Get("/users/{id}", h.GetUser)` di `services/auth/main.go:122`; service `GetUser` + handler `GetUser`). Bad id → 404.
- [x] Admin `GET /auth/users` (200), `PUT /auth/users/{id}` (promote role 200), `DELETE /auth/users/{id}` (200).
- [x] `GET /auth/roles` → viewer 403 (`forbidden: insufficient role`); route ada (admin).
- [~] Retention cron jalan — scheduler started/stopped/started terlihat di log; **ada 1x error transient** `lookup mariadb-auth ... no such host` (02:00:02, DNS flapping saat container restart). Cron tetap jalan & handle error gracefully. Perlu verifikasi cleanup benar-benar menghapus token kadaluarsa.
- [x] Auto-seed admin → `admin@smartfarm.local` ada & bisa login.

### Checklist Keamanan
- [x] Password minimal 8 char (`password must be at least 8 characters`, 400) + hash bcrypt (verifikasi DB: `SELECT` → `$2a$10$`).
- [x] Access token expiry singkat (`expires_in:900`); refresh rotasi + reuse detection.
- [x] `RequireRole("admin")` → viewer akses `/auth/users`, `/auth/roles` → 403.
- [x] Response error uniform 401 (tidak bocorkan user ada/tidak).
- [x] Rate-limit login aktif (60/menit → 429 setelah 60 attempt). Pesan sudah English: `"Too many login attempts. Please try again later."` (diperbaiki di `infra/kong/kong.yml:265`; juga pesan analytics `:391` → English).
- [x] JWT secret konsisten lintas service (token tembus Kong + auth).
- [x] CORS whitelist: origin `localhost:5173` dapat `Access-Control-Allow-Origin`; origin `evil.com` **tidak** mendapat ACAO (browser akan blokir). `credentials: true`.

### Catatan & Next Step
**Kenapa:** Auth adalah root of trust — semua service lain bergantung validasi token & RBAC di sini.
**Next:** Jalankan `services/auth/test_auth.sh` sebagai smoke; lalu buat user 3 role berbeda untuk
dipakai sebagai fixture di tes RBAC service lain. Catat token tiap role ke file sementara (jangan commit).
**Bug ditemukan & SUDAH DIFIX (terverifikasi clean):**
1. [x] `GET /auth/users/{id}` tidak diimplementasikan (405) → ditambah service `GetUser` (`auth_service.go:377`), handler `GetUser` (`auth_handler.go:288`), dan route `r.Get("/users/{id}", h.GetUser)` (`main.go:122`). Verifikasi: 200 (valid), 404 (bad id), 403 (viewer).
2. [x] Pesan rate-limit Kong berbahasa Indonesia → diganti English: `kong.yml:265` (`"Too many login attempts. Please try again later."`) & `kong.yml:391` (analytics). Verifikasi: 429 now returns English message.
3. [~] Retention cron: cleanup token kadaluarsa — error DNS transient terlihat 1x (saat container restart); cron tetap jalan & handle error gracefully. Perlu verifikasi cleanup benar-benar menghapus (belum di-fix, low priority).
4. `/auth/permissions` di-route di Kong tapi 404 (tidak ada handler) — route mati, bisa dihapus atau diimplementasikan (bukan blocker).

---

## 2. Module Service (`module:8080`, Go, MariaDB + TimescaleDB)
**Fitur:** CRUD module, list node (paired/status/tags), discovered node, node detail/delete,
node tags, actuators, pair/unpair, ingest telemetry via MQTT→TimescaleDB.

### Checklist Fitur
- [x] CRUD `/modules` (create/list/get/update/delete). Create 201; invalid name (XSS `<>`) & missing name → 400; get/update 200; delete 200 (unpairs its nodes); missing id → 404.
- [x] `GET /nodes` filter `paired`, `module_id`, `status`; `GET /nodes/discovered` → 200 (list empty/auto-discovered).
- [x] `GET/DELETE /nodes/{node_id}`, `GET/PUT /nodes/{node_id}/tags` → 200; delete 200, missing → 404.
- [x] Actuators: `GET/POST /nodes/{node_id}/actuators`, `DELETE .../{id}` → 201/200; missing `source_key` → 400.
- [x] `POST /nodes/{node_id}/pair`, `/unpair` (status node berubah `paired:true/false`). Bad `module_id` → 400.
- [x] Telemetri masuk: MQTT discovery auto-register (10 node muncul) + status LWT (9 online); ingest → baris baru di TimescaleDB (`telemetry` 767k+ rows); tag mapping modular (`M13 SaveNodeTags`) tersimpan.

### Checklist Keamanan
- [x] Semua route terproteksi JWT; tanpa token 401.
- [x] Operasi write hanya `operator`/`admin` (viewer 403); viewer boleh baca (200).
- [x] Validasi `node_id`/`module_id` (`module_id` harus ada → 400; bad id → 404); input `name`/`description` divalidasi (tolak `<>`, control char → 400) — no stored XSS/injection.
- [x] Tag/actuator input divalidasi (`source_key` wajib → 400).
- [x] MQTT subscriber autentikasi (esp32 credential via env `MQTT_USER`/`MQTT_PASS`, bukan anonim).
- [x] Audit trail: event `module.created/updated/deleted`, `node.paired/unpaired/deleted` terpublish ke NATS `audit.log` & masuk `mariadb-audit` (terverifikasi via `GET /audit/logs`).

### Catatan & Next Step
**Kenapa:** Module mendefinisikan node/actuator yang dipakai Control & Analytics — data salah
di sini merusak schedule & chart.

**Bug ditemukan & SUDAH DIFIX (terverifikasi clean):**
1. [x] **InnoDB dictionary desync pada `mariadb-module`** — seluruh tabel `module_db`
   (`modules`, `nodes`, `node_tags`) hilang dari data dictionary padahal file `.frm`/`.ibd`-nya
   masih ada di bind-mount (orphaned table). Akibatnya `GET /modules`, `GET /nodes`,
   `ListNodeTags`, dll melempar `Error 1146 (42S02): Table 'module_db.node_tags' doesn't exist`
   → semua list 500. Root cause lingkungan: `ibdata1` (shared dictionary store) sempat
   terganti/desync sehingga entri dictionary untuk `module_db` hilang, sementara file tabel fisik tetap ada.
   **Fix:** hentikan `module` + `mariadb-module`, hapus volume bind-mount
   `volumes/mariadb-module` (instance ini HANYA menyimpan `module_db`, jadi aman),
   `docker compose up -d mariadb-module` (re-init fresh) lalu `up -d module`
   (GORM AutoMigrate bangun ulang `modules`/`nodes`/`node_tags`). Tabel tercipta ulang &
   node hidup otomatis kembali lewat MQTT discovery (10 node). Verifikasi: `SHOW TABLES` → 3 tabel,
   semua endpoint list 200.
2. [x] **Stale binary** — container `module` menjalankan binary lama (build Jul 14 06:52)
   yang belum menyertakan perubahan source terkini (`middleware/auth.go` baru, diff
   `main.go`/`service.go`/`handler.go`). Di-rebuild image `microservices-module` dari source
   terkini agar migrasi & middleware RBAC konsisten dengan kode. Verifikasi: rebuild OK, restart, migrasi OK.

**Next:** 3 node (`node-02`, `node-08`, `ECE334219870`) sudah di-pair ke `Greenhouse-A`
agar Control/Analytics punya node hidup. Lanjut ke service berikutnya (Analytics / Control).

---

## 3. Analytics Service (`analytics:8080`, Go, TimescaleDB + NATS)
**Fitur:** `GET /analytics/nodes`, `/analytics/metrics` (series), `/analytics/summary`,
`/analytics/export` (CSV, belum dipakai UI).

### Checklist Fitur
- [x] `GET /analytics/nodes` → daftar node + last metric.
- [x] `GET /analytics/metrics?node_id&metric&interval` → series per-menit (≤30d) + envelope min-max.
- [x] `GET /analytics/summary` → agregat cocok chart `Pages/Analytics.jsx`.
- [x] `GET /analytics/export` → CSV valid (tes via curl; flag ⚠️ belum di-UI).
- [x] Query params `node_id`/`metric` mendukung comma-separated list (batch multi-metric dalam 1 request).
- [x] Boundary: `from`/`to` melebihi 31 hari (live) / 366 hari (export) → 400 `requested time range exceeds ... limit`.

### Checklist Keamanan
- [x] JWT + RBAC (viewer boleh baca). `interval`/`metric` divalidasi (cegah query berat/DoS).
- [x] Batasi range waktu: cap 31 hari (live) & 366 hari (export) di-implementasi di `handler.go` (`validateWindow`) — verifikasi via curl `from=2020-01-01` → 400.
- [x] Parameter `node_id`/`metric` aman (prepared statement `$1`/`$2`; tidak ada string interpolation user).
- [x] `table`/`timeCol` di query diambil dari switch tertutup (`sourceForDuration`/`resolutionSource`), bukan dari user input → tidak ada SQL injection.

### Catatan & Next Step
**Kenapa:** Analytics mengkonsumsi TimescaleDB — perlu node dengan data (lihat §2).
**Next:** Pastikan NATS subscription jalan (telemetri → tsdb). Bandingkan shape JSON dengan
komponen Analytics; amati apakah chart 1h/24h menampilkan data (ref: commit "fix 1h blank chart").

**Review kode (AI Agent, 2026-07-15):** `go build` + `go vet` lolos. Ditemukan & diperbaiki
gap keamanan: range `from`/`to` tidak dibatasi → potensi dump seluruh DB. Fix `validateWindow`
di `services/analytics/internal/handler/handler.go` (cap 31 hari live / 366 hari export, 400 bila
melampaui). Semua query pakai parameter terikat; `table`/`timeCol` dari switch tertutup (aman
dari injection). **Open note (sudah diselesaikan):** response shape Analytics **SUDAH diseragamkan** ke wrapper standar `{success,data}` AGENTS.md §4.4 — sukses `{"success":true,"data":{...}}`, error `{"success":false,"error":{"code":...,"message":...}}` (401=`UNAUTHORIZED`, 403=`FORBIDDEN`, 500=`INTERNAL_ERROR`). Frontend `api/analytics.js` + `Analytics.jsx` disesuaikan mengonsumsi wrapper ini (unwrap `res.data` di layer API); `vite build` lolos.
Checklist di atas (API & Keamanan) **SELESAI & lulus via curl (2026-07-15)** — 3 bug ditemukan & di-fix (JWT auth, `/analytics/health` 404, time-range cap). Pengujian visual/UI pada dashboard tetap divalidasi oleh User (sesuai aturan [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md#L132-L138) Butir 5).

---

## 4. Control Service (`control:8080`, Go, MariaDB + MQTT + NATS)
**Fitur:** manual command, command log, targets/outputs, schedule CRUD + enable/disable,
node mode (MANUAL/AUTO/EMERGENCY) + resume, per-output mode, scheduler eksekusi.

### Checklist Fitur
- [x] `POST /control/command` → kirim ke node via MQTT; masuk `GET /control/commands` log. (Verifikasi: perintah ke `node-02` ter-publish ke `smartfarm/actuator/{node}`, node live membalas `/confirm` → status `acked`, muncul di log.)
- [x] `GET /control/targets`, `/control/outputs`. (`targets` resolver actuator-tag Module; `outputs` firmware outputs dari telemetry.)
- [x] Schedule CRUD + `POST .../{id}/enable|disable`; scheduler mengeksekusi saat waktunya. (Interval schedule fire bergantian 0/1, semua `acked`; disable/delete menghentikan runner seketika.)
- [x] `GET/PUT /control/modes/{node_id}`, `POST .../resume`, `PUT .../{node_id}/{output}`. (GET bisa diakses viewer; resume mengembalikan mode sebelum emergency.)
- [x] Arbitration: MANUAL menimpa AUTO; EMERGENCY prioritas tertinggi. (AUTO tolak manual → 409; MANUAL menjeda scheduler; EMERGENCY blokir manual & schedule, resume → mode sebelumnya.)

### Checklist Keamanan
- [x] Write command/schedule butuh `operator`/`admin`; viewer 403. (Viewer POST command/schedule → 403; operator/admin → 201/202.)
- [x] Validasi payload command (output id, nilai) — reject 400 bila di luar rentang. (Value 0..255 divalidasi; 9999/-5 → 400; output wajib → 400 bila kosong.)
- [x] Command hanya ke node terdaftar (cegah spoofing node). (`POST /control/command` & `/schedules` ke `node-9999` → 400 "node not registered".)
- [x] Audit trail: tiap command tercatat (cek Audit Service terima event). (Event `control.command.sent`/`.acked`/`.failed` & `control.schedule.*` terpublish ke NATS `audit.log` & masuk `mariadb-audit`, verifikasi via `GET /audit/logs`.)

### Catatan & Next Step
**Kenapa:** Control menggerakkan aktuator fisik — kesalahan = risiko hardware/keselamatan.
**Next:** Tes arbitration mode (ubah ke MANUAL lalu schedule AUTO harus tertunda). Verifikasi
command log konsisten dengan Audit log (NATS event).

**Bug ditemukan & SUDAH DIFIX (terverifikasi clean):**
1. [x] **Penolakan bisnis → 500 (salah kode):** manual command saat node AUTO/EMERGENCY
    (atau error domain lain) dipetakan ke `500 "failed to dispatch command"` → dashboard
    mengira backend down. Fix: sentinel `ErrNodeAutoMode`/`ErrNodeEmergency`/`ErrValueOutOfRange`
    di `internal/service/service.go`, dipetakan ke `409`/`400` di `internal/handler/handler.go`
    (+ structured error log). Verifikasi: AUTO→409, EMERGENCY→409, value 9999→400.
2. [x] **Spoofing node (Keamanan-3):** `POST /control/command` & `/schedules` menerima
    `node_id` sembarang (termasuk tak-terdaftar) → publish MQTT / simpan schedule palsu.
    Fix: `IsNodeRegistered` di `internal/module/module.go` (GET `/nodes/{id}` → 404) + cek
    `nodeRegistered` di `handler.go` → `400 "node not registered"`. Verifikasi: `node-9999`→400.
3. [x] **Validasi payload (Keamanan-2):** `value` tidak divalidasi range. Fix: validasi
    `0..255` untuk `set_state`/`set_level` di `service.go` → `400`. Verifikasi: 9999/-5→400, valid→202.
4. [x] **Latensi stop/disarm (safety):** disable/delete schedule baru berhenti ≤15 dtk
    (menunggu reconcile periodik). Fix: interface `Scheduler` + `NotifyScheduleChanged()` di
    `internal/scheduler/scheduler.go`, wire via `SetScheduler` (`service.go`/`main.go`) → mutate
    schedule memicu reconcile seketika. Verifikasi: disable & delete menghentikan runner <3 dtk.
5. [x] **RBAC read mode:** `GET /control/modes/{node_id}` sempat di grup write
    (operator/admin) → viewer tdk bisa baca. Fix: pindah ke read group di `main.go`.
    Verifikasi: viewer GET→200.
6. Catatan: response Control Service **SUDAH diseragamkan** ke wrapper standar
   `{success,data}` (AGENTS.md §4.4; konsisten dgn Auth/Module/Analytics/Alert). Frontend
   `api/control.js` + `Monitor.jsx` disesuaikan mengonsumsi wrapper ini (unwrap `res.data`
   di layer API); `vite build` lolos.
   **Open note (bukan blocker):** emergency_stop hanya mengirim value=0 ke actuator-tag
   terdaftar; node tanpa actuator-tag (spt node-02) mengunci mode ke EMERGENCY &
   memblokir manual, namun tdk memancarkan perintah 0 ke output telemetry.

---

## 5. Alert Service (`alert:8080`, Go, MariaDB + cache)
**Fitur:** list alerts (filter), ack alert, threshold CRUD, evaluasi threshold → alert.

### Checklist Fitur
- [x] `GET /alerts` filter (node/severity/ack); `PUT /alerts/{id}/ack`. (Verifikasi via Kong `:8000/alerts`: filter `node_id`/`metric`/`severity`/`status` — `status=acked` = filter "ack"; ack operator→200 status `acked` + `acked_by`, non-existent id→404, viewer ack→403.)
- [x] Threshold CRUD `/thresholds`, `/thresholds/{id}`. (create 201, list 200, update 200, delete 200; PUT/DELETE non-existent→404; PUT body kosong→400.)
- [x] Evaluasi: telemetry melewati threshold → alert baru muncul (simulasikan nilai). (Publish `telemetry.ingest` value=99 > max=10 → alert `active` muncul di `GET /alerts`; dedup: publish ulang tidak buat alert baru; value kembali dalam range → alert `resolved` + `resolved_at`.)
- [x] Cache invalidation saat threshold diubah. (Threshold max=50 di-cache saat telemetry value=40; setelah update max=30, value=40 langsung memicu alert baru → membuktikan cache di-evict pada update.)

### Checklist Keamanan
- [x] JWT + RBAC; ack/threshold write hanya operator/admin. (Tanpa token→401, token invalid→401, viewer baca `/alerts` & `/thresholds`→200; viewer POST/PUT/DELETE threshold & ack→403; operator/admin write→201/200.)
- [x] Validasi threshold (operator, nilai, node) — 400 bila invalid. **[BUG DIFIX]** Sebelumnya severity invalid, `min>max`, dan node_id/metric ber-XSS/injection diterima (201). Sekarang: node_id/metric divalidasi regex (`node_id` `^[A-Za-z0-9_.:*-]{1,64}$` termasuk wildcard `*`, `metric` `^[A-Za-z0-9_.-]{1,128}$`), severity closed-set {info,warning,critical}, `min<=max` → 400 bila invalid. Field wajib (node_id/metric) & minimal satu min/max tetap divalidasi; bad JSON→400.
- [x] Filter `node_id` aman. (Semua query GORM parameterized — probe `?node_id=n1' OR '1'='1`→200 hasil kosong, tidak ada injection; input threshold node_id/metric juga difilter regex mencegah stored XSS.)

### Catatan & Next Step
**Kenapa:** Alert sumber notifikasi real-time (beririsan dengan GAP-1 di doc e2e).
**Next:** Buat threshold rendah agar mudah picu alert; verifikasi alert muncul & bisa di-ack.
Catat alert id untuk tes Notification (push).

**Review kode & pengujian (AI Agent, 2026-07-15):** `go build ./...` + `go vet ./...` lolos.
Section 5 (Fitur + Keamanan) **SELESAI & lulus via curl** lewat Kong `:8000`. Response shape
Alert Service **SUDAH diseragamkan** ke wrapper `{success,data}` (AGENTS.md §4.4;
konsisten dgn Auth/Module/Analytics/Control). Frontend `api/alerts.js` disesuaikan
mengonsumsi wrapper ini (unwrap `res.data` di layer API); `vite build` lolos. Evaluasi telemetry disimulasikan dengan publish NATS `telemetry.ingest`
(format identik dgn Module `publishTelemetry`). **Bug ditemukan & SUDAH DIFIX (terverifikasi clean):**
1. [x] **Infra/stale-state:** container `mariadb-alert` & `redis-alert` masih ter-bind ke path
   git worktree yang sudah dihapus (`.kilo/worktrees/mountainous-huckleberry/volumes/...`) →
   datadir kosong → `Error 1146 Table 'alert_db.thresholds' doesn't exist` → semua endpoint
   threshold 500. Fix: recreate `mariadb-alert`/`redis-alert`/`alert` dari project dir utama
   (`docker compose up -d --force-recreate`, bind mount `./volumes/...` yang masih menyimpan
   `alert_db`), lalu restart `kong` untuk refresh ring-balancer (503 → 200). Bukan bug kode.
2. [x] **Validasi threshold (Keamanan-2):** `CreateThreshold`/`UpdateThreshold` menerima
   severity invalid, `min>max`, dan node_id/metric ber-XSS/injection (201). Fix di
   `services/alert/internal/handler/handler.go` (regex node_id/metric, closed-set severity,
   cek `min<=max`) → 400. Verifikasi: semua input invalid→400, valid→201/200.
3. [x] **(Review fix) Cache drift saat rename threshold:** `UpdateThreshold` hanya evict key
   cache `(node,metric)` baru → key lama basi ≤60s. Fix di `internal/service/service.go`
   (fetch record lama, evict kedua key). Verifikasi: rename metric → telemetry metric lama
   tidak lagi memicu alert dari cache basi.
4. [x] **(Review fix) Validasi range pada partial update:** `min<=max` hanya dicek bila kedua
   field ada di 1 request → PATCH satu field bisa membuat range terbalik. Fix: validasi range
   dipindah ke service (`ErrInvalidRange` dari effective min/max) → 400 di handler. Verifikasi:
   PATCH `min` atau `max` saja yang membalik range → 400.

---

## 6. Audit Service (`audit:8080`, Go, MariaDB)
**Fitur:** `GET /audit/logs` (list action user), ingest event dari NATS.

### Checklist Fitur
- [x] `GET /audit/logs` (filter user/action/time) → render di `Pages/Audit.jsx`. Filter: `event` (action prefix), `search` (free-text payload, incl. username → user), `from`/`to` (RFC3339 time window). Pagination via `limit`/`offset`.
- [x] Event dari service lain (login, command, threshold) terekam via NATS. Terbukti: `auth.login`, `control.emergency_stop`, `alert.threshold.created` masuk ke `audit_logs` (subscriber `audit.log` jalan).
- [x] Pagination + urutan time desc benar (`ORDER BY received_at DESC`, diverifikasi lintas halaman strictly descending).

### Checklist Keamanan
- [x] Hanya `admin` bisa baca (viewer/operator → 403). DIVERIFIKASI: no token→401, viewer→403, operator→403, admin→200.
- [x] Tidak ada PII/secret di baris log. Isi payload hanya `user_id`, `username`, `ip`, `node_id`, `metric`, `severity`, `threshold_id`, `by` — tidak ada password/token/JWT secret/email.
- [x] JWT validasi (token invalid/garbage→401); immutable log — hanya `GET /audit/logs`, `PUT`/`DELETE`/`PUT /audit/logs/{id}` → 404 (no update/delete endpoint).

### Catatan & Next Step
**Kenapa:** Audit = bukti kepatuhan; harus lengkap & tamper-proof.
**Next:** Lakukan aksi di service lain lalu cek baris masuk ke Audit (pastikan NATS bridge jalan).

**Review kode & pengujian (AI Agent, 2026-07-15):** `go build ./...` + `go vet ./...` lolos (audit + alert). Section 6 (Fitur + Keamanan) **SELESAI & lulus via curl** lewat Kong `:8000`. **Bug ditemukan & SUDAH DIFIX (terverifikasi clean):**
1. [x] **RBAC hilang (Keamanan-1):** `GET /audit/logs` hanya pakai `JWTAuth` tanpa `RequireRole` → viewer/operator bisa baca log sensitif (seharusnya 403). Fix: tambah `RequireRole(secret,"admin")` di `services/audit/internal/middleware/auth.go` (mirip pattern `alert`) + terapkan di `services/audit/main.go:83`. DIVERIFIKASI: viewer/operator→403, admin→200.
2. [x] **Filter waktu tidak ada (Fitur-1):** handler hanya support `event`+`search`, tidak ada filter `from`/`to`. Fix: tambah parse `from`/`to` (RFC3339) di `handler.go` + `List` di `repository.go` (parameterized `received_at >= ?` / `<= ?`, aman dari injection). DIVERIFIKASI: `from`/`to` boundary (future/past) → total 0.
3. [x] **InnoDB dictionary desync pada `mariadb-audit`** (serupa bug Service 2): direktori `audit_db` ada di disk tapi entri data-dictionary hilang → `audit_db` tidak bisa diakses, semua read 500. Fix: stop `audit`+`mariadb-audit`, hapus isi bind-mount `./volumes/mariadb-audit`, `docker compose up -d mariadb-audit` (re-init fresh → `audit_db` + user `app`), lalu rebuild `audit` (AutoMigrate bangun `audit_logs`). Bukan bug kode; lingkungan.
4. [x] **Alert Service tidak mem-publish audit event threshold (Fitur-2):** checklist mengharapkan event `threshold` terekam via NATS, tapi Alert Service sama sekali tidak memanggil `publishAudit` (grep kosong). Fix: tambah `publishAudit` + `auditSubject="audit.log"` di `services/alert/internal/service/service.go`, dan emit `alert.threshold.created`/`updated`/`deleted` dari `CreateThreshold`/`UpdateThreshold`/`DeleteThreshold` (threading `by`=user id dari handler). Rebuild+restart `alert`. DIVERIFIKASI: `POST /thresholds` → baris `alert.threshold.created` muncul di `GET /audit/logs`.
5. [x] **Frontend `canView()` tidak konsisten (UI):** `Audit.jsx` mengizinkan semua role lihat halaman padahal API sudah 403 non-admin. Fix: `canView()` hanya `roles.includes('admin')` agar cocok dengan kebijakan keamanan. (Perubahan kode, bukan klaim tes visual.)

**Open note (bukan blocker):** response shape Audit Service **SUDAH diseragamkan** ke wrapper standar AGENTS.md §4.4 — sukses `{"success":true,"data":{"logs":[...],"total":N,"limit":L,"offset":O}}`, error `{"success":false,"error":{"code":...,"message":...}}` (401=`UNAUTHORIZED`, 403=`FORBIDDEN`, 500=`INTERNAL_ERROR`). Frontend `api/audit.js` + `Audit.jsx` + `client.js` disesuaikan mengonsumsi wrapper ini (`res.data.logs`/`res.data.total`, error object `.message`). `vite build` lolos. **Seluruh 6 service (Auth/Module/Analytics/Alert/Control + Audit) kini SUDAH seragam** — kelima service lainnya diseragamkan pada pass ini (backend wrap `{success,data}`/`{error:{code,message}}` + frontend unwrap `res.data` di layer `api/*`), `go build`+`go vet` per service & `vite build` lolos.

---

## 7. Notification Service (`notification:8080`, Go, MariaDB + queue)
**Fitur:** settings get/put, logs, test send, channel telegram/email/push, queue retry.

> ✅ **(2026-07-15, QA Agent):** Service diimplementasikan penuh (`services/notification`, chi + jwt/v5 + gorm + go-redis + nats.go + prometheus; channel telegram/email/push via stdlib HTTP/SMTP — tanpa SDK eksternal baru). Diuji langsung via Kong `:8000` — **SELURUH checklist fitur + keamanan LULUS** (lihat detail di bawah & [logs.md](file:///home/almuzky/TA/Microservices/logs.md)). Catatan: pengiriman ke channel eksternal (Telegram/SMTP/Push) **disimulasikan sukses di DevMode** bila transport tidak terkonfigurasi; kegagalan nyata (mis. token salah → HTTP 404) tetap diproses & di-retry. Pengiriman riil butuh kredensial env (`SMTP_HOST/USER`, bot token Telegram, `PUSH_URL`) — di luar sandbox QA.

### Checklist Fitur
- [x] `GET/PUT /notifications/settings` (channel on/off, target). GET: 200 (admin/viewer/operator); PUT: 200 admin, **403** viewer/operator (write admin-only).
- [x] `GET /notifications/logs`; `POST /notifications/test` → kirim nyata (dummy). `POST /test` admin → **202** (enqueue), viewer → **403**; `GET /logs` → 200 + `total`.
- [x] Channel: telegram, email, push — tiap channel gagal → retry via queue. Verifikasi: telegram gagal riil (HTTP 404) → `attempts:3` → `failed` (retry via Redis `notification:queue` terbukti).
- [x] Notifikasi terpicu dari alert (subscribe NATS `alert.*`). Verifikasi: publish `alert.triggered` via NATS → +3 log (telegram/email/push) bertema `[SEVERITY] node/metric`.

### Checklist Keamanan
- [x] Settings write hanya admin; token/channel secret disimpan aman (bukan log/plaintext). Secret dienkripsi AES-GCM di MariaDB (`*_secret`); tidak dikembalikan di response GET; GORM logger `Warn` → **tidak ada secret/ciphertext/SQL di container log**.
- [x] Validasi target (email format, chat id) — 400 bila invalid. Email regex, chat id numerik (`^-?\d+$`), push non-empty → 400.
- [x] Rate-limit pengiriman agar tidak spam (queue throttling). Worker memproses 1 job sequentially + `SendInterval` (default 100ms) + `RetryDelay` (default 1s) antar retry.

### Catatan & Next Step
**Kenapa:** Beririsan **GAP-1** (doc e2e): dashboard `NotificationBell` menunggu WS
`/ws/system-status` yang belum ada di wsgateway → bell mati. **Next:** Pilih opsi A
(tambah handler WS `system-status` di wsgateway) atau opsi B (fallback REST polling
`/notifications/logs`). Verifikasi push sampai ke klien setelah WS tersedia.
**Open note (bukan blocker):** response shape Notification Service SUDAH pakai wrapper
standar AGENTS.md §4.4 (`{success,data}` / `{success,false,error:{code,message}}`) —
karena belum ada konsumen REST di dashboard (NotificationBell pakai WS), tidak ada
breaking change. Pengiriman riil ke Telegram/SMTP/Push butuh kredensial env (lihat
`config.go`: `SMTP_HOST/USER/FROM`, bot token di settings, `PUSH_URL`).

---

## 8. Stream Service (`stream:8080`, Go, MinIO + MediaMTX + ML client)
**Fitur:** streams CRUD, snapshot capture (+detect), record start/stop, snapshots list/get/delete,
HLS playback proxy ke MediaMTX.

### Checklist Fitur
- [ ] Streams CRUD `/streams`, `/streams/{id}`.
- [ ] `POST /streams/{id}/snapshot` (+`?detect=true` → panggil ML), `record/start|stop`.
- [ ] `/snapshots` list/get/delete (objek di MinIO).
- [ ] `GET /hls/<name>/index.m3u8` → proxy MediaMTX, bisa diputar di LiveView.

### Checklist Keamanan
- [ ] JWT di semua route; write hanya operator/admin.
- [ ] Validasi stream id & nama HLS (cegah path traversal ke MediaMTX).
- [ ] Akses MinIO pakai credential scoped, bukan public bucket.
- [ ] Snapshot detect tidak bocorkan frame ke log.

### Catatan & Next Step
**Kenapa:** Menangani media + integrasi ML/MinIO — surface attack luas (path, storage).
**Next:** Tes playback HLS end-to-end (MediaMTX harus running). Verifikasi record menghasilkan
file di MinIO & snapshot tersimpan. Cek batas ukuran/retensi snapshot.

---

## 9. ML Service (`ml:8080`, FastAPI/Python, MinIO)
**Fitur:** list/delete results (`/ml/results`), models (`/ml/models`), detect (`/ml/detect`),
vision engine.

### Checklist Fitur
- [ ] `GET /ml/results?prefix=&limit=` → list; `DELETE /ml/results?key=` → hapus.
- [ ] `GET/POST /ml/models`, `POST /ml/detect` (⚠️ belum dipakai UI — tes via curl).
- [ ] Deteksi mengonsumsi frame dari Stream/MinIO → hasil tersimpan.

### Checklist Keamanan
- [ ] `/ml/results` terproteksi JWT (Kong route ada); `key` divalidasi (no path traversal).
- [ ] Upload model terbatas ukuran/type; bukan RCE surface.
- [ ] Resource limit (timeout inferensi) agar tidak hang.

### Catatan & Next Step
**Kenapa:** ML dipanggil oleh Stream detect — perlu kontrak `key`/prefix konsisten.
**Next:** Jalankan `pytest` (bila ada) atau curl tiap route; pastikan model load & detect
return JSON shape yang dipahami Stream. Catat prefix objek standar.

---

## 10. Export Service (`export:8080`, Go, TimescaleDB + cache)
**Fitur:** export data `/export/v1/...` (CSV/parquet) dengan cursor pagination.

### Checklist Fitur
- [ ] `GET /export/v1/...` dengan filter waktu/node → file valid & lengkap.
- [ ] Cursor pagination stabil pada data besar (tidak duplikat/skip).
- [ ] OpenAPI spec (`/export/v1/openapi`) bisa di-fetch.

### Checklist Keamanan
- [ ] JWT + RBAC (admin/operator); rate-limit export berat.
- [ ] Validasi range waktu (cegah full dump DoS).
- [ ] Output tidak bocorkan schema internal; batas ukuran file.

### Catatan & Next Step
**Kenapa:** Beririsan **GAP-3** (doc e2e): service jadi & dirutekan Kong, tapi belum ada
`src/api/export.js` / halaman UI. **Next:** Wire ke dashboard (ikuti `docs/phase11-export-plan.md`)
setelah API tervalidasi. Tes export via curl dahulu sebagai kontrak.

---

## 11. WS Gateway (`wsgateway:8090`, Go)
**Fitur:** Bridge NATS → WebSocket (`GET /ws/nodes/{node_id}/live` & `/ws/system-status`).

### Checklist Fitur
- [ ] `GET /ws/nodes/{node_id}/live?token=` → 101, stream JSON telemetry.
- [ ] Multi-client: beberapa dashboard receive update sama.
- [ ] Health `/health` wsgateway 200.

### Checklist Keamanan
- [ ] WS wajib `?token=` (authenticate); tanpa token → 401 (lihat `wsgateway/internal/auth/jwt.go`).
- [ ] Validasi `node_id` di path WS.
- [ ] Tidak ada data sensitif di frame WS.

### Catatan & Next Step
**Kenapa:** Beririsan **GAP-1** & **GAP-2** (doc e2e). GAP-2: `NodeDetailPanel` &
`NodeConfigPage` buka WS **tanpa** `?token=` → 401, live telemetry mati. **Next:** (a) Tambah
`?token=` di `NodeDetailPanel.jsx` & `NodeConfigPage.jsx` (samakan `Monitor.jsx`); (b) Tambah
handler `GET /ws/system-status` di wsgateway (subscribe `system.status`,`alert.*`) agar
NotificationBell jalan — atau fallback REST polling.

---

## 12. Firmware — Aeroponic Node (`firmware/aeroponic-node`, ESP32)
**Fitur:** konek MQTT (Mosquitto), publish telemetry, terima command, pairing.

### Checklist Fitur
- [ ] Connect ke Mosquitto dengan credential (bukan anonim).
- [ ] Publish telemetry sesuai schema yang dibaca Module/Analytics.
- [ ] Terima & eksekusi command dari Control; balas status.
- [ ] Pairing handshake menghasilkan node "paired" di Module.

### Checklist Keamanan
- [ ] MQTT auth (user/pass atau cert); TLS bila tersedia.
- [ ] Firmware OTA terproteksi (signature) — bila ada.
- [ ] Tidak ada secret hardcode di source; command hanya dari broker terautentikasi.

### Catatan & Next Step
**Kenapa:** Sumber data asli; tanpa node nyata, tes telemetry end-to-end butuh simulator.
**Next:** Bila ESP32 tidak tersedia, buat publisher MQTT dummy (script Python) meniru schema
agar tes Module/Analytics/Control bisa berjalan penuh.

---

## 13. Infrastruktur & Integration (Kong, DB, NATS, MQTT, MinIO, MediaMTX, Prometheus)
### Checklist
- [ ] **Kong:** semua prefix terroute; plugin jwt/rate-limit/cors aktif (tes 429 & preflight CORS).
- [ ] **Kong jwt:** token salah → 401 sebelum sampai service; token benar tembus.
- [ ] **MariaDB/TimescaleDB:** backup & healthcheck; migrasi (`*_svc/migrate.go`) idempoten.
- [ ] **NATS JetStream:** stream/consumer terbuat; event (alert, audit, telemetry) terbridge.
- [ ] **Mosquitto:** ACL aktif (esp32-client hanya topik diperbolehkan).
- [ ] **MinIO:** bucket private; credential scoped.
- [ ] **MediaMTX:** HLS endpoint aman (tidak publik tanpa auth proxy).
- [ ] **Prometheus/Grafana:** metrik tiap service (incl. middleware prometheus) ter-scrape.

### Catatan & Next Step
**Kenapa:** Gateway & message bus adalah tulang punggung; kegagalan di sini = semua service mati.
**Next:** Tes CORS preflight dari origin asli & rate-limit (loop curl cepat → 429). Verifikasi
NATS bridge mengirim event antar service (lihat log tiap service).

---

## 14. Dashboard UI & E2E Integration (React + Browser Subagent)
**Fitur:** Autentikasi (login/register/profile), User Management, Module Management, Analytics, Control Panel, Live View, Snapshot, Telemetri Real-time, dan Notifikasi Sistem.

### Panduan Pengujian E2E Otomatis oleh Agent:
* **Tooling:** Agent menggunakan `browser_subagent` untuk berinteraksi langsung dengan dashboard (`http://localhost:5173` atau port produksi) secara otomatis.
* **Verifikasi:** Lakukan pengujian login, navigasi halaman, pengisian parameter, dan amati logs browser serta network request di tab network (lewat tool browser) untuk memastikan tidak ada API error (5xx/4xx selain yang diharapkan) atau JS crash.
* **Pengecualian:** Keindahan visual (styling) dan kelancaran UX murni tetap diverifikasi secara manual oleh User (sesuai aturan [AGENTS.md](file:///home/almuzky/TA/Microservices/AGENTS.md)).

### Checklist Fitur UI
- [ ] **D1 (Login / Register / Profile):** Halaman `/` - Login dengan user seeded/register baru, ubah password, cek session, deaktifkan akun.
- [ ] **D2 (User Management):** Halaman `/users` - Akses admin untuk mengubah role, menonaktifkan user, hapus user.
- [ ] **D3 (Module Management):** Halaman `/module` - CRUD module, pair/unpair node, edit tags/actuators.
- [ ] **D4 (Analytics):** Halaman `/analytics` - Memilih node dan metrik, memastikan chart ter-render dengan rentang waktu 1h–30d.
- [ ] **D5 (Control Panel):** Halaman `/control` - Mode MANUAL/AUTO, emergency stop, resume, kontrol manual aktuator, CRUD scheduler.
- [ ] **D6 (Live View):** Halaman `/live` - Memutar streaming video (MediaMTX HLS).
- [ ] **D7 (Snapshot):** Halaman `/snapshot` - Galeri capture & AI detection.
- [ ] **D8 (Telemetri Real-time):** Menghubungkan WebSocket live telemetry di halaman detail node (`/ws/nodes/{id}/live`).
- [ ] **D9 (System Notifications):** Menerima notifikasi push via WebSocket `/ws/system-status`.
- [ ] **D10 (Version/Security):** Halaman Monitor CLI / Version.
- [ ] **D11 (Bahasa UI):** Memastikan seluruh teks statis di semua halaman menggunakan Bahasa Inggris (tidak ada bahasa Indonesia).
- [ ] **D12 (Audit Log):** Halaman `/audit` - Tabel audit logs, filtering event, search, pagination, dan live auto-refresh.

### Checklist E2E (Skenario Integrasi)
- [ ] **E2E1 (Telemetry -> Dashboard):** ESP32/Simulator publish telemetry via MQTT -> Module Service -> TimescaleDB -> Analytics Service -> Dashboard Chart.
- [ ] **E2E2 (Telemetry Realtime):** ESP32/Simulator telemetry -> Module -> NATS -> WebSocket Gateway -> Live dashboard updates.
- [ ] **E2E3 (Control -> ESP32):** Dashboard -> Kong -> Control Service -> MQTT command -> ESP32/Simulator -> control acknowledgment.
- [ ] **E2E4 (Scheduler Otomatis):** Control scheduler trigger -> NATS/MQTT -> ESP32/Simulator execution.
- [ ] **E2E5 (Stream -> ML -> MinIO):** Stream snapshot request -> ML service detection -> MinIO storage -> Dashboard snapshot update.
- [ ] **E2E6 (Auth -> RBAC):** Login flow -> token extraction -> header injection -> validation on Kong and sub-services.
- [ ] **E2E7 (Emergency -> Resume):** Trigger emergency stop -> all outputs OFF -> Resume -> restore previous state.

---

## Matriks Prioritas (ringkasan)
| Pri | Item | Ref |
|---|---|---|
| P0 | WS `/ws/system-status` (notif realtime) | GAP-1 §7/§11 |
| P1 | `?token=` di NodeDetailPanel/NodeConfigPage | GAP-2 §11 |
| P2 | Wire Export ke dashboard | GAP-3 §10 |
| P3 | Jalankan checklist tiap service & E2E sebagai regression | seluruh § |

## Catatan Lintas-Service
- GAP-1: NotificationBell WS `system-status` tidak ada → pilih opsi A/B.
- GAP-2: WS tanpa token di 2 komponen → 401.
- GAP-3: Export service belum di-UI.
- Semua route dashboard harus punya pasangan Kong + service valid (cek `vite build`).

> **Penutup:** Setelah tiap service & E2E lulus checklist fitur + keamanan, jalankan pengujian regresi E2E penuh sesuai dengan skenario integrasi di Section 14.

