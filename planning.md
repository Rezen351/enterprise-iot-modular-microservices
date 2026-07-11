# 📋 Planning — IOT-Modular-Microservice

> **Versi Dokumen:** 1.3.0  
> **Tanggal:** 2026-07-11  
> **Status:** 🟢 Fase 1 Selesai — Lanjut ke Fase 2  
> **Penulis:** Tim TA

---

## 🎯 Tujuan Proyek

Membangun sistem monitoring dan kontrol tanaman aeroponik berbasis **arsitektur microservice** dengan pendekatan **Database-per-Service**, komunikasi event-driven via **NATS**, dan API Gateway terpusat via **Kong**. Sistem dirancang untuk berjalan di lingkungan containerized (Docker Compose) dan dapat di-deploy ke cloud melalui **Cloudflare Tunnel**.

---

## 🧠 Filosofi Modular Desain

Sistem dirancang dengan filosofi modular yang berlandaskan pada prinsip pemisahan concern (separation of concerns) dan otonomi layanan. Setiap modul dalam sistem memiliki tanggung jawab yang jelas dan terisolasi, memungkinkan pengembangan, pengujian, dan deployment secara independen.

### Prinsip Modular yang Diadopsi

| Prinsip | Deskripsi | Implementasi dalam Sistem |
|---|---|---|
| **Single Responsibility** | Setiap service hanya bertanggung jawab atas satu domain bisnis | Auth Service hanya menangani autentikasi, Module Service hanya menangani data sensor, Alert Service hanya menangani evaluasi threshold — tidak ada overlap tanggung jawab |
| **Database Isolation** | Setiap service memiliki database sendiri, tidak ada sharing database antar service | 18 instance database terpisah untuk 13 service, masing-masing dengan kredensial unik |
| **Bounded Context** | Setiap service memiliki model data dan bahasa domain sendiri | Service Auth berbicara tentang "user" dan "role", Module Service berbicara tentang "sensor" dan "telemetry", Control Service berbicara tentang "command" dan "device" |
| **Independen Deployable** | Setiap service dapat di-build, di-deploy, dan di-scale secara independen | Masing-masing service memiliki Dockerfile sendiri, go.mod mandiri, dan port internal yang terisolasi |
| **Resilience by Design** | Kegagalan satu service tidak boleh mengganggu service lain | NATS event bus dengan JetStream persistence, saga pattern dengan compensating transaction, dan dead letter queue untuk menangani kegagalan |
| **Observability Built-in** | Setiap service harus menghasilkan data observability secara default | Audit log via NATS untuk setiap operasi kritis, healthcheck endpoint, metrik Prometheus, dan saga tracing dengan correlation ID |
| **Stateless where Possible** | Service diusahakan stateless untuk memudahkan horizontal scaling | WebSocket Service, API Gateway, dan Webhook Service bersifat stateless; state disimpan di database dan cache eksternal |
| **API Contract First** | Komunikasi antar-service didefinisikan melalui kontrak yang jelas | NATS subject contract, MQTT topic contract, REST API contract, dan webhook payload schema didokumentasikan sebelum implementasi |

### Manfaat Arsitektur Modular

- **Skalabilitas Selektif:** Hanya service yang membutuhkan resource tambahan yang di-scale, bukan seluruh sistem. Module Service yang menangani volume data sensor tinggi dapat di-scale secara independen dari Auth Service yang bebannya lebih rendah.
- **Isolasi Kegagalan:** Kerusakan pada satu service tidak merambat ke service lain. Jika Vision API mengalami error, sistem monitoring dan kontrol tetap berjalan normal.
- **Kebebasan Teknologi:** Setiap service dapat menggunakan stack teknologi yang paling sesuai. Service Go untuk performa tinggi, Python untuk ML inference, JavaScript untuk frontend — semuanya berkomunikasi melalui protokol yang terstandarisasi.
- **Paralelisasi Pengembangan:** Tim yang berbeda dapat mengerjakan service yang berbeda secara simultan tanpa konflik, selama kontrak antar-service (NATS subjects, API endpoints) sudah disepakati.
- **Evolusi Independen:** Setiap service dapat diperbarui, diganti, atau bahkan dihapus tanpa mempengaruhi service lain selama kontrak komunikasi tetap dipenuhi.

