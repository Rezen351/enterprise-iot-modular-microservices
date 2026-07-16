"""Model registry routes — CRUD + weights upload + activation.

A "model" is a registered YOLO weights entry with a stable ``model_id`` that
clients use to select which network to run for inference.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select

from app.database import SessionLocal, VisionModel
from app.schemas import Message, ModelCreate, ModelList, ModelOut, ModelUpdate
from app.security import require_read, require_write
from app.vision_engine import registry
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml/models", tags=["Model Registry"])


def _out(meta: dict) -> ModelOut:
    loaded = meta["id"] in registry._loaded
    num_classes = len(meta.get("class_names") or []) or None
    return ModelOut(**{**meta, "loaded": loaded, "num_classes": num_classes})


@router.post("", response_model=ModelOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_write)])
def create_model(payload: ModelCreate):
    """Register a new model. Provide ``file_path`` (weights already in the
    mounted volume) or upload weights afterwards via ``/weights``."""
    try:
        meta = registry.create_model(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _out(meta)


@router.get("", response_model=ModelList, dependencies=[Depends(require_read)])
def list_models(status_filter: str | None = None):
    items = registry.list_models(status_filter)
    return ModelList(total=len(items), items=[_out(m) for m in items])


@router.get("/{model_id}", response_model=ModelOut, dependencies=[Depends(require_read)])
def get_model(model_id: str):
    meta = registry.get_model(model_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return _out(meta)


@router.put("/{model_id}", response_model=ModelOut, dependencies=[Depends(require_write)])
def update_model(model_id: str, payload: ModelUpdate):
    meta = registry.update_model(model_id, payload)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return _out(meta)


@router.post("/{model_id}/activate", response_model=ModelOut,
             dependencies=[Depends(require_write)])
def activate_model(model_id: str):
    """Mark a model as the default (active) one used when ``model_id`` is omitted."""
    meta = registry.set_active(model_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return _out(meta)


@router.post("/{model_id}/weights", response_model=ModelOut,
              dependencies=[Depends(require_write)])
def upload_weights(model_id: str, file: UploadFile = File(...)):
    """Upload YOLO weights (.pt) and bind them to the model."""
    max_bytes = get_settings().max_upload_bytes
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max upload size of {get_settings().max_upload_mb} MB",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    filename = file.filename or ""
    if not filename.lower().endswith(".pt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model weights must be a .pt (PyTorch) file",
        )
    try:
        meta = registry.upload_weights(model_id, filename, data)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _out(meta)


@router.delete("/{model_id}", response_model=Message, dependencies=[Depends(require_write)])
def delete_model(model_id: str):
    if not registry.delete_model(model_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return Message(message=f"Model {model_id} deleted")


@router.get("/{model_id}/count")
def model_count(model_id: str):
    """Number of detection rows produced by this model (quick stats)."""
    with SessionLocal() as session:
        cnt = session.execute(
            select(func.count()).select_from(VisionDetection).where(
                VisionDetection.model_id == model_id
            )
        ).scalar_one()
    return {"model_id": model_id, "detections": cnt}
