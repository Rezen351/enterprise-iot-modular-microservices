# 🛠️ Operational Runbook — Troubleshooting

> Panduan operasional & diagnosa saat sistem bermasalah. Dipisahkan dari `planning.md` karena ini runbook, bukan dokumen arsitektur.

---

## ⚠️ Live MQTT Monitor "Loading terus" (Kasus 2026-07-13)

**Gejala:** Di halaman Configure Node, panel *Live MQTT Monitor* diam terus menampilkan **"Listening for live MQTT payload..."** padahal ESP sudah mengirim telemetry.

**Alur data yang harus utuh:**
```
ESP → broker MQTT internal (tcp://mosquitto:1883, auth enabled)
    → Module Service (subscribe smartfarm/#)
    → PublishLive() publish ke NATS subject "mqtt.{node_id}"
    → WS-Gateway (subscribe mqtt.{node_id}) → WebSocket → Dashboard
```
Teks itu hanya muncul saat WebSocket **sudah `open`** tapi `messages` kosong (dashboard `NodeConfigPage.jsx:385`), artinya koneksi berhasil tapi tidak ada payload yang sampai ke subject NATS.

**Akar masalah yang ditemukan:** Service `module` **kehilangan koneksi Core NATS** (connection putus & tidak auto-recover dengan baik). `PublishLive` (`services/module/internal/service/service.go:571`) memanggil `s.nats.Publish(...)` tapi `s.nats` sudah terputus → pesan **dibuang diam-diam (tidak ada error log)**. Akibatnya subject `mqtt.{node_id}` di NATS kosong → WS-Gateway tidak punya apa-apa untuk di-stream.

> Penting: `telemetry.batch` TETAP jalan karena lewat koneksi **JetStream** yang terpisah, bukan Core NATS — ini yang membuat module terlihat "masih terhubung" padahal live stream-nya mati. Jangan gunakan `telemetry.batch` sebagai indikator bahwa live monitor berfungsi.

**Cara diagnosa cepat (end-to-end):**
1. Pastikan node benar-benar online & publish: `mosquitto_sub -h <MQTT_URL_HOST> -p <PORT> -t 'smartfarm/#'` (broker ada di ENV `MQTT_URL`, BUKAN container `mosquitto` lokal yang hanya untuk dev).
2. Cek `module` terhubung ke NATS — buka monitoring NATS `http://<nats>:8222/connz` dan pastikan ada client **`module-svc`**. Jika tidak ada → inilah penyebabnya.
3. Subscribe subject live: `nats sub "mqtt.<NODE_ID>" -s nats://<nats>:4222`. Jika tidak ada pesan padahal ESP kirim → `PublishLive` gagal (koneksi Core NATS mati).
4. Pastikan WS-Gateway subscribe subject yang benar: `subject = "mqtt." + nodeID` (`services/wsgateway/internal/handler/handler.go:81`).

**Solusi:**
- **Quick fix:** `docker restart microservices-module-1` → koneksi Core NATS dibangun ulang saat startup, live monitor langsung jalan.
- **Permanent fix (SELESAI 2026-07-14):** ditambahkan `nats.DisconnectErrHandler` / `nats.ReconnectHandler` / `nats.ClosedHandler` / `nats.ErrorHandler` + log di `services/module/main.go` dan `services/wsgateway/main.go`, serta health-check periodik (30s) yang men-log WARN bila `!natsConn.IsConnected()`. Selain itu `publishTelemetry` (`services/module/internal/service/service.go:575`) kini men-log error `telemetry.ingest` (tidak lagi `_ =` diam-diam). WS-Gateway (`NodeLive`) juga mereplay payload telemetry terakhir dari cache `mqtt.>` saat client connect, sehingga tidak "loading" bila device report-nya jarang.

---

## ⚠️ Dashboard Error 404 / 401 / 502 / 503 saat akses API

**Gejala:** Dashboard di `:5173/v1/...` menampilkan:
- `404 page not found`
- `401 Unauthorized` berulang kali
- `502 Bad Gateway`
- `503 Service Temporarily Unavailable`

### Diagnosa cepat

| Error | Arsitektur penyebab | Aksi | Kenapa |
|---|---|---|---|
| `404 page not found` | Kong belum running / belum healthy | `docker compose up -d kong` lalu tunggu healthy | Nginx dashboard mem-proxy `/v1/...` ke `kong:8000`. Jika Kong tidak ada, nginx balas 404. |
| `401 Unauthorized` berulang | Token kadaluarsa/invalid dan refresh gagal | Clear `sessionStorage` + refresh halaman, atau login ulang | Client coba refresh token berkali-kali; kalau refresh juga 401, UI terjebak loop. |
| `502 Bad Gateway` | Kong running tapi upstream tidak reachable | `docker compose restart kong` atau cek IP `kong` | Nginx sudah resolve `kong:8000` tapi Kong belum siap/listening. |
| `503 Service Temporarily Unavailable` | Kong healthy tapi hasilkan `failure to get a peer from the ring-balancer` | `docker compose restart kong` | Kong menahan **stale DNS cache** (Lua resolver cache); restart menghapus cache lalu upstream bisa ditemukan. |

### Kapan harus restart dashboard

- **Tidak perlu** saat Kong hanya di-start (`up -d kong`) atau di-restart.
- **Perlu** saat Kong di-recreate (`--force-recreate kong`).
- **Alasan:** `nginx.conf` pakai `proxy_pass http://kong:8000`. Nginx resolve DNS `kong` saat startup dan cache IP-nya. Kalau Kong recreate dapat IP baru, nginx bisa masih kirim ke IP lama sampai resolve ulang.

### Cek apakah IP Kong berubah

```bash
docker inspect microservices-kong-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}'
```

Jika ragu apakah dashboard sudah melihat IP yang sama (saat dashboard running):

```bash
docker compose exec dashboard sh -c 'getent hosts kong'
```

Kalau output beda dari IP Kong saat ini → `docker compose restart dashboard` agar nginx resolve IP baru segera.

### Catatan teknis

- **Nginx + DNS cache:** Docker embedded DNS TTL untuk user-defined network biasanya ~60 detik. Start Kong biasanya aman tanpa restart dashboard.
- **Kong + Lua DNS cache:** Kong bisa cache resolver hasil; kalau upstream container baru dan 503 masih muncul, `restart kong` adalah langkah paling cepat.
