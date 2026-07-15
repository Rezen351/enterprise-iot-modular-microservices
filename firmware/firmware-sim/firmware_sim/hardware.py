"""Virtual hardware model.

Reproduces the behavior of firmware/aeroponic-node/src/core/HardwareManager.cpp
without any real GPIO. Sensor readings come from the dummy sensor model
(``sensors.py``) so the device looks alive and responds to commands exactly
like the real firmware.

Key behaviors mirrored from the firmware:
  * outputs remember their last state (``setOutput``)
  * DIGITAL outputs are coerced to 0/1, PWM to 0..255
  * inputs return realistic engineering values (°C, %, ...) + raw ADC
  * modbus registers return realistic dummy readings
  * local-control rules evaluate with hysteresis and can flip outputs
  * emergency stop zeroes every output and raises an alert
"""

from __future__ import annotations

import math
import random
import time
from typing import Any

from .sensors import DummySensorModel


class VirtualHardware:
    def __init__(self, cfg: Any) -> None:
        self.cfg = cfg
        self.sensors = DummySensorModel()
        self.output_states: dict[str, int] = {o["name"]: 0 for o in cfg.outputs}
        # forced engineering values injected via sim/command hook
        self._forced: dict[str, float] = {}
        self.emergency = False

    # ---- inputs -----------------------------------------------------------
    def read_all(self) -> tuple[dict[str, int], dict[str, dict]]:
        """Sample every input once.

        Returns ``(inputs_raw, sensors_eng)`` where ``inputs_raw`` matches the
        firmware contract (raw ADC 0..4095 / 0..1) and ``sensors_eng`` carries
        the human-friendly engineering value + unit.
        """
        raw_out: dict[str, int] = {}
        eng_out: dict[str, dict] = {}
        for i in self.cfg.inputs:
            forced = self._forced.pop(i["name"], None)
            eng, raw, unit = self.sensors.sample(i["name"], i, forced=forced)
            raw_out[i["name"]] = raw
            eng_out[i["name"]] = {"value": round(eng, 2), "unit": unit}
        return raw_out, eng_out

    def force_input(self, name: str, value: float) -> None:
        self._forced[name] = float(value)

    # ---- outputs ----------------------------------------------------------
    def set_output(self, target: str, value: int) -> bool:
        for o in self.cfg.outputs:
            if o["name"] == target:
                if o["type"] == "PWM":
                    value = max(0, min(255, int(value)))
                else:
                    value = 1 if int(value) > 0 else 0
                self.output_states[target] = value
                return True
        return False

    def trigger_emergency(self) -> None:
        self.emergency = True
        for o in self.cfg.outputs:
            self.output_states[o["name"]] = 0

    def clear_emergency(self) -> None:
        self.emergency = False

    # ---- modbus -----------------------------------------------------------
    def poll_modbus(self) -> dict[str, dict]:
        """Return flat register values, firmware-shaped.

        Firmware stores ``modbus[dev][reg] = responseBuffer * multiplier`` (a
        scalar). We keep that exact shape; the human-friendly version lives in
        the top-level ``sensors`` field instead.
        """
        result: dict[str, dict] = {}
        for m in self.cfg.modbus:
            dev: dict[str, float] = {}
            for reg in m["registers"]:
                fake_def = {"type": "ANALOG", "invert": False}
                eng, _raw, _unit = self.sensors.sample(reg["name"], fake_def)
                mult = float(reg.get("multiplier", 1.0)) or 1.0
                dev[reg["name"]] = round(eng * mult, 2)
            result[m["name"]] = dev
        return result

    # ---- local control ----------------------------------------------------
    def evaluate_local_control(self, sensors: dict[str, dict]) -> list[str]:
        """Mirror HardwareManager::evaluateLocalControl (hysteresis).

        Uses *engineering* values so thresholds (e.g. 30.0 = 30 °C) compare
        directly, regardless of ADC scaling.
        """
        fired: list[str] = []
        for rule in self.cfg.local_control_rules:
            if not rule.get("enabled"):
                continue
            name = rule["inputSensor"]
            target = rule["outputTarget"]
            if name not in sensors or target not in self.output_states:
                continue
            sensor_value = sensors[name]["value"]
            cur = self.output_states[target]
            if cur == 0 and sensor_value > rule["thresholdHigh"]:
                self.set_output(target, 1)
                fired.append(f"{rule['name']} -> {target} ON ({sensor_value:.1f} > {rule['thresholdHigh']})")
            elif cur == 1 and sensor_value < rule["thresholdLow"]:
                self.set_output(target, 0)
                fired.append(f"{rule['name']} -> {target} OFF ({sensor_value:.1f} < {rule['thresholdLow']})")
        return fired
