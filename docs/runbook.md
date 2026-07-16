# 🛠️ Operational Runbook — Troubleshooting

> Panduan operasional & diagnosa saat sistem bermasalah. Dipisahkan dari `planning.md` karena ini runbook, bukan dokumen arsitektur.

---

## ⚠️ Live MQTT Monitor "Loading terus" (Kasus 2026-07-13)

**Gejala:** Di halaman Configure Node, panel *Live MQTT Monitor* diam terus menampilkan **"Listening for live MQTT payload..."** padahal ESP sudah mengirim telemetry.

**Alur data yang harus utuh:**
```
ESP → broker MQTT remote (MQTT_URL, default tcp://192.168.1.103:1884)
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
