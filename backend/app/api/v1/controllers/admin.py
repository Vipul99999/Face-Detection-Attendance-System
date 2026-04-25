from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.api.v1.services.common import (
    build_audit_query,
    day_bounds,
    decode_image,
    delete_saved_image,
    get_registered_users,
    save_image,
    utc_now_iso,
)
from app.api.v1.services.errors import raise_api_error
from app.config.settings import settings
from app.core.auth import (
    authenticate_admin,
    check_admin_login_rate_limit,
    create_access_token,
    get_current_admin,
    track_admin_login_attempt,
)
from app.core.db import (
    create_audit_log,
    deserialize_embedding,
    get_connection,
    serialize_embedding,
)
from app.core.face_utils import cosine_similarity, face_engine


router = APIRouter(tags=["admin"])


@router.post("/admin/login")
async def admin_login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    cleaned_username = username.strip()
    client_ip = request.client.host if request.client else None
    rate_limit = check_admin_login_rate_limit(cleaned_username, client_ip)
    if rate_limit:
        raise_api_error(
            message="Too many login attempts. Please wait before trying again.",
            code="LOGIN_RATE_LIMITED",
            status_code=429,
            details=rate_limit,
        )

    admin = authenticate_admin(username=cleaned_username, password=password)
    if admin is None:
        track_admin_login_attempt(
            username=cleaned_username,
            ip_address=client_ip,
            success=False,
        )
        raise_api_error(
            message="Invalid admin credentials.",
            code="INVALID_CREDENTIALS",
            status_code=401,
        )

    track_admin_login_attempt(
        username=cleaned_username,
        ip_address=client_ip,
        success=True,
    )
    create_audit_log(
        admin_username=admin["username"],
        action="admin_login",
        target_type="admin",
        target_id=str(admin["id"]),
        details={"status": "success"},
    )

    return {
        "status": "success",
        "token": create_access_token(admin["id"], admin["username"]),
        "admin": {
            "id": admin["id"],
            "username": admin["username"],
            "created_at": admin["created_at"],
        },
    }


@router.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return {"admin": admin}


@router.get("/students")
async def list_students(_admin: dict = Depends(get_current_admin)):
    users = get_registered_users()
    return {
        "students": [
            {
                "id": user["id"],
                "name": user["name"],
                "created_at": user["created_at"],
                "image_path": user["image_path"] if settings.store_face_images else None,
            }
            for user in users
        ]
    }