### Batasan dan Trade-off

- **Kompleksitas Operasional:** 18 instance database dan 13+ service membutuhkan monitoring dan orkestrasi yang lebih kompleks dibandingkan monolit.
- **Network Overhead:** Komunikasi antar-service via NATS menambah latency dibandingkan pemanggilan fungsi langsung dalam monolit.
- **Data Consistency:** Eventual consistency adalah konsekuensi dari arsitektur terdistribusi — transaksi yang membutuhkan strong consistency harus menggunakan saga pattern dengan compensating transaction.
- **Debugging Complexity:** Melacak alur transaksi yang melintasi beberapa service membutuhkan tool observability yang memadai (distributed tracing, centralized logging).

---

## 🏗️ Arsitektur Sistem

### Topologi

Sistem terdiri dari beberapa lapisan yang saling terintegrasi:

- **Device Layer:** ESP32 mengirim data sensor via MQTT ke Mosquitto broker
- **Ingestion Layer:** Module Service menerima data dari Mosquitto, menyimpan ke database, dan mempublikasikan ke NATS
- **Processing Layer:** Alert Service, Analytics Service, dan ML/Vision API memproses data secara real-time
- **Control Layer:** Control Service mengirim perintah balik ke ESP32 melalui MQTT
- **Gateway Layer:** Kong sebagai API Gateway tunggal untuk semua traffic eksternal
- **Presentation Layer:** Dashboard (React) dan WebSocket Service untuk real-time updates
- **Integration Layer:** Webhook Service sebagai jembatan event-driven ke sistem eksternal
- **Observability Layer:** Prometheus untuk aggregasi metrik dari seluruh service, dipublikasikan melalui NATS
- **Infrastructure Layer:** NATS untuk event bus, Cloudflare Tunnel untuk akses aman dari internet

### Prinsip Desain

| Prinsip | Implementasi |
|---|---|
| Database-per-Service | Setiap service memiliki container database sendiri, tidak ada sharing database |
| Event-Driven Architecture | Komunikasi antar-service menggunakan NATS JetStream dengan pola Pub/Sub dan Request-Reply |
| Single Entry Point | Semua traffic eksternal melalui Kong API Gateway |
| Zero-Trust Internal | Setiap service hanya mengetahui kredensial database miliknya sendiri |
| Schema Migration on Boot | Setiap service melakukan migrasi skema database sendiri saat startup |
| Saga Pattern | Transaksi terdistribusi menggunakan choreography-based saga via NATS |
| Idempotency | Semua event handler dirancang idempotent untuk menjamin exactly-once processing |

---

## 🗄️ Database per Service

Setiap service memiliki instance database terpisah sesuai dengan kebutuhan data-nya:

| Service | MariaDB | TimescaleDB | Redis | MinIO |
|---|---|---|---|---|
| Auth | `mariadb-auth` | — | — | — |
| Module | `mariadb-module` | `timescaledb-module` | `redis-module` | — |
| Control | `mariadb-control` | — | — | — |
| Alert | `mariadb-alert` | — | `redis-alert` | — |
| Stream | `mariadb-stream` | — | — | `minio-stream` |
| ML / Vision | `mariadb-ml` | — | — | `minio-ml` |
| OTA | `mariadb-ota` | — | — | `minio-ota` |
| Analytics | — | `timescaledb-analytics` | — | — |
| Notification | `mariadb-notification` | — | `redis-notification` | — |
| Audit | `mariadb-audit` | — | — | — |
| Webhook | `mariadb-webhook` | — | — | — |

**Total instance database terpisah:** 10× MariaDB · 2× TimescaleDB · 3× Redis · 3× MinIO = **18 instance**

---

## 📂 Struktur Direktori

Proyek diorganisir dengan struktur sebagai berikut:

