# 📐 Plan — Fase 3: Analytics Service

> **Versi:** 1.0.0
> **Tanggal:** 2026-07-11
> **Status:** 🟡 Direncanakan (belum dikerjakan)
> **Prioritas:** P2
> **Sumber acuan:** `roadmap.md` (Fase 3 — Analytics Service), `planning.md` (Fase 7 — Analytics), `logs.md` (Fase 2 selesai: `telemetry.batch` sudah dipublish oleh Module Service tiap 1 menit).

---

## 🎯 Tujuan Fase 3

Membangun **Analytics Service** (Go) yang mengonsumsi event telemetri dari NATS,
menyimpan agregat time-series ke instance `timescaledb-analytics` miliknya sendiri
(prinsip Database-per-Service), dan mengekspos hasil agregasi (downsampling cerdas
via Continuous Aggregate) ke Dashboard melalui Kong.

Fondasi sudah ada: Module Service sudah mempublikasikan `telemetry.batch` tiap 1 menit
berisi agregat per `(node, metric)`: `count, sum, min, max, avg, last, first_ts, last_ts`.
Analytics **tidak perlu** mengonsumsi `telemetry.ingest` per-reading — cukup konsumsi
`telemetry.batch` untuk efisiensi (sesuai desain yang sudah ditulis di `batch.go:77`).

---

## 🗄️ Topology & Keputusan Desain

| Aspek | Keputusan |
|---|---|
| Database | `timescaledb-analytics` **instance baru** (TimescaleDB), milik Analytics sendiri |
| Sumber data | NATS subject `telemetry.batch` (durian runtuh dari Module Service, 1 menit) |
| Staging table | Hypertable `metrics_rollup` (bucket 1 menit, aligned dgn batch Module) |
| Aggregasi | Continuous Aggregate: `metrics_hourly`, `metrics_daily` |
| Retention | rollup 30d · hourly 365d · daily 730d (ikuti pola `retention policy` di init.sql module) |
| Ekspos | REST API via Kong route `/analytics/*` (protected JWT: Admin/Operator/Viewer) |
| Observability | `/metrics` (prometheus client) + target `analytics-service` di Prometheus |
| Pub/Sub metrik | (Opsional Fase 11) publish `metrics.health` ke NATS — di-skip dulu, scrape langsung seperti Auth |

**Tidak dilakukan di Fase 3:** halaman Dashboard Analytics (di-hide, seperti pola Fase 1),
autentikasi WS, ML inference. Fokus murni: ingest agregat → simpan → query → ekspos.

---

## ✅ Checklist Implementasi

### 1. Infrastruktur Database (`timescaledb-analytics`)

- [ ] `infra/timescaledb/analytics/init.sql`
  - `CREATE EXTENSION IF NOT EXISTS timescaledb;`
  - Hypertable `metrics_rollup(time TIMESTAMPTZ, node_id TEXT, module_id TEXT, metric TEXT, count INT, sum DOUBLE PRECISION, min DOUBLE PRECISION, max DOUBLE PRECISION, avg DOUBLE PRECISION, last DOUBLE PRECISION, first_ts BIGINT, last_ts BIGINT)`
  - `create_hypertable('metrics_rollup', 'time', if_not_exists => TRUE)`
  - Index: `(node_id, metric, time DESC)`, `(metric, time DESC)`
  - Continuous Aggregate `metrics_hourly` (`time_bucket('1h', time)`, node_id, metric, sum(count), sum(sum), min(min), max(max), avg(avg), last(last)) + `add_continuous_aggregate_policy` refresh 1 jam
  - Continuous Aggregate `metrics_daily` (`time_bucket('1d', time)` ...) + refresh 1 hari
  - `add_retention_policy('metrics_rollup', INTERVAL '30 days')`
- [ ] `docker-compose.yml`: service `timescaledb-analytics` (image `timescale/timescaledb:2.17.2-pg16`, volume `./volumes/timescaledb-analytics`, healthcheck `pg_isready`, network `iot-net`)
- [ ] `.env.example` + `.env`: `TIMESCALE_ANALYTICS_DB/USER/PASSWORD` (default `analytics_ts/analytics_user/analytics_pass`)

### 2. Scaffold Analytics Service

- [ ] `services/analytics/go.mod` — module `github.com/almuzky/iot/services/analytics`, Go 1.25
  - deps: `nats.go`, `jackc/pgx/v5` (pgxpool), `go-chi/chi/v5`, `prometheus/client_golang`, `google/uuid`
- [ ] Struktur `internal/`: `config`, `model`, `nats` (subscriber), `tsdb` (write rollup), `repository` (query agg), `service` (normalize/upsert), `handler` (REST), `middleware` (prometheus), `main.go`
- [ ] `Dockerfile` multi-stage (golang:1.25-alpine builder → alpine:3.19 runtime, non-root) + `/health`
- [ ] `docker-compose.yml`: service `analytics` (build, env `TIMESCALE_DSN_ANALYTICS`, `NATS_URL`, `PORT=8080`, depends_on `timescaledb-analytics`+`nats`, healthcheck, port `8082:8080`)

### 3. Config & Model

- [ ] `config/config.go`: `Port`, `TimescaleDSN`, `NATSUrl`, `BatchWindow` (default 1m), `JWTSecret` (untuk verifikasi optional, tapi route dilindungi Kong jadi cukup terima header)
- [ ] `model/model.go`:
  - `BatchMessage{Window string, Rows []BatchRow, RowCount int, Ts int64}`
  - `BatchRow{NodeID, ModuleID, Metric string; Count int; Sum, Min, Max, Avg, Last float64; FirstTS, LastTS int64}`
  - `RollupRow` (DB), DTO response: `SeriesPoint{Time, Value}`, `MetricSummary`, `NodeInfo`

