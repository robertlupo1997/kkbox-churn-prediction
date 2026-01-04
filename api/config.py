"""Configuration settings for the KKBOX Churn API."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """API configuration settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Model paths
    MODEL_PATH: str = "models/xgb.json"
    FEATURES_PATH: str = "eval/features_2017-03-2017-04.csv"
    RULES_PATH: str = "rules.yaml"
    METRICS_PATH: str = "models/training_metrics.json"
    CALIBRATION_PATH: str = "models/calibration_metrics.json"

    # CORS settings
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # API settings
    API_TITLE: str = "KKBOX Churn API"
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"


settings = Settings()
