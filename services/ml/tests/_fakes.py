"""Offline stub layer for the ML service unit tests.

The ML service imports several heavy third-party packages at module load time
(torch/ultralytics, minio, sqlalchemy, pydantic, prometheus_client). They are
not installable in this sandbox and are NOT required to unit-test the pure
Python helpers (``storage.is_safe_object_key``), the ``ModelRegistry``
persistence/selection logic, and the detect response *shape*.

This module installs lightweight fakes into ``sys.modules`` for those heavy
packages **before** any ``app.*`` module is imported, so the real
``app.vision_engine.ModelRegistry`` and ``app.storage`` run against an
in-memory fake ORM instead of a live MariaDB. No real model is loaded.
"""
from __future__ import annotations

import sys
import types
import datetime

# ─── Fake pydantic (just enough for schemas/models) ─────────────────────────


class _FieldInfo:
    def __init__(self, default=None, **kwargs):
        self.default = default


class _BaseModel:
    _fields: dict = {}

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def model_dump(self, exclude_unset=False):
        return {k: getattr(self, k, None) for k in self.__dict__.keys()}


class _PydanticBase:
    @classmethod
    def _register(cls, name, fields):
        cls._fields = dict(fields)
        return cls


def _make_model(name, fields):
    ns = {"_fields": dict(fields), "__annotations__": {f: object for f in fields}}
    ns["model_dump"] = lambda self, exclude_unset=False: {
        k: getattr(self, k, None) for k in self.__dict__.keys()
    }
    ns["model_validator"] = staticmethod(lambda *a, **k: lambda f: f)
    cls = type(name, (_BaseModel,), ns)
    return cls


pydantic = types.ModuleType("pydantic")
pydantic.BaseModel = _BaseModel
pydantic.Field = lambda *a, **k: _FieldInfo(k.get("default", None))
pydantic.model_validator = staticmethod(lambda *a, **k: lambda f: f)
sys.modules["pydantic"] = pydantic

pydantic_settings = types.ModuleType("pydantic_settings")
pydantic_settings.BaseSettings = _BaseModel
pydantic_settings.SettingsConfigDict = lambda **k: k
sys.modules["pydantic_settings"] = pydantic_settings

# ─── Fake prometheus_client ────────────────────────────────────────────────

_prom = types.ModuleType("prometheus_client")


class _Dummy:
    def __init__(self, *a, **k):
        pass

    def labels(self, *a, **k):
        return self

    def inc(self, *a, **k):
        pass

    def set(self, *a, **k):
        pass

    def observe(self, *a, **k):
        pass


_prom.Counter = _Dummy
_prom.Histogram = _Dummy
_prom.Gauge = _Dummy
sys.modules["prometheus_client"] = _prom

# ─── Fake sqlalchemy (minimal for registry + database) ──────────────────────


class _Col:
    """Column descriptor: supports ==, !=, is_() for the fake where() builder
    and is also used by ``desc(col)`` for ordering."""

    def __init__(self, name):
        self.name = name

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.get(self.name, None)

    def __set__(self, instance, value):
        instance.__dict__[self.name] = value

    def __eq__(self, other):
        return (self.name, "eq", other)

    def __ne__(self, other):
        return (self.name, "ne", other)

    def is_(self, other):
        return (self.name, "is_(bool)", other)

    def asc(self):
        return _Desc(self)

    def desc(self):
        return _Desc(self)


class _Select:
    def __init__(self, entity, wheres=None, order=None, limit=None, offset=None, sub=None):
        self._entity = entity
        self._wheres = wheres or []
        self._order = order
        self._limit = limit
        self._offset = offset
        self._sub = sub

    def where(self, *conds):
        new_wheres = self._wheres + list(conds)
        return _Select(self._entity, new_wheres, self._order, self._limit, self._offset, self._sub)

    def order_by(self, col):
        return _Select(self._entity, self._wheres, col, self._limit, self._offset, self._sub)

    def limit(self, n):
        return _Select(self._entity, self._wheres, self._order, n, self._offset, self._sub)

    def offset(self, n):
        return _Select(self._entity, self._wheres, self._order, self._limit, n, self._sub)

    def subquery(self):
        return _Select(self._entity, self._wheres, self._order, self._limit, self._offset, sub=True)


def select(entity):
    return _Select(entity)


class _Desc:
    def __init__(self, col):
        self.col = col.name if hasattr(col, "name") else col


def desc(col):
    return _Desc(col)


class _Func:
    @staticmethod
    def count():
        return ("__count__",)


func = _Func()

sqlalchemy = types.ModuleType("sqlalchemy")
sqlalchemy.select = select
sqlalchemy.desc = desc
sqlalchemy.func = func
# column constructors used by database.py (kept as no-ops)
for _n in ["JSON", "Boolean", "DateTime", "Enum", "Float", "Index", "Integer",
           "String", "Text", "create_engine", "event"]:
    setattr(sqlalchemy, _n, lambda *a, **k: None)
