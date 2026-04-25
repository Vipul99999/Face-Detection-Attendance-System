from __future__ import annotations

import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import settings

EMBEDDING_PREFIX = "enc::"

def _normalize_key(value: str) -> bytes:
    raw = value.encode("utf-8")
    try:
        return base64.urlsafe_b64encode(base64.urlsafe_b64decode(raw))
    except Exception:
        digest = hashlib.sha256(raw).digest()
        return base64.urlsafe_b64encode(digest)


def _build_primary_key() -> bytes:
    if settings.embedding_encryption_key:
        return _normalize_key(settings.embedding_encryption_key)

    digest = hashlib.sha256(settings.auth_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


primary_fernet = Fernet(_build_primary_key())
previous_fernets = [Fernet(_normalize_key(value)) for value in settings.previous_embedding_encryption_keys]


def encrypt_embedding(embedding: list[float]) -> str:
    payload = json.dumps(embedding).encode("utf-8")
    return f"{EMBEDDING_PREFIX}{primary_fernet.encrypt(payload).decode('utf-8')}"


def decrypt_embedding(value: str) -> list[float]:
    if not value.startswith(EMBEDDING_PREFIX):
        return json.loads(value)

    token = value[len(EMBEDDING_PREFIX):]
    try:
        decrypted = primary_fernet.decrypt(token.encode("utf-8")).decode("utf-8")
        return json.loads(decrypted)
    except InvalidToken:
        for fernet in previous_fernets:
            try:
                decrypted = fernet.decrypt(token.encode("utf-8")).decode("utf-8")
                return json.loads(decrypted)
            except InvalidToken:
                continue
        raise


def embedding_requires_rotation(value: str) -> bool:
    if not value.startswith(EMBEDDING_PREFIX):
        return True

    token = value[len(EMBEDDING_PREFIX):]
    try:
        primary_fernet.decrypt(token.encode("utf-8"))
        return False
    except InvalidToken:
        for fernet in previous_fernets:
            try:
                fernet.decrypt(token.encode("utf-8"))
                return True
            except InvalidToken:
                continue
        return True
