# 📋 Planning — IOT-Modular-Microservice

> **Versi Dokumen:** 2.7.0  
> **Tanggal:** 2026-07-13  
> **Status:** 🟢 Fase 1-5 + Monitor Service Selesai — Fase 4 (Control) & Fase 5 (Stream) Selesai + Audit Fix #1/#2 (Module hot-path cache & telemetry.batch JetStream)  
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
| **Single Responsibility** | Setiap service hanya bertanggung jawab atas satu domain bisnis | Auth Service hanya menangani autentikasi, Module Service hanya menangani data sensor & device onboarding, Analytics Service hanya menangani agregasi data — tidak ada overlap tanggung jawab |
| **Database Isolation** | Setiap service memiliki database sendiri, tidak ada sharing database antar service | 17 instance database terpisah untuk 13 service (MinIO dikonsolidasi jadi 1 instance bersama multi-bucket), masing-masing dengan kredensial unik |
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

- **Kompleksitas Operasional:** 17 instance database dan 13+ service membutuhkan monitoring dan orkestrasi yang lebih kompleks dibandingkan monolit.
- **Network Overhead:** Komunikasi antar-service via NATS menambah latency dibandingkan pemanggilan fungsi langsung dalam monolit.
- **Data Consistency:** Eventual consistency adalah konsekuensi dari arsitektur terdistribusi — transaksi yang membutuhkan strong consistency harus menggunakan saga pattern dengan compensating transaction.
- **Debugging Complexity:** Melacak alur transaksi yang melintasi beberapa service membutuhkan tool observability yang memadai (distributed tracing, centralized logging).

---

## 🏗️ Arsitektur Sistem

### Topologi

Sistem terdiri dari beberapa lapisan yang saling terintegrasi:

- **Device Layer:** ESP32 mengirim data sensor via MQTT ke Mosquitto broker
- **Ingestion Layer:** Module Service menerima data dari Mosquitto, menyimpan ke database (MariaDB + TimescaleDB), dan mempublikasikan ke NATS
- **Processing Layer:** Analytics Service, Stream Service (MediaMTX + MinIO *bucket `stream`*), dan (future) ML/Vision API (MinIO *bucket `ml-vision`* di instance MinIO bersama) memproses data secara real-time
- **Control Layer:** Control Service mengirim perintah balik ke ESP32 melalui MQTT
- **Streaming Layer:** Stream Service + MediaMTX (RTSP→HLS/WebRTC) + MinIO bersama (bucket `stream`: snapshot/recording) untuk kamera CCTV/ESP32-CAM
- **Gateway Layer:** Kong sebagai API Gateway tunggal untuk semua traffic eksternal
- **Presentation Layer:** Dashboard (React) dan WebSocket Service untuk real-time updates
- **Integration Layer:** Webhook Service sebagai jembatan event-driven ke sistem eksternal
- **Observability Layer:** Prometheus + exporter (mysqld/postgres/redis/mosquitto/nats) untuk aggregasi metrik; Monitor Service untuk resource container
- **Infrastructure Layer:** NATS untuk event bus, Cloudflare Tunnel (scaffold) untuk akses aman dari internet

### Diagram Alur Data End-to-End (Saat Ini)

```
ESP32 → MQTT (Mosquitto) → Module Service → MariaDB (metadata)
                                            → TimescaleDB (time-series)
                                            → Redis (cache)
                                            → NATS (telemetry.ingest + telemetry.batch)
                                                 → Analytics Service → TimescaleDB (analytics)
                                                 → WS-Gateway → WebSocket → Dashboard (realtime telemetry)
                                                  → Stream Service → MediaMTX (HLS/WebRTC) + MinIO bucket `stream` (snapshot/recording)
                                                 → (future) Alert Service
                                                 → (future) Audit Service

CCTV / ESP32-CAM → RTSP → MediaMTX → Stream Service (register path) → HLS/WebRTC → Dashboard Live View

User → Browser → Kong (API Gateway) → Auth Service (JWT validation)
                                      → Module Service (CRUD modules/nodes)
                                      → Analytics Service (query agregasi)
                                      → Control Service (perintah actuator)
                                      → Stream Service (CRUD stream + snapshot/recording)
                                      → WS-Gateway (WebSocket real-time)
```

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

| Service | MariaDB | TimescaleDB | Redis | MinIO (instance bersama `minio`) | Status |
|---|---|---|---|---|---|
| Auth | `mariadb-auth` | — | — | — | ✅ Running |
| Module | `mariadb-module` | `timescaledb-module` | `redis-module` | — | ✅ Running |
| Control | `mariadb-control` | — | — | — | ✅ Running |
| Stream | `mariadb-stream` | — | — | bucket `stream` | ✅ Running |
| Alert | `mariadb-alert` | — | `redis-alert` | — | ⬜ Belum |
| ML / Vision | `mariadb-ml` | — | — | bucket `ml-vision` | ✅ Running |
| OTA | `mariadb-ota` | — | — | bucket `ota` | ⬜ Belum |
| Analytics | — | `timescaledb-analytics` | — | — | ✅ Running |
| Export | — | `timescaledb-module` (read) | `redis-export` | — | ⬜ Belum |
| Notification | `mariadb-notification` | — | `redis-notification` | — | ⬜ Belum |
| Audit | `mariadb-audit` | — | — | — | ⬜ Belum |
| Webhook | `mariadb-webhook` | — | — | — | ⬜ Belum |
| Monitor | — (docker stats) | — | — | — | ✅ Running |

> **Keputusan Konsolidasi MinIO (2026-07-12):** Tidak lagi membuat instance MinIO terpisah per service (`minio-stream`, `minio-ml`, `minio-ota`). Cukup **1 instance MinIO bersama** (`minio`) dengan **multi-bucket** (`stream`, `ml-vision`, `ota`) dan **access key ter-scoping per service** (prinsip *Zero-Trust Internal* tetap terjaga). Stream tetap menulis snapshot/recording ke bucket `stream` miliknya → tidak bergantung ML yang belum dibuat. ML membaca frame sumber dari bucket `stream` (key read-only) dan menulis hasil anotasi ke bucket `ml-vision`.

