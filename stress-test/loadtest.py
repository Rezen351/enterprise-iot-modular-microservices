import json
import random
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import requests

from config import BASE_URL, ENDPOINTS, weighted_endpoint_pool


def get_token(base_url=None, username=None, password=None):
    base = base_url or BASE_URL
    user = username or "admin"
    pw = password or "admin1234"
    resp = requests.post(
        f"{base}/auth/login",
        json={"username": user, "password": pw},
        timeout=10,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"login failed: {resp.status_code} {resp.text[:200]}")
    data = resp.json()
    token = data.get("access_token") or data.get("token") or data.get("jwt")
    refresh = data.get("refresh_token")
    if not token:
        raise RuntimeError(f"no token in login response: {resp.text[:200]}")
    return token, refresh


class Pacer:
    def __init__(self, rps):
        self._lock = threading.Lock()
        self._interval = 1.0 / max(1e-6, rps)
        self._next = time.time() + self._interval

    def set_rps(self, rps):
        with self._lock:
            self._interval = 1.0 / max(1e-6, rps)

    def sync(self):
        with self._lock:
            now = time.time()
            wait = self._next - now
            if wait <= 0:
                self._next = now + self._interval
                return 0.0
            self._next += self._interval
            return wait



@dataclass
class RequestRecord:
    name: str
    status: int
    latency_ms: float
    bytes: int
    error: str = ""


@dataclass
class LoadStats:
    records: list = field(default_factory=list)
    total: int = 0
    errors: int = 0
    status_counter: Counter = field(default_factory=Counter)
    by_endpoint: dict = field(default_factory=lambda: defaultdict(list))
    start: float = 0.0
    end: float = 0.0

    def add(self, rec: RequestRecord):
        self.records.append(rec)
        self.total += 1
        self.status_counter[rec.status] += 1
        if rec.error:
            self.errors += 1
        self.by_endpoint[rec.name].append(rec)

    def latency_percentile(self, pct):
        if not self.records:
            return 0.0
        vals = sorted(r.latency_ms for r in self.records)
        if not vals:
            return 0.0
        k = (len(vals) - 1) * (pct / 100.0)
        f = int(k)
        c = min(f + 1, len(vals) - 1)
        if f == c:
            return vals[f]
        return vals[f] + (vals[c] - vals[f]) * (k - f)

    def duration(self):
        if not self.start or not self.end:
            return 0.0
        return self.end - self.start

    def throughput(self):
        d = self.duration()
        return self.total / d if d > 0 else 0.0

    def error_rate(self):
        return (self.errors / self.total * 100.0) if self.total else 0.0

    def count_429(self):
        return self.status_counter.get(429, 0)

    def count_5xx(self):
        return sum(v for k, v in self.status_counter.items() if 500 <= k < 600)


class LoadGenerator:
    def __init__(self, base_url=None, token=None, refresh=None, timeout=10,
                 verify_ssl=True, user_agent="iot-stress-test"):
        self.base_url = (base_url or BASE_URL).rstrip("/")
        self.token = token
        self.refresh = refresh
        self.timeout = timeout
        self.verify = verify_ssl
        self.user_agent = user_agent
        self.session = requests.Session()
        self.session.verify = verify_ssl
        self.stats = LoadStats()
        self._lock = threading.Lock()
        self._pool = weighted_endpoint_pool()
        self._stop = threading.Event()

    def _headers(self, ep):
        headers = {
            "User-Agent": self.user_agent,
            "X-Request-ID": f"st-{threading.get_ident()}-{int(time.time()*1000)}",
            "Content-Type": "application/json",
        }
        if ep["auth"] and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _send(self, ep):
        url = f"{self.base_url}{ep['path']}"
        body = ep.get("body")
        if body and isinstance(body, dict):
            body = json.dumps(body).encode()
        start = time.perf_counter()
        err = ""
        status = 0
        nbytes = 0
        try:
            resp = self.session.request(
                ep["method"],
                url,
                headers=self._headers(ep),
                data=body,
                timeout=self.timeout,
            )
            status = resp.status_code
            try:
                nbytes = len(resp.content)
            except Exception:
                nbytes = 0
        except requests.RequestException as exc:
            err = type(exc).__name__
            if exc.args:
                err = str(exc.args[0])[:160]
        latency = (time.perf_counter() - start) * 1000.0
        rec = RequestRecord(ep["name"], status, latency, nbytes, err)
        with self._lock:
            self.stats.add(rec)

    def _worker(self, pacer):
        while not self._stop.is_set():
            wait = pacer.sync()
            if self._stop.is_set():
                break
            if wait > 0:
                time.sleep(wait)
            ep = random.choice(self._pool)
            self._send(ep)

    def _ramp(self, pacer, target, ramp_seconds):
        steps = max(1, int(ramp_seconds))
        for i in range(1, steps + 1):
            if self._stop.is_set():
                return
            pacer.set_rps(target * (i / steps))
            time.sleep(1)

    def run(self, duration=60, rps=50, concurrency=10, ramp_up=0,
            profile=None):
        profile = profile or {}
        self.stats.start = time.time()
        pacer = Pacer(rps if not ramp_up else 1.0)
        ramp_thread = None
        if ramp_up > 0:
            ramp_thread = threading.Thread(
                target=self._ramp, args=(pacer, profile.get("peak_rps", rps), ramp_up)
            )
            ramp_thread.start()

        with ThreadPoolExecutor(max_workers=concurrency) as ex:
            futures = [ex.submit(self._worker, pacer) for _ in range(concurrency)]
            elapsed = 0.0
            while elapsed < duration:
                time.sleep(0.5)
                elapsed = time.time() - self.stats.start
                if self._stop.is_set():
                    break
            self._stop.set()
            for f in futures:
                f.result(timeout=5)
        if ramp_thread:
            ramp_thread.join(timeout=2)
        self.stats.end = time.time()
        return self.stats


def run_load(base_url=None, token=None, refresh=None, duration=60, rps=50,
             concurrency=10, ramp_up=0, profile=None, timeout=10,
             verify_ssl=True, user_agent="iot-stress-test"):
    gen = LoadGenerator(
        base_url=base_url, token=token, refresh=refresh, timeout=timeout,
        verify_ssl=verify_ssl, user_agent=user_agent,
    )
    return gen.run(
        duration=duration, rps=rps, concurrency=concurrency,
        ramp_up=ramp_up, profile=profile,
    )


def run_spike(base_url=None, token=None, refresh=None, duration=120,
              concurrency=10, low_rps=10, high_rps=300, verify_ssl=True):
    gen = LoadGenerator(base_url=base_url, token=token, refresh=refresh,
                        verify_ssl=verify_ssl)
    gen.stats.start = time.time()
    pacer = Pacer(low_rps)
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(gen._worker, pacer) for _ in range(concurrency)]
        phases = [
            ("baseline", low_rps, duration * 0.3),
            ("spike", high_rps, duration * 0.4),
            ("recovery", low_rps, duration * 0.3),
        ]
        for name, rate, secs in phases:
            pacer.set_rps(rate)
            time.sleep(secs)
        gen._stop.set()
        for f in futures:
            f.result(timeout=5)
    gen.stats.end = time.time()
    return gen.stats


def run_soak(base_url=None, token=None, refresh=None, duration=600,
             rps=50, concurrency=10, verify_ssl=True):
    return run_load(
        base_url=base_url, token=token, refresh=refresh, duration=duration,
        rps=rps, concurrency=concurrency, ramp_up=min(30, duration // 4),
        verify_ssl=verify_ssl,
    )
