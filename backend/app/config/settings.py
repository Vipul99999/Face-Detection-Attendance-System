from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]


def _as_bool(value: str, default: bool) -> bool:
    normalized = (value or str(default)).strip().lower()
    return normalized in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Face Attendance MVP")
    app_env: str = os.getenv("APP_ENV", "development")
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8000"))
    admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "admin123")
    auth_secret: str = os.getenv("AUTH_SECRET", "change-this-secret-in-production")
    auth_rate_limit_window_seconds: int = int(
        os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "300")
    )
    auth_rate_limit_max_attempts: int = int(
        os.getenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "5")
    )
    embedding_encryption_key: str = os.getenv("EMBEDDING_ENCRYPTION_KEY", "")
    previous_embedding_encryption_keys: tuple[str, ...] = tuple(
        value.strip()
        for value in os.getenv("PREVIOUS_EMBEDDING_ENCRYPTION_KEYS", "").split(",")
        if value.strip()
    )
    auth_token_expiry_hours: int = int(os.getenv("AUTH_TOKEN_EXPIRY_HOURS", "12"))
    enable_liveness_checks: bool = _as_bool(
        os.getenv("ENABLE_LIVENESS_CHECKS", "false"),
        False,
    )
    liveness_secret: str = os.getenv("LIVENESS_SECRET", "change-this-liveness-secret")
    liveness_token_expiry_seconds: int = int(
        os.getenv("LIVENESS_TOKEN_EXPIRY_SECONDS", "45")
    )
    anti_spoof_model_path: Path = Path(
        os.getenv(
            "ANTI_SPOOF_MODEL_PATH",
            str(BASE_DIR / "models" / "anti_spoof_modelrgb.onnx"),
        )
    )
    anti_spoof_threshold: float = float(os.getenv("ANTI_SPOOF_THRESHOLD", "0.2808"))
    store_face_images: bool = _as_bool(os.getenv("STORE_FACE_IMAGES", "false"), False)
    purge_legacy_face_images: bool = _as_bool(
        os.getenv("PURGE_LEGACY_FACE_IMAGES", "true"),
        True,
    )
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if origin.strip()
    )
    database_path: Path = Path(
        os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "face_attendance.db"))
    )
    upload_dir: Path = Path(
        os.getenv("UPLOAD_DIR", str(BASE_DIR / "data" / "images"))
    )
    attendance_cooldown_minutes: int = int(
        os.getenv("ATTENDANCE_COOLDOWN_MINUTES", "5")
    )
    face_match_threshold: float = float(os.getenv("FACE_MATCH_THRESHOLD", "0.45"))
    duplicate_match_threshold: float = float(
        os.getenv("DUPLICATE_MATCH_THRESHOLD", "0.55")
    )


settings = Settings()
