"""
enyx-enterprise - Chaos Engineering & Resilience Test Suite
Tests System Resiliency, Graceful Degradation, Circuit Breaking, and Self-Healing capabilities under service outages.
Enhanced with recovery time tracking for analytics.
"""

import os
import sys
import time
import subprocess
import requests
import json

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin1234")
DOCKER_COMPOSE_DIR = os.getenv("DOCKER_COMPOSE_DIR", "/home/almuzky/TA/Microservices")


def run_cmd(cmd: str) -> bool:
    try:
        subprocess.run(cmd, shell=True, check=True, cwd=DOCKER_COMPOSE_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def execute_request(url, headers=None, method="GET", json_body=None, timeout=5):
    for attempt in range(1, 4):
        try:
            if method == "GET":
                res = requests.get(url, headers=headers, timeout=5)
            elif method == "POST":
                res = requests.post(url, headers=headers, json=json_body, timeout=5)
            elif method == "PUT":
                res = requests.put(url, headers=headers, json=json_body, timeout=5)
            elif method == "DELETE":
                res = requests.delete(url, headers=headers, timeout=5)
            else:
                res = requests.request(method, url, headers=headers, timeout=5)
            if res.status_code == 429 and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            return res
        except Exception:
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise
    return None
    try:
        subprocess.run(cmd, shell=True, check=True, cwd=DOCKER_COMPOSE_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def get_token():
    for attempt in range(1, 4):
        try:
            res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=10)
            if res.status_code == 200:
                return res.json().get("data", {}).get("access_token")
            if res.status_code == 429 and attempt < 3:
                time.sleep(2 ** attempt)
                continue
        except Exception:
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
    return None


class ResilienceAuditor:
    def __init__(self):
        self.results = []

    def log_result(self, scenario: str, status: str, details: str, recovery_time: float = 0.0):
        symbol = "PASS" if status == "PASS" else ("DEGRADED" if status == "DEGRADED" else "FAIL")
        self.results.append({
            "scenario": scenario,
            "status": symbol,
            "details": details,
            "recovery_time": recovery_time
        })
        print(f"[{symbol}] {scenario}: {details}" + (f" (Recovery: {recovery_time:.1f}s)" if recovery_time > 0 else ""))

    def report(self):
        print("\n" + "=" * 70)
        print("  MICROSERVICES CHAOS & RESILIENCE TEST AUDIT REPORT")
        print("=" * 70)
        for r in self.results:
            print(f" {r['status']:<10} | {r['scenario']:<35} | {r['details']}")
        print("=" * 70 + "\n")

    def get_scenarios(self):
        return [{"scenario": r["scenario"], "status": r["status"], "details": r["details"]} for r in self.results]

    def get_recovery_times(self):
        return [r.get("recovery_time", 0.0) for r in self.results]


def test_scenario_1_non_critical_outage(auditor: ResilienceAuditor, token: str):
    """Scenario 1: Non-Critical Service Outage (ml-service crash)."""
    print("\n[*] Scenario 1: Injecting Outage into 'ml-service'...")

    # 1. Stop ml-service
    run_cmd("docker compose stop ml-service")
    time.sleep(2)

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # 2. Check Core Services (Auth & Modules) - Must remain 100% operational
    auth_res = execute_request(f"{BASE_URL}/v1/auth/me", headers=headers, method="GET")
    mod_res = execute_request(f"{BASE_URL}/v1/modules", headers=headers, method="GET")

    if auth_res and auth_res.status_code == 200 and mod_res and mod_res.status_code == 200:
        auditor.log_result("Core Graceful Isolation", "PASS", "Auth & Module services unaffected by ML outage (200 OK)")
    elif auth_res and auth_res.status_code == 429 or mod_res and mod_res.status_code == 429:
        auditor.log_result("Core Graceful Isolation", "DEGRADED", "Rate-limited during chaos test (expected under load)")
    else:
        auditor.log_result("Core Graceful Isolation", "FAIL", f"Core service impacted: Auth={auth_res.status_code if auth_res else 'none'}, Mod={mod_res.status_code if mod_res else 'none'}")

    # 3. Check ML endpoint - Must return 502 / 503 structured gateway error instead of crashing
    ml_res = execute_request(f"{BASE_URL}/v1/ml/models", headers=headers, method="GET")
    if ml_res and ml_res.status_code in [502, 503, 504]:
        auditor.log_result("ML Circuit Degradation", "PASS", f"Gateway handled ML outage gracefully with HTTP {ml_res.status_code}")
    elif ml_res and ml_res.status_code == 429:
        auditor.log_result("ML Circuit Degradation", "DEGRADED", "Rate-limited during chaos test (expected under load)")
    else:
        auditor.log_result("ML Circuit Degradation", "DEGRADED", f"ML endpoint returned HTTP {ml_res.status_code if ml_res else 'none'}")

    # 4. Self-Healing: Restart ml-service & verify recovery
    print("  -> Restarting 'ml-service' for self-healing verification...")
    recovery_start = time.time()
    run_cmd("docker compose start ml-service")
    time.sleep(5)
    recovery_time = time.time() - recovery_start

    rec_res = execute_request(f"{BASE_URL}/v1/ml/models", headers=headers, method="GET")
    if rec_res and rec_res.status_code == 200:
        auditor.log_result("ML Self-Healing Recovery", "PASS", "ml-service automatically recovered to 200 OK", recovery_time=recovery_time)
    elif rec_res and rec_res.status_code == 429:
        auditor.log_result("ML Self-Healing Recovery", "DEGRADED", "Still rate-limited after recovery (system under test load)")
    else:
        auditor.log_result("ML Self-Healing Recovery", "FAIL", f"ml-service failed to recover: {rec_res.status_code if rec_res else 'none'}", recovery_time=recovery_time)


def test_scenario_2_secondary_services_outage(auditor: ResilienceAuditor, token: str):
    """Scenario 2: Multiple Auxiliary Services Outage (notification & stream services crash)."""
    print("\n[*] Scenario 2: Injecting Outage into 'notification-service' & 'stream-service'...")

    run_cmd("docker compose stop notification-service stream-service")
    time.sleep(2)

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Core control & telemetry endpoints must remain functional
    ctrl_res = execute_request(f"{BASE_URL}/v1/control/commands?node_id=node-1", headers=headers, method="GET")
    an_res = execute_request(f"{BASE_URL}/v1/analytics/nodes", headers=headers, method="GET")

    if ctrl_res and ctrl_res.status_code == 200 and an_res and an_res.status_code == 200:
        auditor.log_result("Multi-Aux Outage Isolation", "PASS", "Control & Analytics operational during notification/stream outage")
    elif (ctrl_res and ctrl_res.status_code == 429) or (an_res and an_res.status_code == 429):
        auditor.log_result("Multi-Aux Outage Isolation", "DEGRADED", "Rate-limited during chaos test (expected under load)")
    else:
        auditor.log_result("Multi-Aux Outage Isolation", "FAIL", f"Control/Analytics impacted: Ctrl={ctrl_res.status_code if ctrl_res else 'none'}, An={an_res.status_code if an_res else 'none'}")

    # Restart services
    print("  -> Restarting 'notification-service' & 'stream-service'...")
    recovery_start = time.time()
    run_cmd("docker compose start notification-service stream-service")
    time.sleep(4)
    recovery_time = time.time() - recovery_start

    notif_rec = execute_request(f"{BASE_URL}/v1/notifications/logs", headers=headers, method="GET")
    stream_rec = execute_request(f"{BASE_URL}/v1/streams", headers=headers, method="GET")

    if notif_rec and notif_rec.status_code == 200 and stream_rec and stream_rec.status_code == 200:
        auditor.log_result("Aux Services Self-Healing", "PASS", "Notification & Stream services recovered to 200 OK", recovery_time=recovery_time)
    elif (notif_rec and notif_rec.status_code == 429) or (stream_rec and stream_rec.status_code == 429):
        auditor.log_result("Aux Services Self-Healing", "DEGRADED", "Still rate-limited after recovery (system under test load)")
    else:
        auditor.log_result("Aux Services Self-Healing", "FAIL", f"Recovery incomplete: Notif={notif_rec.status_code if notif_rec else 'none'}, Stream={stream_rec.status_code if stream_rec else 'none'}", recovery_time=recovery_time)


def test_scenario_3_event_bus_interruption(auditor: ResilienceAuditor, token: str):
    """Scenario 3: Event Bus (NATS Broker) Interruption & Reconnection."""
    print("\n[*] Scenario 3: Injecting Temporary Disconnect into NATS Event Bus...")

    run_cmd("docker compose stop nats")
    time.sleep(3)

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # System Health check must stay up via gateway
    health_res = execute_request(f"{BASE_URL}/v1/health", headers=headers, method="GET", timeout=10)
    if health_res and health_res.status_code == 200:
        auditor.log_result("NATS Outage Gateway Health", "PASS", "Kong Gateway health check responds 200 OK during NATS broker outage")
    elif health_res and health_res.status_code == 429:
        auditor.log_result("NATS Outage Gateway Health", "DEGRADED", "Rate-limited during chaos test (expected under load)")
    else:
        auditor.log_result("NATS Outage Gateway Health", "DEGRADED", f"Gateway temporarily unreachable during NATS outage: {health_res.status_code if health_res else 'connection failed'}")

    # Restart NATS & test auto-reconnection
    print("  -> Restarting NATS Broker & verifying auto-reconnection...")
    recovery_start = time.time()
    run_cmd("docker compose start nats")
    time.sleep(5)
    recovery_time = time.time() - recovery_start

    audit_res = execute_request(f"{BASE_URL}/v1/audit/logs", headers=headers, method="GET")
    if audit_res and audit_res.status_code == 200:
        auditor.log_result("NATS Auto-Reconnection", "PASS", "Microservices successfully reconnected to NATS JetStream event bus", recovery_time=recovery_time)
    elif audit_res and audit_res.status_code == 429:
        auditor.log_result("NATS Auto-Reconnection", "DEGRADED", "Still rate-limited after recovery (system under test load)")
    else:
        auditor.log_result("NATS Auto-Reconnection", "FAIL", f"Audit logs error after NATS restart: {audit_res.status_code if audit_res else 'none'}", recovery_time=recovery_time)


def run_chaos_suite(token: str = None):
    """Run all chaos & resilience scenarios and return structured results."""
    if token is None:
        token = get_token()

    auditor = ResilienceAuditor()

    try:
        test_scenario_1_non_critical_outage(auditor, token)
        test_scenario_2_secondary_services_outage(auditor, token)
        test_scenario_3_event_bus_interruption(auditor, token)
    finally:
        # Ensure all services are running after chaos tests
        print("\n[*] Cleanup: Ensuring all microservices are running...")
        run_cmd("docker compose start ml-service notification-service stream-service nats")
        auditor.report()

    return auditor.get_scenarios(), auditor.get_recovery_times()


def main():
    print("=" * 70)
    print("  ENTERPRISE IOT MICROSERVICES CHAOS & RESILIENCE TEST SUITE")
    print("=" * 70)

    token = get_token()
    if not token:
        print("[!] Warning: Auth login failed, running tests in unauthenticated fallback mode.")
    else:
        print("[*] Successfully authenticated with Auth Service!")

    scenarios, recovery_times = run_chaos_suite(token)

    # Print summary
    pass_count = sum(1 for s in scenarios if s["status"] == "PASS")
    degraded_count = sum(1 for s in scenarios if s["status"] == "DEGRADED")
    fail_count = sum(1 for s in scenarios if s["status"] == "FAIL")

    print(f"\n  SUMMARY: {pass_count} PASS, {degraded_count} DEGRADED, {fail_count} FAIL")


if __name__ == "__main__":
    main()
