"""Read-only listing of objects stored in the `ml-result` bucket by the
external CCTV capture cron. Exposes frames / annotated images / result JSON
so the dashboard gallery can render captures without touching the ML bucket.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel

from app.config import get_settings
from app.security import require_read, require_write
from app import storage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml", tags=["Results"])


class ResultObject(BaseModel):
    key: str
    url: str
    size: int
    last_modified: str | None = None
    kind: str


_PREFIX_KIND = {
    "frames": "frame",
    "annotated": "annotated",
    "results": "result",
}


@router.get("/results", response_model=list[ResultObject], dependencies=[Depends(require_read)])
def list_results(
    prefix: str = Query("frames", description="frames | annotated | results"),
    limit: int = Query(200, ge=1, le=1000),
):
    """List objects under a prefix in the `ml-result` bucket.

    URLs are returned as same-origin `/storage/{bucket}/{key}` paths so the
    dashboard can serve them through its MinIO proxy (the bucket is
    public-read)."""
    settings = get_settings()
    bucket = settings.minio_result_bucket
    if prefix not in _PREFIX_KIND:
        prefix = "frames"
    client = storage.get_client()

    items: list[ResultObject] = []
    for obj in client.list_objects(bucket, prefix=f"{prefix}/", recursive=True):
        if obj.object_name is None or obj.is_dir:
            continue
        url = f"/storage/{bucket}/{obj.object_name}"
        items.append(
            ResultObject(
                key=obj.object_name,
                url=url,
                size=obj.size or 0,
                last_modified=obj.last_modified.isoformat() if obj.last_modified else None,
                kind=_PREFIX_KIND.get(prefix, "frame"),
            )
        )
        if len(items) >= limit:
            break
    items.sort(key=lambda i: i.key, reverse=True)
    return items


@router.delete("/results", dependencies=[Depends(require_write)])
def delete_result(key: str = Query(...)):
    """Delete a single object from the `ml-result` bucket (file management)."""
    settings = get_settings()
    bucket = settings.minio_result_bucket
    client = storage.get_client()
    try:
        client.remove_object(bucket, key)
    except Exception as exc:  # already gone / not found — treat as deleted
        logger.warning("remove_object %s/%s failed: %s", bucket, key, exc)
    return {"deleted": key, "bucket": bucket}
