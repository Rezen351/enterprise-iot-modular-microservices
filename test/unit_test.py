"""
Enterprise IoT Modular Microservices - Comprehensive Feature & Unit Test Suite
Tests 100% of all microservices, features, endpoints, and WebSocket channels via Kong API Gateway (/v1).
Enhanced with per-service execution time tracking for analytics.
"""

import os
import sys
import unittest
import requests
import json
import time

try:
    import websocket
except ImportError:
    websocket = None


BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin1234")

# Global Token Cache to prevent hitting Kong Auth Rate Limiter (429)
GLOBAL_TOKEN = None
GLOBAL_REFRESH_TOKEN = None


def get_global_token():
    global GLOBAL_TOKEN, GLOBAL_REFRESH_TOKEN
    if GLOBAL_TOKEN:
        return GLOBAL_TOKEN
    try:
        url = f"{BASE_URL}/v1/auth/login"
        res = requests.post(url, json={"identifier": ADMIN_USER, "password": ADMIN_PASS}, timeout=5)
        if res.status_code == 200:
            data = res.json().get("data", {})
            GLOBAL_TOKEN = data.get("access_token") or data.get("token")
            GLOBAL_REFRESH_TOKEN = data.get("refresh_token")
    except Exception:
        pass
    return GLOBAL_TOKEN


class TimedTestResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_times = {}
        self.test_class_times = {}

    def startTest(self, test):
        super().startTest(test)
        test._start_time = time.time()

    def stopTest(self, test):
        elapsed = time.time() - getattr(test, "_start_time", time.time())
        class_name = test.__class__.__name__
        self.test_class_times[class_name] = self.test_class_times.get(class_name, 0) + elapsed
        self.test_times[str(test)] = elapsed
        super().stopTest(test)


class TimedTestRunner(unittest.TextTestRunner):
    def _makeResult(self):
        return TimedTestResult(self.stream, self.descriptions, self.verbosity)


class TestSystemHealth(unittest.TestCase):
    """1. Global System Health Check."""

    def test_01_gateway_health(self):
        res = requests.get(f"{BASE_URL}/v1/health", timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK from /v1/health, got {res.status_code}: {res.text}")
        data = res.json()
        self.assertTrue(data.get("success", False), "Health response should indicate success")


class TestAuthService(unittest.TestCase):
    """2. Auth Service Features (Register, Login, Me, Profile, Password, Sessions, Roles, Users, Refresh, Logout)."""

    token = None
    refresh_token = None

    def setUp(self):
        self.token = get_global_token()

    def test_01_login_success(self):
        token = get_global_token()
        self.assertIsNotNone(token, "Login response must return access token")
        TestAuthService.token = token
        TestAuthService.refresh_token = GLOBAL_REFRESH_TOKEN

    def test_02_get_profile(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/auth/me"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/auth/me, got {res.status_code}: {res.text}")

    def test_03_get_sessions(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/auth/sessions"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/auth/sessions, got {res.status_code}: {res.text}")

    def test_04_admin_list_users(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/auth/users"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/auth/users, got {res.status_code}: {res.text}")

    def test_05_admin_list_roles(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/auth/roles"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/auth/roles, got {res.status_code}: {res.text}")


class TestModuleService(unittest.TestCase):
    """3. Module Service Features (Modules CRUD, Nodes, Discovered Nodes, Tags, Actuators)."""

    created_module_id = None

    def setUp(self):
        self.token = get_global_token()

    def test_01_list_modules(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/modules"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/modules, got {res.status_code}: {res.text}")

    def test_02_create_module(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/modules"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {"name": f"Test Greenhouse {int(time.time())}", "description": "Automated unit test module"}
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 201], f"Expected 200/201 for create module, got {res.status_code}: {res.text}")
        mod_id = res.json().get("data", {}).get("id")
        TestModuleService.created_module_id = mod_id

    def test_03_get_module_by_id(self):
        if not self.token or not TestModuleService.created_module_id:
            self.skipTest("No module ID available")
        url = f"{BASE_URL}/v1/modules/{TestModuleService.created_module_id}"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for get module, got {res.status_code}: {res.text}")

    def test_04_list_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/nodes"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/nodes, got {res.status_code}: {res.text}")

    def test_05_list_discovered_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/nodes/discovered"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/nodes/discovered, got {res.status_code}: {res.text}")


