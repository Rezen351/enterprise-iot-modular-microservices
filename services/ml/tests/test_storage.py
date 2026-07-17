"""Tests for ``app.storage.is_safe_object_key`` (path-traversal safety)."""
from __future__ import annotations

import sys
import types

import pytest


# Build a minimal fake config so storage.py can import without pydantic_settings.
def _fake_settings():
    s = types.SimpleNamespace()
    s.minio_endpoint = "minio:9000"
    s.minio_access_key = "x"
    s.minio_secret_key = "x"
    s.minio_use_ssl = False
    s.minio_ml_bucket = "mlbucket"
    s.minio_public_url = "http://localhost:9000"
    return s


sys.path.insert(0, __file__.rsplit("/", 1)[0])
from _fakes import install  # noqa: E402

_storage, _ve = install(_fake_settings)
is_safe_object_key = _storage.is_safe_object_key


@pytest.mark.parametrize("key", [
    "frames/x.jpg",
    "original/20240101_000000_ab12cd_image.jpg",
    "detected/sub/dir/foo.png",
    "a/b/c/d/e",
    "node-01/snapshot.png",
    "metrics_rollup",
])
def test_safe_keys_pass(key):
    assert is_safe_object_key(key) is True


@pytest.mark.parametrize("key", [
    "../../etc/passwd",
    "../x",
    "..",
    "a/../../b",
    "/etc/passwd",
    "/absolute/path",
    "frames\\evil",
    "back\\slash",
    "sub/..\ncontrol",
    "a\x00b",
])
def test_unsafe_keys_rejected(key):
    assert is_safe_object_key(key) is False


def test_empty_and_none_rejected():
    assert is_safe_object_key("") is False
    assert is_safe_object_key(None) is False


def test_non_string_rejected():
    assert is_safe_object_key(123) is False  # type: ignore[arg-type]