- **`docker-compose.yml`** — Definisi semua service dan instance database
- **`.env.example`** — Template variabel lingkungan untuk konfigurasi
- **`infra/`** — Konfigurasi infrastruktur pendukung:
  - `mariadb/` — Skema inisialisasi database per service (auth, module, control, alert, stream, ml, ota, notification, audit, webhook)
  - `timescaledb/` — Skema untuk time-series data (module, analytics)
  - `redis/` — Konfigurasi Redis per instance
  - `minio/` — Script inisialisasi bucket
  - `nats/` — Konfigurasi NATS dengan JetStream dan ACL per-service
  - `mosquitto/` — Konfigurasi MQTT broker dan ACL per-topik
  - `mediamtx/` — Konfigurasi MediaMTX untuk streaming video
  - `kong/` — Konfigurasi routing, JWT validation, rate-limiting, CORS
  - `prometheus/` — Konfigurasi Prometheus untuk aggregasi metrik
  - `cloudflared/` — Konfigurasi tunnel Cloudflare
- **`services/`** — Kode sumber microservices (auth, module, control, alert, stream, ota, analytics, notification, audit, websocket, webhook)
- **`vision-api/`** — Service Python untuk YOLOv8 inference
- **`dashboard/`** — Frontend React untuk antarmuka pengguna
- **`docs/`** — Dokumentasi kontrak API, NATS subjects, MQTT topics, webhook payload schema
- **`volumes/`** — Persistent data storage (diabaikan oleh git)

---

## 🔌 NATS Subject Contract

NATS digunakan sebagai event bus untuk komunikasi antar-service. Berikut adalah kontrak subject yang digunakan:

### Core Events

| Subject | Publisher | Subscriber(s) | Pattern |
|---|---|---|---|
| `telemetry.ingest` | Module Service | Alert, Analytics, WebSocket, Webhook | Pub/Sub |
| `telemetry.batch` | Module Service | Analytics | Pub/Sub |
| `alert.triggered` | Alert Service | Notification, WebSocket, Webhook | Pub/Sub |
| `alert.resolved` | Alert Service | Notification, WebSocket, Webhook | Pub/Sub |
| `control.commands.>` | Control Service | Control Service (reply) | Request-Reply |
| `detection.result` | Vision API | Analytics, WebSocket, Webhook | Pub/Sub |
| `audit.log` | Semua service | Audit Service | Pub/Sub |
| `metrics.health` | Semua service | Prometheus | Pub/Sub |
| `webhook.delivery` | Webhook Service | Audit Service | Pub/Sub |
| `webhook.retry` | Webhook Service | Webhook Service (internal) | Queue |

### Saga Events

| Subject | Publisher | Subscriber(s) | Pattern |
|---|---|---|---|
| `saga.telemetry.>` | Module Service | Alert, Analytics | Saga Step |
| `saga.control.>` | Control Service | ESP32 / Mosquitto | Saga Step |
| `saga.ota.>` | OTA Service | Module, Notification | Saga Step |
| `saga.alert.ml` | Alert Service | Notification Service | Saga Step |
| `saga.*.compensate` | Service terkait | Service terkait | Compensating Transaction |
| `saga.*.dlq` | NATS (auto) | Audit Service | Dead Letter Queue |

---

## 🔄 Saga Pattern via NATS

Sistem menggunakan **Choreography-based Saga** untuk menangani transaksi terdistribusi antar-service. Dalam pola ini, setiap service bereaksi terhadap event dari service sebelumnya dan mempublikasikan event berikutnya secara otonom. Jika suatu langkah gagal, service yang bertanggung jawab mempublikasikan event **kompensasi** untuk membatalkan efek dari langkah-langkah sebelumnya.

**Mengapa Choreography (bukan Orchestration)?**
- Tidak ada central orchestrator — setiap service otonom dan hanya mengetahui domain-nya sendiri
- Lebih resilient: kegagalan satu service tidak memblokir service lain
- Sesuai dengan prinsip Database-per-Service dan Zero-Trust Internal
- Skalabilitas lebih baik karena tidak ada single point of failure

### Prinsip Implementasi Saga

