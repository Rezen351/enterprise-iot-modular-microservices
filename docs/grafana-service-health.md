# Panduan Membaca Dashboard "Service Health" (Untuk Pemula)

> **Tujuan dokumen ini:** menjelaskan apa arti setiap grafik di dashboard Grafana
> **Service Health — IOT Modular Microservice** dengan bahasa sehari-hari, lengkap
> dengan arti tiap angka/parameter yang muncul. Anda tidak perlu paham teknis untuk
> membaca ini.

---

## 1. Cara Membuka Dashboard

1. Buka browser, kunjungi **http://localhost:3000**
2. Login dengan user `admin` / password `admin`
3. Di menu kiri, buka **Dashboards** → folder **Service Health** → pilih
   **Service Health — IOT Modular Microservice**

Dashboard akan otomatis refresh setiap **15 detik** (lihat tulisan di kanan atas,
misal `Last 1h` = data 1 jam terakhir).

**Istilah dasar yang sering muncul:**
- **Target** = satu komponen yang dipantau (mis. server auth, database MariaDB, dsb).
- **UP / DOWN** = komponen hidup (bisa dihubungi) atau mati/tidak bisa dihubungi.
- **req/s (request per second)** = berapa kali layanan diminta dalam 1 detik.
- **% (persen)** = proporsi dari keseluruhan, mis. berapa % request yang gagal.
- **p50 / p95 / p99 (percentile)** = angka "kelambatan". p95 artinya 95% request
  lebih cepat dari angka tersebut. Semakin kecil semakin baik.
- **ms (milidetik) / s (detik)** = satuan waktu. 1000 ms = 1 detik.

---

## 2. Section: Service Overview (Ringkasan Utama)

Ini adalah "kartu kesehatan" paling atas. Baca 6 kotak ini dulu untuk tahu kondisi
secara keseluruhan.

| Kartu | Artinya | Warna & Makna |
|-------|---------|---------------|
| **Services UP** | Jumlah komponen yang hidup & sehat | Hijau = bagus |
| **Services DOWN** | Jumlah komponen yang gagal dihubungi | Merah = ada masalah, harus dicek |
| **Total Targets** | Total seluruh komponen yang dipantau | Angka tetap (acuan) |
| **Avg Request Rate** | Rata-rata total permintaan ke semua layanan (req/s) | Semakin tinggi = semakin sibuk |
| **Avg p95 Latency** | Rata-rata kelambatan p95 semua layanan (detik) | Kecil = respons cepat |
| **Avg Error Rate** | Rata-rata % request yang gagal (4xx/5xx) | Hijau bagus; kuning >1%; merah >5% |

> **Cara cepat ambil kesimpulan:** kalau *Services DOWN* = 0 dan *Avg Error Rate*
> kecil (hijau), sistem dalam keadaan sehat.

### 2.1 Tabel "Services DOWN — Which ones?"
Tepat di bawah ringkasan ada tabel khusus yang **langsung menuliskan nama
service yang DOWN** (kolom `job` + `instance`) beserta jumlahnya di footer.
Jadi kalau kartu *Services DOWN* = 1, lihat tabel ini untuk tahu persis
service mana yang mati — tidak perlu menerka. Tabel kosong = semua sehat.

---

## 3. Section: Service Status & Health

Dua panel di bawah ringkasan:

### 3.1 Tabel "Target Status"
Tabel berisi daftar semua komponen:
- **job** = nama komponen (mis. `auth-service`, `mariadb-auth`).
- **Value (UP/DOWN)** = status, berwarna **hijau = UP**, **merah = DOWN**.
- Kolom lain menunjukkan seberapa lama Prometheus mengambil datanya
  (*scrape duration*) — angka kecil (mis. 0.01 s) berarti pengambilan data lancar.

### 3.2 Grafik "Request Rate by Service"
Garis naik-turun yang menunjukkan **seberapa sibuk tiap layanan tiap saat**.
Sumbu vertikal = req/s, sumbu horizontal = waktu. Garis tinggi = lagi banyak
permintaan.

---

## 4. Section: HTTP Traffic (Lalu Lintas Web Tiap Layanan)

Bagian ini khusus untuk layanan mikro (auth, module, analytics, control, stream).

### 4.1 HTTP Request Rate (req/s)
**Apa artinya:** berapa permintaan yang diterima tiap layanan per detik.
**Cara baca:** garis naik = traffic naik (banyak user/device mengakses).

