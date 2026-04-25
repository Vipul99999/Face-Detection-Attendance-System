from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, File, Form, UploadFile

from app.api.v1.services.errors import raise_api_error
from app.config.settings import settings
from app.core.anti_spoof import anti_spoof_engine
from app.core.db import get_connection
from app.core.face_utils import face_engine
from app.core.liveness import generate_liveness_challenge, validate_liveness_proof
from app.api.v1.services.common import decode_image, find_best_match, save_image


router = APIRouter(tags=["public"])


@router.get("/health")
async def api_health():
    state = face_engine.state
    anti_spoof_state = anti_spoof_engine.state
    with get_connection() as conn:
        user_count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        attendance_count = conn.execute(
            "SELECT COUNT(*) AS count FROM attendance"
        ).fetchone()["count"]

    return {
        "status": "ok",
        "app": settings.app_name,
        "face_engine": {
            "available": state.available,
            "reason": state.reason,
        },
        "liveness": {
            "enabled": settings.enable_liveness_checks,
        },
        "anti_spoof": {
            "available": anti_spoof_state.available,
            "reason": anti_spoof_state.reason,
        },
        "privacy": {
            "store_face_images": settings.store_face_images,
            "purge_legacy_face_images": settings.purge_legacy_face_images,
            "retention_mode": "embeddings_only"
            if not settings.store_face_images
            else "raw_images_enabled",
        },
        "stats": {
            "registered_users": user_count,
            "attendance_records": attendance_count,
        },
    }


@router.get("/liveness/challenge")
async def liveness_challenge():
    if not settings.enable_liveness_checks:
        return {
            "status": "disabled",
            "challenge": None,
            "instructions": "Liveness checks are disabled for attendance scans.",
        }

    challenge = generate_liveness_challenge()
    return {
        "status": "success",
        "challenge": challenge,
        "instructions": "Complete the active liveness challenge before attendance capture.",
    }


@router.post("/capture")
@router.post("/capture/auto")
async def capture_attendance(
    file: UploadFile = File(...),
    liveness_token: str | None = Form(default=None),
    liveness_proof: str | None = Form(default=None),
):
    liveness_result = None
    if settings.enable_liveness_checks:
        liveness_result = validate_liveness_proof(liveness_token, liveness_proof)

    contents = await file.read()
    image = decode_image(contents)
    if image is None:
        raise_api_error(
            message="Invalid image file.",
            code="INVALID_IMAGE",
            status_code=400,
        )

    embedding, meta = face_engine.extract_embedding(image, for_registration=False)
    if embedding is None:
        raise_api_error(
            message=meta["reason"],
            code="FACE_CAPTURE_REJECTED",
            status_code=400,
            details=meta,
        )

    anti_spoof_result = anti_spoof_engine.analyze(image)
    if anti_spoof_result["available"] and anti_spoof_result["is_spoof"]:
        raise_api_error(
            message=anti_spoof_result["reason"],
            code="ANTI_SPOOF_REJECTED",
            status_code=403,
            details={"anti_spoof": anti_spoof_result},
        )

    user, score = find_best_match(embedding)
    if user is None or score < settings.face_match_threshold:
        raise_api_error(
            message="Face not recognized. Register this student first.",
            code="FACE_NOT_RECOGNIZED",
            status_code=404,
            details={"similarity": round(score, 3)},
        )

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.attendance_cooldown_minutes)

    with get_connection() as conn:
        latest = conn.execute(
            """
            SELECT created_at
            FROM attendance
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user["id"],),
        ).fetchone()

        if latest:
            last_marked = datetime.fromisoformat(latest["created_at"])
            if last_marked >= window_start:
                return {
                    "status": "duplicate",
                    "attendance_marked": False,
                    "message": f"Attendance already marked recently for {user['name']}.",
                    "user": user["name"],
                    "time": latest["created_at"],
                    "similarity": round(score, 3),
                }

        capture_path = save_image(contents, "attendance") or None
        timestamp = now.isoformat()
        conn.execute(
            """
            INSERT INTO attendance (user_id, name, captured_image_path, similarity, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user["id"], user["name"], capture_path, score, timestamp),
        )

    return {
        "status": "success",
        "attendance_marked": True,
        "message": f"Attendance marked for {user['name']}.",
        "user": user["name"],
        "time": now.isoformat(),
        "similarity": round(score, 3),
        "liveness": liveness_result,
        "anti_spoof": anti_spoof_result,
    }
