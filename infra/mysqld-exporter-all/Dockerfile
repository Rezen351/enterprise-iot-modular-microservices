# =============================================================================
# mysqld-exporter-all — single container running multiple mysqld_exporter
# processes, one per target MariaDB (ADR-005, OPTION 1).
#
# Each process listens on its own port and is configured via a DSN env var:
#   MYSQL_DSN_1  -> port 9104  (mariadb-auth)
#   MYSQL_DSN_2  -> port 9105  (mariadb-control)
#   MYSQL_DSN_3  -> port 9106  (mariadb-module)
#   MYSQL_DSN_4  -> port 9107  (mariadb-stream)
#   MYSQL_DSN_5  -> port 9108  (mariadb-audit)
#   MYSQL_DSN_6  -> port 9109  (mariadb-alert)
#   MYSQL_DSN_7  -> port 9110  (mariadb-notification)
#   MYSQL_DSN_8  -> port 9111  (mariadb-ml)
#
# The mapping (DSN index -> port -> instance) MUST stay in sync with
# infra/prometheus/prometheus.yml so Grafana dashboards do not break.
# =============================================================================
FROM prom/mysqld-exporter:v0.15.1 AS builder

# Runtime stage: debian-slim ships apt + tini + sh so we can run multiple
# exporter processes and forward signals correctly.
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /bin/mysqld_exporter /usr/local/bin/mysqld_exporter

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose every per-DB scrape port.
EXPOSE 9104 9105 9106 9107 9108 9109 9110 9111

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
