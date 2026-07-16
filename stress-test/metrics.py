import time

import requests

from config import PROMETHEUS_URL

BOTTLENECK_QUERIES = [
    ("Kong request rate (req/s)", "sum(rate(kong_http_requests_total[1m]))"),
    ("Kong request latency p95 (ms)",
     "histogram_quantile(0.95, sum(rate(kong_request_latency_ms_bucket[1m])) by (le))"),
    ("Kong upstream latency p95 (ms)",
     "histogram_quantile(0.95, sum(rate(kong_upstream_latency_ms_bucket[1m])) by (le))"),
    ("Kong 5xx rate", "sum(rate(kong_http_requests_total{status=~\"5..\"}[1m]))"),
    ("Kong 429 rate (rate-limited)",
     "sum(rate(kong_http_requests_total{status=\"429\"}[1m]))"),
    ("Scrape targets down", "count(up == 0)"),
    ("MariaDB queries/s (auth)", "rate(mysql_global_status_queries[1m])"),
    ("MariaDB connections (auth)",
     "mysql_global_status_threads_connected"),
    ("MariaDB slow queries/s", "rate(mysql_global_status_slow_queries[1m])"),
    ("Redis connected clients", "redis_connected_clients"),
    ("Redis memory used (bytes)", "redis_memory_used_bytes"),
    ("TimescaleDB active connections",
     "pg_stat_activity_count"),
    ("NATS connections", "gnatsd_connz_num_connections"),
    ("NATS JetStream total messages", "jetstream_server_total_messages"),
    ("NATS JetStream memory used (bytes)", "jetstream_account_memory_used"),
    ("Mosquitto messages received/s",
     "rate(broker_messages_received[1m])"),
    ("Mosquitto connected clients",
     "broker_clients_connected"),
    ("Host CPU used (%)",
     "100 * (1 - avg by(instance)(rate(node_cpu_seconds_total{mode=\"idle\"}[1m])))"),
    ("Host memory available (%)",
     "node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100"),
]


class MetricsCollector:
    def __init__(self, prometheus_url=None, timeout=10):
        self.url = (prometheus_url or PROMETHEUS_URL).rstrip("/")
        self.timeout = timeout

    def _query(self, expr):
        try:
            resp = requests.get(
                f"{self.url}/api/v1/query",
                params={"query": expr},
                timeout=self.timeout,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("status") != "success":
                return None
            return data.get("data", {}).get("result", [])
        except Exception:
            return None

    def snapshot(self, queries=None):
        queries = queries or BOTTLENECK_QUERIES
        out = {}
        for label, expr in queries:
            res = self._query(expr)
            if not res:
                out[label] = "n/a"
                continue
            import math
            values = []
            for item in res:
                val = item.get("value", [None, None])
                if val and len(val) > 1:
                    try:
                        f = float(val[1])
                        if not math.isnan(f):
                            values.append(f)
                    except (TypeError, ValueError):
                        pass
            if values:
                out[label] = round(sum(values), 4)
            else:
                out[label] = "n/a"
        return out

    def sample_series(self, duration=60, interval=5, queries=None):
        series = []
        end = time.time() + duration
        while time.time() < end:
            snap = self.snapshot(queries=queries)
            snap["_ts"] = time.strftime("%H:%M:%S")
            series.append(snap)
            time.sleep(interval)
        return series

    def compare(self, before, after):
        report = []
        for label in before:
            b = before.get(label)
            a = after.get(label)
            if isinstance(b, (int, float)) and isinstance(a, (int, float)):
                delta = a - b
                pct = (delta / b * 100.0) if b else 0.0
                report.append((label, b, a, delta, round(pct, 1)))
        return report
