# Enterprise IoT Microservices Testing Suite

Toolkit pengujian fungsionalitas (*Unit & Feature Integration Tests*) dan beban trafik (*Industry-Standard Stress Tests*) untuk seluruh arsitektur Enterprise IoT Modular Microservices.

Seluruh trafik pengujian masuk melalui **Kong API Gateway** (`/v1`) untuk memverifikasi autentikasi JWT, role-based access control, rate limiting, latensi, dan throughput sistem di bawah berbagai kondisi beban.

---

## 📂 Struktur Folder `test/`

```
test/
├── unit_test.py        # Suite Unit & Feature Test (41 test cases - 100% microservices)
├── stress_test.py      # Engine Stress Testing (Load, Spike, Soak, Breakpoint, WS)
├── config.py           # Konfigurasi target URL & kredensial
├── requirements.txt    # Dependensi Python pip
└── README.md           # Dokumen panduan pengujian
```

---

## 🚀 Cara Menjalankan Unit & Stress Test

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
- **Fungsi:** Menguji latensi (P50/P95/P99) dan throughput rata-rata di bawah beban normal.

#### **B. Spike Test (Traffic Surge & Recovery)**
```bash
python3 stress_test.py spike --users 10 --rps 50 --spike-rps 250
```
- **Fungsi:** Mensimulasikan lonjakan trafik mendadak (50 RPS → 250 RPS) dan menguji kecepatan pemulihan sistem.

#### **C. Soak / Endurance Test (Long-Duration Stability)**
```bash
python3 stress_test.py soak --users 20 --rps 100 --duration 120
```
- **Fungsi:** Menjalankan beban tinggi dalam durasi panjang untuk mendeteksi *memory leak* atau *connection leak*.

#### **D. Breakpoint Capacity Test (Mencari Batas Maksimum / Knee Point)**
```bash
python3 stress_test.py breakpoint
```
- **Fungsi:** Menaikkan beban secara bertahap (10 → 50 → 100 → 250 → 500 RPS) untuk menemukan batas kapasitas throughput maksimum dan titik jenuh cluster.

#### **E. WebSocket Stress Test (Connection Holding)**
```bash
python3 stress_test.py ws --users 50 --duration 30
```
- **Fungsi:** Membuka puluhan/ratusan koneksi WebSocket simultan ke gateway dan menahan status koneksi.
