from __future__ import annotations

from fastapi import UploadFile

from app.api.v1.routes import capture_attendance


async def process_auto_capture(file: UploadFile):
    return await capture_attendance(file=file)
