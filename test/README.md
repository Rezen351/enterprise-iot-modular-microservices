# enyx-enterprise Testing Suite

Toolkit pengujian fungsionalitas (*Unit & Feature Integration Tests*), beban trafik (*Industry-Standard Stress Tests*), dan ketangguhan sistem (*Chaos Engineering & Resilience Tests*) untuk seluruh arsitektur enyx-enterprise.

Seluruh trafik pengujian masuk melalui **Kong API Gateway** (`/v1`) untuk memverifikasi autentikasi JWT, role-based access control, rate limiting, latensi, throughput, dan pemulihan mandiri (*self-healing*) di bawah berbagai kondisi kegagalan.

---

## 📂 Struktur Folder `test/`

```
test/
├── unit_test.py        # Suite Unit & Feature Test (102 test cases across 14 service classes)
├── stress_test.py      # Engine Stress Testing (Load, Spike, Soak, Breakpoint, WS)
├── resilience_test.py  # Engine Chaos & Resilience Test (Outage Injection & Self-Healing)
├── config.py           # Konfigurasi target URL & kredensial
├── requirements.txt    # Dependensi Python pip
└── README.md           # Dokumen panduan pengujian
```

---

## 🚀 Cara Menjalankan Suite Pengujian

### 1. Persiapan Dependensi
```bash
cd test
pip install -r requirements.txt
```

---

### 2. Suite Unit Test (102 Test Cases — 100% Microservices)

Menguji seluruh fungsionalitas 14 microservices + WS Gateway + DLQ, endpoint REST API, dan WebSocket handshake.

```bash
python3 unit_test.py
```

**Parameter Environment Variables:**

| Env | Default | Fungsi |
|---|---|---|
| `BASE_URL` | `http://localhost:8000` | Target Kong API Gateway |
| `ADMIN_USER` | `admin` | Username login otomatis |
| `ADMIN_PASS` | `admin1234` | Password login otomatis |
| `CAPTURE_TEST_RESULTS` | `1` | Simpan request/response JSON + MD ke `test/results/` |
| `TEST_MAX_RETRIES` | `3` | Jumlah retry saat connection error / 429 |
| `TEST_RETRY_DELAY` | `1.0` | Delay dasar retry (detik), dikali attempt |

---

### 3. Suite Stress Test (Industry-Standard Traffic Performance)

Engine `stress_test.py` mendukung 5 mode pengujian standar industri:

#### **A. Baseline Load Test (HTTP Concurrency & Throughput)**
```bash
python3 stress_test.py load --users 10 --rps 50 --duration 15
```

**Parameter:**

| Flag | Default | Fungsi |
|---|---|---|
| `--base-url` | `http://localhost:8000` | Target API Gateway |
| `--username` | `admin` | Admin username untuk login |
| `--password` | `admin1234` | Admin password untuk login |
| `--users` | `10` | Concurrent virtual users |
| `--rps` | `50` | Target Requests Per Second |
| `--duration` | `15` | Durasi test dalam detik |

#### **B. Spike Test (Traffic Surge & Recovery)**
```bash
python3 stress_test.py spike --users 10 --rps 50 --spike-rps 250
```

**Parameter:**

| Flag | Default | Fungsi |
|---|---|---|
| `--base-url` | `http://localhost:8000` | Target API Gateway |
| `--username` | `admin` | Admin username untuk login |
| `--password` | `admin1234` | Admin password untuk login |
| `--users` | `10` | Concurrent virtual users |
| `--rps` | `50` | Baseline RPS |
| `--spike-rps` | `250` | Peak RPS saat traffic surge |

#### **C. Soak / Endurance Test (Long-Duration Stability)**
```bash
python3 stress_test.py soak --users 20 --rps 100 --duration 120
```

**Parameter:**

| Flag | Default | Fungsi |
|---|---|---|
| `--base-url` | `http://localhost:8000` | Target API Gateway |
| `--username` | `admin` | Admin username untuk login |
| `--password` | `admin1234` | Admin password untuk login |
| `--users` | `20` | Concurrent virtual users |
| `--rps` | `100` | Target Requests Per Second |
| `--duration` | `120` | Durasi endurance test dalam detik |

