FROM python:3.11-alpine

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Alpine's ffmpeg build handles H265/H264 RTSP cleanly. The Debian-slim ffmpeg
# build used earlier would hang on H265 keyframe seeks for these CCTV streams.
RUN apk add --no-cache ffmpeg

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cron_capture.py .

RUN adduser -D -H -s /sbin/nologin -u 10002 appuser && chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["python", "cron_capture.py"]
