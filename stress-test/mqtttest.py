import json
import threading
import time

from config import MQTT_HOST, MQTT_PORT, MQTT_TOPIC_PREFIX


class MqttLoadResult:
    def __init__(self):
        self.clients = 0
        self.connected = 0
        self.published = 0
        self.failed_publish = 0
        self.connect_errors = []
        self.latencies = []
        self.start = 0.0
        self.end = 0.0
        self._lock = threading.Lock()

    def record_connect(self, ok, err=None):
        with self._lock:
            self.clients += 1
            if ok:
                self.connected += 1
            else:
                self.connect_errors.append(err)

    def record_publish(self, ok, latency_ms=None):
        with self._lock:
            if ok:
                self.published += 1
                if latency_ms is not None:
                    self.latencies.append(latency_ms)
            else:
                self.failed_publish += 1


def _client_worker(client_id, host, port, topic, rate, duration, user, pw, result):
    try:
        import paho.mqtt.client as mqtt
    except ImportError as exc:
        with result._lock:
            result.connect_errors.append(f"paho-mqtt not installed: {exc}")
        return

    def on_connect(client, userdata, flags, rc, *args):
        if rc == 0:
            result.record_connect(True)
        else:
            result.record_connect(False, f"rc={rc}")

    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv5)
    client.on_connect = on_connect
    if user:
        client.username_pw_set(user, pw)
    try:
        client.connect(host, port, keepalive=60)
    except Exception as exc:
        result.record_connect(False, f"{type(exc).__name__}: {str(exc)[:120]}")
        return
    client.loop_start()

    interval = 1.0 / max(1, rate)
    end = time.time() + duration
    seq = 0
    while time.time() < end:
        payload = json.dumps({
            "device": client_id,
            "ts": int(time.time() * 1000),
            "seq": seq,
            "temp": 25.0 + (seq % 10),
            "hum": 60 + (seq % 20),
        })
        seq += 1
        t0 = time.perf_counter()
        info = client.publish(topic, payload, qos=0)
        try:
            info.wait_for_publish(timeout=5)
            ok = info.is_published()
        except Exception:
            ok = False
        result.record_publish(ok, (time.perf_counter() - t0) * 1000.0)
        time.sleep(interval)

    client.loop_stop()
    try:
        client.disconnect()
    except Exception:
        pass


def run_mqtt(clients=20, rate_per_client=5, duration=60, host=None, port=None,
             topic=None, user=None, password=None):
    h = host or MQTT_HOST
    p = port or MQTT_PORT
    t = topic or f"{MQTT_TOPIC_PREFIX}/telemetry/loadtest"
    result = MqttLoadResult()
    result.start = time.time()
    threads = []
    for i in range(clients):
        cid = f"stress-{i}-{int(time.time())}"
        th = threading.Thread(
            target=_client_worker,
            args=(cid, h, p, t, rate_per_client, duration, user, password, result),
        )
        th.start()
        threads.append(th)
    for th in threads:
        th.join()
    result.end = time.time()
    return result