@router.get("/audit-logs")
async def list_audit_logs(_admin: dict = Depends(get_current_admin)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, admin_username, action, target_type, target_id, details_json, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 100
            """
        ).fetchall()

    return {
        "logs": [
            {
                "id": row["id"],
                "admin_username": row["admin_username"],
                "action": row["action"],
                "target_type": row["target_type"],
                "target_id": row["target_id"],
                "details": json.loads(row["details_json"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@router.post("/register")
async def register_user(
    name: str = Form(...),
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    cleaned_name = " ".join(name.split())
    if len(cleaned_name) < 2:
        raise_api_error(
            message="Enter a valid student name.",
            code="INVALID_STUDENT_NAME",
            status_code=400,
        )

    contents = await file.read()
    image = decode_image(contents)
    if image is None:
        raise_api_error(
            message="Invalid image file.",
            code="INVALID_IMAGE",
            status_code=400,
        )

    embedding, meta = face_engine.extract_embedding(image, for_registration=True)
    if embedding is None:
        raise_api_error(
            message=meta["reason"],
            code="FACE_REGISTRATION_REJECTED",
            status_code=400,
            details=meta,
        )

    existing_users = get_registered_users()
    for user in existing_users:
        if user["name"].lower() == cleaned_name.lower():
            raise_api_error(
                message="Student is already registered.",
                code="STUDENT_ALREADY_REGISTERED",
                status_code=409,
            )

        score = cosine_similarity(embedding, deserialize_embedding(user["embedding"]))
        if score >= settings.duplicate_match_threshold:
            raise_api_error(
                message=f"Face already looks registered as {user['name']}.",
                code="DUPLICATE_FACE_MATCH",
                status_code=409,
                details={"similarity": round(score, 3), "matched_user": user["name"]},
            )

    image_path = save_image(contents, "register") or None
    timestamp = utc_now_iso()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (name, embedding, image_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                cleaned_name,
                serialize_embedding(embedding),
                image_path,
                timestamp,
                timestamp,
            ),
        )
        user_id = cursor.lastrowid

    create_audit_log(
        admin_username=admin["username"],
        action="register_student",
        target_type="student",
        target_id=str(user_id),
        details={"name": cleaned_name},
    )

    return {
        "status": "success",
        "message": f"{cleaned_name} registered successfully.",
        "student": {
            "id": user_id,
            "name": cleaned_name,
            "image_path": image_path,
            "created_at": timestamp,
        },
    }


@router.get("/attendance")
async def get_attendance(_admin: dict = Depends(get_current_admin)):
    with get_connection() as conn:
        records = conn.execute(
            """
            SELECT id, user_id, name, captured_image_path, similarity, created_at
            FROM attendance
            ORDER BY created_at DESC
            """
        ).fetchall()

    return {
        "records": [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "name": row["name"],
                "captured_image_path": row["captured_image_path"],
                "similarity": row["similarity"],
                "time": row["created_at"],
            }
            for row in records
        ]
    }


@router.get("/attendance/export.csv")
async def export_attendance_csv(admin: dict = Depends(get_current_admin)):
    with get_connection() as conn:
        records = conn.execute(
            """
            SELECT name, similarity, created_at
            FROM attendance
            ORDER BY created_at DESC
            """
        ).fetchall()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["student_name", "match_score", "captured_at_utc"])

    for row in records:
        writer.writerow([row["name"], row["similarity"], row["created_at"]])

    create_audit_log(
        admin_username=admin["username"],
        action="export_attendance_csv",
        target_type="attendance",
        details={"records_exported": len(records)},
    )

    buffer.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="attendance_{timestamp}.csv"'
        },
    )


@router.get("/dashboard/summary")
async def dashboard_summary(_admin: dict = Depends(get_current_admin)):
    with get_connection() as conn:
        total_students = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        total_attendance = conn.execute(
            "SELECT COUNT(*) AS count FROM attendance"
        ).fetchone()["count"]
        today_prefix = datetime.now().date().isoformat()
        today_attendance = conn.execute(
            "SELECT COUNT(*) AS count FROM attendance WHERE created_at LIKE ?",
            (f"{today_prefix}%",),
        ).fetchone()["count"]
        latest = conn.execute(
            """
            SELECT name, created_at
            FROM attendance
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()

    return {
        "stats": {
            "registered_students": total_students,
            "attendance_records": total_attendance,
            "today_attendance": today_attendance,
            "latest_activity": dict(latest) if latest else None,
        }
    }


@router.get("/analytics/summary")
async def analytics_summary(
    date: str | None = None,
    _admin: dict = Depends(get_current_admin),
):
    selected_date, day_start, day_end = day_bounds(date)

    with get_connection() as conn:
        total_students = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        day_attendance = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM attendance
            WHERE created_at >= ? AND created_at < ?
            """,
            (day_start, day_end),
        ).fetchone()["count"]
        attendance_rate = round(
            (day_attendance / total_students) * 100, 1
        ) if total_students else 0.0

        per_student_rows = conn.execute(
            """
            SELECT
                users.id,
                users.name,
                COUNT(attendance.id) AS total_marks,
                MAX(attendance.created_at) AS last_seen
            FROM users
            LEFT JOIN attendance ON attendance.user_id = users.id
            GROUP BY users.id, users.name
            ORDER BY total_marks DESC, users.name ASC
            """
        ).fetchall()

        trend_rows = conn.execute(
            """
            SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total
            FROM attendance
            GROUP BY substr(created_at, 1, 10)
            ORDER BY day DESC
            LIMIT 7
            """
        ).fetchall()

        absentee_rows = conn.execute(
            """
            SELECT users.id, users.name, users.created_at
            FROM users
            LEFT JOIN attendance
                ON attendance.user_id = users.id
                AND attendance.created_at >= ?
                AND attendance.created_at < ?
            WHERE attendance.id IS NULL
            ORDER BY users.name ASC
            """,
            (day_start, day_end),
        ).fetchall()

    return {
        "selected_date": selected_date,
        "overview": {
            "registered_students": total_students,
            "present_today": day_attendance,
            "absent_today": max(total_students - day_attendance, 0),
            "attendance_rate": attendance_rate,
        },
        "attendance_trend": [dict(row) for row in reversed(trend_rows)],
        "top_students": [dict(row) for row in per_student_rows[:5]],
        "absentees": [dict(row) for row in absentee_rows],
    }


@router.post("/students/{student_id}/purge")
async def purge_student_with_reauth(
    student_id: int,
    confirm_password: str = Form(...),
    admin: dict = Depends(get_current_admin),
):
    verified_admin = authenticate_admin(admin["username"], confirm_password)
    if verified_admin is None:
        create_audit_log(
            admin_username=admin["username"],
            action="delete_student_reauth_failed",
            target_type="student",
            target_id=str(student_id),
            details={"reason": "invalid_password"},
        )
        raise_api_error(
            message="Re-authentication failed.",
            code="REAUTH_FAILED",
            status_code=401,
        )

    with get_connection() as conn:
        student = conn.execute(
            """
            SELECT id, name, image_path
            FROM users
            WHERE id = ?
            """,
            (student_id,),
        ).fetchone()

        if student is None:
            raise_api_error(
                message="Student not found.",
                code="STUDENT_NOT_FOUND",
                status_code=404,
            )

        attendance_rows = conn.execute(
            """
            SELECT id, captured_image_path
            FROM attendance
            WHERE user_id = ?
            """,
            (student_id,),
        ).fetchall()

        conn.execute("DELETE FROM attendance WHERE user_id = ?", (student_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (student_id,))

    delete_saved_image(student["image_path"])
    for row in attendance_rows:
        delete_saved_image(row["captured_image_path"])

    create_audit_log(
        admin_username=admin["username"],
        action="delete_student_biometric_purge",
        target_type="student",
        target_id=str(student_id),
        details={
            "name": student["name"],
            "attendance_records_deleted": len(attendance_rows),
            "raw_images_deleted": settings.store_face_images,
        },
    )

    return {
        "status": "success",
        "message": f"{student['name']} and related biometric attendance data were deleted.",
        "deleted_student_id": student_id,
        "attendance_records_deleted": len(attendance_rows),
    }


@router.post("/security/embeddings/re-encrypt")
async def reencrypt_embeddings(admin: dict = Depends(get_current_admin)):
    migrated_count = 0

    with get_connection() as conn:
        rows = conn.execute("SELECT id, embedding FROM users").fetchall()
        for row in rows:
            try:
                decrypted = deserialize_embedding(row["embedding"])
                new_value = serialize_embedding(decrypted)
                if row["embedding"] != new_value:
                    conn.execute(
                        "UPDATE users SET embedding = ?, updated_at = ? WHERE id = ?",
                        (new_value, utc_now_iso(), row["id"]),
                    )
                    migrated_count += 1
            except Exception:
                continue

    create_audit_log(
        admin_username=admin["username"],
        action="reencrypt_embeddings",
        target_type="security",
        details={"migrated_embeddings": migrated_count},
    )

    return {
        "status": "success",
        "message": "Embedding re-encryption completed.",
        "migrated_embeddings": migrated_count,
    }
