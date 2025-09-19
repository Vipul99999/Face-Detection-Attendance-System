import cv2
import numpy as np
from fastapi import UploadFile
from datetime import datetime, timedelta
from app.core.face_utils import extract_embedding, match_face
from app.core.db import db


def process_auto_capture(file: UploadFile):
    print("File is comming from frontend", file.filename)
    contents = np.frombuffer(file.file.read(), np.uint8)
    img = cv2.imdecode(contents, cv2.IMREAD_COLOR)

    if img is None:
        return {"attendance_marked": False, "reason": "Invalid image"}

    # Save temporary image
    save_path = f"data/images/auto_{datetime.now().timestamp()}.jpg"
    cv2.imwrite(save_path, img)
    print("\n temporary image saved")
    # Extract embedding
    embedding, meta = extract_embedding(save_path)
    if embedding is None:
        return {"attendance_marked": False, "reason": meta["reason"]}
    print("\n embedding image loaded")
    # Match face
    user = match_face(embedding)
    if not user:
        return {"attendance_marked": False, "reason": "Face not recognized"}
    print("\n Image is matched")
    # Check last attendance (within 2 minutes)
    ten_minutes_ago = datetime.now() - timedelta(minutes=10)
    recent = db.attendance.find_one({
        "name": user["name"],
        "time": {"$gte": ten_minutes_ago}
    })
    print("\nImage is not uploaded less than 10 minute ago image")
    if recent:
        return {
            "attendance_marked": False,
            "reason": f"Attendance already marked for {user['name']} recently"
        }
    print("\nImage inserted")
    # Insert new attendance record
    record = {"name": user["name"], "time": datetime.now()}
    db.attendance.insert_one(record)
    print("\n new record inserted as attendance mark")
    return {
        "attendance_marked": True,
        "reason": f"Marked {user['name']}",
        "score": user["score"],
        "time": record["time"].isoformat()
    }
