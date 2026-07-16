from loadtest import LoadStats


def _bar(pct, width=30):
    filled = int(width * min(100, max(0, pct)) / 100.0)
    return "#" * filled + "-" * (width - filled)


def print_load_summary(stats, title="HTTP LOAD TEST"):
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70)
    if not isinstance(stats, LoadStats):
        print(" (no stats)")
        return
    dur = stats.duration()
    print(f" Duration        : {dur:.1f}s")
    print(f" Total requests  : {stats.total}")
    print(f" Throughput      : {stats.throughput():.1f} req/s")
    print(f" Errors          : {stats.errors} ({stats.error_rate():.2f}%)")
    print(f" 5xx responses   : {stats.count_5xx()}")
    print(f" 429 rate-limited: {stats.count_429()}")
    print(f" Latency p50     : {stats.latency_percentile(50):.1f} ms")
    print(f" Latency p95     : {stats.latency_percentile(95):.1f} ms")
    print(f" Latency p99     : {stats.latency_percentile(99):.1f} ms")
    print(f" Latency max     : {max((r.latency_ms for r in stats.records), default=0):.1f} ms")

    print("\n Status code distribution:")
    for code in sorted(stats.status_counter):
        n = stats.status_counter[code]
        pct = (n / stats.total * 100.0) if stats.total else 0
        print(f"   {code} : {n:>7}  ({pct:5.1f}%) {_bar(pct)}")

    print("\n Per-endpoint (avg latency / errors):")
    for name, recs in sorted(stats.by_endpoint.items()):
        avg = sum(r.latency_ms for r in recs) / len(recs) if recs else 0
        errs = sum(1 for r in recs if r.error)
        print(f"   {name:<18} n={len(recs):>6}  avg={avg:7.1f}ms  err={errs}")


def print_ws_summary(url, result):
    print("\n" + "=" * 70)
    print(" WEBSOCKET LOAD TEST")
    print("=" * 70)
    dur = (result.end - result.start) or 1
    print(f" Target URL      : {url}")
    print(f" Total clients   : {result.total}")
    print(f" Connected       : {result.connected}")
    print(f" Failed          : {result.failed}")
    print(f" Dropped         : {result.disconnected}")
    print(f" Messages rx     : {result.messages_received}")
    print(f" Connect rate    : {result.connected / dur:.1f} conn/s")
    if result.errors:
        print("\n Sample errors:")
        for e in result.errors[:8]:
            print(f"   - {e}")


def print_mqtt_summary(result):
    print("\n" + "=" * 70)
    print(" MQTT / TELEMETRY LOAD TEST")
    print("=" * 70)
    dur = (result.end - result.start) or 1
    print(f" Clients         : {result.clients}")
    print(f" Connected       : {result.connected}")
    print(f" Published       : {result.published}")
    print(f" Failed publish  : {result.failed_publish}")
    print(f" Publish rate    : {result.published / dur:.1f} msg/s")
    if result.latencies:
        result.latencies.sort()
        p95 = result.latencies[int(len(result.latencies) * 0.95) - 1]
        print(f" Pub latency p95 : {p95:.1f} ms")
    if result.connect_errors:
        print("\n Connect errors:")
        for e in result.connect_errors[:8]:
            print(f"   - {e}")


def print_pentest(results):
    print("\n" + "=" * 70)
    print(" PENETRATION / SECURITY TEST")
    print("=" * 70)
    print(f" {'CHECK':<52}{'SEV':<7}{'RESULT'}")
    print("-" * 70)
    passed = failed = na = 0
    for r in results:
        if r["passed"] is None:
            verdict = "N/A"
            na += 1
        elif r["passed"]:
            verdict = "PASS"
            passed += 1
        else:
            verdict = "FAIL"
            failed += 1
        print(f" {r['name'][:50]:<52}{r['severity']:<7}{verdict}")
    print("-" * 70)
    print(f" PASS={passed}  FAIL={failed}  N/A={na}")
    print("\n Details:")
    for r in results:
        flag = "PASS" if r["passed"] else ("FAIL" if r["passed"] is False else "N/A")
        print(f"  [{flag}] {r['name']}")
        print(f"        {r['detail']}")


def print_metrics_snapshot(snap, title="SYSTEM METRICS SNAPSHOT"):
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70)
    for label, val in snap.items():
        if label.startswith("_"):
            continue
        print(f" {label:<36}: {val}")


def print_metrics_compare(compare):
    print("\n" + "=" * 70)
    print(" BOTTLENECK ANALYSIS (before -> after load)")
    print("=" * 70)
    print(f" {'METRIC':<34}{'BEFORE':>12}{'AFTER':>12}{'DELTA':>12}")
    print("-" * 70)
    for label, b, a, delta, pct in compare:
        arrow = "▲" if delta > 0 else "▼"
        print(f" {label:<34}{b:>12}{a:>12}{arrow}{pct:>5}%")
    print("-" * 70)
    print(" Look for: large ▲ in latency/5xx/429, ▲ in DB queries or Redis")
    print(" memory, ▲ in NATS pending, or ▲ in connected MQTT clients.")


def export_json(path, data):
    import json
    with open(path, "w") as fh:
        json.dump(data, fh, indent=2, default=str)
