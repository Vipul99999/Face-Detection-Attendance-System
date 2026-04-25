from __future__ import annotations

import base64
import hmac
import json
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import Header, status

from app.api.v1.services.errors import raise_api_error
from app.config.settings import settings
from app.core.db import (
    clear_admin_login_attempts,
    get_connection,
    record_admin_login_attempt,
)
from app.core.security import verify_password


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("utf-8"))


def create_access_token(admin_id: int, username: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.auth_token_expiry_hours
    )
    payload = {
        "sub": admin_id,
        "username": username,
        "exp": expires_at.isoformat(),
    }
    encoded_payload = _b64encode(json.dumps(payload).encode("utf-8"))
    signature = hmac.new(
        settings.auth_secret.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{encoded_payload}.{signature}"


def decode_access_token(token: str) -> dict:
    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError:
        raise_api_error(
            message="Invalid token format.",
            code="INVALID_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    expected_signature = hmac.new(
        settings.auth_secret.encode("utf-8"),
        encoded_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise_api_error(
            message="Invalid token signature.",
            code="INVALID_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    payload = json.loads(_b64decode(encoded_payload).decode("utf-8"))
    expires_at = datetime.fromisoformat(payload["exp"])
    if expires_at < datetime.now(timezone.utc):
        raise_api_error(
            message="Session expired. Please log in again.",
            code="SESSION_EXPIRED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return payload


def authenticate_admin(username: str, password: str) -> dict | None:
    with get_connection() as conn:
        admin = conn.execute(
            "SELECT id, username, password_hash, created_at FROM admins WHERE username = ?",
            (username,),
        ).fetchone()

    if admin is None:
        return None

    admin_dict = dict(admin)
    if not verify_password(password, admin_dict["password_hash"]):
        return None
    return admin_dict


def check_admin_login_rate_limit(username: str, ip_address: str | None) -> dict | None:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=settings.auth_rate_limit_window_seconds)

    with get_connection() as conn:
        attempts = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM admin_login_attempts
            WHERE username = ?
              AND COALESCE(ip_address, '') = COALESCE(?, '')
              AND success = 0
              AND created_at >= ?
            """,
            (username, ip_address, window_start.isoformat()),
        ).fetchone()

    failures = attempts["count"] if attempts else 0
    if failures < settings.auth_rate_limit_max_attempts:
        return None

    retry_after = settings.auth_rate_limit_window_seconds
    return {
        "retry_after_seconds": retry_after,
        "window_seconds": settings.auth_rate_limit_window_seconds,
        "max_attempts": settings.auth_rate_limit_max_attempts,
    }


def track_admin_login_attempt(
    *,
    username: str,
    ip_address: str | None,
    success: bool,
) -> None:
    if success:
        clear_admin_login_attempts(username=username, ip_address=ip_address)
        return

    record_admin_login_attempt(
        username=username,
        ip_address=ip_address,
        success=False,
    )


def get_current_admin(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise_api_error(
            message="Authorization token missing.",
            code="AUTH_REQUIRED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)

    with get_connection() as conn:
        admin = conn.execute(
            "SELECT id, username, created_at FROM admins WHERE id = ?",
            (payload["sub"],),
        ).fetchone()

    if admin is None:
        raise_api_error(
            message="Admin account not found.",
            code="ADMIN_NOT_FOUND",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return dict(admin)
