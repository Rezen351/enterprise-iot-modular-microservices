# Microservices Unit & Feature Test Suite

Suite pengujian unit dan fungsionalitas otomatis (*unit & feature integration tests*) untuk seluruh 12 microservices pada arsitektur Enterprise IoT.

Trafik pengujian berjalan melalui **Kong API Gateway** (`/v1`) untuk memverifikasi autentikasi JWT, role-based access control, response wrapper JSON, dan fungsionalitas seluruh endpoint API & WebSocket.

---

## 📂 Struktur Folder

```
test/
├── unit_test.py        # Suite unit test utama (22 test case)
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

## 🧪 Cakupan Unit Test (22 Test Case)

| # | Test Case | Target Endpoint / Feature | Deskripsi |
|---|---|---|---|
| 1 | `TestSystemHealth` | `GET /v1/health` | Verifikasi gateway health check & response format |
| 2 | `TestAuthService` | `POST /v1/auth/login` | Verifikasi penolakan kredensial salah (401) |
| 3 | `TestAuthService` | `POST /v1/auth/login` | Verifikasi penerbitan JWT & refresh token saat login sukses |
| 4 | `TestAuthService` | `GET /v1/auth/me` | Verifikasi pengambilan profil pengguna terautentikasi |
| 5 | `TestAuthService` | `GET /v1/auth/sessions` | Verifikasi daftar sesi pengguna aktif |
| 6 | `TestModuleService` | `GET /v1/modules` | Verifikasi daftar modul IoT terdaftar |
| 7 | `TestModuleService` | `GET /v1/nodes` | Verifikasi daftar sensor node |
| 8 | `TestModuleService` | `GET /v1/nodes/discovered` | Verifikasi penemuan node MQTT otomatis |
| 9 | `TestAnalyticsService` | `GET /v1/analytics/nodes` | Verifikasi daftar node pada service analitik |
| 10 | `TestAnalyticsService` | `GET /v1/analytics/summary` | Verifikasi ringkasan data time-series |
| 11 | `TestControlService` | `GET /v1/control/commands` | Verifikasi riwayat perintah kontrol aktuator |
| 12 | `TestControlService` | `GET /v1/control/modes/{id}` | Verifikasi status mode kontrol |
| 13 | `TestAlertService` | `GET /v1/alerts` | Verifikasi riwayat peringatan threshold |
| 14 | `TestAlertService` | `GET /v1/thresholds` | Verifikasi daftar aturan threshold |
| 15 | `TestAuditService` | `GET /v1/audit/logs` | Verifikasi audit log sistem |
| 16 | `TestNotificationService` | `GET /v1/notifications/logs` | Verifikasi log pengiriman notifikasi |
| 17 | `TestStreamService` | `GET /v1/streams` | Verifikasi pendaftaran kamera CCTV |
| 18 | `TestStreamService` | `GET /v1/snapshots` | Verifikasi gambar snapshot kamera |
| 19 | `TestMLService` | `GET /v1/ml/models` | Verifikasi model YOLO vision terdaftar |
| 20 | `TestExportService` | `GET /v1/export/v1/nodes` | Verifikasi endpoint ekspor node |
| 21 | `TestExportService` | `GET /v1/export/v1/openapi` | Verifikasi OpenAPI spec ekspor telemetri |
| 22 | `TestWSGateway` | `ws://.../v1/ws/system-status` | Verifikasi handshake WebSocket live telemetry |
