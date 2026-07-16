# 🛠️ system-update.md — Action List: Sync Planning ↔ Actual System

> **Tanggal:** 2026-07-16
> **Tujuan:** Dokumen ini adalah daftar tugas (bukan log) untuk menyelaraskan dokumen arsitektur
> (`planning.md`, `roadmap.md`) dan infrastructure (`docker-compose.yml`, `infra/`) dengan
> **keadaan sistem sebenarnya** yang tercatat di `logs.md`. Agent yang mengerjakan dapat
> mengambil item di bawah satu per satu.
> **Sumber kebenaran:** `logs.md` (hasil pengujian langsung) + inspeksi `docker-compose.yml`.
> **Dokumen terkait:** [planning.md](file:///home/almuzky/TA/Microservices/docs/planning.md) · [roadmap.md](file:///home/almuzky/TA/Microservices/docs/roadmap.md) · [logs.md](file:///home/almuzky/TA/Microservices/logs.md) · [testing-plan-agent.md](file:///home/almuzky/TA/Microservices/docs/testing-plan-agent.md) · [testing-implementasi-manual.md](file:///home/almuzky/TA/Microservices/docs/testing-implementasi-manual.md)

---

## 📌 Ringkasan Temuan (Gap Analysis)

Pengujian di `logs.md` membuktikan sistem **lebih maju** dari yang tertulis di `planning.md`/`roadmap.md`.
Ada 3 kategori ketidak-sesuaian:

1. **Fitur sudah jadi tapi didokumentasikan sebagai `⬜`/Future** → Notification & Export Service.
2. **Keputusan konsolidasi (ADR-004/ADR-005) didokumentasikan sebagai ✅ tapi BELUM diterapkan di `docker-compose.yml`** → Redis & Exporter masih terpisah.
3. **Security table menandai ✅ padahal masih terbuka di realitas** → Mosquitto `allow_anonymous`, MinIO root credential.

> Catatan: `testing-plan-agent.md` (§7 Notification, §10 Export) SUDAH benar & konsisten dengan `logs.md`.
> Yang perlu disesuaikan adalah `planning.md`/`roadmap.md` + penambahan service ke `docker-compose.yml` +
> pembaruan `testing-implementasi-manual.md` (UI) agar sejalan dengan fitur yang sudah ada.

---

## ✅ ACTION LIST (untuk Agent)

### A. Dokumen: Tandai Notification & Export Service sebagai SELESAI

- [ ] **A1.** `planning.md` — Bagian "🗄️ Database per Service" (tabel ~baris 165-194):
  - Kolom Status untuk **Notification** (`mariadb-notification` + `redis-shared` DB2) ubah `⬜ Belum` → `✅ Running`.
  - Kolom Status untuk **Export** (`timescaledb-module` read + `redis-shared` DB3) ubah `⬜ Belum` → `✅ Running`.
- [ ] **A2.** `planning.md` — Bagian "🧱 Fase Implementasi" (tabel ~baris 529-547):
  - `Notification Service` baris `⬜ Dikerjakan di TA (blocker fungsional)` → `✅ Selesai`.
  - `Export Service / Data API` baris `⬜ Future (sebagian via Analytics)` → `✅ Selesai`.
- [ ] **A3.** `planning.md` — Bagian "Subscriber Nyata vs Diterbitkan (Gap Analysis)" (~baris 484-494):
  - `alert.triggered`/`alert.resolved` baris `🔴 GAP` → `✅` (Notification Service sudah subscribe `alert.*`, terverifikasi di `logs.md` §13 #7 & §7).
- [ ] **A4.** `roadmap.md` — Tabel "Yang belum dikerjakan (sisa)" (~baris 37-50):
  - Hapus baris `Notification Service` (sudah selesai) atau ubah status `⬜` → `[x]`.
  - Hapus baris `Export Service / Data API` atau ubah `⬜` → `[x]`.
- [ ] **A5.** `roadmap.md` — "Status Keseluruhan" (~baris 15): tambahkan `Notification Service ✅` dan `Export Service ✅` ke daftar yang sudah berjalan end-to-end.
- [ ] **A6.** `roadmap.md` — Section "🔴 Fase 5 — Notification Service" (~baris 370-397): checklist masih semua `[ ]`; ubah seluruh item `[ ]` → `[x]` (sesuai `logs.md` + `testing-plan-agent.md` §7).
- [ ] **A7.** `roadmap.md` — Section "🟢 Fase 9b — Export Service" (~baris 645-771): checklist `/export/v1/telemetry` sudah `[x]`; ubah item tersisa (`/export/v1/nodes`, `/export/v1/alerts`, `/export/v1/commands`, `/export/v1/audit`, `/export/v1/discover`, redis caching, Kong route, Dockerfile, Prometheus) dari `[ ]` → `[x]` karena sudah diimplementasikan & lulus (lihat `logs.md` M10).

### B. Infrastruktur: Tambahkan service yang hilang ke `docker-compose.yml`

Kode `services/notification` dan `services/export` SUDAH ADA & LULUS tes (logs M7/M10) tapi
**tidak didefinisikan sebagai service** di `docker-compose.yml` → tidak akan jalan saat `up -d`.

- [ ] **B1.** Tambahkan service `notification:` di `docker-compose.yml` (setelah `audit`/`alert`), dengan:
  - image build `context: ./services/notification`
  - environment: `PORT`, `JWT_SECRET`, `DB_DSN` (mariadb-notification), `REDIS_ADDR` (lihat B3), `NATS_URL`, `PROMETHEUS` scrape port
  - depends_on `mariadb-notification` + `nats`
  - healthcheck `GET /health`
  - Kong route `/notifications` (sudah ada di `infra/kong/kong.yml` per logs §13 #2)
- [ ] **B2.** Tambahkan service `export-service:` di `docker-compose.yml` dengan:
  - image build `context: ./services/export`
  - environment: `PORT`, `JWT_SECRET`, `TIMESCALEDB_MODULE_DSN` (timescaledb-module `module_ts`), `REDIS_ADDR` (lihat B3), `PROMETHEUS`
  - depends_on `timescaledb-module` + `nats`
  - healthcheck `/health`
  - Kong route `/export` + `/analytics/export` (sudah diarahkan ke `export-upstream` per logs M10 #4)
- [ ] **B3.** **KESELARASAN REDIS:** Karena Redis belum di-consolidate (lihat item C), gunakan
  instance Redis yang SUDAH ada: `notification` → `redis-notification:6379`, `export` → `redis-export:6379`.
  (Jika item C dikerjakan dulu, gunakan `redis-shared:6379?db=2` / `?db=3`.)

### C. Infrastruktur: Terapkan ADR-004 (Redis Consolidation) — PILIH SALAH SATU

Dokumen mengklaim ✅ tapi compose masih punya 4 instance terpisah.

- [ ] **C1. OPSI 1 (Terapkan konsolidasi — disarankan):**
  - Ganti `redis-module`, `redis-alert`, `redis-notification`, `redis-export` dengan 1 instance `redis-shared`.
  - Update semua `REDIS_ADDR` service ke `redis-shared:6379` + tambahkan `REDIS_DB` (module=0, alert=1, notification=2, export=3).
  - Update `services/*/internal/config` untuk membaca `REDIS_DB`.
  - Hapus volume `volumes/redis-{module,alert,notification,export}`.
- [ ] **C2. OPSI 2 (Revert dokumen):** Jika konsolidasi tidak dikerjakan, ubah `planning.md` ADR-004
  dan tabel "Total instance database" menjadi tetap 4 Redis terpisah (17 instance, bukan 14).
  > **Rekomendasi:** OPSI 1 agar doc & reality sama. Jangan biarkan doc ✅ tapi implementasi ❌.

### D. Infrastruktur: Terapkan ADR-005 (Exporter Consolidation) — PILIH SALAH SATU

Dokumen mengklaim ✅ tapi compose masih punya 8 mysqld + 2 postgres + 2 redis exporter.

- [ ] **D1. OPSI 1 (Terapkan konsolidasi — disarankan):**
  - Buat `infra/mysqld-exporter-all/` dengan skrip menjalankan beberapa proses exporter per target DB (port beda).
  - Replace 8× `mysqld-exporter-*` → 1× `mysqld-exporter-all` (multi-proc), 2× `postgres-exporter-*` → 1× `postgres-exporter-all`, 2× `redis-exporter` → 1× `redis-exporter` (sudah 1, tapi arahkan ke `redis-shared`).
  - Label `instance` di Prometheus tetap per-DB (dashboard Grafana tidak berubah).
- [ ] **D2. OPSI 2 (Revert dokumen):** Ubah `planning.md` ADR-005 menjadi "masih 11 exporter terpisah".
  > **Rekomendasi:** OPSI 1. Jika terlalu berat, setidaknya buat `exporter-all` untuk mengurangi container; jangan biarkan klaim ✅ palsu.

### E. Security: Perbaiki tabel keamanan agar jujur

- [ ] **E1.** `planning.md` Security table (~baris 552-566):
  - `MQTT ACL` ✅ → 🟡 (realitas: `allow_anonymous true` masih aktif, `acl.conf` ter-comment — lihat `logs.md` Keamanan #1, beberapa section).
  - Tambah baris `MinIO scoped access key` → 🟡 (realitas: masih pakai root credential, belum scoped per-service — `logs.md` open note).
- [ ] **E2.** `roadmap.md` / `security-audit.md`: catat open remediation untuk Mosquitto ACL enforcement
  (`allow_anonymous false` + `password_file` + distribusi kredensial `MQTT_USER`/`MQTT_PASS` ke `.env` + firmware).
- [ ] **E3.** `planning.md` / `roadmap.md`: catat OTA firmware belum verifikasi signature (ED25519/ECDSA) — open note, bukan ✅.

### F. Observability count: Perbarui angka target

- [ ] **F1.** `planning.md` "Target Prometheus Saat Ini" (~baris 605-614): tambahkan target yang
  benar-benar ada (31 target per `logs.md` §13 #10): `alert-service`, `control-service`, `audit-service`,
  `stream-service`, `ml-service`, `notification-service`, `export-service`, `node-exporter`, `cadvisor`,
  `redis-*`, `postgres-*`, `mosquitto-exporter`, `nats-exporter`. Jangan biarkan hanya 6 target terdaftar.

### G. testing-implementasi-manual.md (UI) — sesuaikan dengan fitur yang SUDAH ada

> Agent **dilarang** mencentang checklist UI (milik User), tapi boleh memperbarui daftar fitur
> agar User tahu apa yang harus diuji secara visual.

- [ ] **G1.** Tambahkan section **§14e Notification Bell & Real-time Alert (UI)** di `testing-implementasi-manual.md`:
  - Bell di header menerima notifikasi dari WS `/ws/system-status` (GAP-1 sudah tertutup di backend, `logs.md` M11).
  - Verifikasi: alert triggered → bell badge naik + dropdown; resolved → hilang/berubah warna.
- [ ] **G2.** Tambahkan section **§14f Export Data (UI)** di `testing-implementasi-manual.md`:
  - Halaman/modal export CSV (node telemetri) via `GET /export/v1/telemetry` (GAP-3: belum ada `src/api/export.js`).
  - Verifikasi: download CSV, filter node/metric/window, rate-limit 429.
- [ ] **G3.** Pastikan section Stream/ML (`?detect=true` AI Detection) mencantumkan open note:
  butuh model YOLO aktif terdaftar di ML Service agar gallery DETECTION terisi (bukan bug kode).
- [ ] **G4.** Section Control Panel / Live View / Snapshot sudah ✅ di roadmap; pastikan manual doc
  mereferensikan route yang benar (`/control`, `/live`, `/snapshot`, `/alerts`, `/audit`).

### H. Sinkronisasi akhir

- [ ] **H1.** Setelah A–G, jalankan `docker compose config` untuk validasi YAML `docker-compose.yml`.
- [ ] **H2.** Update `logs.md` dengan entri baru (tabel aktivitas) mencatat penyelarasan doc↔system ini.
- [ ] **H3.** Pastikan `planning.md` "Kriteria Selesai" (~baris 700-709) diperbarui: Notification & Export
  end-to-end kini masuk kriteria yang terpenuhi; OTA/Webhook/Metrics-Service/Cloudflare tetap Future P4.

---

## 🚫 Hal yang TIDAK perlu diubah (sudah konsisten)

- `testing-plan-agent.md` §7 (Notification) & §10 (Export) — SUDAH benar & lulus.
- Service: auth, module, analytics, wsgateway, alert, audit, stream, ml, control, monitor, cctv-capture — status ✅ cocok.
- MinIO single shared multi-bucket (`stream`/`mlbucket`/`ota`/`ml-result`) — ✅ cocok.
- Kong / NATS / Mosquitto / MediaMTX / Prometheus / Grafana — ✅ ada & sesuai.
- Response wrapper standar `{success,data}`/`{error:{code,message}}` — sudah diterapkan di seluruh service Go + ML.

---

## ⚠️ Catatan Konteks untuk Agent

- Semua perubahan dokumen tetap **Bahasa Indonesia** untuk internal (sesuai AGENTS.md §1: hanya UI/API wajib English).
- Jangan hardcode credential; selalu via env (ADR/AGENTS.md §4.3).
- Jika mengerjakan B/C/D (compose), lakukan **isolasi**: nyalakan hanya service terkait + dependency DB-nya
  (`docker compose up -d <svc> <db>`), bukan seluruh stack (AGENTS.md §6.9).
- Setelah selesai, matikan container test & bersihkan env (AGENTS.md §6.9).
