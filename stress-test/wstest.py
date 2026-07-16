import threading
import time

from config import BASE_URL, WS_PATH


class WsLoadResult:
    def __init__(self):
        self.total = 0
        self.connected = 0
        self.failed = 0
        self.disconnected = 0
        self.errors = []
        self.messages_received = 0
        self.latencies = []
        self.start = 0.0
        self.end = 0.0
        self._lock = threading.Lock()

    def record_connect(self, ok, err=None):
        with self._lock:
            self.total += 1
            if ok:
                self.connected += 1
            else:
                self.failed += 1
                if err:
                    self.errors.append(err)


def _connect_one(url, token, result, hold_seconds, verify_ssl):
    try:
        import websocket
    except ImportError as exc:
        with result._lock:
            result.failed += 1
            result.errors.append(f"websocket-client not installed: {exc}")
        return

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    ws = None
    try:
        ws = websocket.create_connection(
            url, header=headers, timeout=15,
            sslopt={"cert_reqs": 0} if not verify_ssl else None,
        )
        result.record_connect(True)
        end = time.time() + hold_seconds
        while time.time() < end:
            try:
                ws.settimeout(2)
                msg = ws.recv()
                if msg:
                    with result._lock:
                        result.messages_received += 1
            except websocket.WebSocketTimeoutException:
                continue
            except Exception:
                with result._lock:
                    result.disconnected += 1
                break
    except Exception as exc:
        result.record_connect(False, f"{type(exc).__name__}: {str(exc)[:120]}")
    finally:
        try:
            if ws:
                ws.close()
        except Exception:
            pass


def run_ws(connections=50, hold_seconds=30, token=None, base_url=None,
           verify_ssl=True, path=None):
    base = (base_url or BASE_URL).rstrip("/")
    ws_url = base.replace("http://", "ws://").replace("https://", "wss://")
    ws_path = path or WS_PATH
    url = f"{ws_url}{ws_path}"

    result = WsLoadResult()
    result.start = time.time()
    threads = []
    for _ in range(connections):
        t = threading.Thread(
            target=_connect_one,
            args=(url, token, result, hold_seconds, verify_ssl),
        )
        t.start()
        threads.append(t)
    for t in threads:
        t.join()
    result.end = time.time()
    return url, result
