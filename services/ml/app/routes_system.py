"""Health & system routes (public: no JWT required)."""
from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas import HealthStatus
from app.vision_engine import registry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["System"])


@router.get("/health", include_in_schema=False)
def health():
    default = None
    try:
        meta = registry.default_model()
        default = meta["id"] if meta else None
    except Exception:  # pragma: no cover
        default = None
    return HealthStatus(
        status="ok",
        service="ml-api",
        version="1.0.0",
        models_loaded=registry.loaded_count(),
        default_model=default,
    )
