import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env():
    env_path = ROOT / ".env"
    if env_path.exists():
        with env_path.open() as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


_load_env()

BASE_URL = os.getenv("KONG_PUBLIC_URL", "http://localhost:8000").rstrip("/")
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090").rstrip("/")
GRAFANA_URL = os.getenv("GRAFANA_URL", "http://localhost:3000").rstrip("/")

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC_PREFIX = os.getenv("MQTT_TOPIC_PREFIX", "smartfarm")

WS_PATH = "/ws"

JWT_SECRET = os.getenv("JWT_SECRET", "")

ENDPOINTS = [
    {
        "name": "health-check",
        "method": "GET",
        "path": "/health",
        "auth": False,
        "weight": 15,
        "body": None,
    },
    {
        "name": "auth-login",
        "method": "POST",
        "path": "/auth/login",
        "auth": False,
        "weight": 10,
        "body": {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    },
    {
        "name": "auth-refresh",
        "method": "POST",
        "path": "/auth/refresh",
        "auth": False,
        "weight": 3,
        "body": {"refresh_token": "{{refresh_token}}"},
    },
    {
        "name": "auth-me",
        "method": "GET",
        "path": "/auth/me",
        "auth": True,
        "weight": 12,
        "body": None,
    },
    {
        "name": "modules-list",
        "method": "GET",
        "path": "/modules",
        "auth": True,
        "weight": 12,
        "body": None,
    },
    {
        "name": "nodes-list",
        "method": "GET",
        "path": "/nodes",
        "auth": True,
        "weight": 8,
        "body": None,
    },
    {
        "name": "analytics-query",
        "method": "GET",
        "path": "/analytics?range=1h",
        "auth": True,
        "weight": 8,
        "body": None,
    },
    {
        "name": "control-list",
        "method": "GET",
        "path": "/control",
        "auth": True,
        "weight": 6,
        "body": None,
    },
    {
        "name": "streams-list",
        "method": "GET",
        "path": "/streams",
        "auth": True,
        "weight": 6,
        "body": None,
    },
    {
        "name": "ml-list",
        "method": "GET",
        "path": "/ml/models",
        "auth": True,
        "weight": 4,
        "body": None,
    },
    {
        "name": "hls-probe",
        "method": "GET",
        "path": "/hls/nonexistent/index.m3u8",
        "auth": False,
        "weight": 4,
        "body": None,
    },
]

PENTEST_TARGETS = [
    "/auth/me",
    "/auth/logout",
    "/auth/account",
    "/auth/users",
    "/auth/roles",
    "/auth/permissions",
    "/auth/sessions",
    "/modules",
    "/nodes",
    "/analytics",
    "/control",
    "/control/commands",
    "/streams",
    "/snapshots",
    "/ml/models",
]


def weighted_endpoint_pool():
    pool = []
    for ep in ENDPOINTS:
        pool.extend([ep] * ep["weight"])
    return pool