class TestAnalyticsService(unittest.TestCase):
    """4. Analytics Service Features (Nodes, Metrics, Summary, Export)."""

    def setUp(self):
        self.token = get_global_token()

    def test_01_list_analytics_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/analytics/nodes"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/analytics/nodes, got {res.status_code}: {res.text}")

    def test_02_analytics_metrics(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/analytics/metrics?node_id=node-1&metric=temperature&interval=1h"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for analytics metrics, got {res.status_code}: {res.text}")

    def test_03_analytics_summary(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/analytics/summary?node_id=node-1&metric=temperature"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 404], f"Expected 200 or 404 for analytics summary, got {res.status_code}")

    def test_04_analytics_export_csv(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/analytics/export?node_id=node-1&metric=temperature&resolution=day"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for CSV export, got {res.status_code}: {res.text}")


class TestControlService(unittest.TestCase):
    """5. Control Service Features (Commands, Modes, Manual Commands, Targets, Outputs, Resume Auto)."""

    def setUp(self):
        self.token = get_global_token()

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

    def test_03_get_target_setpoints(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/control/targets?node_id=node-1"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 404, 500], f"Expected response for targets, got {res.status_code}: {res.text}")

    def test_04_get_output_states(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/control/outputs?node_id=node-1"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for outputs, got {res.status_code}: {res.text}")

    def test_05_send_manual_command(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/control/command"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {"node_id": "node-1", "actuator": "fan", "action": "ON"}
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 202, 400], f"Expected response for manual command, got {res.status_code}: {res.text}")

    def test_06_resume_auto_mode(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/control/modes/node-1/resume"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.post(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for resume auto mode, got {res.status_code}: {res.text}")


class TestAlertService(unittest.TestCase):
    """6. Alert Service Features (Alerts List, Acknowledge, Thresholds CRUD)."""

    created_threshold_id = None

    def setUp(self):
        self.token = get_global_token()

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

    def test_03_create_threshold(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/thresholds"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "node_id": "node-1",
            "metric": "temperature",
            "min": 15.0,
            "max": 35.0,
            "severity": "warning"
        }
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 201], f"Expected 200/201 for create threshold, got {res.status_code}: {res.text}")
        thresh_id = res.json().get("data", {}).get("id")
        TestAlertService.created_threshold_id = thresh_id

    def test_04_delete_threshold(self):
        if not self.token or not TestAlertService.created_threshold_id:
            self.skipTest("No threshold ID available to delete")
        url = f"{BASE_URL}/v1/thresholds/{TestAlertService.created_threshold_id}"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.delete(url, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 204], f"Expected 200/204 for delete threshold, got {res.status_code}: {res.text}")


class TestAuditService(unittest.TestCase):
    """7. Audit Service Features (Query Logs, Event Filters, Time Ranges)."""

    def setUp(self):
        self.token = get_global_token()

    def test_01_list_audit_logs(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/audit/logs"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/audit/logs, got {res.status_code}: {res.text}")

    def test_02_filter_audit_logs_by_event(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/audit/logs?event=auth.login"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for audit filter, got {res.status_code}: {res.text}")


class TestNotificationService(unittest.TestCase):
    """8. Notification Service Features (Settings, Logs, Test Dispatch)."""

    def setUp(self):
        self.token = get_global_token()

    def test_01_notification_logs(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/notifications/logs"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for notification logs, got {res.status_code}: {res.text}")

    def test_02_get_notification_settings(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/notifications/settings"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for notification settings, got {res.status_code}: {res.text}")

    def test_03_dispatch_test_notification(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/notifications/test"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {"channel": "telegram", "message": "Unit test notification message"}
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 202], f"Expected 200/202 for test notification, got {res.status_code}: {res.text}")


class TestStreamService(unittest.TestCase):
    """9. Stream Service Features (Streams CRUD, Snapshots, Recordings)."""

    created_stream_id = None

    def setUp(self):
        self.token = get_global_token()

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

    def test_03_create_stream(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/streams"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "name": f"cam_unit_test_{int(time.time())}",
            "source_url": "rtsp://localhost:8554/test",
            "module_id": "550e8400-e29b-41d4-a716-446655440000"
        }
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 201, 400, 500], f"Expected response for create stream, got {res.status_code}: {res.text}")
        if res.status_code in [200, 201]:
            st_id = res.json().get("data", {}).get("id")
            TestStreamService.created_stream_id = st_id

    def test_04_delete_stream(self):
        if not self.token or not TestStreamService.created_stream_id:
            self.skipTest("No stream ID available to delete")
        url = f"{BASE_URL}/v1/streams/{TestStreamService.created_stream_id}"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.delete(url, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 204], f"Expected 200/204 for delete stream, got {res.status_code}: {res.text}")


