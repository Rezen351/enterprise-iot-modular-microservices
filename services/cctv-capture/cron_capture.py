"""External CCTV capture cron for ML data collection.

Runs independently of the microservices. Every interval it:
  1. reads the latest telemetry from the Module Service Redis cache,
  2. only proceeds when the pump is OFF or the output load is 0 (so no
     misting is captured in the frame),
   3. grabs a single CCTV frame via ffmpeg from the RTSP relay,
   4. runs inference through the ML service /ml/detect API,
   5. uploads the raw frame + detection result to the `ml-result` MinIO bucket
      (the SAME bucket the in-app "Capture Detect AI" button writes to, so
      both routine cron captures and user-triggered captures appear together
      in the gallery's CAPTURES tab).

Scheduling (pick one):
  - CAPTURE_CRON       : a 5-field cron expression, e.g. "0 */8 * * *" (custom
                         routine schedule — most flexible).
  - CAPTURE_INTERVAL_HOURS : fixed sleep loop (default 8h) when no cron expr.
  - RUN_ONCE=1          : single shot (for an external host cron).
"""
from __future__ import annotations

import io
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

from PIL import Image
import minio
import redis
import requests

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("cctv-capture")

KNOWN_BUCKETS = ["ml", "stream", "ml-result", "ota"]


def env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def env_bool(key: str, default: bool) -> bool:
    v = os.getenv(key)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def parse_list(value: str) -> list[str]:
    return [p.strip() for p in value.split(",") if p.strip()]


def resolve_paths(obj: Any, parts: list[str]) -> list[Any]:
    if not parts:
        return [obj]
    if not isinstance(obj, dict):
        return []
    key = parts[0]
    if key == "*":
        out: list[Any] = []
        for v in obj.values():
            out.extend(resolve_paths(v, parts[1:]))
        return out
    if key in obj:
        return resolve_paths(obj[key], parts[1:])
    return []


