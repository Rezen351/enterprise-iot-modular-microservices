FROM python:3.11-alpine

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Alpine's ffmpeg build handles H265/H264 RTSP cleanly. The Debian-slim ffmpeg
# build used earlier would hang on H265 keyframe seeks for these CCTV streams.
RUN apk add --no-cache ffmpeg

# Vendored wheels: the Docker build context has no egress to PyPI, so we install
# offline from the wheels/ directory (musllinux builds for python3.11).
COPY wheels/ ./wheels/
COPY requirements.txt .
RUN pip install --no-index --find-links=wheels -r requirements.txt && rm -rf wheels

COPY cron_capture.py .

RUN adduser -D -H -s /sbin/nologin -u 10002 appuser && chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["python", "cron_capture.py"]