| Prinsip | Detail |
|---|---|
| **Idempotency** | Setiap step harus idempotent — pesan yang sama diproses dua kali tidak boleh menyebabkan duplikasi data |
| **Saga ID** | Setiap event menyertakan `saga_id` (UUID v4) dan `step` untuk traceability end-to-end |
| **JetStream Persistence** | Semua subject `saga.*` menggunakan JetStream stream `SAGA` untuk menjamin pesan tidak hilang |
| **Dead Letter Queue** | Pesan yang gagal setelah 3 kali retry otomatis masuk ke `saga.*.dlq` dan dikonsumsi oleh Audit Service |
| **Compensating Transaction** | Setiap langkah maju (forward step) memiliki pasangan kompensasi untuk mekanisme rollback |
| **Timeout** | Control: 500 ms · OTA: 30 menit · Telemetry: 5 detik |

### Saga 1 — Telemetry Ingest & Alert

Alur ketika data sensor masuk dari ESP32 hingga notifikasi dikirim ke pengguna:

1. **Module Service** menyimpan data sensor ke database, lalu mempublikasikan `saga.telemetry.saved`
2. **Alert Service** mengevaluasi threshold — jika terlampaui, buat record alert dan publikasikan `saga.alert.evaluated`; jika normal, publikasikan `saga.alert.skipped`
3. **Notification Service** mengirim notifikasi ke pengguna dan publikasikan `saga.notif.sent`
4. **Kompensasi:** Jika penyimpanan database gagal, Module Service publikasikan `saga.telemetry.compensate`; jika alert invalid, Alert Service publikasikan `saga.alert.compensate`

### Saga 2 — Control Command ke ESP32

Alur ketika operator mengirim perintah ke perangkat (misalnya menyalakan pompa):

1. **Control Service** menerima perintah, set status `pending` di database, publikasikan `saga.control.initiated`
2. **ESP32** mengirim ACK via MQTT, Control Service update status menjadi `sent`
3. **Control Service** konfirmasi eksekusi, status menjadi `done`, publikasikan `saga.control.completed`
4. **Kompensasi:** Jika timeout 500 ms tanpa ACK, Control Service publikasikan `saga.control.compensate`, status menjadi `failed`, dan notifikasi dikirim ke operator

### Saga 3 — OTA Firmware Update

Alur pembaruan firmware ke ESP32 secara aman:

1. **OTA Service** upload firmware baru ke MinIO, publikasikan `saga.ota.ready`
2. **Module Service** kirim URL firmware ke ESP32 via MQTT topic `ota/push/{device}`
3. **ESP32** konfirmasi download, status menjadi `downloading`
4. **OTA Service** konfirmasi instalasi selesai, status menjadi `installed`
5. **Kompensasi:** Jika timeout 30 menit tanpa konfirmasi, OTA Service publikasikan `saga.ota.compensate`, status menjadi `failed`, notifikasi dikirim ke admin

### Saga 4 — ML Detection → Alert

Alur ketika Vision API mendeteksi anomali visual (misalnya hama pada tanaman):

1. **Vision API** mempublikasikan `detection.result` dengan hasil deteksi YOLOv8
2. **Alert Service** mengevaluasi confidence score — jika di atas threshold, publikasikan `saga.alert.ml`
3. **Notification Service** mengirim notifikasi ke pengguna
4. **Kompensasi:** Jika confidence score di bawah threshold, Alert Service publikasikan `saga.alert.ml.compensate` untuk membatalkan alert

### Struktur Payload Event Saga

Setiap event saga memiliki struktur payload yang konsisten mencakup: `saga_id` (UUID v4), `step` (nama langkah), `service` (publisher), `timestamp` (ISO 8601), `payload` (data spesifik), dan `meta` (retry_count, correlation_id, trace_id).

---

## 🧱 Fase Implementasi

### ✅ Fase 0 — Infrastruktur Dasar (Selesai)
- Struktur direktori dan docker-compose.yml untuk fase awal
- Konfigurasi NATS (JetStream + per-service authentication)
- Konfigurasi Kong (routing, JWT, rate-limiting, CORS)
- Skema database Auth Service (RBAC + seed data)

