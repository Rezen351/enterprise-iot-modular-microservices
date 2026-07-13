"""Prometheus metrics for the ML / Vision API."""
from __future__ import annotations

from prometheus_client import Counter, Histogram, Gauge

INFERENCE_TOTAL = Counter(
    "vision_inferences_total",
    "Total inference requests processed.",
    ["model_id", "source_type", "status"],
)
DETECTIONS_TOTAL = Counter(
    "vision_detections_total",
    "Total objects detected across all inferences.",
    ["model_id"],
)
INFERENCE_LATENCY = Histogram(
    "vision_inference_seconds",
    "Inference latency in seconds.",
    ["model_id"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
MODELS_LOADED = Gauge(
    "vision_models_loaded",
    "Number of YOLO models currently loaded in memory.",
)
