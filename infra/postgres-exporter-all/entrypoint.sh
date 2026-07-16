#!/bin/sh
# =============================================================================
# postgres-exporter-all entrypoint
# Launches one postgres_exporter process per configured DSN on a dedicated
# port, then waits for all of them. Each DSN comes from POSTGRES_DSN_<n> and
# maps to a fixed port defined below.
#
# Order is FIXED and must match infra/prometheus/prometheus.yml instance labels:
#   1 -> 9187 timescaledb-module
#   2 -> 9188 timescaledb-analytics
# =============================================================================
set -e

# index -> port
PORTS="9187 9188"

i=1
for port in $PORTS; do
    dsn_var="POSTGRES_DSN_${i}"
    eval "dsn=\${$dsn_var}"

    if [ -z "$dsn" ]; then
        echo "[postgres-exporter-all] WARNING: $dsn_var not set; skipping port $port" >&2
        i=$((i + 1))
        continue
    fi

    echo "[postgres-exporter-all] starting postgres_exporter #$i on :$port for $dsn_var" >&2
    DATA_SOURCE_NAME="$dsn" \
    /usr/local/bin/postgres_exporter \
        --web.listen-address=":${port}" &
    # record pid so we can wait on it
    eval "pid_${i}=\$!"

    i=$((i + 1))
done

# Wait for all background exporter processes; if any exits, propagate failure.
failed=0
i=1
for port in $PORTS; do
    pid_var="pid_${i}"
    eval "pid=\${$pid_var}"
    if [ -n "$pid" ]; then
        if ! wait "$pid"; then
            echo "[postgres-exporter-all] exporter #$i (pid $pid) exited with error" >&2
            failed=1
        fi
    fi
    i=$((i + 1))
done

exit $failed