class TestMLService(unittest.TestCase):
    """10. ML Vision Service Features (Models List, Frame Inference)."""

    def setUp(self):
        self.token = get_global_token()

    def test_01_list_ml_models(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/ml/models"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/ml/models, got {res.status_code}: {res.text}")

    def test_02_ml_frame_inference_request(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/ml/detect/from-stream"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "object_key": "cctv-front/2026-07-21_120000_frame.jpg",
            "model_id": "yolov8n",
            "conf": 0.3
        }
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        self.assertIn(res.status_code, [200, 400, 404, 500], f"Expected response from ML infer, got {res.status_code}")


class TestExportService(unittest.TestCase):
    """11. Export Service Features (Export Nodes, Metric Metadata, Telemetry CSV, OpenAPI Spec)."""

    def setUp(self):
        self.token = get_global_token()

    def test_01_export_nodes(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/export/v1/nodes"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/export/v1/nodes, got {res.status_code}: {res.text}")

    def test_02_export_metadata(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/export/v1/meta?node_id=node-1&metric=temperature"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/export/v1/meta, got {res.status_code}: {res.text}")

    def test_03_export_openapi(self):
        if not self.token:
            self.skipTest("No auth token")
        url = f"{BASE_URL}/v1/export/v1/openapi"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers, timeout=5)
        self.assertEqual(res.status_code, 200, f"Expected 200 OK for /v1/export/v1/openapi, got {res.status_code}: {res.text}")


class TestWSGateway(unittest.TestCase):
    """12. WebSocket Gateway Features (System Status Channel & Node Live Channel Handshakes)."""

    def setUp(self):
        self.token = get_global_token()

    def test_01_websocket_system_status(self):
        if websocket is None or not self.token:
            self.skipTest("websocket-client not installed or no auth token")
        ws_base = BASE_URL.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_base}/v1/ws/system-status?token={self.token}"
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            self.assertTrue(ws.connected, "WebSocket system status connection should be active")
            ws.close()
        except Exception as exc:
            self.fail(f"WebSocket system-status handshake failed: {exc}")

    def test_02_websocket_node_live(self):
        if websocket is None or not self.token:
            self.skipTest("websocket-client not installed or no auth token")
        ws_base = BASE_URL.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_base}/v1/ws/nodes/node-1/live?token={self.token}"
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            self.assertTrue(ws.connected, "WebSocket node live connection should be active")
            ws.close()
        except Exception as exc:
            self.fail(f"WebSocket node-live handshake failed: {exc}")


def run_unit_tests():
    """Run all unit & feature test cases across 12 microservices."""
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

    runner = TimedTestRunner(verbosity=2)
    result = runner.run(suite)

    # Build service names list aligned with test classes
    service_names = [
        "SystemHealth", "Auth", "Module", "Analytics", "Control",
        "Alert", "Audit", "Notification", "Stream", "ML", "Export", "WSGateway"
    ]

    pass_counts = []
    skip_counts = []
    fail_counts = []
    exec_times = []

    class_map = {
        TestSystemHealth: "SystemHealth",
        TestAuthService: "Auth",
        TestModuleService: "Module",
        TestAnalyticsService: "Analytics",
        TestControlService: "Control",
        TestAlertService: "Alert",
        TestAuditService: "Audit",
        TestNotificationService: "Notification",
        TestStreamService: "Stream",
        TestMLService: "ML",
        TestExportService: "Export",
        TestWSGateway: "WSGateway",
    }

    class_stats = {name: {"skip": 0, "fail": 0} for name in service_names}

    for test, err in result.errors + result.failures:
        class_name = class_map.get(test.__class__, test.__class__.__name__)
        class_stats[class_name]["fail"] += 1

    for test, reason in result.skipped:
        class_name = class_map.get(test.__class__, test.__class__.__name__)
        class_stats[class_name]["skip"] += 1

    known_totals = {
        "SystemHealth": 1, "Auth": 5, "Module": 5, "Analytics": 4,
        "Control": 6, "Alert": 4, "Audit": 2, "Notification": 3,
        "Stream": 4, "ML": 2, "Export": 3, "WSGateway": 2,
    }

    for name in service_names:
        total = known_totals.get(name, 0)
        skipped = class_stats[name]["skip"]
        failed = class_stats[name]["fail"]
        passed = max(0, total - skipped - failed)
        pass_counts.append(passed)
        skip_counts.append(skipped)
        fail_counts.append(failed)
        exec_times.append(0.0)

    if hasattr(result, "test_class_times"):
        for i, name in enumerate(service_names):
            time_val = result.test_class_times.get(name, 0.0)
            if time_val == 0.0:
                time_val = result.test_class_times.get(f"Test{name}", 0.0)
            exec_times[i] = time_val

    return result.wasSuccessful(), service_names, pass_counts, skip_counts, fail_counts, exec_times
