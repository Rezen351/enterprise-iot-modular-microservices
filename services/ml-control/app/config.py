import os

try:
    from pydantic_settings import BaseSettings
    class Settings(BaseSettings):
        PORT: int = int(os.getenv("PORT", "8080"))
        NATS_URL: str = os.getenv("NATS_URL", "nats://nats:4222")
        JWT_SECRET: str = os.getenv("JWT_SECRET", "shared_jwt_secret_change_me")
        CONTROL_URL: str = os.getenv("CONTROL_URL", "http://control:8080")
        MODULE_URL: str = os.getenv("MODULE_URL", "http://module:8080")
        STREAM_URL: str = os.getenv("STREAM_URL", "http://stream:8080")
        ML_URL: str = os.getenv("ML_URL", "http://ml:8080")
        REDIS_ADDR: str = os.getenv("REDIS_ADDR", "redis-shared:6379")
        REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
        REDIS_DB: int = int(os.getenv("REDIS_DB", "4"))
        SNAPSHOT_INTERVAL_HOURS: int = int(os.getenv("SNAPSHOT_INTERVAL_HOURS", "8"))
        MIN_ON_SEC: float = float(os.getenv("MIN_ON_SEC", "5"))
        MAX_ON_SEC: float = float(os.getenv("MAX_ON_SEC", "60"))
        MIN_OFF_SEC: float = float(os.getenv("MIN_OFF_SEC", "60"))
        MAX_OFF_SEC: float = float(os.getenv("MAX_OFF_SEC", "900"))
        SCHEDULE_UPDATE_COOLDOWN_MIN: int = int(os.getenv("SCHEDULE_UPDATE_COOLDOWN_MIN", "30"))
        AUTO_APPLY_SCHEDULE: bool = os.getenv("AUTO_APPLY_SCHEDULE", "true").lower() == "true"
        DEFAULT_OUTPUT_NAME: str = os.getenv("DEFAULT_OUTPUT_NAME", "mister")
        DEFAULT_INTERVAL_SEC: float = float(os.getenv("DEFAULT_INTERVAL_SEC", "300"))
        DEFAULT_DURATION_SEC: float = float(os.getenv("DEFAULT_DURATION_SEC", "10"))

        class Config:
            env_file = ".env"
            extra = "ignore"
    settings = Settings()
except ImportError:
            class SettingsFallback:
                PORT: int = int(os.getenv("PORT", "8080"))
                NATS_URL: str = os.getenv("NATS_URL", "nats://nats:4222")
                JWT_SECRET: str = os.getenv("JWT_SECRET", "shared_jwt_secret_change_me")
                CONTROL_URL: str = os.getenv("CONTROL_URL", "http://control:8080")
                MODULE_URL: str = os.getenv("MODULE_URL", "http://module:8080")
                STREAM_URL: str = os.getenv("STREAM_URL", "http://stream:8080")
                ML_URL: str = os.getenv("ML_URL", "http://ml:8080")
                REDIS_ADDR: str = os.getenv("REDIS_ADDR", "redis-shared:6379")
                REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
                REDIS_DB: int = int(os.getenv("REDIS_DB", "4"))
                SNAPSHOT_INTERVAL_HOURS: int = int(os.getenv("SNAPSHOT_INTERVAL_HOURS", "8"))
                MIN_ON_SEC: float = float(os.getenv("MIN_ON_SEC", "5"))
                MAX_ON_SEC: float = float(os.getenv("MAX_ON_SEC", "60"))
                MIN_OFF_SEC: float = float(os.getenv("MIN_OFF_SEC", "60"))
                MAX_OFF_SEC: float = float(os.getenv("MAX_OFF_SEC", "900"))
                SCHEDULE_UPDATE_COOLDOWN_MIN: int = int(os.getenv("SCHEDULE_UPDATE_COOLDOWN_MIN", "30"))
                AUTO_APPLY_SCHEDULE: bool = os.getenv("AUTO_APPLY_SCHEDULE", "true").lower() == "true"
                DEFAULT_OUTPUT_NAME: str = os.getenv("DEFAULT_OUTPUT_NAME", "mister")
                DEFAULT_INTERVAL_SEC: float = float(os.getenv("DEFAULT_INTERVAL_SEC", "300"))
                DEFAULT_DURATION_SEC: float = float(os.getenv("DEFAULT_DURATION_SEC", "10"))
            settings = SettingsFallback()