### 4.2 HTTP Error Rate (4xx + 5xx, %)
**Apa artinya:** persentase permintaan yang **gagal**.
- `4xx` = salah dari sisi permintaan (mis. login salah, akses ditolak).
- `5xx` = salah dari sisi server (server error).
**Cara baca:** garis di angka 0% = sempurna. Kalau naik tiba-tiba = ada masalah
pada layanan tersebut.

### 4.3 HTTP Latency (p50 / p95 / p99)
**Apa artinya:** kecepatan respons layanan.
- **p50** = setengah (50%) request dilayani dalam waktu ini atau lebih cepat.
- **p95** = 95% request lebih cepat dari angka ini (yang dipakai acuan umum).
- **p99** = 99% request lebih cepat (mengungkap request "nakal" yang sangat lambat).
**Cara baca:** semakin rendah garis semakin cepat. Lonjakan p99 jauh di atas p50
= ada beberapa request yang tersendat.

### 4.4 HTTP Requests In-Flight
**Apa artinya:** jumlah permintaan yang **sedang diproses** (belum selesai) pada
saat itu.
**Cara baca:** naik terus menerus & tidak turun = layanan kewalahan / mungkin
"macet" (bottleneck).

---

## 5. Section: Service Resource Usage (Pemakaian Sumber Daya)

Menunjukkan "tenaga" yang dipakai tiap layanan (seperti task manager di komputer).

### 5.1 Memory (RSS)
**Apa artinya:** memori RAM yang dipakai tiap layanan (satuan **bytes**, bisa
diklik satuan untuk ganti ke MB/GB).
**Cara baca:** naik terus & tidak pernah turun = kemungkinan kebocoran memori
(memory leak).

### 5.2 CPU Usage (%)
**Apa artinya:** persentase pemakaian CPU tiap layanan.
**Cara baca:** mendekati 100% terus = layanan sangat berat / butuh lebih banyak
resource.

### 5.3 Goroutines
**Apa artinya:** jumlah "utas kerja" di dalam program Go (bahasa pemrograman
layanan). Indikator beban internal.
**Cara baca:** naik drastis & terus menerus = beban tidak wajar (sering tanda
bug / antrian menumpuk).

### 5.4 Open File Descriptors (%)
**Apa artinya:** rasio file/koneksi yang dibuka vs batas maksimum yang diizinkan
sistem.
**Cara baca:** mendekati 100% = hampir kehabisan batas, bisa bikin layanan tidak
bisa membuat koneksi baru.

---

## 6. Section: Databases — MariaDB

MariaDB adalah database untuk menyimpan data (user, modul, kontrol, stream).
Ada 4 instance: `auth`, `control`, `module`, `stream`.

| Grafik | Artinya | Tanda bahaya |
|--------|---------|--------------|
| **Connections** | jumlah koneksi database yang aktif | mendekati batas maksimum |
| **Queries / sec (QPS)** | berapa query dijalankan per detik | — (semakin sibuk wajar naik) |
| **Slow Queries / sec** | query yang berjalan lambat per detik | naik terus = perlu optimasi/index |
| **Aborted Connects / sec** | koneksi yang ditolak/gagal per detik | > 0 terus = masalah auth/limit koneksi |

---

## 7. Section: Cache — Redis

Redis adalah **penyimpanan cache** (data cepat) untuk layanan Module.

- **Memory Used vs Max** = memori terpakai vs batas maksimum. Garis "used"
  mendekati "max" = cache hampir penuh.
- **Cache Hit Rate (%)** = **persentase permintaan yang langsung terpenuhi dari
  cache** (tanpa harus ke database). **Makin tinggi makin baik** (mis. 99% =
  sangat efisien).
- **Operations / sec** = berapa perintah Redis dijalankan per detik.
- **Connected Clients** = jumlah aplikasi yang terhubung ke Redis.

---

## 8. Section: TimescaleDB / PostgreSQL

TimescaleDB adalah database seri-waktu (telemetri/analitik). Ada instance
`module` dan `analytics`.

- **Connections (backends)** = jumlah koneksi aktif ke database.
- **Transactions / sec (TPS)** = transaksi per detik.
  - **commit** = berhasil disimpan.
  - **rollback** = dibatalkan (gagal). Rollback tinggi = banyak error penyimpanan.
- **Cache Hit Ratio (%)** = persentase data yang diambil dari memori cache
  database (bukan dari disk). **Makin tinggi makin cepat.**

---

## 9. Section: Messaging — NATS & MQTT

Ini adalah "broker pesan" — seperti pos pengiriman pesan antar perangkat/layanan
(IoT). NATS & Mosquitto (MQTT) dipakai agar device dan server bisa saling kirim
data secara real-time.

