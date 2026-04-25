from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.config.settings import settings
from app.core.embedding_crypto import (
    decrypt_embedding,
    embedding_requires_rotation,
    encrypt_embedding,
)
from app.core.security import hash_password


_database_initialized = False


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _purge_legacy_face_images() -> None:
    if settings.store_face_images or not settings.purge_legacy_face_images:
        return

    upload_dir = settings.upload_dir
    if upload_dir.exists() and upload_dir.is_dir():
        for pattern in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
            for file_path in upload_dir.glob(pattern):
                try:
                    file_path.unlink()
                except OSError:
                    continue


def initialize_database() -> None:
    global _database_initialized
    if _database_initialized:
        return

    _ensure_parent(settings.database_path)
    with sqlite3.connect(settings.database_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                embedding TEXT NOT NULL,
                image_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                captured_image_path TEXT,
                similarity REAL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_username TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                details_json TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                ip_address TEXT,
                success INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_attendance_user_time ON attendance(user_id, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance(created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_lookup ON admin_login_attempts(username, ip_address, created_at DESC)"
        )
        admin = conn.execute(
            "SELECT id FROM admins WHERE username = ?",
            (settings.admin_username,),
        ).fetchone()
        if admin is None:
            conn.execute(
                """
                INSERT INTO admins (username, password_hash, created_at)
                VALUES (?, ?, ?)
                """,
                (
                    settings.admin_username,
                    hash_password(settings.admin_password),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

        if not settings.store_face_images:
            conn.execute("UPDATE users SET image_path = NULL WHERE image_path IS NOT NULL")
            conn.execute(
                "UPDATE attendance SET captured_image_path = NULL WHERE captured_image_path IS NOT NULL"
            )

        rows = conn.execute("SELECT id, embedding FROM users").fetchall()
        for row in rows:
            embedding_value = row["embedding"]
            try:
                if embedding_requires_rotation(embedding_value):
                    decrypted_value = decrypt_embedding(embedding_value)
                    re_encrypted = encrypt_embedding(decrypted_value)
                    conn.execute(
                        "UPDATE users SET embedding = ? WHERE id = ?",
                        (re_encrypted, row["id"]),
                    )
            except Exception:
                continue

    _purge_legacy_face_images()
    _database_initialized = True


@contextmanager
def get_connection():
    initialize_database()
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def serialize_embedding(embedding: list[float]) -> str:
    return encrypt_embedding(embedding)


def deserialize_embedding(value: str) -> list[float]:
    return decrypt_embedding(value)


def create_audit_log(
    admin_username: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO audit_logs (admin_username, action, target_type, target_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                admin_username,
                action,
                target_type,
                target_id,
                json.dumps(details or {}),
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def record_admin_login_attempt(
    *,
    username: str,
    ip_address: str | None,
    success: bool,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO admin_login_attempts (username, ip_address, success, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                username,
                ip_address,
                1 if success else 0,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def clear_admin_login_attempts(*, username: str, ip_address: str | None) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            DELETE FROM admin_login_attempts
            WHERE username = ?
              AND COALESCE(ip_address, '') = COALESCE(?, '')
            """,
            (username, ip_address),
        )
