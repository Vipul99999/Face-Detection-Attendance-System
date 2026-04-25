from pydantic import BaseModel


class AttendanceRecord(BaseModel):
    id: int
    user_id: int
    name: str
    time: str
    similarity: float | None = None
    captured_image_path: str | None = None