### NATS
- **Connections & JetStream** = jumlah koneksi NATS + jumlah *stream*,
  *consumer*, dan *message* di JetStream (fitur penyimpanan pesan).
- **Msg Rate** = kecepatan pesan masuk (`in_msgs/s`) dan keluar (`out_msgs/s`).

### MQTT (Mosquitto)
- **Clients & Subscriptions** = jumlah perangkat terhubung dan topik langganan.
- **Msg Rate & Bytes** = kecepatan pesan dan besaran byte yang lewat
  (masuk/keluar). Naik = banyak device mengirim data.

---

## 10. Section: API Gateway — Kong

Kong adalah "gerbang utama" — semua traffic dari luar masuk lewat sini dulu
sebelum diteruskan ke layanan mikro.

- **Requests / sec** = total permintaan yang lewat gerbang Kong.
- **Latency p99 (ms)** = kelambatan p99.
  - `request_p99` = total waktu dari masuk sampai keluar.
  - `upstream_p99` = waktu yang dihabiskan layanan di belakang Kong
    (tanpa waktu antre di Kong). Selisih keduanya menunjukkan seberapa lama
    Kong sendiri memproses.
- **Bandwidth** = besaran data (bytes/detik) yang lewat, terbagi *egress*
  (keluar) dan *ingress* (masuk).
- **Upstream Target Health** = tabel kesehatan tiap layanan di belakang Kong.
  **HEALTHY (hijau) = layanan bisa melayani**, **UNHEALTHY (merah) = gagal**.
- **Datastore Reachable** = apakah Kong bisa menjangkau database konfigurasinya
  (1 = ya). Kalau 0 = Kong tidak bisa membaca konfigurasi.

---

## 11. Section: Service Detail (Drill-down Interaktif)

Bagian paling bawah memakai **dropdown "Service"** di atas dashboard (kanan
atas, di sebelah pemilih waktu).

**Cara pakai:**
1. Klik dropdown **Service**.
2. Pilih satu layanan (mis. `auth-service`) atau beberapa, atau **All**.
3. Keenam panel di bawahnya akan otomatis menampilkan data **hanya** untuk
   layanan yang dipilih:
   - **Request Rate** — sibuk atau tidak.
   - **Error Rate (%)** — berapa % gagal.
   - **p95 Latency** — kelambatan.
   - **Memory (RSS)** — pemakaian RAM.
   - **CPU (%)** — pemakaian CPU.
   - **Goroutines** — beban internal.
   - **Open FDs (%)** — sisa kuota koneksi/file.
   - **Service UP?** — status 1 = hidup, 0 = mati.

Gunakan ini untuk "membedah" satu layanan yang terlihat aneh di section atas.

---

## 12. Tips Cepat Troubleshooting (Cheat Sheet)

| Gejala di dashboard | Kemungkinan penyebab | Cek di section |
|---------------------|----------------------|----------------|
| Services DOWN > 0 | Komponen mati / restart | Service Status |
| Error Rate naik | Bug / gagal login massal / dependency mati | HTTP Traffic |
| p99 naik jauh dari p50 | Beberapa request tersendat (DB lambat, GC) | HTTP Traffic, MariaDB, TimescaleDB |
| Memory naik terus | Memory leak | Resource Usage |
| CPU ~100% | Layanan kelebihan beban | Resource Usage |
| Redis Hit Rate turun | Cache sering miss → DB lebih sibuk | Cache — Redis |
| Kong Upstream UNHEALTHY | Layanan di belakang Kong mati | API Gateway |
| MySQL Slow Queries naik | Query berat / butuh index | MariaDB |

---

## 13. Catatan Teknis (untuk yang ingin tahu lebih dalam)

- **Sumber data:** semua grafik mengambil dari **Prometheus** (`http://prometheus:9090`)
  yang menghisap metrik tiap 15 detik.
- **PromQL** (bahasa pencarian Prometheus) contoh yang dipakai dashboard:
  - `count(up == 1)` → hitung komponen hidup.
  - `rate(http_requests_total[2m])` → hitung kecepatan request dalam 2 menit terakhir.
  - `histogram_quantile(0.95, ...)` → hitung nilai persentil ke-95 dari histogram latensi.
- **File dashboard:** `infra/grafana/dashboards/service-health.json`
  (auto-dimuat ulang oleh Grafana tiap 30 detik).
- **Konfigurasi scrape:** `infra/prometheus/prometheus.yml`.
