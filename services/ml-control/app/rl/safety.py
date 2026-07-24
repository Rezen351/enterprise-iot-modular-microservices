from app.config import settings

class SafetyGuardrail:
    def __init__(
        self,
        min_on_sec: float = settings.MIN_ON_SEC,
        max_on_sec: float = settings.MAX_ON_SEC,
        min_off_sec: float = settings.MIN_OFF_SEC,
        max_off_sec: float = settings.MAX_OFF_SEC,
    ):
        self.min_on_sec = min_on_sec
        self.max_on_sec = max_on_sec
        self.min_off_sec = min_off_sec
        self.max_off_sec = max_off_sec

    def sanitize(self, raw_on_sec: float, raw_off_sec: float) -> tuple[float, float]:
        """
        Clamps raw ON and OFF misting duration parameters within physical safety limits.
        Prevents pump overheating, dry roots, or excessive submergence.
        """
        clamped_on = max(self.min_on_sec, min(self.max_on_sec, float(raw_on_sec)))
        clamped_off = max(self.min_off_sec, min(self.max_off_sec, float(raw_off_sec)))
        return round(clamped_on, 2), round(clamped_off, 2)
