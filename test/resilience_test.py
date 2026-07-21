"""
Enterprise IoT Modular Microservices - Chaos Engineering & Resilience Test Suite
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


def get_token():
    try:
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        if res.status_code == 200:
            return res.json().get("data", {}).get("access_token")
    except Exception:
        pass
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
    auth_res = requests.get(f"{BASE_URL}/v1/auth/me", headers=headers, timeout=5)
    mod_res = requests.get(f"{BASE_URL}/v1/modules", headers=headers, timeout=5)

    if auth_res.status_code == 200 and mod_res.status_code == 200:
        auditor.log_result("Core Graceful Isolation", "PASS", "Auth & Module services unaffected by ML outage (200 OK)")
    else:
        auditor.log_result("Core Graceful Isolation", "FAIL", f"Core service impacted: Auth={auth_res.status_code}, Mod={mod_res.status_code}")

    # 3. Check ML endpoint - Must return 502 / 503 structured gateway error instead of crashing
    ml_res = requests.get(f"{BASE_URL}/v1/ml/models", headers=headers, timeout=5)
    if ml_res.status_code in [502, 503, 504]:
        auditor.log_result("ML Circuit Degradation", "PASS", f"Gateway handled ML outage gracefully with HTTP {ml_res.status_code}")
    else:
        auditor.log_result("ML Circuit Degradation", "DEGRADED", f"ML endpoint returned HTTP {ml_res.status_code}")

    # 4. Self-Healing: Restart ml-service & verify recovery
    print("  -> Restarting 'ml-service' for self-healing verification...")
    recovery_start = time.time()
    run_cmd("docker compose start ml-service")
    time.sleep(5)
    recovery_time = time.time() - recovery_start

    rec_res = requests.get(f"{BASE_URL}/v1/ml/models", headers=headers, timeout=5)
    if rec_res.status_code == 200:
        auditor.log_result("ML Self-Healing Recovery", "PASS", "ml-service automatically recovered to 200 OK", recovery_time=recovery_time)
    else:
        auditor.log_result("ML Self-Healing Recovery", "FAIL", f"ml-service failed to recover: {rec_res.status_code}", recovery_time=recovery_time)


def test_scenario_2_secondary_services_outage(auditor: ResilienceAuditor, token: str):
    """Scenario 2: Multiple Auxiliary Services Outage (notification & stream services crash)."""
    print("\n[*] Scenario 2: Injecting Outage into 'notification-service' & 'stream-service'...")

    run_cmd("docker compose stop notification-service stream-service")
    time.sleep(2)

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Core control & telemetry endpoints must remain functional
    ctrl_res = requests.get(f"{BASE_URL}/v1/control/commands?node_id=node-1", headers=headers, timeout=5)
    an_res = requests.get(f"{BASE_URL}/v1/analytics/nodes", headers=headers, timeout=5)

    if ctrl_res.status_code == 200 and an_res.status_code == 200:
        auditor.log_result("Multi-Aux Outage Isolation", "PASS", "Control & Analytics operational during notification/stream outage")
    else:
        auditor.log_result("Multi-Aux Outage Isolation", "FAIL", f"Control/Analytics impacted: Ctrl={ctrl_res.status_code}, An={an_res.status_code}")

    # Restart services
    print("  -> Restarting 'notification-service' & 'stream-service'...")
    recovery_start = time.time()
    run_cmd("docker compose start notification-service stream-service")
    time.sleep(4)
    recovery_time = time.time() - recovery_start

    notif_rec = requests.get(f"{BASE_URL}/v1/notifications/logs", headers=headers, timeout=5)
    stream_rec = requests.get(f"{BASE_URL}/v1/streams", headers=headers, timeout=5)

    if notif_rec.status_code == 200 and stream_rec.status_code == 200:
        auditor.log_result("Aux Services Self-Healing", "PASS", "Notification & Stream services recovered to 200 OK", recovery_time=recovery_time)
    else:
        auditor.log_result("Aux Services Self-Healing", "FAIL", f"Recovery incomplete: Notif={notif_rec.status_code}, Stream={stream_rec.status_code}", recovery_time=recovery_time)


def test_scenario_3_event_bus_interruption(auditor: ResilienceAuditor, token: str):
    """Scenario 3: Event Bus (NATS Broker) Interruption & Reconnection."""
    print("\n[*] Scenario 3: Injecting Temporary Disconnect into NATS Event Bus...")

    run_cmd("docker compose stop nats")
    time.sleep(3)

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # System Health check must stay up via gateway
    health_res = requests.get(f"{BASE_URL}/v1/health", timeout=5)
    if health_res.status_code == 200:
        auditor.log_result("NATS Outage Gateway Health", "PASS", "Kong Gateway health check responds 200 OK during NATS broker outage")
    else:
        auditor.log_result("NATS Outage Gateway Health", "FAIL", f"Health check failed: {health_res.status_code}")

    # Restart NATS & test auto-reconnection
    print("  -> Restarting NATS Broker & verifying auto-reconnection...")
    recovery_start = time.time()
    run_cmd("docker compose start nats")
    time.sleep(5)
    recovery_time = time.time() - recovery_start

    audit_res = requests.get(f"{BASE_URL}/v1/audit/logs", headers=headers, timeout=5)
    if audit_res.status_code == 200:
        auditor.log_result("NATS Auto-Reconnection", "PASS", "Microservices successfully reconnected to NATS JetStream event bus", recovery_time=recovery_time)
    else:
        auditor.log_result("NATS Auto-Reconnection", "FAIL", f"Audit logs error after NATS restart: {audit_res.status_code}", recovery_time=recovery_time)


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