**Object storage:** 1× instance MinIO bersama (`minio`, multi-bucket + scoped access key) untuk Stream / ML / OTA.
**Total instance database terpisah:** 10× MariaDB · 2× TimescaleDB · 4× Redis · 1× MinIO = **17 instance**
**Sudan berjalan:** 4× MariaDB · 2× TimescaleDB · 1× Redis · 1× MinIO = **8 instance**

---

## 📂 Struktur Direktori

Proyek diorganisir dengan struktur sebagai berikut:

- **`docker-compose.yml`** — Definisi semua service dan instance database (saat ini: auth, module, analytics, wsgateway, nats, mosquitto, kong, prometheus)
- **`.env.example`** — Template variabel lingkungan untuk konfigurasi
- **`infra/`** — Konfigurasi infrastruktur pendukung:
  - `mariadb/` — Skema inisialisasi database per service (auth ✅, module ✅, control ⬜, alert ⬜, stream ⬜, ml ⬜, ota ⬜, notification ⬜, audit ⬜, webhook ⬜)
  - `timescaledb/` — Skema untuk time-series data (module ✅, analytics ✅)
  - `redis/` — Konfigurasi Redis per instance
  - `minio/` — Script inisialisasi bucket
  - `nats/` — Konfigurasi NATS dengan JetStream dan ACL per-service ✅
  - `mosquitto/` — Konfigurasi MQTT broker dan ACL per-topik ✅
  - `mediamtx/` — Konfigurasi MediaMTX untuk streaming video
  - `kong/` — Konfigurasi routing, JWT validation, rate-limiting, CORS ✅
  - `prometheus/` — Konfigurasi Prometheus untuk aggregasi metrik ✅
  - `cloudflared/` — Konfigurasi tunnel Cloudflare
- **`services/`** — Kode sumber microservices:
  - `auth/` ✅ — Service autentikasi (Go)
  - `module/` ✅ — Service manajemen device & telemetri (Go)
  - `analytics/` ✅ — Service agregasi data time-series (Go)
  - `wsgateway/` ✅ — WebSocket bridge NATS → Dashboard (Go)
  - `export/` ⬜ — Service ekspor data untuk akses eksternal/Python (Go/Python)
  - `control/` ✅ — Service kontrol device
  - `alert/` ⬜ — Service evaluasi threshold
  - `stream/` ⬜ — Service streaming video
  - `ota/` ⬜ — Service update firmware
  - `notification/` ⬜ — Service notifikasi multi-channel
  - `audit/` ⬜ — Service audit log
  - `webhook/` ⬜ — Service webhook eksternal
- **`ml/`** ⬜ — Service Python untuk YOLOv8 inference
- **`dashboard/`** ✅ — Frontend React untuk antarmuka pengguna
- **`docs/`** — Dokumentasi kontrak API, NATS subjects, MQTT topics, webhook payload schema
- **`volumes/`** — Persistent data storage (diabaikan oleh git)

---

## 🔌 NATS Subject Contract

NATS digunakan sebagai event bus untuk komunikasi antar-service. Berikut adalah kontrak subject yang digunakan:

### Core Events

| Subject | Publisher | Subscriber(s) | Pattern | Status |
|---|---|---|---|---|
| `telemetry.ingest` | Module Service | Alert, Analytics, WebSocket, Webhook | Pub/Sub | ✅ Aktif |
| `telemetry.batch` | Module Service | Analytics | Pub/Sub | ✅ Aktif |
| `alert.triggered` | Alert Service | Notification, WebSocket, Webhook | Pub/Sub | ⬜ Belum |
| `alert.resolved` | Alert Service | Notification, WebSocket, Webhook | Pub/Sub | ⬜ Belum |
| `control.commands.>` | Control Service | Control Service (reply) | Request-Reply | ⬜ Belum |
| `detection.result` | Vision API | Analytics, WebSocket, Webhook | Pub/Sub | ✅ Dipublish |
| `audit.log` | Semua service | Audit Service | Pub/Sub | ✅ Dipublish (Auth, Module) tapi ⬜ belum di-consume |
| `metrics.health` | Semua service | Prometheus | Pub/Sub | ⬜ Belum (masih scrape langsung) |
| `webhook.delivery` | Webhook Service | Audit Service | Pub/Sub | ⬜ Belum |
| `webhook.retry` | Webhook Service | Webhook Service (internal) | Queue | ⬜ Belum |

### Saga Events

| Subject | Publisher | Subscriber(s) | Pattern |
|---|---|---|---|
| `saga.telemetry.>` | Module Service | Alert, Analytics | Saga Step |
| `saga.control.>` | Control Service | ESP32 / Mosquitto | Saga Step |
| `saga.ota.>` | OTA Service | Module, Notification | Saga Step |
| `saga.alert.ml` | Alert Service | Notification Service | Saga Step |
| `saga.*.compensate` | Service terkait | Service terkait | Compensating Transaction |
| `saga.*.dlq` | NATS (auto) | Audit Service | Dead Letter Queue |

### Catatan Penting: Core NATS vs JetStream

| Subject | Tipe | Keterangan |
|---|---|---|
| `telemetry.ingest` | Core NATS | Pesan tidak di-buffer; subscriber offline akan kehilangan pesan (cukup untuk live WS fan-out) |
| `telemetry.batch` | **JetStream** (stream `TELEMETRY_BATCH`, durable consumer `analytics-batch`) | ✅ Persisten + replay otomatis — Analytics restart tidak lagi menghilangkan window agregat 1-menit |
| `audit.log` | Core NATS | Pesan audit hilang jika Audit Service belum berjalan |
| `saga.*` | JetStream (SAGA stream) | Dijamin persistence dengan retry & DLQ |

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

1. **Control Service** menerima perintah (manual) atau scheduler memicu (otomatis), set status `pending` di database, publish MQTT `set_output` ke `smartfarm/actuator/{node_id}` dengan `req_id`
2. **ESP32** eksekusi lalu kirim ACK via MQTT `smartfarm/{node_id}/confirm`; Module Service fan-out ke NATS → Control Service korelasi `req_id`, status `acked`
3. **Verifikasi:** state final dikonfirmasi via `telemetry.outputs.{name}`, status menjadi `done`
4. **Kompensasi:** Jika timeout tanpa `/confirm`, status menjadi `failed` dan notifikasi dikirim ke operator

