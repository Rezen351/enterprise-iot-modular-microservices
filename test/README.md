# Microservices Unit & Feature Test Suite

Suite pengujian unit dan fungsionalitas otomatis (*unit & feature integration tests*) untuk seluruh 12 microservices pada arsitektur Enterprise IoT.

Trafik pengujian berjalan melalui **Kong API Gateway** (`/v1`) untuk memverifikasi autentikasi JWT, role-based access control, response wrapper JSON, dan fungsionalitas seluruh endpoint API & WebSocket.

---

## 📂 Struktur Folder

```
test/
├── unit_test.py        # Suite unit test utama (41 test case)
├── config.py           # Konfigurasi target URL & kredensial
├── requirements.txt    # Dependensi Python pip
└── README.md           # Panduan pengujian
```

---

## 🚀 Cara Menjalankan Unit Test

### 1. Install Dependensi
```bash
cd test
pip install -r requirements.txt
```

### 2. Jalankan Suite Unit Test
```bash
python3 unit_test.py
```

---

## 🧪 Cakupan Unit Test (41 Test Cases — 100% Microservices)

| # | Test Class | Target Endpoint / Feature | Deskripsi & Verifikasi |
|---|---|---|---|
| 1 | `TestSystemHealth` | `GET /v1/health` | Verifikasi gateway health check & response format |
| 2 | `TestAuthService` | `POST /v1/auth/login` | Penerbitan JWT access & refresh token |
| 3 | `TestAuthService` | `GET /v1/auth/me` | Verifikasi pengambilan profil pengguna terautentikasi |
| 4 | `TestAuthService` | `GET /v1/auth/sessions` | Verifikasi daftar sesi pengguna aktif |
| 5 | `TestAuthService` | `GET /v1/auth/users` | Verifikasi admin list users |
| 6 | `TestAuthService` | `GET /v1/auth/roles` | Verifikasi admin list roles |
| 7 | `TestModuleService` | `GET /v1/modules` | Verifikasi daftar modul IoT terdaftar |
| 8 | `TestModuleService` | `POST /v1/modules` | Verifikasi pembuatan modul IoT baru |
| 9 | `TestModuleService` | `GET /v1/modules/{id}` | Verifikasi pengambilan detail modul berdasarkan ID |
| 10 | `TestModuleService` | `GET /v1/nodes` | Verifikasi daftar sensor node |
| 11 | `TestModuleService` | `GET /v1/nodes/discovered` | Verifikasi penemuan node MQTT otomatis |
| 12 | `TestAnalyticsService` | `GET /v1/analytics/nodes` | Verifikasi daftar node pada service analitik |
| 13 | `TestAnalyticsService` | `GET /v1/analytics/metrics` | Verifikasi query time-series rollups |
| 14 | `TestAnalyticsService` | `GET /v1/analytics/summary` | Verifikasi ringkasan data time-series |
| 15 | `TestAnalyticsService` | `GET /v1/analytics/export` | Verifikasi ekspor CSV data rollups |
| 16 | `TestControlService` | `GET /v1/control/commands` | Verifikasi riwayat perintah kontrol aktuator |
| 17 | `TestControlService` | `GET /v1/control/modes/{id}` | Verifikasi status mode kontrol |
| 18 | `TestControlService` | `GET /v1/control/targets` | Verifikasi target setpoints |
| 19 | `TestControlService` | `GET /v1/control/outputs` | Verifikasi status output aktuator |
| 20 | `TestControlService` | `POST /v1/control/command` | Verifikasi pengiriman perintah manual |
| 21 | `TestControlService` | `POST /v1/control/modes/{id}/resume` | Verifikasi resume mode otomatis |
| 22 | `TestAlertService` | `GET /v1/alerts` | Verifikasi riwayat peringatan threshold |
| 23 | `TestAlertService` | `GET /v1/thresholds` | Verifikasi daftar aturan threshold |
| 24 | `TestAlertService` | `POST /v1/thresholds` | Verifikasi pembuatan aturan threshold |
| 25 | `TestAlertService` | `DELETE /v1/thresholds/{id}` | Verifikasi penghapusan aturan threshold |
| 26 | `TestAuditService` | `GET /v1/audit/logs` | Verifikasi query audit log sistem |
| 27 | `TestAuditService` | `GET /v1/audit/logs?event=...` | Verifikasi filter audit log berdasarkan event |
| 28 | `TestNotificationService` | `GET /v1/notifications/logs` | Verifikasi log pengiriman notifikasi |
| 29 | `TestNotificationService` | `GET /v1/notifications/settings` | Verifikasi pengaturan saluran notifikasi |
| 30 | `TestNotificationService` | `POST /v1/notifications/test` | Verifikasi pengiriman notifikasi uji |
| 31 | `TestStreamService` | `GET /v1/streams` | Verifikasi pendaftaran kamera CCTV |
| 32 | `TestStreamService` | `GET /v1/snapshots` | Verifikasi gambar snapshot kamera |
| 33 | `TestStreamService` | `POST /v1/streams` | Verifikasi registrasi stream kamera baru |
| 34 | `TestMLService` | `GET /v1/ml/models` | Verifikasi model YOLO vision terdaftar |
| 35 | `TestMLService` | `POST /v1/ml/detect/from-stream` | Verifikasi permintaan inferensi frame YOLO |
| 36 | `TestExportService` | `GET /v1/export/v1/nodes` | Verifikasi endpoint ekspor node |
| 37 | `TestExportService` | `GET /v1/export/v1/meta` | Verifikasi metrik metadata ekspor |
| 38 | `TestExportService` | `GET /v1/export/v1/openapi` | Verifikasi OpenAPI spec ekspor telemetri |
| 39 | `TestWSGateway` | `ws://.../v1/ws/system-status` | Verifikasi handshake WebSocket system status |
| 40 | `TestWSGateway` | `ws://.../v1/ws/nodes/{id}/live` | Verifikasi handshake WebSocket live telemetry node |
