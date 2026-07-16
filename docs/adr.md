# 📌 Architecture Decision Records (ADR)

> Kumpulan keputusan arsitektur penting beserta konteks & alasan. Dipisahkan dari `planning.md` agar dokumen utama tetap fokus pada arsitektur murni. Referensi: praktik standar ADR (merw/101-adr).

---

## ADR-001 — Konsolidasi MinIO (2026-07-12)

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

---

## ADR-002 — Ekspor Agregat Telemetri via Analytics (Opsi A, 2026-07-13)

**Konteks:** Mahasiswa/peneliti butuh akses data telemetri berjangka panjang. Semula direncanakan service `export/` terpisah.

**Keputusan:** Ekspor agregat telemetri **tidak** dibuat sebagai service terpisah, melainkan diimplementasikan langsung di Analytics Service sebagai `GET /analytics/export` (CSV, kolom `bucket,node_id,metric,count,sum,min,max,avg,last`, resolusi `day`/`hour`/`raw`).

**Alasan:** Daily aggregate (retensi 10 tahun + kompresi) sudah cukup untuk penelitian jangka panjang (termasuk range 5+ tahun). Menghindari service baru yang memperbesar kompleksitas operasional. Service `export/` terpisah (alerts/commands/audit/Parquet) tetap tertunda sebagai Fase 9b.

---

## ADR-003 — Shared JWT Secret lintas Service (2026-07-16)

**Konteks:** Beberapa service (Auth, WS, ML, Stream) memvalidasi JWT dengan secret yang sama.

**Keputusan:** Diterima untuk TA (sama secret, validasi di service masing-masing). Produksi disarankan per-service key + mTLS.

**Alasan:** Mengurangi kompleksitas operasional di skala TA. Melanggar prinsip *Zero-Trust Internal* secara ketat, namun acceptable mengingat防御-in-depth via validasi di setiap service. Tercatat sebagai trade-off di Risiko Teknis `planning.md`.

---

## ADR-004 — Konsolidasi Redis (2026-07-16)

**Konteks:** Semula direncanakan 4 instance Redis terpisah per service (`redis-module`, `redis-alert`, `redis-notification`, `redis-export`), masing-masing dengan exporter sendiri (total 4 container Redis + 4 exporter Redis).

**Keputusan:** Gabung menjadi **1 instance Redis bersama (`redis-shared`)** dengan **multi-DB** (logical database terpisah per service) + **1 exporter bersama**. Sama seperti pola ADR-001 (MinIO), bukan membelah container di 1 host.

**Alasan:**
1. **Pola konsisten dengan MinIO (ADR-001).** Redis adalah cache/ephemeral store, bukan sumber kebenaran domain (DB per-service tetap MariaDB/TimescaleDB terpisah — prinsip *Database-per-Service* tidak dilanggar). Bottleneck Redis adalah RAM/disk I/O, bukan proses; membelah jadi 4 container di host sama justru menambah kontensi.
2. **Isolasi tetap terjaga via logical DB.** Setiap service diberi `REDIS_DB` berbeda (module=0, alert=1, notification=2, export=3). Untuk prod dapat ditambah user Redis ter-scoping per DB. Setara isolasi per-instance untuk kebutuhan TA.
3. **Efisiensi operasional.** Mengurangi 3 container Redis + 3 exporter (7 -> 2 container: 1 redis + 1 exporter). Sesuai tujuan mengurangi "terlalu banyak instance" di planning.

**Skema mapping DB:**
```
redis-shared (1 instance, appendonly on)
 ├─ DB 0: module-service        (owner: module; juga dipakai cctv-capture)
 ├─ DB 1: alert-service         (owner: alert)
 ├─ DB 2: notification-service  (owner: notification)
 └─ DB 3: export-service        (owner: export)
```

**Yang TIDAK diubah:** MariaDB/TimescaleDB tetap per-service (inti arsitektur TA). Hanya Redis (cache) yang dikonsolidasi.

> **Catatan implementasi:** `cctv-capture` sebelumnya menunjuk `redis-module:6379` DB0 -> dialihkan ke `redis-shared:6379` DB0 (mapping sama, tidak breaking).

---

## ADR-005 — Konsolidasi Prometheus Exporter (2026-07-16)

**Konteks:** Terdapat 11 container exporter terpisah: 8× `mysqld-exporter` (per MariaDB), 2× `postgres-exporter` (per TimescaleDB), 1× `redis-exporter` (sudah 1 sejak ADR-004). Tiap exporter hanya scrape 1 target → banyak container ringan yang menambah beban orkestrasi.

**Keputusan:** Gabung exporter per **tipe** menjadi **3 container** (`mysqld-exporter-all`, `postgres-exporter-all`, `redis-exporter`), masing-masing menjalankan beberapa proses exporter pada port berbeda (satu proses per DB target). Prometheus scrape tiap target sebagai job terpisah (instance label tetap membedakan DB). Sama seperti ADR-001/004: mengurangi jumlah container, bukan mengurangi cakupan metrik.

**Alasan:**
1. **Efisiensi orkestrasi.** 11 container → 3 container (-8). Exporter adalah side-car metrik ringan; tidak butuh isolasi per-DB.
2. **Metrik tetap terpisah.** Tiap proses exporter punya target/DSN sendiri dan Prometheus memberi `instance` label berbeda (`mariadb-auth`, `mariadb-module`, dst) → dashboard Grafana tidak berubah.
3. **Risiko rendah.** Tidak mengubah credential/ACL; sekadar menggabung proses sejenis dalam 1 container (multi-port).

**Skema mapping (port per target):**
```
mysqld-exporter-all   (1 container)
 ├─ :9104 → mariadb-auth
 ├─ :9105 → mariadb-control
 ├─ :9106 → mariadb-module
 ├─ :9107 → mariadb-stream
 ├─ :9108 → mariadb-audit
 ├─ :9109 → mariadb-alert
 ├─ :9110 → mariadb-notification
 └─ :9111 → mariadb-ml

postgres-exporter-all (1 container)
 ├─ :9187 → timescaledb-module
 └─ :9188 → timescaledb-analytics

redis-exporter        (1 container, sudah ada sejak ADR-004)
 └─ :9121 → redis-shared (DB0-3 via label)
```

**Yang TIDAK diubah:** Jumlah job & label di `prometheus.yml` tetap sama (per-DB), hanya `targets:` menunjuk port container gabungan. cAdvisor, node-exporter, mosquitto-exporter, nats-exporter, kong tetap 1 masing-masing (sudah shared).
