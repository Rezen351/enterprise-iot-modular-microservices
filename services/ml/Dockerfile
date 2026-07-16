FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for OpenCV + Ultralytics (libgl for imshow/plot)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# PyJWT is required by app/security.py but kept as a separate layer so the
# (large) torch/ultralytics cache layer above is not invalidated on edits.
RUN pip install --no-cache-dir "PyJWT==2.10.1"

# pydantic-settings is required by app/config.py (BaseSettings) and kept as a
# separate layer so the (large) torch/ultralytics cache layer is preserved.
RUN pip install --no-cache-dir "pydantic-settings==2.6.1"

# Copy application
COPY app ./app

# Non-root user
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8080/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