def is_off(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return not value
    if isinstance(value, (int, float)):
        return value == 0
    s = str(value).strip().lower()
    return s in ("0", "0.0", "off", "false", "no", "")


def load_zero(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return value == 0
    try:
        return float(str(value).strip()) == 0
    except ValueError:
        return False


def read_latest_telemetry(rdb: redis.Redis, node_ids: list[str]) -> dict[str, dict]:
    result: dict[str, dict] = {}
    if node_ids:
        keys = [f"node:latest:{n}" for n in node_ids]
    else:
        keys = [k.decode() for k in rdb.scan_iter(match="node:latest:*")]
    for key in keys:
        node_id = key.split(":", 2)[-1]
        raw = rdb.get(key)
        if not raw:
            continue
        try:
            result[node_id] = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("telemetry for %s is not valid JSON", node_id)
    return result


def evaluate_condition(telemetry: dict[str, dict], pump_paths: list[str], load_paths: list[str], mode: str) -> tuple[bool, dict]:
    detail: dict[str, Any] = {"nodes": {}, "pump_off": False, "load_zero": False}
    for node_id, payload in telemetry.items():
        node_pump_off = False
        node_load_zero = False
        for p in pump_paths:
            for v in resolve_paths(payload, p.split(".")):
                if is_off(v):
                    node_pump_off = True
        for p in load_paths:
            for v in resolve_paths(payload, p.split(".")):
                if load_zero(v):
                    node_load_zero = True
        detail["nodes"][node_id] = {
            "pump_off": node_pump_off,
            "load_zero": node_load_zero,
        }
        if node_pump_off:
            detail["pump_off"] = True
        if node_load_zero:
            detail["load_zero"] = True
    if mode == "all":
        allowed = bool(telemetry) and all(
            n["pump_off"] or n["load_zero"] for n in detail["nodes"].values()
        )
    else:
        allowed = detail["pump_off"] or detail["load_zero"]
    return allowed, detail


def discover_targets(token: str) -> tuple[list[str], dict[str, str], Optional[str]]:
    """Resolve the list of MediaMTX path names to snapshot and their sources.

    Returns (names, sources, error) where ``sources`` maps each name to the
    upstream camera RTSP URL. We register each path in MediaMTX (on demand,
    pulling from the camera) right before capturing — paths added via the
    MediaMTX API are ephemeral and disappear on a MediaMTX restart, so we must
    (re)create them every cycle rather than assuming they already exist.

    Priority:
      1. CCTV_CAPTURE_STREAMS (explicit comma-separated path names)
      2. the streams already managed by the stream service (GET /streams,
         which also exposes each stream's source RTSP URL)
      3. fallback: a temporary MediaMTX path registered from CCTV_RTSP_URL
    """
    names = parse_list(env("CAPTURE_STREAMS", ""))
    if names:
        return names, {}, None

    base = env("STREAM_BASE_URL", "http://stream:8080")
    try:
        r = requests.get(
            f"{base}/streams",
            headers={"Authorization": f"Bearer {token}"} if token else {},
            timeout=15,
        )
        r.raise_for_status()
        streams = [s for s in (r.json().get("streams") or []) if s.get("name")]
        names = [s["name"] for s in streams]
        sources = {s["name"]: s.get("source_rtsp") or "" for s in streams}
        if names:
            return names, sources, None
    except Exception as exc:
        logger.warning("could not discover streams from stream service: %s", exc)

    if env("CCTV_RTSP_URL", ""):
        return ["__camera__"], {"__camera__": env("CCTV_RTSP_URL", "")}, None
    return [], {}, "set CCTV_CAPTURE_STREAMS, register streams, or set CCTV_RTSP_URL"


def register_path(name: str, source: str) -> None:
    api = env("MEDIAMTX_API_URL", "http://mediamtx:9997")
    try:
        requests.post(
            f"{api}/v3/config/paths/add/{name}",
            json={
                "source": source,
                "sourceOnDemand": True,
                "sourceOnDemandStartTimeout": "20s",
                "sourceOnDemandCloseAfter": "15s",
            },
            timeout=15,
        )
    except Exception as exc:
        logger.warning("mediamtx register path %s failed: %s", name, exc)


def remove_path(name: str) -> None:
    api = env("MEDIAMTX_API_URL", "http://mediamtx:9997")
    try:
        requests.delete(f"{api}/v3/config/paths/delete/{name}", timeout=15)
    except Exception:
        pass


def capture_frame(rtsp_url: str, min_bytes: int, timeout: int, attempts: int = 3) -> bytes:
    """Grab one JPEG frame from an RTSP source via ffmpeg.

    MediaMTX has no built-in HTTP snapshot endpoint, so we pull one frame from
    the RTSP relay (rtsp://mediamtx:8554/{name}) or directly from the camera
    RTSP URL. The output-seek skips the initial GOP so we get a clean keyframe.
    Retries with backoff to tolerate a cold on-demand source.
    """
    args = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-rtsp_transport", "tcp", "-i", rtsp_url,
        "-ss", "1", "-frames:v", "1", "-q:v", "2", "-an",
        "-f", "image2", "-c:v", "mjpeg", "pipe:1",
    ]
    backoff = 1
    last_err = None
    for attempt in range(attempts):
        if attempt > 0:
            time.sleep(backoff)
            backoff = min(backoff * 2, 2)
        try:
            proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            last_err = f"ffmpeg timed out after {timeout}s (stream may not be live)"
            continue
        if proc.returncode != 0:
            last_err = proc.stderr.decode().strip() or "ffmpeg failed (stream may not be live)"
            continue
        data = proc.stdout
        if len(data) < min_bytes and attempt != attempts - 1:
            last_err = f"frame too small ({len(data)} bytes) — stream may not be live"
            continue
        return data
    raise RuntimeError(last_err or "ffmpeg failed")


def is_blank_frame(image_bytes: bytes, max_stddev: float = 12.0, min_unique_colors: int = 60) -> bool:
    """Heuristic: is the JPEG effectively blank (uniform grey/color)?

    MediaMTX may return a placeholder frame for a path that is "ready" but
    has no real video (camera unreachable, no-signal test pattern, etc).
    Such frames are nearly uniform and carry almost no visual information,
    so we skip them rather than polluting the ML dataset.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return True
    small = img.resize((64, 64))
    pixels = list(small.getdata())
    n = len(pixels)
    if n == 0:
        return True
    means = [sum(p[c] for p in pixels) / n for c in range(3)]
    stddev = (sum(sum((p[c] - means[c]) ** 2 for p in pixels) / n for c in range(3)) / 3) ** 0.5
    unique = len(set(pixels))
    return stddev < max_stddev or unique < min_unique_colors


def get_ml_token() -> str:
    token = env("ML_API_TOKEN", "")
    if token:
        return token
    auth_base = env("AUTH_BASE_URL", "http://auth:8080")
    username = env("AUTH_USERNAME", env("ADMIN_USERNAME", "admin"))
    password = env("AUTH_PASSWORD", env("ADMIN_PASSWORD", "admin1234"))
    url = f"{auth_base.rstrip('/')}/auth/login"
    try:
        resp = requests.post(url, json={"username": username, "password": password}, timeout=15)
        resp.raise_for_status()
        return resp.json().get("access_token", "")
    except Exception as exc:
        logger.error("failed to obtain ML API token from %s: %s", url, exc)
        return ""


def call_ml_detect(ml_base: str, token: str, image_bytes: bytes, filename: str, model_id: Optional[str], conf: Optional[float], iou: Optional[float], imgsz: Optional[int]) -> dict:
    url = f"{ml_base.rstrip('/')}/ml/detect"
    files = {"files": (filename, io.BytesIO(image_bytes), "image/jpeg")}
    data: dict[str, Any] = {}
    if model_id:
        data["model_id"] = model_id
    if conf is not None:
        data["conf"] = str(conf)
    if iou is not None:
        data["iou"] = str(iou)
    if imgsz is not None:
        data["imgsz"] = str(imgsz)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    resp = requests.post(url, files=files, data=data, headers=headers, timeout=180)
    resp.raise_for_status()
    return resp.json()


def build_minio_client() -> minio.Minio:
    return minio.Minio(
        env("MINIO_ENDPOINT", "minio:9000"),
        access_key=env("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=env("MINIO_SECRET_KEY", "minioadmin"),
        secure=env_bool("MINIO_USE_SSL", False),
    )


def ensure_bucket(client: minio.Minio, bucket: str) -> None:
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def key_from_url(url: str, default_bucket: str) -> tuple[str, str]:
    rest = url.split("://", 1)[-1]
    path = rest.split("/", 1)[-1] if "/" in rest else ""
    segments = [s for s in path.split("/") if s]
    if "minio" in segments:
        segments = segments[segments.index("minio") + 1:]
    for i, seg in enumerate(segments):
        if seg in KNOWN_BUCKETS:
            return seg, "/".join(segments[i + 1:])
    return default_bucket, "/".join(segments)


def mirror_annotated(client: minio.Minio, detection: dict, result_bucket: str, dest_key: str) -> Optional[str]:
    annotated_url = detection.get("annotated_url")
    if not annotated_url:
        return None
    src_bucket, src_key = key_from_url(annotated_url, "ml")
    try:
        data = client.get_object(src_bucket, src_key).read()
    except Exception as exc:
        logger.warning("could not fetch annotated image %s/%s: %s", src_bucket, src_key, exc)
        return None
    client.put_object(result_bucket, dest_key, io.BytesIO(data), length=len(data), content_type="image/jpeg")
    return dest_key


def cron_delay(expr: str) -> float:
    """Seconds until the next matching time for a 5-field cron expression."""
    from croniter import croniter

    from datetime import datetime as _dt

    return (croniter(expr, _dt.now()).get_next(_dt) - _dt.now()).total_seconds()


def log_config() -> None:
    """Emit resolved configuration so misconfiguration is obvious at startup."""
    fields = [
        ("CAPTURE_CRON", env("CAPTURE_CRON", "")),
        ("CAPTURE_INTERVAL_HOURS", env("CAPTURE_INTERVAL_HOURS", "8")),
        ("RUN_ONCE", env("RUN_ONCE", "")),
        ("CAPTURE_STREAMS", env("CAPTURE_STREAMS", "")),
        ("NODE_IDS", env("NODE_IDS", "")),
        ("CONDITION_MODE", env("CONDITION_MODE", "any")),
        ("SKIP_WHEN_TELEMETRY_MISSING", env("SKIP_WHEN_TELEMETRY_MISSING", "true")),
        ("PUMP_PATHS", env("PUMP_PATHS", "telemetry.outputs.pump")),
        ("LOAD_PATHS", env("LOAD_PATHS", "telemetry.outputs.load1")),
        ("MINIO_RESULT_BUCKET", env("MINIO_RESULT_BUCKET", "ml-result")),
        ("MINIO_STREAM_BUCKET", env("MINIO_STREAM_BUCKET", "stream")),
        ("MODEL_ID", env("MODEL_ID", "")),
        ("ML_BASE_URL", env("ML_BASE_URL", "http://ml:8080")),
        ("CCTV_RTSP_URL", env("CCTV_RTSP_URL", "")),
    ]
    logger.info("config:")
    for k, v in fields:
        logger.info("  %-28s = %s", k, v or "<empty>")


def run_cycle() -> None:
    pump_paths = parse_list(env("PUMP_PATHS", "")) or ["telemetry.outputs.pump"]
    load_paths = parse_list(env("LOAD_PATHS", "")) or ["telemetry.outputs.load1"]
    node_ids = parse_list(env("NODE_IDS", ""))
    mode = env("CONDITION_MODE", "any").lower()
    require_telemetry = env_bool("SKIP_WHEN_TELEMETRY_MISSING", True)

    rdb = redis.Redis(
        host=env("REDIS_ADDR", "redis-module:6379").split(":")[0],
        port=int(env("REDIS_ADDR", "redis-module:6379").split(":")[1]),
        password=env("REDIS_PASSWORD", "") or None,
        db=env_int("REDIS_DB", 0),
        socket_timeout=5,
    )
    telemetry = read_latest_telemetry(rdb, node_ids)
    rdb.close()

    if not telemetry:
        if require_telemetry:
            logger.warning("no telemetry available — skipping capture to avoid misting")
            return
        logger.info("no telemetry available — proceeding (SKIP_WHEN_TELEMETRY_MISSING=false)")

    allowed, detail = evaluate_condition(telemetry, pump_paths, load_paths, mode)
    if not allowed:
        logger.info("capture skipped: pump/load active (misting possible) | detail=%s", json.dumps(detail))
        return
    logger.info("condition met (pump_off=%s load_zero=%s) — capturing", detail["pump_off"], detail["load_zero"])

    ml_token = get_ml_token()
    names, sources, err = discover_targets(ml_token)
    if not names:
        logger.warning("no capture targets: %s — skipping", err or "unknown")
        return

    rtsp_base = env("MEDIAMTX_RTSP_URL", "rtsp://mediamtx:8554").rstrip("/")
    min_bytes = env_int("SNAPSHOT_MIN_BYTES", 20480)
    ffmpeg_timeout = env_int("FFMPEG_TIMEOUT", 8)

    client = build_minio_client()
    result_bucket = env("MINIO_RESULT_BUCKET", "ml-result")
    ensure_bucket(client, result_bucket)
    # The raw frame is also written to the `stream` bucket so the ML service
    # `/ml/detect/from-stream` endpoint (which reads frames from `stream`) can
    # run inference on it. This is the integration point validated by §17e.
    stream_bucket = env("MINIO_STREAM_BUCKET", "stream")
    ensure_bucket(client, stream_bucket)
    public_url = env("MINIO_PUBLIC_URL", "http://localhost:9000").rstrip("/")

    model_id = env("MODEL_ID", "") or None
    conf = float(env("CONF", "")) if env("CONF", "") else None
    iou = float(env("IOU", "")) if env("IOU", "") else None
    imgsz = env_int("IMSZ", 0) or None
    ml_base = env("ML_BASE_URL", "http://ml:8080")

    captured = 0
    for name in names:
        # Build the RTSP source: a MediaMTX path (relayed from the camera) or,
        # as a fallback, the camera RTSP URL directly. We (re)register the
        # MediaMTX path with its upstream source every cycle because API-added
        # paths are ephemeral and vanish on a MediaMTX restart.
        if name == "__camera__":
            src = env("CCTV_RTSP_URL", "")
            target = "camera"
            if src:
                register_path(name, src)
        else:
            target = name
            upstream = sources.get(name)
            if upstream:
                register_path(name, upstream)
            src = f"{rtsp_base}/{name}"
        if not src:
            logger.warning("no RTSP source for %s — skipping", name)
            continue
        try:
            frame = capture_frame(src, min_bytes, ffmpeg_timeout)
        except Exception as exc:
            logger.error("capture failed for %s: %s", name, exc)
            continue

        if is_blank_frame(frame):
            logger.warning("snapshot for %s is blank/grey (no real video) — skipping", target)
            continue

        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        frame_key = f"frames/{target}/{ts}.jpg"
        client.put_object(result_bucket, frame_key, io.BytesIO(frame), length=len(frame), content_type="image/jpeg")

        # Mirror the raw frame into the `stream` bucket (same key prefix) so the
        # ML `/ml/detect/from-stream` endpoint can pick it up. The `stream`
        # bucket is the canonical source of frames for from-stream detection.
        stream_frame_key = f"frames/{target}/{ts}.jpg"
        try:
            client.put_object(stream_bucket, stream_frame_key, io.BytesIO(frame), length=len(frame), content_type="image/jpeg")
        except Exception as exc:
            logger.warning("could not mirror frame to stream bucket %s: %s", stream_frame_key, exc)

        detection: Optional[dict] = None
        try:
            resp = call_ml_detect(ml_base, ml_token, frame, f"{target}_{ts}.jpg", model_id, conf, iou, imgsz)
            if resp.get("results"):
                detection = resp["results"][0]
        except Exception as exc:
            logger.error("ml detect failed for %s: %s", target, exc)

        record = {
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "stream": target,
            "source_rtsp": env("CCTV_RTSP_URL", "") if name == "__camera__" else f"mediamtx:{target}",
            "condition": detail,
            "frame_key": frame_key,
            "frame_url": f"{public_url}/{result_bucket}/{frame_key}",
            "detection": detection,
        }
        record_key = f"results/{target}/{ts}.json"
        record_bytes = json.dumps(record, indent=2).encode()
        client.put_object(result_bucket, record_key, io.BytesIO(record_bytes), length=len(record_bytes), content_type="application/json")

        if detection and env_bool("MIRROR_ANNOTATED", True):
            annotated_key = f"annotated/{target}/{ts}.jpg"
            mirror_annotated(client, detection, result_bucket, annotated_key)

        logger.info(
            "captured %s -> ml-result/%s | detections=%s classes=%s",
            target, record_key,
            detection.get("num_detections") if detection else "n/a",
            detection.get("classes") if detection else "n/a",
        )
        captured += 1

    logger.info("cycle complete: %d target(s) captured of %d discovered", captured, len(names))


def main() -> None:
    log_config()
    cron_expr = env("CAPTURE_CRON", "").strip()
    if cron_expr:
        logger.info("custom cron schedule enabled: %r", cron_expr)
        while True:
            try:
                run_cycle()
            except Exception as exc:
                logger.exception("cycle error: %s", exc)
            try:
                delay = cron_delay(cron_expr)
            except Exception as exc:
                logger.error("invalid CAPTURE_CRON %r (%s) — falling back to 1h: %s", cron_expr, exc, exc)
                delay = 3600
            logger.info("next run in %.0fs", delay)
            time.sleep(max(1.0, delay))
    if env_bool("RUN_ONCE", False):
        logger.info("single-shot run")
        run_cycle()
        return
    interval = env_int("CAPTURE_INTERVAL_HOURS", 8) * 3600
    logger.info("scheduler started, interval=%ds", interval)
    while True:
        try:
            run_cycle()
        except Exception as exc:
            logger.exception("cycle error: %s", exc)
        logger.info("sleeping %ds until next cycle", interval)
        time.sleep(interval)


if __name__ == "__main__":
    sys.exit(main())