sqlalchemy.orm = types.ModuleType("sqlalchemy.orm")
sqlalchemy.orm.DeclarativeBase = object
sqlalchemy.orm.Mapped = object
sqlalchemy.orm.mapped_column = staticmethod(lambda *a, **k: None)
sqlalchemy.orm.sessionmaker = staticmethod(lambda *a, **k: None)
sys.modules["sqlalchemy"] = sqlalchemy
sys.modules["sqlalchemy.orm"] = sqlalchemy.orm

# ─── Fake minio (storage.py imports it; not exercised by these tests) ───────

minio = types.ModuleType("minio")
minio.Minio = object
minio.error = types.ModuleType("minio.error")
minio.error.S3Error = Exception
sys.modules["minio"] = minio
sys.modules["minio.error"] = minio.error

# ─── In-memory ORM fake for app.database ────────────────────────────────────

# Simple row containers that mimic attribute access used by the registry.
class _Row:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"<Row {self.__dict__}>"


class _Store:
    def __init__(self):
        self.models: list[_Row] = []
        self.detections: list[_Row] = []


_STORE = _Store()


def _matches(row, wheres):
    for w in wheres:
        attr, op, val = w
        cur = getattr(row, attr, None)
        if op == "eq" and not (cur == val):
            return False
        if op == "ne" and not (cur != val):
            return False
        if op == "is_(bool)":
            if val is True and cur is not True:
                return False
            if val is False and cur is not False:
                return False
        if op == "is_true" and not (cur is True):
            return False
        if op == "is_false" and not (cur is False):
            return False
    return True


def _eval(entity, wheres, order, limit, offset, sub):
    rows = _STORE.models if entity.__name__ == "VisionModel" else _STORE.detections
    rows = [r for r in rows if _matches(r, wheres)]
    if order is not None and hasattr(order, "col"):
        col = order.col
        rows.sort(key=lambda r: getattr(r, col, 0), reverse=True)
    return rows


class _FakeSession:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def get(self, entity, pk):
        rows = _STORE.models if entity.__name__ == "VisionModel" else _STORE.detections
        for r in rows:
            if r.id == pk:
                return r
        return None

    def add(self, row):
        rows = _STORE.models if entity_name(row) == "VisionModel" else _STORE.detections
        rows.append(row)

    def delete(self, row):
        rows = _STORE.models if entity_name(row) == "VisionModel" else _STORE.detections
        for i, r in enumerate(rows):
            if r.id == row.id:
                rows.pop(i)
                return

    def commit(self):
        pass

    def execute(self, stmt):
        rows = _eval(stmt._entity, stmt._wheres, stmt._order, stmt._limit, stmt._offset, stmt._sub)
        if stmt._sub:
            return _FakeResult([_Row(__count__=len(rows))])
        return _FakeResult(rows)


def entity_name(row):
    return type(row).__name__


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None

    def scalar_one(self):
        return self._rows[0].__dict__.get("__count__", 0) if self._rows else 0


class _SessionLocal:
    def __call__(self):
        return _FakeSession()


def _make_fake_database(get_settings):
    db = types.ModuleType("app.database")
    db.SessionLocal = _SessionLocal()

    class _Base:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    db.Base = _Base

    _vm_cols = [
        "id", "name", "slug", "description", "model_type", "framework",
        "version", "file_path", "class_names", "input_size",
        "confidence_threshold", "iou_threshold", "status", "is_default",
        "metadata_", "created_at", "updated_at",
    ]
    _vd_cols = [
        "id", "detection_uid", "model_id", "model_name", "source_type",
        "source_ref", "original_url", "annotated_url", "num_detections",
        "classes", "detections", "confidence_min", "confidence_max",
        "confidence_avg", "execution_time_ms", "status", "created_at",
    ]

    class VisionModel(_Base):
        __tablename__ = "vision_models"

    for _c in _vm_cols:
        setattr(VisionModel, _c, _Col(_c))

    class VisionDetection(_Base):
        __tablename__ = "vision_detections"

    for _c in _vd_cols:
        setattr(VisionDetection, _c, _Col(_c))

    db.VisionModel = VisionModel
    db.VisionDetection = VisionDetection
    db.init_db = lambda: None
    return db


# ─── Helper to (re)build the fake environment and import app modules ────────

def install(get_settings):
    """Install all stubs and return freshly-imported app.storage / app.vision_engine."""
    # registered model/weight path helpers used only by vision_engine
    sys.modules.pop("app.database", None)
    sys.modules.pop("app.storage", None)
    sys.modules.pop("app.vision_engine", None)
    sys.modules.pop("app.config", None)

    app_config = types.ModuleType("app.config")
    app_config.get_settings = get_settings
    sys.modules["app.config"] = app_config

    app_db = _make_fake_database(get_settings)
    sys.modules["app.database"] = app_db

    import importlib

    app_storage = importlib.import_module("app.storage")
    app_ve = importlib.import_module("app.vision_engine")
    # reset the in-memory store and the singleton registry between tests
    _STORE.models.clear()
    _STORE.detections.clear()
    app_ve.registry._loaded.clear()
    return app_storage, app_ve


def reset_store():
    _STORE.models.clear()
    _STORE.detections.clear()


def add_model_row(**kwargs):
    row = _Row(**kwargs)
    _STORE.models.append(row)
    return row
