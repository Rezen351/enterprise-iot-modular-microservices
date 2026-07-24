import json
import nats
from app.config import settings

class NATSSubscriber:
    def __init__(self):
        self.nc = None

    async def connect(self):
        """
        Langkah 1: Menghubungkan ke NATS Broker & Berlangganan (Subscribe) ke Topik Event
        """
        try:
            # Hubungkan ke NATS server
            self.nc = await nats.connect(settings.NATS_URL)
            print(f"[NATS] Connected to {settings.NATS_URL}")

            # Subscribe ke topik telemetry.ingest
            await self.nc.subscribe("telemetry.ingest", cb=self.handle_telemetry)

            # Subscribe ke topik detection.result
            await self.nc.subscribe("detection.result", cb=self.handle_detection_result)

            print("[NATS] Subscribed to subjects: telemetry.ingest, detection.result")
        except Exception as e:
            print(f"[NATS] Error connecting to NATS: {e}")

    async def disconnect(self):
        """
        Langkah 2: Menutup koneksi NATS secara bersih
        """
        if self.nc and self.nc.is_connected:
            await self.nc.drain()
            await self.nc.close()
            print("[NATS] Connection closed.")

    async def handle_telemetry(self, msg):
        """
        Callback saat menerima data sensor telemetry.ingest
        """
        try:
            payload = json.loads(msg.data.decode("utf-8"))
            print(f"[NATS Received telemetry.ingest]: {payload}")
        except Exception as e:
            print(f"[NATS Error parsing telemetry]: {e}")

    async def handle_detection_result(self, msg):
        """
        Callback saat menerima data analisis AI detection.result
        """
        try:
            payload = json.loads(msg.data.decode("utf-8"))
            print(f"[NATS Received detection.result]: {payload}")
        except Exception as e:
            print(f"[NATS Error parsing detection]: {e}")