### ✅ Fase 1 — Auth Service [P1 — SELESAI]
- Scaffold Go service dengan struktur internal (model, repository, service, handler, middleware)
- Endpoint autentikasi: register, login (email **atau** username via field `identifier`), refresh token, logout, profile/me
- Middleware RBAC dengan tiga level akses: Admin, Operator, Viewer
- Publisher NATS untuk audit log pada setiap event autentikasi
- Cron job untuk pembersihan refresh token expired dan user inaktif
- Dockerfile multi-stage dan healthcheck endpoint
- Seed akun admin default (env `ADMIN_*`) saat migrasi pertama — idempoten
- Endpoint manajemen akun (admin only): list users, list roles, ubah status aktif/role, hapus akun, dengan guard self-deactivate/demote & last-admin
- Prometheus `/metrics` (client_golang) + plugin Kong `prometheus` — semua target UP

### ✅ Fase 1 — Dashboard (Auth-only) [P1 — SELESAI]
- Dashboard React terhubung ke Kong (`VITE_API_URL`, default `http://localhost:8000`)
- Fokus fitur Auth: login (identifier + show/hide password), register, profile, ubah password, sesi, deactivate
- Halaman non-auth (telemetri/control/video) di-hide, kode tetap di disk
- Menu **Manajemen Akun** hanya muncul untuk user ber-role `admin`

### ⬜ Fase 2 — Module Service [P2]
- MQTT subscriber dari Mosquitto untuk menerima data sensor
- Penyimpanan telemetri ke MariaDB (metadata) dan TimescaleDB (time-series)
- Konfigurasi hypertable dengan time-partitioning pada kolom waktu
- Publisher NATS untuk event telemetry.ingest
- Cache data terakhir ke Redis
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 3 — Control Service [P3]
- REST endpoint untuk mengirim perintah ke device
- NATS Request-Reply pattern dengan timeout 500 ms untuk perintah darurat
- Publisher MQTT ke Mosquitto untuk diteruskan ke ESP32
- Audit log untuk setiap perintah yang dikirim
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 4 — Alert Service [P4]
- Subscriber NATS untuk event telemetry.ingest
- Evaluasi threshold yang dikonfigurasi di database
- Cache threshold ke Redis untuk akses cepat
- Publisher event alert.triggered dan alert.resolved
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 5 — Stream Service [P5]
- Integrasi dengan MediaMTX untuk streaming HLS/WebRTC
- Penyimpanan metadata stream ke MariaDB
- Upload snapshot ke MinIO
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 6 — ML / Vision API [P6]
- YOLOv8 inference service menggunakan Python
- Penyimpanan hasil deteksi ke MariaDB
- Upload annotated image ke MinIO
- Publisher event detection.result ke NATS
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 7 — Analytics Service [P7]
- Subscriber NATS untuk semua event telemetry
- Agregasi data time-series ke TimescaleDB
- Implementasi data retention policy dengan continuous aggregate dan drop chunk
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 8 — Audit Service [P8]
- Subscriber NATS untuk subject audit.log
- Append-only insert ke MariaDB untuk immutability log
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 9 — WebSocket Service [P9]
- Subscriber multi-subject NATS untuk real-time events (telemetry, alert, detection)
- Maintain koneksi WebSocket persistent dengan dashboard
- Broadcast event ke seluruh client yang terhubung
- Auto-reconnect dan connection pooling
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 10 — Webhook Service [P10]
- REST endpoint untuk registrasi webhook oleh pengguna
- Subscriber NATS untuk event yang akan diforward ke eksternal
- HTTP client untuk mengirim payload ke endpoint eksternal
- Retry mechanism dengan exponential backoff (3x percobaan)
- Tracking status pengiriman (success, failed, pending)
- Publisher event `webhook.delivery` untuk audit trail
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 11 — Prometheus Metrics Service [P11]
- Subscriber NATS untuk subject `metrics.health` dari seluruh service
- Aggregasi metrik health dan performa sistem
- Expose endpoint `/metrics` untuk Prometheus scraping
- Metrik yang dikumpulkan: request count, error rate, response time, uptime, resource usage
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 12 — Notification Service [P12]
- Subscriber NATS untuk event alert.triggered
- Multi-channel notification: Push notification, Email, Telegram
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 13 — Dashboard [P13]
- React application (reuse dari Aeroponik-Docker)
- Koneksi WebSocket ke WebSocket Service
- Visualisasi telemetri real-time, manajemen alert, dan kontrol device

