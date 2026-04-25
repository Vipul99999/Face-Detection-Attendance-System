from __future__ import annotations

import json
import random
import secrets
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import status

from app.api.v1.services.errors import raise_api_error
from app.config.settings import settings


_challenge_lock = Lock()
_challenge_store: dict[str, dict] = {}


def _cleanup_expired_challenges() -> None:
    now = datetime.now(timezone.utc)
    expired = [
        token
        for token, payload in _challenge_store.items()
        if datetime.fromisoformat(payload["expires_at"]) < now
    ]
    for token in expired:
        _challenge_store.pop(token, None)


def generate_liveness_challenge() -> dict:
    challenge_step = random.choice(["blink", "turn_left", "turn_right"])
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=settings.liveness_token_expiry_seconds
    )
    token = secrets.token_urlsafe(32)
    payload = {
        "steps": [challenge_step],
        "expires_at": expires_at.isoformat(),
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "used": False,
    }
    with _challenge_lock:
        _cleanup_expired_challenges()
        _challenge_store[token] = payload
    return {"token": token, "steps": payload["steps"], "expires_at": payload["expires_at"]}


def validate_liveness_proof(token: str | None, proof: str | None) -> dict:
    if not token or not proof:
        raise_api_error(
            message="Active liveness verification is required before attendance capture.",
            code="LIVENESS_REQUIRED",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    with _challenge_lock:
        _cleanup_expired_challenges()
        challenge = _challenge_store.get(token)
        if challenge is None:
            raise_api_error(
                message="Invalid or expired liveness challenge.",
                code="LIVENESS_CHALLENGE_INVALID",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if challenge.get("used"):
            raise_api_error(
                message="Liveness challenge already used. Start a new scan.",
                code="LIVENESS_CHALLENGE_USED",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

    try:
        proof_payload = json.loads(proof)
    except json.JSONDecodeError:
        raise_api_error(
            message="Invalid liveness proof payload.",
            code="LIVENESS_PROOF_INVALID",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    completed_steps = proof_payload.get("completed_steps", [])
    metrics = proof_payload.get("metrics", {})
    required_steps = challenge.get("steps", [])

    for step in required_steps:
        if step not in completed_steps:
            raise_api_error(
                message=f"Liveness step '{step}' was not completed.",
                code="LIVENESS_STEP_MISSING",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"missing_step": step},
            )

    blink_count = int(metrics.get("blink_count", 0))
    turn_offset = float(metrics.get("turn_offset", 0))
    stable_frames = int(metrics.get("stable_frames", 0))

    if "blink" in required_steps and blink_count < 1:
        raise_api_error(
            message="Blink challenge did not complete successfully.",
            code="LIVENESS_BLINK_FAILED",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if any(step in required_steps for step in ("turn_left", "turn_right")) and turn_offset < 0.025:
        raise_api_error(
            message="Head-turn challenge was too weak. Try again.",
            code="LIVENESS_TURN_FAILED",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if stable_frames < 5:
        raise_api_error(
            message="Liveness capture was too short. Keep your face visible a little longer.",
            code="LIVENESS_STABILITY_FAILED",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    with _challenge_lock:
        if token in _challenge_store:
            _challenge_store[token]["used"] = True
            _challenge_store.pop(token, None)

    return {"steps": required_steps, "metrics": metrics}
