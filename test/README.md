# Enterprise IoT Microservices Testing Suite

Toolkit pengujian fungsionalitas (*Unit & Feature Integration Tests*), beban trafik (*Industry-Standard Stress Tests*), dan ketangguhan sistem (*Chaos Engineering & Resilience Tests*) untuk seluruh arsitektur Enterprise IoT Modular Microservices.

Seluruh trafik pengujian masuk melalui **Kong API Gateway** (`/v1`) untuk memverifikasi autentikasi JWT, role-based access control, rate limiting, latensi, throughput, dan pemulihan mandiri (*self-healing*) di bawah berbagai kondisi kegagalan.

---

## 📂 Struktur Folder `test/`

```
test/
├── unit_test.py        # Suite Unit & Feature Test (41 test cases - 100% microservices)
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

### 2. Suite Unit Test (41 Test Cases — 100% Microservices)

Menguji seluruh fungsionalitas 12 microservices, endpoint REST API, dan WebSocket handshake.

```bash
python3 unit_test.py
```

---

### 3. Suite Stress Test (Industry-Standard Traffic Performance)

Engine `stress_test.py` mendukung 5 mode pengujian standar industri:

#### **A. Baseline Load Test (HTTP Concurrency & Throughput)**
```bash
python3 stress_test.py load --users 10 --rps 50 --duration 15
```

#### **B. Spike Test (Traffic Surge & Recovery)**
```bash
python3 stress_test.py spike --users 10 --rps 50 --spike-rps 250
```

#### **C. Soak / Endurance Test (Long-Duration Stability)**
```bash
python3 stress_test.py soak --users 20 --rps 100 --duration 120
```

#### **D. Breakpoint Capacity Test (Mencari Batas Maksimum / Knee Point)**
```bash
python3 stress_test.py breakpoint
```

#### **E. WebSocket Stress Test (Connection Holding)**
```bash
python3 stress_test.py ws --users 50 --duration 30
```

---

### 4. Suite Chaos & Resilience Test (Ketangguhan & Self-Healing)

Engine `resilience_test.py` mensimulasikan kegagalan komponen (*Chaos Engineering*) untuk memverifikasi isolasi dampak dan pemulihan otomatis:

```bash
python3 resilience_test.py
```

#### **Skenario Chaos Engineering Teruji:**
1. **Skenario 1 (Single Non-Critical Outage):** Menghentikan `ml-service` → memverifikasi service utama (`auth`, `modules`) tetap 100% `200 OK`, lalu memverifikasi pemulihan otomatis (*self-healing*) saat `ml-service` dinyalakan kembali.
2. **Skenario 2 (Multi-Auxiliary Outage):** Menghentikan `notification-service` & `stream-service` secara bersamaan → memverifikasi API kontrol & analitik tetap berjalan tanpa terpengaruh.
3. **Skenario 3 (Event Bus Interruption):** Menghentikan broker `nats` → memverifikasi Kong Gateway tetap merespons health check, serta memverifikasi auto-reconnect NATS client saat broker kembali online.