### ⬜ Fase 14 — OTA Service [P14]
- Upload firmware binary ke MinIO
- Trigger update ke ESP32 via MQTT
- Tracking status update per device
- Publisher metrik health ke subject `metrics.health`

### ⬜ Fase 15 — Cloudflare Tunnel [P15]
- Konfigurasi cloudflared tunnel ke Kong:8000
- TLS end-to-end untuk koneksi aman dari internet

---

## 🔐 Keamanan

| Aspek | Implementasi |
|---|---|
| Autentikasi | JWT HS256 dengan expiry 15 menit |
| Refresh Token | Rotation + revocation, hash disimpan di database |
| RBAC | Tiga level akses: Admin, Operator, Viewer — divalidasi per endpoint |
| Database Isolation | Setiap service hanya mengetahui kredensial database miliknya sendiri |
| Network Isolation | Semua container berada di network private `iot-net`, hanya Kong yang terekspos ke host |
| Rate Limiting | Kong: 20 req/min untuk endpoint auth, 60–120 req/min untuk endpoint lain |
| CORS | Whitelist origin eksplisit, tidak menggunakan wildcard |
| MQTT ACL | Kontrol akses per-topik per-service di konfigurasi Mosquitto |
| NATS ACL | Kontrol akses per-subject per-user di konfigurasi NATS |
| Webhook Auth | Setiap webhook endpoint eksternal memerlukan secret token untuk verifikasi |

---

## 📊 Monitoring dan Observability

- **Healthcheck:** Setiap service menyediakan endpoint `/health` untuk Docker healthcheck
- **Metrics Pipeline (saat ini):** Service mengekspos endpoint `/metrics` (Prometheus client) yang di-scrape langsung oleh Prometheus server. Auth Service → `auth:8080/metrics`, Kong → `kong:8001/metrics` (plugin prometheus). Target `prometheus`, `auth-service`, `kong` semua UP.
- **Metrics Pipeline (rencana):** Setiap service juga mempublikasikan metrik health ke subject `metrics.health` via NATS, dikonsumsi oleh Prometheus Service (lihat Fase 11).
- **Audit Trail:** Semua operasi kritis dicatat melalui event `audit.log` ke NATS
- **Saga Tracing:** Setiap transaksi saga memiliki `saga_id` dan `trace_id` untuk end-to-end tracing
- **Dead Letter Queue:** Pesan gagal terkumpul di subject `saga.*.dlq` untuk investigasi
- **Webhook Delivery Log:** Setiap pengiriman webhook ke eksternal dicatat melalui event `webhook.delivery`

---

## ✅ Kriteria Selesai

- Semua service dan 18 instance database dalam status `healthy` setelah `docker compose up -d`
- Tidak ada service yang mengakses database milik service lain (verifikasi via environment variables dan network policy)
- End-to-end flow ESP32 → Module → NATS → WebSocket → Dashboard berjalan
- End-to-end flow Alert → Notification → Webhook (eksternal) berjalan
- End-to-end flow Control → ESP32 berjalan
- End-to-end flow Stream → ML → MinIO berjalan
- End-to-end flow Metrics: semua service → NATS → Prometheus → /metrics berjalan
- Kong JWT validation berfungsi pada semua protected routes
- Webhook Service dapat mengirim event ke endpoint eksternal dengan retry mechanism
- Semua service memiliki unit test dengan minimal 80% code coverage

---

## 📝 Catatan Teknis

- **Bahasa Pemrograman:** Go untuk microservices, Python untuk Vision API, JavaScript/React untuk Dashboard
- **Container Runtime:** Docker Compose untuk development dan staging
- **Message Broker:** NATS JetStream untuk event bus, Mosquitto untuk MQTT
- **Database:** MariaDB untuk data relasional, TimescaleDB untuk time-series, Redis untuk caching, MinIO untuk object storage
- **API Gateway:** Kong dengan plugin JWT, rate-limiting, dan CORS
- **Streaming:** MediaMTX untuk RTSP/HLS/WebRTC
- **Metrics:** Prometheus untuk aggregasi metrik dari seluruh service
- **Deployment:** Cloudflare Tunnel untuk akses publik yang aman