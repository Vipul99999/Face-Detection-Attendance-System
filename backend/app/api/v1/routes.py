from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import os, shutil
from datetime import datetime, timedelta,timezone

from bson import ObjectId

from app.core.db import users_collection, attendance_collection
from app.core.face_utils import extract_embedding, match_face, cosine_similarity  # you’ll adjust these for Mongo

router = APIRouter()

UPLOAD_DIR = "data/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ----------------- Register User -----------------
@router.post("/register")
async def register_user(name: str = Form(...), file: UploadFile = File(...)):
    print("Register request received:", name, file.filename)
    # Save uploaded image
    save_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{file.filename}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print("save Uploaded image\n")
    # Extract embedding
    embedding, meta = extract_embedding(save_path, for_registration=True)
    if embedding is None:
        print("Embedding extraction failed:", meta)
        return JSONResponse(
            {"status": "error", "message": meta.get("reason", "Embedding failed")},
            status_code=400,
        )
    print("embedding phase passed")
    # Check duplicate by name
    existing = users_collection.find_one({"name": name})
    if existing:
        return JSONResponse(
            {"status": "error", "message": "User already registered"},
            status_code=400,
        )
    print("checing duplicate name passed\n")
    # ✅ Check duplicate face by comparing embeddings
    all_users = users_collection.find({})
    for user in all_users:
        stored_embedding = user.get("embedding")
        if stored_embedding:
            sim = cosine_similarity(embedding, stored_embedding)
            if sim > 0.7:  # threshold
                # Instead of returning 400, update embeddings
                users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"embedding": embedding, "updated_at": datetime.utcnow()}}
                )
                return {
                    "status": "success",
                    "message": f"User {user['name']}'s face embeddings updated."
                }

    print("checking duplicate face passed\n")
    # Save new user
    print("Saved uploaded file to:", save_path)

    user_doc = {
        "name": name,
        "embedding": embedding,  # list[float]
        "created_at": datetime.now(timezone.utc),
    }
    users_collection.insert_one(user_doc)

    return {"status": "success", "message": f"User {name} registered successfully"}

# ----------------- Capture Attendance -----------------
@router.post("/capture")
async def capture_face(file: UploadFile = File(...)):
    print("file name is in api/v1/capture api ", file.filename)
    save_path = os.path.join(UPLOAD_DIR, f"capture_{datetime.now().timestamp()}_{file.filename}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    embedding, meta = extract_embedding(save_path)
    if embedding is None:
        return {"status": "error", "message": meta.get("reason", "Embedding failed")}
    print("\n file embedded image retireiving done")
    user = match_face(embedding)  # Should query Mongo users_collection internally
    if not user:
        return {"status": "error", "message": "Face not recognized"}
    print("\n file matching done")
    # Attendance cooldown = 5 minutes
    last_record = attendance_collection.find_one(
        {"user_id": str(user["_id"])}, sort=[("time", -1)]
    )
    if last_record and (datetime.now(timezone.utc) - last_record["time"]) < timedelta(minutes=5):
        return {
            "status": "error",
            "message": f"Attendance already marked at {last_record['time'].isoformat()}",
        }
    print("\n Attendance marking process")
    # Mark attendance
    attendance_doc = {
        "user_id": str(user["_id"]),
        "name": user["name"],
        "time": datetime.now(timezone.utc),
    }
    attendance_collection.insert_one(attendance_doc)
    print("\n Attendance marking done")
    return {
        "status": "success",
        "user": user["name"],
        "time": attendance_doc["time"].isoformat(),
    }


# ----------------- Auto Capture -----------------
@router.post("/capture/auto")
async def auto_capture(file: UploadFile = File(...)):
    print("file name is in api/v1/capture/auto api ", file.filename)
    save_path = os.path.join(UPLOAD_DIR, f"auto_{datetime.now().timestamp()}_{file.filename}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print("\nIt passes the file opning phase ")
    embedding, meta = extract_embedding(save_path)
    if embedding is None:
        return JSONResponse({"status": "error", "message": meta.get("reason", "Embedding failed")}, status_code=400)
    print("\n file embedded image retireiving done")
    user = match_face(embedding)
    if not user:
        return JSONResponse({"status": "error", "message": "Face not recognized"}, status_code=404)
    print("\n file matching done")
    # Check cooldown
    last_record = attendance_collection.find_one(
        {"user_id": str(user["_id"])}, sort=[("time", -1)]
    )
    if last_record:
        last_time = last_record["time"]
        # Make it timezone-aware if it's naive
        if last_time.tzinfo is None:
            last_time = last_time.replace(tzinfo=timezone.utc)
        print(f"Last attendance time (timezone-aware): {last_time}")

        if (datetime.now(timezone.utc) - last_time) < timedelta(minutes=5):
            print("Attendance already marked recently. Skipping.")
            return {
                "status": "error",
                "attendance_marked": False,
                "message": f"Already marked at {last_time.isoformat()}",
            }
    print("\n Attendance marking processing")
    # Insert attendance
    attendance_doc = {
        "user_id": str(user["_id"]),
        "name": user["name"],
        "time": datetime.now(timezone.utc),
    }
    attendance_collection.insert_one(attendance_doc)
    print("\n Attendance marking done")
    return {
        "status": "success",
        "attendance_marked": True,
        "user": user["name"],
        "time": attendance_doc["time"].isoformat(),
    }


# ----------------- Get Attendance Records -----------------
@router.get("/attendance")
async def get_attendance():
    print("Fetching attendance records from database...")  # Function start

    records = list(attendance_collection.find().sort("time", -1))
    print(f"Total attendance records fetched: {len(records)}")  # Number of records

    result = []
    for r in records:
        print(f"Processing record: user={r.get('name')}, time={r.get('time')}")  # Print each record
        result.append({"name": r["name"], "time": r["time"].isoformat()})

    print("Attendance records processed and ready to return")  # Finished processing
    return {"records": result}
