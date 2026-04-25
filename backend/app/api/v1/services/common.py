from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np

from app.config.settings import settings
from app.core.db import deserialize_embedding, get_connection
from app.core.face_utils import cosine_similarity


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def decode_image(contents: bytes) -> np.ndarray | None:
    array = np.frombuffer(contents, np.uint8)
    return cv2.imdecode(array, cv2.IMREAD_COLOR)


def save_image(contents: bytes, prefix: str) -> str:
    if not settings.store_face_images:
        return ""
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}_{uuid4().hex[:12]}.jpg"
    path = settings.upload_dir / filename
    path.write_bytes(contents)
    return str(path)


def delete_saved_image(path_value: str | None) -> None:
    if not path_value:
        return

    file_path = Path(path_value)
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass


def get_registered_users() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, embedding, image_path, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def find_best_match(embedding: list[float]) -> tuple[dict | None, float]:
    best_user = None
    best_score = 0.0

    for user in get_registered_users():
        score = cosine_similarity(embedding, deserialize_embedding(user["embedding"]))
        if score > best_score:
            best_user = user
            best_score = score

    return best_user, best_score


def day_bounds(date_value: str | None = None) -> tuple[str, str, str]:
    if date_value:
        selected_day = datetime.fromisoformat(date_value).date()
    else:
        selected_day = datetime.now().date()

    start = datetime.combine(selected_day, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return selected_day.isoformat(), start.isoformat(), end.isoformat()


def build_audit_query(
    action: str | None = None,
    admin_username: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[str, list]:
    conditions: list[str] = []
    params: list = []

    if action:
        conditions.append("action = ?")
        params.append(action)
    if admin_username:
        conditions.append("admin_username = ?")
        params.append(admin_username)
    if date_from:
        conditions.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("created_at <= ?")
        params.append(date_to)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where_clause, params
