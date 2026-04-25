from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_password(password: str, salt: str | None = None) -> str:
    actual_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        actual_salt.encode("utf-8"),
        120000,
    ).hex()
    return f"{actual_salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt, _digest = stored_hash.split("$", 1)
    return hmac.compare_digest(hash_password(password, salt), stored_hash)