> Catatan: firmware membalas ACK via **MQTT `/confirm`**, bukan NATS Request-Reply sinkron. Timeout ditetapkan Control Service (mis. 2–5 detik, menyesuaikan interval telemetry 5s).

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

Setiap event saga memiliki struktur payload yang konsisten:
```json
{
  "saga_id": "uuid-v4",
  "step": "telemetry.saved",
  "service": "module-service",
  "timestamp": "2026-07-11T10:00:00Z",
  "payload": { /* data spesifik */ },
  "meta": {
    "retry_count": 0,
    "correlation_id": "uuid",
    "trace_id": "uuid"
  }
}
```

---

## 🧱 Fase Implementasi

### ✅ Fase 0 — Infrastruktur Dasar (Selesai)
- Struktur direktori dan docker-compose.yml untuk fase awal
- Konfigurasi NATS (JetStream + per-service authentication)
- Konfigurasi Kong (routing, JWT, rate-limiting, CORS)
- Skema database Auth Service (RBAC + seed data)
- Konfigurasi Mosquitto (MQTT broker + ACL per-topik)
- Konfigurasi Prometheus (scrape targets)

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

### ✅ Fase 2 — Module Service [P2 — SELESAI]

#### 2a — Onboarding Perangkat
- Scaffold Module Service (Go) dengan struktur internal mirror pola Auth
- Skema `module_db` (MariaDB): tabel `modules` & `nodes` via GORM AutoMigrate
- MQTT subscriber `discovery` → auto-register node (unpaired)
- MQTT subscriber `status/#` → update status + last_seen
- Redis status cache dengan TTL
- REST: Module CRUD (`POST/GET/PUT/DELETE /modules`)
- REST: Node onboarding (`GET /nodes`, `GET /nodes/discovered`, `pair`, `unpair`, `DELETE`)
- NATS `audit.log` publish saat module/node created/paired/unpaired/deleted
- TimescaleDB provisioning + hypertable `telemetry`
- Dockerfile multi-stage + healthcheck
- Kong route + Prometheus scrape

#### 2b — Telemetry Ingest
- MQTT subscriber telemetry `smartfarm/{node}/telemetry` → `IngestTelemetry`
- Tag mapping (modular): tabel `node_tags` — source_key → tag_name DB, bisa diubah di UI
- Simpan ke TimescaleDB hypertable `telemetry` (node_id, module_id, metric, value, raw)
- Cache ke Redis nilai terbaru per node (`node:latest:{id}`, TTL)
- Publish NATS `telemetry.ingest` per reading
- Publish NATS `telemetry.batch` setiap 1 menit (agregat count/sum/min/max/avg/last)

### ✅ Fase 3 — Analytics Service [P2 — SELESAI]
- Subscribe `telemetry.batch` dari NATS **JetStream** (durable consumer `analytics-batch`, replay otomatis saat restart)
- Upsert agregat ke `metrics_rollup` di `timescaledb-analytics` (Database-per-Service)
- Continuous aggregate: `metrics_hourly`, `metrics_daily` dengan auto-refresh
- Data Retention Policy (berjenjang): raw `metrics_rollup` 30 hari, `metrics_hourly` 365 hari, `metrics_daily` **3650 hari (10 tahun)**
- Compression policy 7 hari pada `metrics_hourly` & `metrics_daily` (storage murah untuk history panjang)
- REST API via Kong: `/analytics/metrics`, `/analytics/summary`, `/analytics/nodes`, `/analytics/export` (CSV bulk download riset — `?node_id&metric&resolution=day|hour|raw&from&to`)
- Dashboard halaman Analytics dengan Line chart (Chart.js), selector node + metric, range 1h/6h/24h/7d/30d
- Prometheus target UP

### ✅ Fase 3 — WS-Gateway [P2 — SELESAI]
- Service `wsgateway` (NATS → WebSocket bridge), route `/ws` via Kong
- Subscribe `mqtt.{node_id}` → push realtime payload ke dashboard (`/ws/nodes/{node_id}/live`)
- ✅ **Autentikasi koneksi WS via JWT** — validasi access token (Bearer header / `?token=`) pakai `JWT_SECRET` yang sama dengan Auth Service
- ⬜ **`system-status` / notifikasi multi-subject (NotificationContext)** — ditunda (belum diperlukan)

### ✅ Fase 4 — Control Service [P2 — SELESAI]

> Dua mode: **Manual** (publish langsung) dan **Otomatis** (scheduler **server-side** — interval/jadwal/threshold nyala-mati). Firmware = *dumb actuator*; semua penjadwalan di Control Service.

#### Yang sudah dikerjakan (status 2026-07-12)
- **Backend (Go):** arbitrasi mode node-level via sentinel `output_name='*'` di tabel `control_modes`. `HandleManualCommand` menolak override manual di mode `AUTO`/`EMERGENCY` (kecuali `emergency_stop`); `EnabledSchedules` menjeda scheduler node saat mode `MANUAL`/`EMERGENCY`.
- **Persistensi mode pra-emergency:** kolom `prev_mode` ditambahkan ke `gormControlMode` (AutoMigrate). `EnterEmergency` menyimpan mode aktif sebelum emergency; `ResumeNode` mengembalikan mode tersebut (default `AUTO` bila `prev_mode` kosong), sehingga **Resume merestorasi mode sebelum emergency**, bukan selalu AUTO.
- **Endpoint:** `PUT /control/modes/{node_id}`, `GET`, `POST .../resume` (Kong sudah route `/control/modes`).
- **Dashboard (React):** Halaman **Control Panel** dengan kartu *Control Mode* (badge MANUAL / OTOMATIS · BERJALAN NORMAL / EMERGENCY STOP, toggle Manual⇄Otomatis, tombol Emergency Stop, tombol Resume yang hanya muncul saat EMERGENCY). Perbaikan bug: `TargetTile` kini menerima `nodeMode` sehingga tombol manual ON/OFF/Toggle/level aktif hanya di mode MANUAL.
- **Jadwal:** CRUD jadwal + **edit** (prefill form, `PUT /control/schedules/{id}`) + toggle enable/disable + **pagination** (PAGE_SIZE=4) agar rapi saat jadwal banyak.

