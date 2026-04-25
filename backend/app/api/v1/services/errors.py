from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ApiError(Exception):
    message: str
    code: str
    status_code: int
    details: dict | list | None = field(default=None)


def error_response_payload(
    *,
    message: str,
    code: str,
    details: dict | list | None = None,
) -> dict:
    payload = {
        "status": "error",
        "message": message,
        "error": {
            "code": code,
        },
    }
    if details not in (None, {}, []):
        payload["error"]["details"] = details
    return payload


def raise_api_error(
    *,
    message: str,
    code: str,
    status_code: int,
    details: dict | list | None = None,
) -> None:
    raise ApiError(message=message, code=code, status_code=status_code, details=details)