### 4. NATS Subscriber (`internal/nats`)

- [ ] Koneksi JetStream durable consumer ke subject `telemetry.batch` (queue group `analytics`) → survive restart
- [ ] Handler `onBatch(msg)`:
  - Unmarshal `BatchMessage`
  - Mapping `last_ts` (unix ms) → `time` bucket (truncate ke menit)
  - Panggil `service.IngestBatch(ctx, rows)` (idempoten: upsert on `(time, node_id, metric)`)
- [ ] Ack hanya setelah berhasil write ke DB (at-least-once; upsert jaga duplikat)
- [ ] (Opsional) subscribe `telemetry.ingest` sebagai fallback backfill — skip dulu

### 5. TSDB Write & Query (`internal/tsdb`)

- [ ] `tsdb.New(dsn)` pakai `pgxpool` (mirip `module/internal/tsdb/tsdb.go`)
- [ ] `UpsertRollup(ctx, row)` — `INSERT ... ON CONFLICT (time, node_id, metric) DO UPDATE` (recompute avg dari sum/count)
- [ ] `QuerySeries(ctx, nodeID, metric, from, to, interval)`:
  - `1m..1h` → baca `metrics_rollup`
  - `>1h..24h` → baca `metrics_hourly`
  - `>24h` → baca `metrics_daily`
  - Kembalikan points dengan downsampling otomatis (pilih continuous aggregate terdekat)
- [ ] `QuerySummary(ctx, nodeID, metric, from, to)` → min/max/avg/last/count
- [ ] `ListNodes(ctx)` → distinct `node_id` yang punya data

### 6. REST API (`internal/handler` + `chi`)

| Method | Path | Akses | Deskripsi |
|---|---|---|---|
| GET | `/analytics/metrics` | JWT (Viewer+) | Query series: `?node_id=&metric=&from=&to=&interval=` (default 1h, 1m) |
| GET | `/analytics/summary` | JWT (Viewer+) | Ringkasan statistik per node/metric & window |
| GET | `/analytics/nodes` | JWT (Viewer+) | Daftar node yang punya data + metric tersedia |
| GET | `/health` | Public | Healthcheck Kong upstream |

- [ ] Validasi query param (`from/to` ISO8601 atau unix, `interval` enum aman)
- [ ] Sentinel error → HTTP status (400 bad param, 500 internal)
- [ ] Prometheus middleware (counter `analytics_http_requests_total`, durasi) — reuse pola `module/internal/middleware/prometheus.go`

### 7. Kong Route (`infra/kong/kong.yml`)

- [ ] Upstream `analytics-upstream` → `analytics:8080`, healthcheck `/health`
- [ ] Route `/analytics` (dan subpath) → upstream, **JWT plugin** (claim iss), rate-limiting 60 req/min, CORS, prometheus
- [ ] Pastikan subject NATS & role Viewer boleh akses (dashboard Viewer butuh baca)

### 8. Prometheus

- [ ] `infra/prometheus/prometheus.yml`: tambah job `analytics-service` → `analytics:8080/metrics`
- [ ] Target harus **UP** setelah `docker compose up`

### 9. main.go Wiring

- [ ] Load config → connect TimescaleDB (retry 10x) → connect NATS JetStream → start subscriber → chi router → graceful shutdown (cancel ctx, drain NATS, close pool)

---

## 🔗 Kontrak Payload (`telemetry.batch` — sudah diproduksi Module)

```json
{
  "window": "1m",
  "row_count": 2,
  "ts": 1752200000000,
  "rows": [
    {
      "node_id": "node-01", "module_id": "mod-a",
      "metric": "inputs.tank_level",
      "count": 12, "sum": 840.5, "min": 68.1, "max": 72.3,
      "avg": 70.04, "last": 71.0,
      "first_ts": 1752200000000, "last_ts": 1752200059000
    }
  ]
}
```

Analytics menyimpan tiap row sebagai 1 baris `metrics_rollup` dengan `time = epoch_ms(last_ts)` dibulatkan ke menit.

---

## ✅ Kriteria Selesai Fase 3

- [ ] `timescaledb-analytics` `healthy` setelah `docker compose up -d`
- [ ] Analytics menerima `telemetry.batch` dari NATS & `metrics_rollup` terisi (verifikasi `SELECT count(*) FROM metrics_rollup`)
- [ ] Continuous aggregate `metrics_hourly`/`metrics_daily` ter-query & auto-refresh
- [ ] `GET /analytics/metrics` via Kong dengan JWT mengembalikan series (downsampling per interval benar)
- [ ] Retention policy aktif (chunk > 30d otomatis di-drop)
- [ ] Target `analytics-service` di Prometheus **UP**; `go build ./...` + `go vet ./...` lolos
- [ ] Catat progres harian di `logs.md` (format tabel status)

---

## 📝 Catatan / Risiko

- **Idempotensi:** pakai upsert on `(time, node_id, metric)` karena NATS at-least-once → batch bisa dobel jika crash sebelum ack.
- **Time alignment:** `last_ts` epoch ms dibulatkan ke menit agar konsisten dengan bucket Continuous Aggregate.
- **Backfill historis:** data `telemetry` di `timescaledb-module` (raw) bisa di-migrasi manual ke `metrics_rollup` lewat query SQL one-off bila perlu (di luar scope awal).
- **Bukan scrape NATS untuk metrik:** konsisten dengan Fase 1, Analytics langsung expose `/metrics` dan Prometheus scrape langsung (belum pakai `metrics.health` — tunggu Fase 11).