#### Kontrak nyata firmware (hasil audit `firmware/aeroponic-node`)
Skema ini **menggantikan** asumsi lama (`cmd/{device_id}` + NATS Request-Reply):
- **Topik command:** `smartfarm/actuator/{node_id}` (bukan `cmd/{device_id}`) — `ConfigManager.cpp:142`
- **Action:** hanya `set_output` (eksekusi seketika, tanpa scheduler lokal)
- **Payload:** `{"action":"set_output","target":"<output_name>","value":<int>,"req_id":"<opsional>"}`
  - `value`: DIGITAL → `0`/`1` · PWM → `0–255`; `target` = `HardwareOutputs[].name`
- **ACK:** via MQTT `smartfarm/{node_id}/confirm` (**bukan** NATS Request-Reply) → korelasi `req_id`; fallback verifikasi via `telemetry.outputs.{name}`
- **Fitur lokal firmware:** local control threshold+histeresis & emergency shutdown (interrupt → semua OFF)

#### Type control — Manual (publish seketika)
- `set_state` (ON/OFF DIGITAL) · `set_level` (PWM 0–100%→0–255) · `toggle` · `pulse` (ON X detik lalu OFF, timer server) · `emergency_stop` (semua output=0)

#### Type control — Otomatis (scheduler server-side)
- `interval` ⭐ (ON x detik / OFF y detik berulang — pola pompa aeroponik)
- `schedule` (cron jam nyala/mati) · `threshold` (sensor + histeresis) · `duration` (nyala total durasi) · `ramp` (PWM bertahap)

#### Implementasi
- `POST /control/command` — mode manual, publish `set_output` seketika (JWT Operator/Admin)
- Publish MQTT ke `smartfarm/actuator/{node_id}` + ACL Mosquitto (izin publish `smartfarm/actuator/#`)
- Korelasi ACK dari `/confirm` (via NATS fan-out Module Service), timeout → `failed`
- CRUD `schedules` + scheduler engine (goroutine/cron) untuk mode otomatis
- Simpan ke MariaDB (`mariadb-control`) + publish `audit.log`
- Dockerfile + healthcheck + Kong route + Prometheus

#### Database `mariadb-control`
- `control_targets` (katalog output per node), `control_modes` (MANUAL/AUTO per output), `schedules` (definisi otomatis + params JSON), `commands` (log: req_id, status pending→sent→acked / timeout / failed)

### ⬜ Fase 5 — Alert Service [P2]
- Subscribe NATS `telemetry.ingest`
- Ambil threshold dari `mariadb-alert`, cache di `redis-alert`
- Evaluasi threshold — bandingkan nilai sensor dengan batas min/max
- Publish `alert.triggered` jika threshold terlampaui
- Publish `alert.resolved` jika nilai kembali normal
- REST endpoint: `GET /alerts`, `PUT /alerts/:id/ack`
- Dockerfile + healthcheck

### ⬜ Fase 5 — Notification Service [P3]
- Subscribe NATS `alert.triggered`, `alert.resolved`
- Multi-channel: Push notification, Email (SMTP), Telegram (Bot API)
- Queue di `redis-notification` sebagai antrian notifikasi (retry)
- Simpan log notifikasi di `mariadb-notification`
- Dockerfile + healthcheck

### ⬜ Fase 6 — Stream Service [P3]
- Integrasi MediaMTX untuk streaming HLS/WebRTC
- Metadata stream di `mariadb-stream`
- Upload snapshot ke MinIO bersama (bucket `stream`)

### ✅ Fase 6 — ML / Vision API [P3 — SELESAI]

> Service Python/FastAPI yang berdiri sendiri dari Go microservices. Inti: **Model Registry** — model YOLO (mis. `best.pt`) didaftarkan dan memperoleh `model_id` stabil; user memilih `model_id` saat inferensi (atau default bila kosong). Swap model tanpa restart.

- **Model Registry:** `POST/GET/PUT/DELETE /ml/models`, `POST /ml/models/{id}/activate` (jadikan default), `POST /ml/models/{id}/weights` (upload `.pt`). Weights dari volume `models/` (`file_path`, default `best.pt`) atau di-upload via API. Load YOLO **lazy + cache per `model_id`**; reload otomatis saat config/weights berubah.
- **Inference YOLOv8:** `POST /ml/detect` (upload 1..N gambar → deteksi class/confidence/bbox + gambar teranotasi), `POST /ml/detect/base64`, `POST /ml/detect/from-stream` (frame dari bucket `stream`). Threshold/iou/imgsz dapat di-override per request.
- **Storage:** original + detected JPEG → MinIO bucket `ml-vision` (instance bersama); baca frame dari bucket `stream` (read-only).
- **Persistensi:** `mariadb-ml` → `vision_models` (registry) + `vision_detections` (history), dikelola SQLAlchemy AutoCreate.
- **Events:** publish `detection.result` ke NATS (best-effort) untuk Alert/Analytics/Export.
- **Keamanan:** JWT/RBAC middleware (HS256, secret sama dengan Auth Service); write = admin/operator, read = semua role.
- **Observability:** Prometheus `/metrics` (`vision_inferences_total`, `vision_detections_total`, `vision_inference_seconds`, `vision_models_loaded`) + `mariadb-ml` + `mysqld-exporter-ml`.
 - **Infra:** `Dockerfile` (python:3.11-slim, healthcheck), volume `ml-models` (di-seed `best.pt`), route Kong `/ml`, scrape `ml-service` + `mariadb-ml`.
 - **Auto-seed model `vision-aeroponik`:** saat startup, ML Service mendaftarkan otomatis `vision-aeroponik-model-test.pt` (id/slug `vision-aeroponik`) sebagai model default bila belum ada di registry — sehingga snapshot detection langsung siap pakai tanpa registrasi manual.

### ✅ Fase 6b — Snapshot → AI Vision Detection (Gallery Tab) [P3 — SELESAI]

> Integrasi end-to-end: capture frame dari Live Stream → dikirim ke ML Vision → hasil deteksi (bounding box, class, confidence) disimpan & ditampilkan di Gallery pada tab **DETECTION** yang terpisah dari tab SNAPSHOT / RECORDING.

