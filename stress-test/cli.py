import argparse
import sys

import config
import report

from loadtest import get_token, run_load, run_spike, run_soak
from wstest import run_ws
from mqtttest import run_mqtt
from pentest import run_pentest
from metrics import MetricsCollector


def _auth(args):
    if args.token:
        return args.token, None
    try:
        return get_token(args.base_url, args.username, args.password)
    except Exception as exc:
        print(f"[!] could not obtain auth token: {exc}")
        return None, None


def cmd_load(args):
    token, _ = _auth(args)
    stats = run_load(
        base_url=args.base_url, token=token, duration=args.duration,
        rps=args.rps, concurrency=args.users, ramp_up=args.ramp,
        verify_ssl=not args.insecure,
    )
    report.print_load_summary(stats, f"HTTP LOAD TEST  ({args.rps} rps / {args.users} users)")
    if args.out:
        report.export_json(args.out, _stats_to_dict(stats))


def _stats_to_dict(stats):
    return {
        "total": stats.total,
        "throughput": stats.throughput(),
        "error_rate": stats.error_rate(),
        "p50": stats.latency_percentile(50),
        "p95": stats.latency_percentile(95),
        "p99": stats.latency_percentile(99),
        "status": dict(stats.status_counter),
        "rps_429": stats.count_429(),
        "rps_5xx": stats.count_5xx(),
    }


def cmd_ws(args):
    token, _ = _auth(args)
    url, res = run_ws(
        connections=args.users, hold_seconds=args.duration,
        token=token, base_url=args.base_url, verify_ssl=not args.insecure,
    )
    report.print_ws_summary(url, res)


def cmd_mqtt(args):
    res = run_mqtt(
        clients=args.users, rate_per_client=args.rps, duration=args.duration,
        host=args.mqtt_host, port=args.mqtt_port,
        user=args.mqtt_user, password=args.mqtt_pass,
    )
    report.print_mqtt_summary(res)


def cmd_pentest(args):
    token, _ = _auth(args)
    results = run_pentest(
        base_url=args.base_url, token=token,
        login_user=args.username, login_pass=args.password,
        verify_ssl=not args.insecure,
    )
    report.print_pentest(results)


def cmd_soak(args):
    token, _ = _auth(args)
    m = MetricsCollector(args.prometheus)
    before = m.snapshot()
    report.print_metrics_snapshot(before, "METRICS BEFORE LOAD")
    print(f"[*] running soak test for {args.duration}s ...")
    stats = run_soak(
        base_url=args.base_url, token=token, duration=args.duration,
        rps=args.rps, concurrency=args.users, verify_ssl=not args.insecure,
    )
    report.print_load_summary(stats, f"SOAK TEST ({args.duration}s)")
    after = m.snapshot()
    report.print_metrics_snapshot(after, "METRICS AFTER LOAD")
    report.print_metrics_compare(m.compare(before, after))


def cmd_spike(args):
    token, _ = _auth(args)
    m = MetricsCollector(args.prometheus)
    before = m.snapshot()
    print(f"[*] running spike test (low={args.low} -> high={args.high}) for {args.duration}s ...")
    stats = run_spike(
        base_url=args.base_url, token=token, duration=args.duration,
        concurrency=args.users, low_rps=args.low, high_rps=args.high,
        verify_ssl=not args.insecure,
    )
    report.print_load_summary(stats, "SPIKE TEST")
    after = m.snapshot()
    report.print_metrics_compare(m.compare(before, after))


def cmd_metrics(args):
    m = MetricsCollector(args.prometheus)
    if args.timeline:
        print(f"[*] sampling Prometheus for {args.duration}s every {args.interval}s ...")
        series = m.sample_series(duration=args.duration, interval=args.interval)
        for snap in series:
            ts = snap.pop("_ts", "")
            print(f"\n[{ts}]")
            for label, val in snap.items():
                print(f"   {label:<34}: {val}")
    else:
        snap = m.snapshot()
        report.print_metrics_snapshot(snap, "PROMETHEUS METRICS SNAPSHOT")


def build_parser():
    p = argparse.ArgumentParser(
        prog="stress-test",
        description="Traffic & penetration testing toolkit for the IoT microservice stack.",
    )
    sub = p.add_subparsers(dest="command", required=True)

    def add_common(sp):
        sp.add_argument("--base-url", default=config.BASE_URL)
        sp.add_argument("--prometheus", default=config.PROMETHEUS_URL)
        sp.add_argument("--username", default=config.ADMIN_USERNAME)
        sp.add_argument("--password", default=config.ADMIN_PASSWORD)
        sp.add_argument("--token", default=None,
                        help="reuse a JWT instead of logging in")
        sp.add_argument("--insecure", action="store_true",
                        help="disable TLS verification")
        sp.add_argument("--out", default=None, help="export JSON report")

    sp = sub.add_parser("load", help="HTTP load / stress test via Kong")
    add_common(sp)
    sp.add_argument("--users", type=int, default=10)
    sp.add_argument("--rps", type=int, default=50)
    sp.add_argument("--duration", type=int, default=60)
    sp.add_argument("--ramp", type=int, default=0)
    sp.set_defaults(func=cmd_load)

    sp = sub.add_parser("ws", help="WebSocket gateway load test")
    add_common(sp)
    sp.add_argument("--users", type=int, default=50)
    sp.add_argument("--duration", type=int, default=30)
    sp.set_defaults(func=cmd_ws)

    sp = sub.add_parser("mqtt", help="MQTT telemetry load test (Mosquitto)")
    add_common(sp)
    sp.add_argument("--users", type=int, default=20)
    sp.add_argument("--rps", type=int, default=5)
    sp.add_argument("--duration", type=int, default=60)
    sp.add_argument("--mqtt-host", default=config.MQTT_HOST)
    sp.add_argument("--mqtt-port", type=int, default=config.MQTT_PORT)
    sp.add_argument("--mqtt-user", default=None)
    sp.add_argument("--mqtt-pass", default=None)
    sp.set_defaults(func=cmd_mqtt)

    sp = sub.add_parser("pentest", help="security / penetration checks")
    add_common(sp)
    sp.set_defaults(func=cmd_pentest)

    sp = sub.add_parser("soak", help="long soak test + Prometheus delta")
    add_common(sp)
    sp.add_argument("--users", type=int, default=10)
    sp.add_argument("--rps", type=int, default=50)
    sp.add_argument("--duration", type=int, default=600)
    sp.set_defaults(func=cmd_soak)

    sp = sub.add_parser("spike", help="spike test (baseline->spike->recovery)")
    add_common(sp)
    sp.add_argument("--users", type=int, default=10)
    sp.add_argument("--low", type=int, default=10)
    sp.add_argument("--high", type=int, default=300)
    sp.add_argument("--duration", type=int, default=120)
    sp.set_defaults(func=cmd_spike)

    sp = sub.add_parser("metrics", help="query Prometheus / Grafana metrics")
    add_common(sp)
    sp.add_argument("--timeline", action="store_true")
    sp.add_argument("--duration", type=int, default=60)
    sp.add_argument("--interval", type=int, default=5)
    sp.set_defaults(func=cmd_metrics)

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\n[!] interrupted by user")
        sys.exit(130)


if __name__ == "__main__":
    main()
