import unittest
from app.rl.safety import SafetyGuardrail
from app.rl.agent import SprayRLAgent, DecisionInput

class TestSprayRLAgent(unittest.TestCase):
    def test_safety_guardrail_clamping(self):
        guardrail = SafetyGuardrail(min_on_sec=5.0, max_on_sec=60.0, min_off_sec=60.0, max_off_sec=900.0)

        # Test values exceeding max limits
        clamped_on, clamped_off = guardrail.sanitize(120.0, 1500.0)
        self.assertEqual(clamped_on, 60.0)
        self.assertEqual(clamped_off, 900.0)

        # Test values below min limits
        clamped_on_min, clamped_off_min = guardrail.sanitize(1.0, 10.0)
        self.assertEqual(clamped_on_min, 5.0)
        self.assertEqual(clamped_off_min, 60.0)

        # Test valid normal values
        normal_on, normal_off = guardrail.sanitize(15.0, 300.0)
        self.assertEqual(normal_on, 15.0)
        self.assertEqual(normal_off, 300.0)

    def test_rl_agent_short_roots(self):
        agent = SprayRLAgent()
        decision_input = DecisionInput(
            node_id="node-1",
            root_length_cm=3.0,  # Short root (<5cm) -> more misting
            potato_condition="healthy",
        )
        decision = agent.predict(decision_input)

        # Short roots should reduce off_sec (interval) and increase on_sec (duration)
        self.assertLess(decision.recommended_off_sec, 300.0)
        self.assertGreater(decision.recommended_on_sec, 10.0)
        self.assertIn("root_3.0cm", decision.reason)

    def test_rl_agent_diseased_condition(self):
        agent = SprayRLAgent()
        decision_input = DecisionInput(
            node_id="node-1",
            root_length_cm=10.0,
            potato_condition="diseased",  # Diseased condition -> increase misting duration
        )
        decision = agent.predict(decision_input)

        self.assertGreater(decision.recommended_on_sec, 10.0)
        self.assertIn("condition_diseased", decision.reason)

if __name__ == "__main__":
    unittest.main()
