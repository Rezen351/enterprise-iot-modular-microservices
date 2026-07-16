# =============================================================================
# postgres-exporter-all — single container running multiple postgres_exporter
# processes, one per target TimescaleDB (ADR-005, OPTION 1).
#
# Each process listens on its own port and is configured via a DSN env var:
#   POSTGRES_DSN_1 -> port 9187  (timescaledb-module)
#   POSTGRES_DSN_2 -> port 9188  (timescaledb-analytics)
#
# The mapping (DSN index -> port -> instance) MUST stay in sync with
# infra/prometheus/prometheus.yml so Grafana dashboards do not break.
# =============================================================================
FROM wrouesnel/postgres_exporter:latest AS builder

# Runtime stage: debian-slim ships apt + tini + sh so we can run multiple
# exporter processes and forward signals correctly.
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /postgres_exporter /usr/local/bin/postgres_exporter

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose every per-DB scrape port.
EXPOSE 9187 9188

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
