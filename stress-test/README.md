# Stress-Test & Penetration Toolkit — IoT Microservice Stack

Toolkit Python untuk menguji beban trafik (load / stress / soak / spike) dan
keamanan (penetration) dari arsitektur microservice IoT kamu, lalu
mengkorelasikan hasilnya dengan metrik Prometheus/Grafana agar kamu tahu
di mana letak **bottleneck** sistem.

Semua trafik masuk lewat **Kong** (`KONG_PUBLIC_URL`, default `http://localhost:8000`)
sama seperti yang dilakukan dashboard/produksi, kecuali test MQTT yang menembak
langsung ke broker **Mosquitto** (`MQTT_HOST`, default `localhost:1883`).

## Struktur folder

```
stress-test/
├── requirements.txt      # dependensi pip
├── config.py             # endpoint catalog + pembacaan .env
├── loadtest.py           # engine beban HTTP (load/soak/spike)
├── wstest.py             # beban WebSocket gateway (/ws)
├── mqtttest.py           # beban telemetry MQTT (Mosquitto)
├── metrics.py            # kolektor metrik Prometheus (before/after)
├── pentest.py            # suite pengetesan keamanan
├── report.py             # formatter laporan (teks + JSON)
├── cli.py                # entrypoint CLI (argparse)
└── README.md
```

## Instalasi

```bash
cd stress-test
python3 -m venv .venv && source .venv/bin/activate   # opsional
pip install -r requirements.txt
```

`requests` sudah ada di sistem. `websocket-client` (ws) dan `paho-mqtt` (mqtt)
diimpor secara *lazy*, jadi hanya dibutuhkan saat menjalankan subcommand
`ws` / `mqtt`.

Konfigurasi diambil otomatis dari `../.env` (folder project utama) — termasuk
`KONG_PUBLIC_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `MQTT_HOST`, dll.
Semua bisa di-override lewat environment variable atau flag CLI.

## Perintah

Semua subcommand menerima flag umum:
`--base-url`, `--prometheus`, `--username`, `--password`, `--token`,
`--insecure`, `--out <file.json>`.

### 1. Load test HTTP (lewat Kong)

```bash
python3 cli.py load --rps 50 --users 10 --duration 60 --ramp 10
```

Mengirim trafik campuran ke seluruh endpoint (lihat katalog di bawah) dengan
rata-rata `rps` terkendali, `--users` = jumlah thread konkuren, `--ramp` =
naik bertahap (detik). Hasil: throughput, latency p50/p95/p99, distribusi
status, jumlah `429` (ter-rate-limit) dan `5xx`.

### 2. WebSocket load test

```bash
pip install websocket-client
python3 cli.py ws --users 100 --duration 30
```

Membuka N koneksi ke `/ws`, menahan selama `--duration`, menghitung
keberhasilan koneksi, putus, dan pesan yang diterima.

### 3. MQTT telemetry load test

```bash
pip install paho-mqtt
python3 cli.py mqtt --users 50 --rps 5 --duration 60
```

Mensimulasikan perangkat ESP32: N client publish telemetry ke topik
`{MQTT_TOPIC_PREFIX}/telemetry/loadtest` dengan QoS 0. Metrik ini bisa
dikorelasikan dengan exporter Mosquitto di Grafana.

### 4. Penetration / security test

```bash
python3 cli.py pentest
```

Cek keamanan otomatis (lihat daftar di bawah). Butuh token JWT — toolkit akan
login dulu. **Catatan:** endpoint `/auth/login` di Kong punya limit
`20/menit` & `100/jam`; jangan jalankan `pentest` berulang-ulang dalam waktu
singkat atau login akan kena `429` dan sebagian cek berstatus `N/A`.

### 5. Soak test + delta metrik (cari bottleneck)

```bash
python3 cli.py soak --rps 50 --users 10 --duration 600
```

Menjalankan beban lama, lalu mengambil snapshot Prometheus **sebelum** dan
**sesudah**, dan mencetak delta. Ini cara terbaik menemukan bottleneck:
naiknya tajam (▲) pada latency/5xx/429, query DB, memori Redis, pesan NATS
pending, atau koneksi MQTT = titik sempitnya.

### 6. Spike test

```bash
python3 cli.py spike --low 10 --high 300 --duration 120
```

Fase baseline → spike tinggi → recovery. Menguji apakah sistem & rate-limiter
Kong stabil saat trafik melonjak.

### 7. Tanya metrik Prometheus langsung

```bash
python3 cli.py metrics
python3 cli.py metrics --timeline --duration 60 --interval 5
```

Mencetak snapshot (atau deret waktu) metrik bottleneck dari Prometheus.
Buka Grafana (`http://localhost:3000`) untuk visualisasi lengkap.

## Katalog endpoint yang dites (load)

| Endpoint            | Method | Auth | Bobot |
|---------------------|--------|------|-------|
| `/health`           | GET    | tidak| 15    |
| `/auth/login`       | POST   | tidak| 10    |
| `/auth/refresh`     | POST   | tidak| 3     |
| `/auth/me`          | GET    | ya   | 12    |
| `/modules`          | GET    | ya   | 12    |
| `/nodes`            | GET    | ya   | 8     |
| `/analytics`        | GET    | ya   | 8     |
| `/control`          | GET    | ya   | 6     |
| `/streams`          | GET    | ya   | 6     |
| `/ml/models`        | GET    | ya   | 4     |
| `/hls/.../index.m3u8`| GET   | tidak| 4     |

## Cek keamanan (pentest)

- Protected route menolak akses tanpa token (401/403)
- JWT yang diubah (tampered) ditolak
- Serangan algoritma `none` pada JWT ditolak
- SQL injection (body login & query param) ditangani aman
- XSS payload tidak direfleksikan sebagai HTML
- Path traversal diblokir
- Endpoint login menerapkan rate-limit (anti brute-force)
- CORS tidak memantulkan origin sembarangan
- Header server sensitif tidak dibocorkan
- Header keamanan (CSP, X-Content-Type-Options, dll) ada
- Method HTTP tidak diizinkan ditolak (405/404)
- WebSocket mewajibkan autentikasi

## Cara membaca hasil untuk cari bottleneck

1. Jalankan `soak` (atau `load` dengan `--rps` naik bertahap) sambil
   panel Grafana terbuka.
2. Perhatikan di laporan: latency `p95/p99` naik drastis, atau `429`/`5xx`
   mendominasi → gateway/backend mulai jenuh.
3. Bandingkan dengan delta metrik dari `soak`/`spike`:
   - `Kong upstream latency p95` naik → service di belakang Kong lambat.
   - `MariaDB queries/s` / `connections` naik → DB jadi titik sempit.
   - `Redis memory used` naik → cache perlu dibersihkan/ditambah.
   - `NATS JetStream total messages` / `pending` naik → event bus backlog.
   - `Mosquitto connected clients` / `messages received` naik → broker MQTT.
4. Ulangi dengan `--rps` lebih tinggi sampai menemukan titik jenuh (knie).

## Catatan penting

- Rate-limit Kong (global `100/menit`, auth-public `20/menit` & `100/jam`)
  akan memunculkan banyak `429` pada load test agresif — itu *control* yang
  bekerja, bukan bug. Untuk menekan backend secara murni, naikkan limit di
  `infra/kong/kong.yml` atau arahkan load test ke service internal.
- Temuan `FAIL` pada pentest (mis. `/modules` & `/nodes` yang merespons `200`
  tanpa token) adalah celah keamanan nyata yang perlu diperbaiki di service
  terkait (tambahkan middleware JWT/RBAC).
