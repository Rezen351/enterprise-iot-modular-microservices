"""NATS publisher for ``detection.result`` events.

Events are published best-effort: a failure to publish must never break an
inference response. The connection is established lazily and reused.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_nats = None
_loop = None


# Hard caps so a missing/broken NATS broker can never block an inference
# response: connect fails fast and we do not retry forever in the background.
_NATS_CONNECT_TIMEOUT = 2.0
_NATS_MAX_RECONNECT = 0
_NATS_RECONNECT_WAIT = 1.0
_NATS_PUBLISH_TIMEOUT = 3.0


async def _get_nats():
    global _nats, _loop
    if not settings.nats_enabled:
        return None
    if _nats is not None:
        return _nats
    try:  # pragma: no cover - requires live NATS
        import nats

        _loop = asyncio.get_event_loop()
        connect_kwargs: dict[str, Any] = {
            "servers": settings.nats_url,
            "connect_timeout": _NATS_CONNECT_TIMEOUT,
            "reconnect_time_wait": _NATS_RECONNECT_WAIT,
            "max_reconnect_attempts": _NATS_MAX_RECONNECT,
        }
        if settings.nats_user:
            connect_kwargs["user"] = settings.nats_user
            connect_kwargs["password"] = settings.nats_password
        _nats = await nats.connect(**connect_kwargs)
        logger.info("Connected to NATS at %s", settings.nats_url)
    except Exception as exc:  # pragma: no cover
        logger.warning("NATS unavailable, events will be skipped: %s", exc)
        _nats = None
    return _nats


async def publish_detection(payload: dict[str, Any]) -> None:
    """Publish a detection.result event. Swallows all errors."""
    if not settings.nats_enabled:
        return
    try:  # pragma: no cover - requires live NATS
        nc = await _get_nats()
        if nc is None:
            return
        await asyncio.wait_for(
            nc.publish(
                settings.nats_subject_detection,
                json.dumps(payload, default=str).encode("utf-8"),
            ),
            timeout=_NATS_PUBLISH_TIMEOUT,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to publish detection event: %s", exc)


def publish_detection_sync(payload: dict[str, Any]) -> None:
    """Fire-and-forget wrapper to call from sync route handlers.

    Runs in a worker thread with a hard timeout so a broken NATS broker can
    never block (and thus hang) an inference HTTP response.
    """
    if not settings.nats_enabled:
        return
    try:
        import threading

        def _run() -> None:
            try:
                asyncio.run(publish_detection(payload))
            except Exception as exc:  # pragma: no cover
                logger.warning("Failed to publish detection event (sync): %s", exc)

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        t.join(timeout=_NATS_PUBLISH_TIMEOUT + 1.0)
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to publish detection event (sync): %s", exc)
