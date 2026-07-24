from dataclasses import dataclass
from typing import Optional
from app.rl.safety import SafetyGuardrail
from app.config import settings

@dataclass
class DecisionInput:
    node_id: str
    root_length_cm: float
    potato_condition: str
    confidence: float = 1.0
    ambient_humidity: Optional[float] = None
    ambient_temp: Optional[float] = None

@dataclass
class DecisionOutput:
    recommended_on_sec: float
    recommended_off_sec: float
    raw_on_sec: float
    raw_off_sec: float
    clamped: bool
    reason: str

class SprayRLAgent:
    def __init__(self, guardrail: Optional[SafetyGuardrail] = None):
        self.guardrail = guardrail or SafetyGuardrail()

    def predict(self, input_data: DecisionInput) -> DecisionOutput:
        """
        Computes dynamic misting parameters based on root length, crop health, and telemetry.
        Demonstrates continuous dynamic response curve with RL fallback logic.
        """
        base_interval = settings.DEFAULT_INTERVAL_SEC
        base_duration = settings.DEFAULT_DURATION_SEC

        # Continuous growth scaling factor: shorter roots need more frequent misting
        if input_data.root_length_cm < 5.0:
            root_multiplier = 0.8  # 20% shorter interval
            duration_multiplier = 1.2  # 20% longer duration
        elif input_data.root_length_cm > 15.0:
            root_multiplier = 1.2  # 20% longer interval
            duration_multiplier = 0.8  # 20% shorter duration
        else:
            root_multiplier = 1.0 + ((input_data.root_length_cm - 10.0) * 0.02)
            duration_multiplier = 1.0 - ((input_data.root_length_cm - 10.0) * 0.02)

        # Condition penalty scaling factor
        condition_lower = input_data.potato_condition.lower()
        if condition_lower in ["poor", "diseased"]:
            duration_multiplier *= 1.3
            root_multiplier *= 0.8
        elif condition_lower == "moderate":
            duration_multiplier *= 1.1

        raw_off = base_interval * root_multiplier
        raw_on = base_duration * duration_multiplier

        clamped_on, clamped_off = self.guardrail.sanitize(raw_on, raw_off)
        was_clamped = (clamped_on != raw_on) or (clamped_off != raw_off)

        reason = (
            f"dynamic_rl_root_{input_data.root_length_cm:.1f}cm_"
            f"condition_{condition_lower}"
        )

        return DecisionOutput(
            recommended_on_sec=clamped_on,
            recommended_off_sec=clamped_off,
            raw_on_sec=round(raw_on, 2),
            raw_off_sec=round(raw_off, 2),
            clamped=was_clamped,
            reason=reason,
        )
