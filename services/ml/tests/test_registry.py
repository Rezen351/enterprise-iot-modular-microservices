"""Tests for ``app.vision_engine.ModelRegistry`` persistence & default selection.

Runs fully offline against an in-memory fake ORM (see ``_fakes``). No real
database, torch, or YOLO weights are touched.
"""
from __future__ import annotations

import sys
import types
import uuid

import pytest


def _fake_settings():
    s = types.SimpleNamespace()
    # values the registry reads
    s.models_dir = "/tmp/fake_models"
    s.default_weights_filename = "best.pt"
    s.auto_activate_first_model = True
    return s


sys.path.insert(0, __file__.rsplit("/", 1)[0])
from _fakes import install, reset_store  # noqa: E402

_storage, _ve = install(_fake_settings)
ModelRegistry = _ve.ModelRegistry
ModelCreate = _ve  # placeholder; ModelCreate built dynamically below

# Minimal pydantic-like payload the registry's create_model expects.
# The registry calls data.slug / data.name / data.model_dump(exclude_unset=True)
# on update; we supply a tiny stand-in object.


class _ModelCreate:
    def __init__(self, **kw):
        self.__dict__.update(kw)
        self.metadata = kw.get("metadata")


class _ModelUpdate:
    def __init__(self, **kw):
        self.__dict__.update(kw)
        self._unset = set(kw.keys())

    def model_dump(self, exclude_unset=False):
        return {k: v for k, v in self.__dict__.items() if k != "_unset"}


@pytest.fixture(autouse=True)
def fresh():
    reset_store()
    _ve.registry._loaded.clear()
    yield
    reset_store()


def _create(name, slug=None, is_default=False):
    data = _ModelCreate(
        name=name, slug=slug, description="d", model_type="yolov8",
        framework="ultralytics", version="1", file_path="/tmp/fake_models/x.pt",
        class_names=["a"], input_size=640, confidence_threshold=0.25,
        iou_threshold=0.45, is_default=is_default, metadata={"k": "v"},
    )
    return _ve.registry.create_model(data)


def test_register_and_list():
    m = _create("Model A", slug="a")
    assert m["id"]
    listed = _ve.registry.list_models()
    assert len(listed) == 1
    assert listed[0]["name"] == "Model A"


def test_create_sets_status():
    m_default = _create("Default", slug="def", is_default=True)
    assert m_default["status"] == "active"
    m_reg = _create("Registered", slug="reg")
    assert m_reg["status"] == "registered"


def test_list_filter_by_status():
    _create("Active", slug="act", is_default=True)
    _create("Registered", slug="reg")
    active = _ve.registry.list_models(status="active")
    assert len(active) == 1
    assert active[0]["slug"] == "act"


def test_get_model_and_by_slug():
    m = _create("BySlug", slug="slug1")
    assert _ve.registry.get_model(m["id"])["id"] == m["id"]
    assert _ve.registry.get_model_by_slug("slug1")["id"] == m["id"]
    assert _ve.registry.get_model("missing") is None


def test_duplicate_slug_rejected():
    _create("A", slug="dup")
    with pytest.raises(ValueError):
        _create("B", slug="dup")


def test_set_default_marks_active_and_clears_others():
    a = _create("A", slug="a", is_default=True)
    b = _create("B", slug="b")
    assert _ve.registry.get_model(a["id"])["is_default"] is True
    updated = _ve.registry.set_active(b["id"])
    assert updated["is_default"] is True
    assert _ve.registry.get_model(a["id"])["is_default"] is False
    assert _ve.registry.get_model(b["id"])["is_default"] is True


def test_default_model_picks_default():
    a = _create("A", slug="a", is_default=True)
    _create("B", slug="b")
    d = _ve.registry.default_model()
    assert d["id"] == a["id"]


def test_default_model_auto_activates_first_when_none():
    b = _create("B", slug="b")  # no default set
    d = _ve.registry.default_model()
    assert d is not None
    assert d["id"] == b["id"]
    assert _ve.registry.get_model(b["id"])["is_default"] is True


def test_update_model():
    m = _create("A", slug="a")
    upd = _ve.registry.update_model(m["id"], _ModelUpdate(name="A2", is_default=True))
    assert upd["name"] == "A2"
    assert upd["is_default"] is True
    assert _ve.registry.get_model(m["id"])["is_default"] is True


def test_update_missing_returns_none():
    assert _ve.registry.update_model("nope", _ModelUpdate(name="x")) is None


def test_delete_model():
    m = _create("A", slug="a")
    assert _ve.registry.delete_model(m["id"]) is True
    assert _ve.registry.get_model(m["id"]) is None
    assert _ve.registry.delete_model("nope") is False


def test_within_models_dir():
    reg = _ve.registry
    inside = "/tmp/fake_models/foo.pt"
    outside = "/etc/passwd"
    assert reg._within_models_dir(inside) is True
    assert reg._within_models_dir(outside) is False
