import pymongo
from app.config.settings import settings

client = pymongo.MongoClient(settings.MONGO_URI)
db = client["face_attendance"]
print(db.list_collection_names())
print("DB is Connected")

# Collections
users_collection = db["users"]
attendance_collection = db["attendance"]

# -------------------- Indexes (safe creation) --------------------
try:
    # Users: Ensure unique name
    users_collection.create_index("name", unique=True)
except Exception as e:
    print(f"[WARN] Could not create index on users.name → {e}")

try:
    # Attendance: Optimize lookups by user_id and timestamp
    attendance_collection.create_index([("user_id", 1), ("time", -1)])
    attendance_collection.create_index("time")
except Exception as e:
    print(f"[WARN] Could not create indexes on attendance → {e}")