- **Stream Service (`?detect=true`):** `POST /streams/{id}/snapshot?detect=true` men-capture frame (simpan sebagai `kind=snapshot`), lalu memanggil `POST /ml/detect` dengan model `vision-aeroponik`. Hasil deteksi disimpan sebagai snapshot `kind=detection` (URL = frame asli; metadata `model_id`, `model_name`, `num_detections`, `classes`, `detections` (JSON bbox), `confidence_avg`). Stream Service menandatangani JWT service sendiri (shared `JWT_SECRET`, role admin/operator) untuk memanggil ML tanpa round-trip ke Auth.
- **Auth tereduksi:** ML Client di Stream Service membuat service JWT (HS256) — tidak perlu login ke Auth tiap request.
- **Storage:** deteksi tetap di bucket `stream` (frame asli); kotak digambar di dashboard dari `detections` JSON (tidak bergantung public URL bucket `ml-vision`), sehingga view konsisten lewat proxy `/storage`.
- **Dashboard Gallery (`/snapshot`):** satu halaman dengan toolbar **AI Capture** (pilih stream + *Capture & Detect*) untuk admin/operator, dan tab **ALL / SNAPSHOT / RECORDING / DETECTION**. Tab DETECTION merender overlay bounding box + ringkasan class & confidence (grid & lightbox).
- **Hardening timeout:** `WriteTimeout` Stream Service 30s → 120s; route Kong `stream-service` `write_timeout`/`read_timeout` 10s → 120s (fix 504 *upstream timeout* saat capture + inferensi).

Lihat detail lengkap (endpoint + contoh) di `roadmap.md` → **Fase 6 — ML / Vision API**.
- Subscribe `audit.log` dari NATS
- Append-only insert ke `mariadb-audit` untuk immutability log
- Endpoint `GET /audit/logs` (admin only)
- ⚠️ **Catatan:** Semua service (Auth, Module) sudah publish `audit.log` tapi belum ada yang consume. Data audit menumpuk sia-sia.

### ⬜ Fase 9 — Dashboard (Lengkap) [P3]
- React app (reuse dari Aeroponik-Docker)
- Tampilan telemetri real-time via WebSocket
- Tampilan alert & history
  - Panel kontrol device (Control Panel: mode arbitration + manual override + schedule editor/pagination) ✅
  - Halaman Device Management (file sudah ada, tinggal integrasi penuh)
- Koneksi ke WS-Gateway dengan JWT auth

### ⬜ Fase 9b — Export Service / Data API [P3 — AKSES DATA EKSTERNAL]
> Melayani akses data untuk mahasiswa/peneliti via REST API. Memungkinkan import langsung ke Python pandas, R, Excel, dan tools analisis data lainnya.

#### Latar Belakang
Mahasiswa dan peneliti perlu mengakses data sensor, telemetri, alert, dan metadata untuk keperluan analisis, tugas akhir, dan penelitian. Data tersimpan di berbagai database (TimescaleDB, MariaDB) dan tidak bisa diakses langsung. Export Service menjembatani dengan menyediakan REST API yang menghasilkan output CSV/JSON/Parquet yang siap di-import ke pandas.

#### Arsitektur
```
Mahasiswa (Python/Notebook)
  │ pd.read_csv("https://api.smartfarm.local/export/v1/telemetry?...")
  ▼
Kong API Gateway (JWT Auth + Rate Limiting: 5 req/min)
  │
  ▼
Export Service (Go/Python FastAPI)
  ├─ Query TimescaleDB (telemetry raw + aggregate)
  ├─ Query MariaDB (metadata node, module, alert, audit)
  ├─ Multi-format: CSV, JSON, Parquet, Excel (XLSX)
  ├─ Streaming response (tidak load semua ke memory)
  ├─ Caching query results (redis-export)
  └─ Discover endpoint (self-documenting schema)
```

#### Endpoint

| Method | Endpoint | Deskripsi | Format Output |
|--------|----------|-----------|---------------|
| `GET` | `/export/v1/telemetry` | Data telemetri mentah | CSV, JSON, Parquet |
| `GET` | `/export/v1/telemetry/aggregate` | Data agregat (hourly/daily) | CSV, JSON |
| `GET` | `/export/v1/nodes` | Metadata node & module | CSV, JSON |
| `GET` | `/export/v1/alerts` | History alert | CSV, JSON |
| `GET` | `/export/v1/commands` | Log perintah kontrol | CSV, JSON |
| `GET` | `/export/v1/audit` | Audit log (admin only) | CSV, JSON |
| `GET` | `/export/v1/discover` | List semua tabel & kolom yang tersedia | JSON |

> **Keputusan (Opsi A — 2026-07-13):** Ekspor agregat telemetri untuk riset mahasiswa **tidak** dibuat sebagai service `export/` terpisah, melainkan diimplementasikan langsung di Analytics Service sebagai `GET /analytics/export` (CSV, kolom `bucket,node_id,metric,count,sum,min,max,avg,last`, resolusi `day`/`hour`/`raw`). Daily aggregate (retensi 10 tahun + kompresi) sudah cukup untuk penelitian jangka panjang (termasuk range 5+ tahun); service `export/` terpisah (alerts/commands/audit/Parquet) tetap tertunda.

#### Parameter Query

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `format` | string | `csv` | `csv`, `json`, `parquet`, `xlsx` |
| `from` | ISO8601 | -7 hari | Awal time range |
| `to` | ISO8601 | sekarang | Akhir time range |
| `node_id` | string | semua | Filter per node |
| `metric` | string | semua | Filter per metric |
| `module_id` | string | semua | Filter per module |
| `limit` | int | 10000 | Max baris per response |
| `offset` | int | 0 | Pagination |
| `sort` | string | `time` | Kolom sorting |
| `order` | string | `desc` | `asc` / `desc` |
| `compress` | bool | `false` | GZip response |

#### Contoh Penggunaan dari Python

