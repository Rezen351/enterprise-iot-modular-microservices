"""Database layer (MariaDB via SQLAlchemy).

The ML/Vision service owns `mariadb-ml`. Schema is created idempotently on
startup (CREATE TABLE IF NOT EXISTS) so the service is the single source of
truth for its DDL, mirroring the GORM AutoMigrate approach used by the Go
services in this project.
"""
from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    event,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import get_settings

settings = get_settings()

_engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle,
    pool_pre_ping=True,
    json_serializer=lambda obj: json.dumps(obj, default=str),
)

SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class VisionModel(Base):
    """Registered YOLO model in the model registry.

    Each model gets a stable ``model_id`` that API consumers use to select
    which weights to run for inference (the "best.pt" you trained becomes one
    of these entries, addressable by its id).
    """

    __tablename__ = "vision_models"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(255), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    model_type: Mapped[str] = mapped_column(String(64), default="yolov8")
    framework: Mapped[str] = mapped_column(String(64), default="ultralytics")
    version: Mapped[str | None] = mapped_column(String(64))
    file_path: Mapped[str | None] = mapped_column(String(1024))
    class_names: Mapped[list | None] = mapped_column(JSON)
    input_size: Mapped[int] = mapped_column(Integer, default=640)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.25)
    iou_threshold: Mapped[float] = mapped_column(Float, default=0.45)
    status: Mapped[str] = mapped_column(
        Enum("registered", "active", "failed", "disabled", name="vm_status"),
        default="registered",
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[object] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (Index("idx_vm_status", "status"),)


class VisionDetection(Base):
    """History of every inference run (one row per processed image)."""

    __tablename__ = "vision_detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    detection_uid: Mapped[str | None] = mapped_column(String(64), unique=True)
    model_id: Mapped[str | None] = mapped_column(String(64))
    model_name: Mapped[str | None] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(
        Enum("upload", "stream", "base64", name="vd_source"), default="upload"
    )
    source_ref: Mapped[str | None] = mapped_column(String(1024))
    original_url: Mapped[str | None] = mapped_column(String(1024))
    annotated_url: Mapped[str | None] = mapped_column(String(1024))
    num_detections: Mapped[int] = mapped_column(Integer, default=0)
    classes: Mapped[list | None] = mapped_column(JSON)
    detections: Mapped[list | None] = mapped_column(JSON)
    confidence_min: Mapped[float | None] = mapped_column(Float)
    confidence_max: Mapped[float | None] = mapped_column(Float)
    confidence_avg: Mapped[float | None] = mapped_column(Float)
    execution_time_ms: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(32), default="success")
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_vd_model", "model_id"),
        Index("idx_vd_created", "created_at"),
    )


def init_db() -> None:
    """Create tables if they do not exist. Idempotent."""
    # Use a MariaDB-compatible charset via the engine; create schema.
    Base.metadata.create_all(_engine)


@contextmanager
def get_session() -> Iterator[sessionmaker]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@event.listens_for(_engine, "connect")
def _set_charset(dbapi_connection, connection_record):  # pragma: no cover
    try:
        with dbapi_connection.cursor() as cur:
            cur.execute("SET NAMES utf8mb4")
    except Exception:
        pass
