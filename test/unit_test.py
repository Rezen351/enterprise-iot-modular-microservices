"""
Enterprise IoT Modular Microservices - Comprehensive Unit & Feature Test Suite
Tests all 12 microservices and features via Kong API Gateway (/v1).
"""

import os
import sys
import unittest
import requests

try:
    import websocket
except ImportError:
    websocket = None


BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin1234")


class TestSystemHealth(unittest.TestCase):
    """Test global system health check via Kong Gateway."""

    def test_01_gateway_health(self):
        url = f"{BASE_URL}/v1/health"
        res = requests.get(url, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK from /v1/health, got {res.status_code}: {res.text}")
        data = res.json()
        self.assertTrue(data.get("success", False), "Health response should indicate success")


class TestAuthService(unittest.TestCase):
    """Test Auth Service endpoints (Login, Me, Profile, Sessions, Refresh)."""

    token = None
    refresh_token = None

    def test_01_login_invalid_credentials(self):
        url = f"{BASE_URL}/v1/auth/login"
        payload = {"identifier": "invalid_user", "password": "wrong_password"}
        res = requests.post(url, json=payload, timeout=5)
        self.assertEqual(res.status_code, 401, f"Expected 401 for invalid credentials, got {res.status_code}")

    def test_02_login_success(self):
        url = f"{BASE_URL}/v1/auth/login"
        payload = {"identifier": ADMIN_USER, "password": ADMIN_PASS}
        res = requests.post(url, json=payload, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 for valid login, got {res.status_code}: {res.text}")
        data = res.json().get("data", {})
        token = data.get("access_token") or data.get("token")
        self.assertIsNotNone(token, "Login response must return access token")
        TestAuthService.token = token
        TestAuthService.refresh_token = data.get("refresh_token")

    def test_03_get_profile(self):
        token = TestAuthService.token
        if not token:
            self.skipTest("No auth token available")
        url = f"{BASE_URL}/v1/auth/me"
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/auth/me, got {res.status_code}: {res.text}")

    def test_04_get_sessions(self):
        token = TestAuthService.token
        if not token:
            self.skipTest("No auth token available")
        url = f"{BASE_URL}/v1/auth/sessions"
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/auth/sessions, got {res.status_code}: {res.text}")


class TestModuleService(unittest.TestCase):
    """Test Module Service endpoints (Modules, Nodes, Discovered, Tags)."""

    def setUp(self):
        url = f"{BASE_URL}/v1/auth/login"
        res = requests.post(url, json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        if res.status_code == 200:
            data = res.json().get("data", {})
            self.token = data.get("access_token") or data.get("token")
        else:
            self.token = None

    def test_01_list_modules(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/modules"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/modules, got {res.status_code}: {res.text}")

    def test_02_list_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/nodes"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/nodes, got {res.status_code}: {res.text}")

    def test_03_list_discovered_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/nodes/discovered"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/nodes/discovered, got {res.status_code}: {res.text}")


class TestAnalyticsService(unittest.TestCase):
    """Test Analytics Service endpoints (Nodes, Metrics, Summary, Export)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_list_analytics_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/analytics/nodes"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/analytics/nodes, got {res.status_code}: {res.text}")

    def test_02_analytics_summary(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/analytics/summary?node_id=node-1&metric=temperature"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 404], f"Expected 200 or 404, got {res.status_code}")


class TestControlService(unittest.TestCase):
    """Test Control Service endpoints (Commands, Modes, Targets, Outputs)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_list_commands(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/control/commands?node_id=node-1"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/control/commands, got {res.status_code}: {res.text}")

    def test_02_get_control_mode(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/control/modes/node-1"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 404], f"Expected 200 or 404, got {res.status_code}")


class TestAlertService(unittest.TestCase):
    """Test Alert Service endpoints (Alerts, Thresholds)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_list_alerts(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/alerts"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/alerts, got {res.status_code}: {res.text}")

    def test_02_list_thresholds(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/thresholds"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/thresholds, got {res.status_code}: {res.text}")


class TestAuditService(unittest.TestCase):
    """Test Audit Service endpoints (Logs, Filters)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_list_audit_logs(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/audit/logs"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/audit/logs, got {res.status_code}: {res.text}")


class TestNotificationService(unittest.TestCase):
    """Test Notification Service endpoints (Settings, Logs)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_notification_logs(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/notifications/logs"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/notifications/logs, got {res.status_code}: {res.text}")


class TestStreamService(unittest.TestCase):
    """Test Stream Service endpoints (Streams, Snapshots)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_list_streams(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/streams"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/streams, got {res.status_code}: {res.text}")

    def test_02_list_snapshots(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/snapshots"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/snapshots, got {res.status_code}: {res.text}")


class TestMLService(unittest.TestCase):
    """Test ML Vision Service endpoints (Models, Detection)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_list_ml_models(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/ml/models"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/ml/models, got {res.status_code}: {res.text}")


class TestExportService(unittest.TestCase):
    """Test Export Service endpoints (Nodes, Telemetry, OpenAPI)."""

    def setUp(self):
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        self.token = res.json().get("data", {}).get("access_token") if res.status_code == 200 else None

    def test_01_export_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/export/v1/nodes"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/export/v1/nodes, got {res.status_code}: {res.text}")

    def test_02_export_openapi(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/export/v1/openapi"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/export/v1/openapi, got {res.status_code}: {res.text}")


class TestWSGateway(unittest.TestCase):
    """Test WebSocket Gateway connection."""

    def test_01_websocket_handshake(self):
        if websocket is None:
            self.skipTest("websocket-client package not installed")
        res = requests.post(f"{BASE_URL}/v1/auth/login", json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        if res.status_code != 200:
            self.skipTest("Auth failed for WS test")
        token = res.json().get("data", {}).get("access_token")
        
        ws_base = BASE_URL.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_base}/v1/ws/system-status?token={token}"
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            self.assertTrue(ws.connected, "WebSocket connection should be active")
            ws.close()
        except Exception as exc:
            self.fail(f"WebSocket handshake failed: {exc}")


def run_unit_tests():
    """Run all unit test cases and return success boolean."""
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    
    suite.addTest(loader.loadTestsFromTestCase(TestSystemHealth))
    suite.addTest(loader.loadTestsFromTestCase(TestAuthService))
    suite.addTest(loader.loadTestsFromTestCase(TestModuleService))
    suite.addTest(loader.loadTestsFromTestCase(TestAnalyticsService))
    suite.addTest(loader.loadTestsFromTestCase(TestControlService))
    suite.addTest(loader.loadTestsFromTestCase(TestAlertService))
    suite.addTest(loader.loadTestsFromTestCase(TestAuditService))
    suite.addTest(loader.loadTestsFromTestCase(TestNotificationService))
    suite.addTest(loader.loadTestsFromTestCase(TestStreamService))
    suite.addTest(loader.loadTestsFromTestCase(TestMLService))
    suite.addTest(loader.loadTestsFromTestCase(TestExportService))
    suite.addTest(loader.loadTestsFromTestCase(TestWSGateway))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_unit_tests()
    sys.exit(0 if success else 1)
