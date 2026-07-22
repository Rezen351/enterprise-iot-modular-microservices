#!/bin/sh
# =============================================================================
# mysqld-exporter-all entrypoint
# Launches one mysqld_exporter process per configured DSN on a dedicated port,
# then waits for all of them. Each DSN comes from MYSQL_DSN_<n> and maps to a
# fixed port defined below.
#
# mysqld_exporter v0.15.x reads credentials from a .my.cnf file (--config.my-cnf)
# or DATA_SOURCE_NAME; we write one .my.cnf per target and point the exporter at
# it. The address is passed via --mysqld.address.
#
# Order is FIXED and must match infra/prometheus/prometheus.yml instance labels:
#   1 -> 9104 mariadb-auth
#   2 -> 9105 mariadb-control
#   3 -> 9106 mariadb-module
#   4 -> 9107 mariadb-stream
#   5 -> 9108 mariadb-audit
#   6 -> 9109 mariadb-alert
#   7 -> 9110 mariadb-notification
#   8 -> 9111 mariadb-ml
#   9 -> 9112 mariadb-webhook
# =============================================================================
set -e

# index -> port
PORTS="9104 9105 9106 9107 9108 9109 9110 9111 9112"

i=1
for port in $PORTS; do
    dsn_var="MYSQL_DSN_${i}"
    eval "dsn=\${$dsn_var}"

    if [ -z "$dsn" ]; then
        echo "[mysqld-exporter-all] WARNING: $dsn_var not set; skipping port $port" >&2
        i=$((i + 1))
        continue
    fi

    # Parse user:password@tcp(host:port)/
    user=$(echo "$dsn" | sed -E 's#^([^:]+):.*#\1#')
    pass=$(echo "$dsn" | sed -E 's#^[^:]+:([^@]+)@.*#\1#')
    addr=$(echo "$dsn" | sed -E 's#^[^@]+@tcp\(([^)]+)\)/.*#\1#')

    cnf="/tmp/mycnf_${port}"
    cat > "$cnf" <<EOF
[client]
user = ${user}
password = ${pass}
host = $(echo "$addr" | cut -d: -f1)
port = $(echo "$addr" | cut -d: -f2)
EOF

    echo "[mysqld-exporter-all] starting mysqld_exporter #$i on :$port for $dsn_var (addr=$addr)" >&2
    /usr/local/bin/mysqld_exporter \
        --web.listen-address=":${port}" \
        --config.my-cnf="$cnf" \
        --collect.info_schema.tables \
        --collect.info_schema.processlist \
        --collect.info_schema.userstats &
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
            echo "[mysqld-exporter-all] exporter #$i (pid $pid) exited with error" >&2
            failed=1
        fi
    fi
    i=$((i + 1))
done

exit $failed
