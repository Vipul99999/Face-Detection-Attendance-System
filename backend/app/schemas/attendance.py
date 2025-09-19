from pydantic import BaseModel
from datetime import datetime

class AttendanceRecord(BaseModel):
    name: str
    time: datetime

    class Config:
        orm_mode = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