```python
import pandas as pd

# Setup autentikasi
headers = {"Authorization": "Bearer student-api-key-xxx"}

# Satu baris: export telemetri langsung ke DataFrame
df = pd.read_csv(
    "https://api.smartfarm.local/export/v1/telemetry",
    params={"from": "2026-07-01", "to": "2026-07-11"},
    headers=headers
)

# Filter spesifik
df_node = pd.read_csv(
    "https://api.smartfarm.local/export/v1/telemetry",
    params={"node_id": "ECE334219870", "metric": "cwt1_temperature"},
    headers=headers
)

# Data agregat (lebih ringan)
df_agg = pd.read_csv(
    "https://api.smartfarm.local/export/v1/telemetry/aggregate",
    params={"bucket": "hourly", "from": "2026-06-01", "to": "2026-07-11"},
    headers=headers
)

# Multi-tabel untuk analisis lengkap
nodes = pd.read_csv("https://api.smartfarm.local/export/v1/nodes", headers=headers)
telemetry = pd.read_csv("https://api.smartfarm.local/export/v1/telemetry", params={...}, headers=headers)
alerts = pd.read_csv("https://api.smartfarm.local/export/v1/alerts", params={...}, headers=headers)
df = telemetry.merge(nodes, on="node_id").merge(alerts, on="node_id", how="left")

# Export Parquet untuk big data
import requests
resp = requests.get("https://api.smartfarm.local/export/v1/telemetry",
                    params={"format": "parquet", "limit": 1000000},
                    headers=headers)
with open("data.parquet", "wb") as f:
    f.write(resp.content)
df = pd.read_parquet("data.parquet")
```

#### Keamanan & Access Control

| Aspek | Implementasi |
|-------|-------------|
| Autentikasi | JWT via Kong (sama seperti service lain) |
| Role-based Access | Viewer: data non-sensitif. Admin: semua termasuk audit log |
| Rate Limiting | 5 req/min untuk non-admin, 30 req/min untuk admin |
| Data Limit | Maks 100.000 baris per request (admin: 1.000.000) |
| Time Range Limit | Maks 90 hari per request untuk non-admin |
| API Key Tiers | Student Basic (50 req/hari, 10rb baris, 7 hari), Student Research (200 req/hari, 100rb baris, 90 hari), Admin (unlimited) |

#### Checklist Implementasi