#### **D. Breakpoint Capacity Test (Mencari Batas Maksimum / Knee Point)**
```bash
python3 stress_test.py breakpoint
```

**Parameter:**

| Flag | Default | Fungsi |
|---|---|---|
| `--base-url` | `http://localhost:8000` | Target API Gateway |
| `--username` | `admin` | Admin username untuk login |
| `--password` | `admin1234` | Admin password untuk login |

Catatan: Mode ini menjalankan level tetap `[5 users/10 RPS, 10 users/50 RPS, 20 users/100 RPS, 40 users/250 RPS, 60 users/500 RPS]` selama 8 detik per level.

#### **E. WebSocket Stress Test (Connection Holding)**
```bash
python3 stress_test.py ws --users 50 --duration 30
```

**Parameter:**

| Flag | Default | Fungsi |
|---|---|---|
| `--base-url` | `http://localhost:8000` | Target API Gateway |
| `--username` | `admin` | Admin username untuk login |
| `--password` | `admin1234` | Admin password untuk login |
| `--users` | `50` | Jumlah concurrent WebSocket connections |
| `--duration` | `30` | Durasi hold connection dalam detik |

---

### 4. Suite Chaos & Resilience Test (Ketangguhan & Self-Healing)

Engine `resilience_test.py` mensimulasikan kegagalan komponen (*Chaos Engineering*) untuk memverifikasi isolasi dampak dan pemulihan otomatis:

```bash
python3 resilience_test.py
```

**Parameter Environment Variables:**

| Env | Default | Fungsi |
|---|---|---|
| `BASE_URL` | `http://localhost:8000` | Target Kong API Gateway |
| `ADMIN_USER` | `admin` | Username login |
| `ADMIN_PASS` | `admin1234` | Password login |
| `DOCKER_COMPOSE_DIR` | `/home/almuzky/TA/Microservices` | Path `docker-compose.yml` untuk stop/start service saat chaos |

#### **Skenario Chaos Engineering Teruji:**
1. **Skenario 1 (Single Non-Critical Outage):** Menghentikan `ml-service` → memverifikasi service utama (`auth`, `modules`) tetap 100% `200 OK`, lalu memverifikasi pemulihan otomatis (*self-healing*) saat `ml-service` dinyalakan kembali.
2. **Skenario 2 (Multi-Auxiliary Outage):** Menghentikan `notification-service` & `stream-service` secara bersamaan → memverifikasi API kontrol & analitik tetap berjalan tanpa terpengaruh.
3. **Skenario 3 (Event Bus Interruption):** Menghentikan broker `nats` → memverifikasi Kong Gateway tetap merespons health check, serta memverifikasi auto-reconnect NATS client saat broker kembali online.

---

### 5. Konfigurasi Terbagi (`config.py`)

File ini otomatis memuat `.env` proyek dan digunakan oleh `stress_test.py` serta reusable oleh module lain:

| Parameter | Env | Default | Fungsi |
|---|---|---|---|
| Kong public URL | `KONG_PUBLIC_URL` | `http://localhost:8000` | Base URL API Gateway |
| Prometheus URL | `PROMETHEUS_URL` | `http://localhost:9090` | URL Prometheus server |
| Grafana URL | `GRAFANA_URL` | `http://localhost:3000` | URL Grafana dashboard |
| Admin username | `ADMIN_USERNAME` | `admin` | Kredensial autentikasi admin |
| Admin password | `ADMIN_PASSWORD` | `admin1234` | Kredensial autentikasi admin |
| MQTT host | `MQTT_HOST` | `localhost` | Host broker MQTT |
| MQTT port | `MQTT_PORT` | `1883` | Port broker MQTT |
| MQTT topic prefix | `MQTT_TOPIC_PREFIX` | `smartfarm` | Prefix topik MQTT |
| JWT secret | `JWT_SECRET` | `""` | Secret verifikasi token JWT |

**Catatan penting:** `config.py` memuat `.env` proyek secara otomatis (`_load_env()`), jadi pastikan `.env` berisi kredensial yang benar sebelum menjalankan test.
