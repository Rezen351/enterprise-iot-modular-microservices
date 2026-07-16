# 🔧 Security Audit — Gateway & Service Hardening (2026-07-14)

> Laporan *stress test & penetration test* (toolkit di `stress-test/`). Dipisahkan dari `planning.md` karena ini adalah laporan hasil pengujian, bukan dokumen arsitektur.

## Temuan & Perbaikan

| # | Temuan (pentest/stress) | Perbaikan | File |
|---|--------------------------|-----------|------|
| 1 | `/modules` & `/nodes` dapat diakses **tanpa token** (200) | Module Service sekarang menegakkan JWT (HS256, secret sama dengan Auth) + RBAC: read butuh user valid, write butuh `admin`/`operator`. Health `/health` tetap publik. | `services/module/internal/middleware/auth.go` (baru, stdlib-only), `services/module/main.go`, `services/module/internal/config/config.go` |
| 2 | Rate limit Kong terlalu ketat → bottleneck (Auth 20/menit, global 100/menit) | Dinaikkan: global `100→300`/menit, auth-public `20→60`/menit, route terlindungi `120→300`/menit (jam disesuaikan). Login tetap dilindungi dari brute-force. | `infra/kong/kong.yml` |
| 3 | Header keamanan tidak ada + `Server`/`X-Powered-By` bocor | Plugin global `response-transformer` menyuntikkan CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS; menghapus `Server` & `X-Powered-By`. Plus `KONG_NGINX_HTTP_SERVER_TOKENS: off`. | `infra/kong/kong.yml`, `docker-compose.yml` |
| 4 | XSS reflection pada `POST /modules` | Validasi input menolak `<` `>` & control char pada `name`/`description`; encoder JSON sudah HTML-escape sebagai lapisan kedua. | `services/module/internal/handler/handler.go` |
| 5 | Tidak ada metrik host (CPU/RAM/disk) di Prometheus → bottleneck sulit dilacak | Tambah `node-exporter` (host) & `cAdvisor` (per-container) + job scrape di Prometheus. | `docker-compose.yml`, `infra/prometheus/prometheus.yml` |

## Catatan

- Middleware JWT Module Service dibuat **tanpa dependensi baru** (verifikasi HMAC-SHA256 pakai stdlib) agar `go.mod` tidak berubah & build tetap ringan.
- Validasi RBAC di service bersifat *defense-in-depth*; Kong tetap berperan sebagai rate-limiter/entry point (plugin `jwt` Kong sengaja tidak diaktifkan — validasi claim tetap di service masing-masing, konsisten dengan pola Control Service).

## Verifikasi

Jalankan `python3 stress-test/cli.py pentest` (ekspektasi: *Protected routes reject unauthenticated access* → PASS) dan `python3 stress-test/cli.py metrics` (ekspektasi job `node-exporter` & `cadvisor` muncul).

## Remediasi Terbuka (Open Items — Belum Selesai)

Temuan berikut **masih terbuka** (status 🟡 di `planning.md` §Keamanan) dan tercatat sebagai pekerjaan remediation yang belum dikerjakan:

| # | Temuan | Status | Rencana Remediasi |
|---|--------|--------|-------------------|
| O1 | Mosquitto `allow_anonymous true` masih aktif; `acl.conf` template per-service ter-comment → koneksi anonim diterima (terverifikasi client tanpa user/pass connect `rc=0`). | 🟡 Open | Set `allow_anonymous false` + aktifkan `password_file` di `infra/mosquitto/config/mosquitto.conf`; uncomment & distribusikan `acl.conf` (topic `esp32`/`module-svc`/`control-svc`); isi `MQTT_USER`/`MQTT_PASS` ke `.env` dan firmware agar seluruh stack tidak lagi anonim. |
| O2 | MinIO masih pakai root credential (belum scoped per-service per bucket). | 🟡 Open | Buat access key ter-scoped per service (Stream rw `stream`, ML rw `ml-vision` ro `stream`, OTA rw `ota`) via `mc admin user/accesskey`; distribusikan ke masing-masing service melalui env (bukan root credential). |
| O3 | OTA firmware (`WebConfigPortal.cpp` `/api/ota`) **belum** verifikasi signature (ED25519/ECDSA) — hanya `checkAuthToken()` web portal. | 🟡 Open | Tambahkan verifikasi signature firmware sebelum `Update.begin` (ED25519/ECDSA); tolak image tanpa/tidak cocok signature. |

> Sumber: `logs.md` (2026-07-16, Keamanan #1 & Firmware S12 Keamanan #1/#2). Remediasi O1–O3 **di luar scope** hardening pentest di atas dan belum diimplementasikan.