| Status | Item | Deskripsi | Estimasi |
|---|---|---|---|
| `[ ]` | Scaffold service (Go/Python) | Struktur internal, go.mod/requirements.txt | 1 hari |
| `[ ]` | Koneksi ke TimescaleDB (module + analytics) | Read-only query pool | 0.5 hari |
| `[ ]` | Koneksi ke MariaDB (module + auth) | Read-only query untuk metadata | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/telemetry` | Query + streaming CSV/JSON/Parquet | 1 hari |
| `[x]` | Endpoint `/export/v1/telemetry/aggregate` | **Delivered via Analytics Service `GET /analytics/export`** (CSV, resolusi day/hour/raw) — lihat catatan Opsi A | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/nodes` | Metadata node & module | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/alerts` | History alert | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/commands` | Log perintah kontrol | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/audit` (admin only) | Audit log | 0.5 hari |
| `[ ]` | Endpoint `/export/v1/discover` | Self-documenting schema | 0.5 hari |
| `[ ]` | Redis caching (`redis-export`) | Cache query results, TTL configurable | 0.5 hari |
| `[ ]` | Kong route + rate limiting | `/export` route, 5 req/min limit | 0.5 hari |
| `[ ]` | Dockerfile + healthcheck | Multi-stage + `/health` | 0.5 hari |
| `[ ]` | Prometheus metrics | `export_http_requests_total` | 0.5 hari |
| `[ ]` | Dokumentasi API untuk mahasiswa | Contoh pandas, R, Excel | 1 hari |

**Total estimasi: 5-7 hari**

### ⬜ Fase 10 — OTA Service [P4]
- Upload firmware binary ke MinIO bersama (bucket `ota`)
- Trigger update ke ESP32 via MQTT
- Tracking status update per device
- Verifikasi checksum firmware

### ⬜ Fase 11 — Prometheus Metrics Service [P4]
- Subscriber NATS untuk subject `metrics.health` dari seluruh service
- Aggregasi metrik health dan performa sistem
- Expose endpoint `/metrics` untuk Prometheus scraping
- Metrik: request count, error rate, response time, uptime, resource usage
- **Catatan:** Saat ini metrik scrape langsung (bukan via NATS). Fase ini akan mengubah ke arsitektur event-driven.

### ⬜ Fase 12 — Cloudflare Tunnel [P4]
- `cloudflared tunnel run` → Kong:8000
- TLS end-to-end untuk koneksi aman dari internet
- Custom domain mapping

---

## 🔐 Keamanan

| Aspek | Implementasi | Status |
|---|---|---|
| Autentikasi | JWT HS256 dengan expiry 15 menit | ✅ |
| Refresh Token | Rotation + revocation, hash (SHA-256) disimpan di database | ✅ |
| RBAC | Tiga level akses: Admin, Operator, Viewer — divalidasi per endpoint | ✅ |
| Database Isolation | Setiap service hanya mengetahui kredensial database miliknya sendiri | ✅ |
| Network Isolation | Semua container berada di network private `iot-net`, hanya Kong yang terekspos ke host | ✅ |
| Rate Limiting | Kong: 20 req/min untuk endpoint auth publik, 60-120 req/min untuk endpoint lain | ✅ |
| CORS | Whitelist origin eksplisit (localhost:3000, localhost:5173, FRONTEND_URL), tidak menggunakan wildcard | ✅ |
| MQTT ACL | Kontrol akses per-topik per-service di konfigurasi Mosquitto | ✅ |
| NATS ACL | Kontrol akses per-subject per-user di konfigurasi NATS | ✅ |
| WebSocket Auth | ✅ JWT pada handshake WS (Bearer header / `?token=`), validasi via `JWT_SECRET` | ✅ |
| Webhook Auth | Setiap webhook endpoint eksternal memerlukan secret token untuk verifikasi | ⬜ |

---

## 📊 Monitoring dan Observability

| Aspek | Implementasi | Status |
|---|---|---|
| Healthcheck | Setiap service menyediakan endpoint `/health` untuk Docker healthcheck | ✅ |
| Prometheus Metrics | Auth, Module, Analytics, WS-Gateway expose `/metrics`; Kong via plugin prometheus | ✅ |
| Scrape Targets | `prometheus`, `auth-service`, `module-service`, `analytics-service`, `wsgateway-service`, `kong` — semua UP | ✅ |
| Audit Trail | Auth & Module publish `audit.log` ke NATS; ⬜ belum di-consume Audit Service | 🟡 Sebagian |
| Saga Tracing | Setiap transaksi saga memiliki `saga_id` dan `trace_id` untuk end-to-end tracing | ⬜ |
| Dead Letter Queue | Pesan gagal terkumpul di subject `saga.*.dlq` untuk investigasi | ⬜ |
| Webhook Delivery Log | Setiap pengiriman webhook ke eksternal dicatat melalui event `webhook.delivery` | ⬜ |

### Target Prometheus Saat Ini

| Target | Endpoint | Status |
|---|---|---|
| `prometheus` | `localhost:9090` | ✅ UP |
| `auth-service` | `auth:8080/metrics` | ✅ UP |
| `module-service` | `module:8080/metrics` | ✅ UP |
| `analytics-service` | `analytics:8080/metrics` | ✅ UP |
| `wsgateway-service` | `wsgateway:8090/metrics` | ✅ UP |
| `kong` | `kong:8001/metrics` | ✅ UP |

---

## 🚀 Rekomendasi Prioritas Pengerjaan

| Prioritas | Fase | Service | Estimasi | Alasan |
|---|---|---|---|---|
| ✅ P1 | Fase 4 | Control Service | 3-5 hari | ESP32 sudah bisa dikontrol (manual + otomatis + emergency/resume) |
| 🔴 P1 | Fase 5 | Alert Service | 3-5 hari | Data sensor sudah masuk tapi belum ada evaluasi threshold |
| 🔴 P1 | Fase 8 | Audit Service | 1-2 hari | Quick win: data audit sudah dipublish tapi tidak di-consume |
| 🟡 P2 | Fase 5 | Notification Service | 3-5 hari | Alert tidak berguna tanpa notifikasi ke pengguna |
| 🟡 P2 | Fase 3 | WS-Gateway JWT Auth | ✅ Selesai | Celah keamanan WS sudah ditutup |
| 🟡 P2 | Fase 9 | Dashboard Device Management | 2-3 hari | File sudah ada, tinggal integrasi |
| 🟢 P3 | Fase 6 | Stream Service | 5-7 hari | ✅ Selesai |
| 🟢 P3 | Fase 6 | ML / Vision API | 7-14 hari | ✅ Selesai — Model Registry + YOLOv8 inference + MinIO/NATS |
| ⬜ P4 | Fase 10 | OTA Service | 5-7 hari | Fitur opsional |
| ⬜ P4 | Fase 11 | Prometheus Metrics Service | 3-5 hari | Refactoring pipeline metrik |
| ⬜ P4 | Fase 12 | Cloudflare Tunnel | 1-2 hari | Deployment ke production |

---

## ✅ Kriteria Selesai

- Semua service dan 17 instance database dalam status `healthy` setelah `docker compose up -d`
- Tidak ada service yang mengakses database milik service lain (verifikasi via environment variables dan network policy)
- End-to-end flow ESP32 → Module → NATS → WebSocket → Dashboard berjalan ✅
- End-to-end flow Module → Analytics → Dashboard berjalan ✅
- End-to-end flow Alert → Notification → Webhook (eksternal) berjalan
- End-to-end flow Control → ESP32 berjalan
- End-to-end flow Stream → ML → MinIO berjalan
- End-to-end flow Metrics: semua service → NATS → Prometheus → /metrics berjalan
- Kong JWT validation berfungsi pada semua protected routes ✅
- WebSocket Gateway dengan JWT authentication ✅
- Webhook Service dapat mengirim event ke endpoint eksternal dengan retry mechanism
- Semua service memiliki unit test dengan minimal 80% code coverage

---

## 📝 Catatan Teknis

- **Bahasa Pemrograman:** Go 1.22+ untuk microservices, Python untuk Vision API, JavaScript/React untuk Dashboard
- **Container Runtime:** Docker Compose untuk development dan staging
- **Message Broker:** NATS JetStream untuk event bus, Mosquitto untuk MQTT
- **Database:** MariaDB 10.11 untuk data relasional, TimescaleDB 2.17 untuk time-series, Redis 7 untuk caching, MinIO untuk object storage
- **API Gateway:** Kong 3.6 dengan plugin JWT, rate-limiting, dan CORS
- **Streaming:** MediaMTX untuk RTSP/HLS/WebRTC
- **Metrics:** Prometheus 3.4 untuk aggregasi metrik dari seluruh service
- **Deployment:** Cloudflare Tunnel untuk akses publik yang aman
- **Frontend:** React + Vite + Chart.js + Tailwind CSS
- **ORM:** GORM (Go) untuk MariaDB, pgx (Go) untuk TimescaleDB

### Risiko Teknis yang Perlu Dimitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Core NATS untuk `telemetry.batch` | Kehilangan data saat Analytics restart | ✅ Selesai (2026-07-13): upgrade ke JetStream — stream `TELEMETRY_BATCH` (file storage, retention 24h) + durable consumer `analytics-batch` di Analytics, replay otomatis saat restart |
| WS tanpa autentikasi | Data real-time bisa diakses siapa saja | ✅ Sudah: JWT handshake di WS-Gateway |
| 17 instance database | Biaya operasional tinggi, backup kompleks | Evaluasi apakah semua instance diperlukan di fase awal — ✅ MinIO sudah dikonsolidasi jadi 1 instance bersama (multi-bucket + scoped key) |
| Tidak ada backup strategy | Data hilang jika container crash | Tambah volume backup atau cron job dump SQL |
| Tidak ada CI/CD | Manual build & deploy rawan human error | Setup GitHub Actions atau GitLab CI sederhana |

---

## 📝 Catatan Perubahan

| Tanggal | Versi | Perubahan |
|---------|-------|-----------|
| 2026-07-11 | 2.0.0 | Sinkronisasi dengan roadmap.md; update status Fase 2 & 3 selesai; tambah ringkasan, timeline, risiko |
| 2026-07-12 | 2.1.0 | **Fase 4 (Control Service) SELESAI.** Backend: arbitrasi mode node-level, kolom `prev_mode` + `EnterEmergency`/`ResumeNode` (Resume restorasi mode pra-emergency). Dashboard: halaman Control Panel (kartu Control Mode, toggle Manual⇄Otomatis, Emergency Stop, Resume), perbaikan bug `TargetTile` (`nodeMode` prop), editor jadwal (create/edit/toggle/delete) + pagination (PAGE_SIZE=4). `mariadb-control` & `services/control` ditandai Running/✅ |
| 2026-07-12 | 2.4.0 | **Konsolidasi MinIO (Opsi C).** Tidak lagi instance MinIO per service (`minio-stream`/`minio-ml`/`minio-ota`) → **1 instance MinIO bersama** (`minio`) dengan multi-bucket (`stream`, `ml-vision`, `ota`) + access key scoped per service. Stream tetap owner bucket `stream` (tidak bergantung ML). Total instance turun 19 → 17. Update tabel Database-per-Service, topologi, diagram alur, dan risiko instance. |
| 2026-07-12 | 2.5.0 | **Fase 6 (ML / Vision API) SELESAI.** Service Python/FastAPI mandiri: Model Registry (CRUD + upload weights + activate → `model_id` untuk swap model), inference YOLOv8 (`/ml/detect` upload/base64/from-stream) dengan lazy-load + cache per `model_id`, persistensi `mariadb-ml` (`vision_models`, `vision_detections`), hasil anotasi ke bucket `ml-vision` (MinIO bersama), publish `detection.result` ke NATS, JWT/RBAC middleware, Prometheus `/metrics`, `mariadb-ml` + `mysqld-exporter-ml`, route Kong `/ml`, scrape `ml-service` + `mariadb-ml`. Weights `best.pt` di-seed ke volume `ml-models`. |
| 2026-07-13 | 2.7.0 | **Audit fix — komunikasi & bottleneck.** (1) Module Service: hilangkan N+1 query di hot-path telemetry — tag mapping & module id di-cache in-memory (TTL 2m, invalidasi saat pair/unpair/edit tag) dan `TouchNode` di-batch (1× UPDATE per node per 30 detik via `StartTouchFlusher`) sehingga tiap reading tidak lagi memicu 2× SELECT + 1× UPDATE MariaDB. (2) `telemetry.batch` di-upgrade dari Core NATS ke **JetStream** (stream `TELEMETRY_BATCH`, file storage, retention 24h) dengan durable consumer `analytics-batch` di Analytics → window agregat 1-menit tidak lagi hilang saat Analytics restart (replay otomatis, ack eksplisit). Kedua service lolos `go build` + `go vet`. |
| 2026-07-13 | 2.8.0 | **Telemetry retention berjenjang + ekspor CSV (Opsi A).** `infra/timescaledb/analytics/init.sql`: retensi berjenjang — raw `metrics_rollup` 30 hari, `metrics_hourly` 365 hari, `metrics_daily` **3650 hari (10 tahun)** — + compression policy 7 hari pada `metrics_hourly`/`metrics_daily` (history riset 5–10 tahun tetap murah). Perbaikan idempotensi bootstrap: `ALTER TABLE ... ADD CONSTRAINT` → `CREATE UNIQUE INDEX IF NOT EXISTS` (versi lama gagal saat re-run/upgrade sehingga CAGG & policy tidak terbuat). Analytics Service: endpoint baru `GET /analytics/export` (CSV, kolom `bucket,node_id,metric,count,sum,min,max,avg,last`, resolusi `day`/`hour`/`raw`) untuk unduh history telemetri mahasiswa tanpa scaffolding service `export/` terpisah. Lolos `go build` + `go vet` + pengujian end-to-end (TimescaleDB fresh + service: verifikasi policy retensi/kompresi, continuous aggregate, dan ekspor CSV range 4 tahun). |

---

## 📝 Catatan Keputusan Arsitektur — Konsolidasi MinIO (2026-07-12)

**Konteks:** Semula direncanakan instance MinIO terpisah per service (`minio-stream` untuk snapshot/recording, `minio-ml` untuk hasil anotasi YOLOv8, `minio-ota` untuk firmware). Muncul usulan alternatif: MinIO hanya milik ML, dan Stream cukup menangani API MediaMTX lalu menaruh snapshot/recording ke MinIO-nya ML.

**Keputusan:** Ambil **Opsi C — 1 instance MinIO bersama, multi-bucket, scoped access key.** Bukan Opsi A (Stream bergantung MinIO ML) dan bukan Opsi B (2+ instance MinIO di host yang sama).

**Alasan:**
1. **Urutan deploy & bounded context.** Stream Service sudah `✅` dan live; ML/Vision belum dibuat. Jika Stream menulis ke MinIO ML, Stream tidak bisa jalan sebelum ML di-deploy (regresi prinsip *Independen Deployable*). Stream memproduksi snapshot/recording → harus tetap punya storage sendiri (bucket `stream`).
2. **Performa.** Bottleneck MinIO adalah disk I/O + bandwidth network, bukan proses MinIO. Membelah jadi 2 instance di host/disk sama justru menambah kontensi (2 proses berebut resource), bukan isolasi. Satu instance dengan disk SSD/NVMe lebih dari cukup untuk beban TA ini (beberapa kamera, object level GB–ratusan GB). MinIO dirancang untuk throughput puluhan GB/s.
3. **Resilience.** Kelemahan satu instance = SPOF object storage. Mitigasinya **bukan** membelah container di 1 host, tapi menjalankan 1 MinIO dalam **mode distributed / erasure-coding multi-drive** (mis. 4 drive) di host yang sama. Itu lebih tangguh daripada 2 container di 1 disk.
4. **Isolasi tetap terjaga.** Buckets terpisah + access key ter-scoping (`stream-svc-key` → rw `stream`; `ml-svc-key` → rw `ml-vision` + ro `stream`; `ota-svc-key` → rw `ota`) memenuhi prinsip *Zero-Trust Internal*, setara dengan isolasi per-instance.
5. **Efisiensi operasional.** Mengurangi jumlah container & beban backup, menjawab risiko "terlalu banyak instance" yang sudah tercatat di dokumen.

**Skema akhir:**
```
minio (1 instance, erasure-coding multi-drive bila memungkinkan)
 ├─ bucket: stream      owner: Stream Service   (rw: stream-svc-key)
 ├─ bucket: ml-vision   owner: ML / Vision API  (rw: ml-svc-key, ro: stream)
 └─ bucket: ota         owner: OTA Service      (rw: ota-svc-key)  [Fase 12]
```
ML membaca frame sumber dari `stream` (key read-only) untuk inferensi, tanpa Stream harus mengirim file ke ML. Retensi per bucket bisa berbeda (snapshot/recording pendek, model/annotated panjang).
