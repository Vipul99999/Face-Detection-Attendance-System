import cv2
import numpy as np
import os
from insightface.app import FaceAnalysis
from numpy.linalg import norm
from datetime import datetime, timedelta, timezone

from app.core.db import users_collection, attendance_collection

# -------------------- Set local model path --------------------
MODEL_DIR = r"C:\Users\Vipul\.insightface\models\buffalo_l"
os.environ["INSIGHTFACE_MODELS"] = MODEL_DIR
print("Models exist in folder:", os.listdir(MODEL_DIR))

# -------------------- Initialize Face Models --------------------
face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("✅ Face models loaded successfully!")

# -------------------- Extract Face Embedding --------------------
def extract_embedding(image_path, for_registration: bool = False):
    print(f"extract_embedding started for image: {image_path}")  # Function start

    img = cv2.imread(image_path)
    print(f"Image loaded: {'Success' if img is not None else 'Failed'}")  # Image load check
    if img is None:
        print("Invalid image file. Returning spoof error.")
        return None, {"spoof": True, "reason": "Invalid image"}

    faces = face_app.get(img)
    print(f"Number of faces detected: {len(faces)}")  # Number of faces detected
    if not faces:
        print("No face detected. Returning spoof error.")
        return None, {"spoof": True, "reason": "No face detected"}

    if for_registration and len(faces) != 1:
        print(f"Multiple faces detected during registration ({len(faces)} faces). Returning spoof error.")
        return None, {"spoof": True, "reason": "Multiple faces detected"}

    # Pick the largest face
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    print(f"Largest face selected with bbox: {face.bbox}")

    if for_registration:
        print("Registration mode: skipping pose check and anti-spoofing")
        spoof = False
        reason = "Valid (registration bypass)"
    else:
        print("Performing anti-spoofing check...")
        spoof, reason = check_spoof(face)

    if spoof:
        print(f"Spoof detected! Reason: {reason}. Returning error.")
        return None, {"spoof": True, "reason": reason}

    print("Embedding extracted successfully. Returning valid embedding.")
    return face.normed_embedding.tolist(), {"spoof": False, "reason": "Valid"}

# -------------------- Cosine Similarity --------------------
def cosine_similarity(vec1, vec2):
    print("Calculating cosine similarity...")  # Function start
    v1, v2 = np.array(vec1), np.array(vec2)
    print(f"Vector 1 length: {len(v1)}, Vector 2 length: {len(v2)}")  # Vector info

    dot_product = np.dot(v1, v2)
    norm_v1 = norm(v1)
    norm_v2 = norm(v2)
    print(f"Dot product: {dot_product}, Norm v1: {norm_v1}, Norm v2: {norm_v2}")  # Intermediate values

    similarity = float(dot_product / (norm_v1 * norm_v2))
    print(f"Cosine similarity result: {similarity}")  # Final result
    return similarity

# -------------------- Match Face Against DB --------------------
def match_face(embedding, threshold: float = 0.45):
    print("File match_face function start\n")  # Function execution started

    users = list(users_collection.find({}))
    print(f"Total users fetched from database: {len(users)}")  # Show how many users were retrieved

    if not users:
        print("No users found in database")  # Prints if no users are found
        return None

    best_user, best_score = None, 0.0
    for idx, user in enumerate(users, start=1):
        db_emb = np.array(user["embedding"])
        print(f"Checking user {idx} with ID {user.get('_id')} for cosine similarity...")  # Which user is being checked
        
        sim = cosine_similarity(embedding, db_emb)
        print(f"Cosine similarity with user {user.get('_id')}: {sim:.4f}")  # Print similarity score

        if sim > best_score:
            print(f"New best match found! User {user.get('_id')} with similarity {sim:.4f}")  # Update best score
            best_score = sim
            best_user = user

    if best_user:
        print(f"Best user found: {best_user.get('_id')} with similarity {best_score:.4f}")  # Final best user
        if best_score >= threshold:
            print("Similarity above threshold, returning user")  # Threshold check passed
            return best_user
        else:
            print("Best similarity below threshold, returning None")  # Threshold check failed
    else:
        print("No matching user found")  # No user matched at all

    return None

# -------------------- Anti-Spoofing --------------------


def check_spoof(face, min_det_score=0.5, max_pose=45, flat_threshold=1.0, include_roll=True):
    print("\n Starting spoof checking function")

    # Check detection confidence
    if face.det_score < min_det_score:
        print(f" Low detection confidence: {face.det_score:.2f}")
        return True, f"Low detection confidence ({face.det_score:.2f})"

    # Extract pose safely
    try:
        yaw, pitch, roll = np.degrees(face.pose)
        print(f" Pose angles: yaw={yaw:.2f}, pitch={pitch:.2f}, roll={roll:.2f}")
    except Exception as e:
        print(f"❌ Pose extraction failed: {e}")
        return True, "Pose data unavailable"

    # Flat face check (possible spoof)
    if abs(yaw) < flat_threshold and abs(pitch) < flat_threshold:
        print(" Flat face detected (possible photo)")
        return True, "Flat face (possible photo)"

    # Extreme pose check
    # if abs(yaw) > max_pose or abs(pitch) > max_pose or (include_roll and abs(roll) > max_pose):
    #     print("Unrealistic head pose detected")
    #     return True, "Unrealistic head pose"

    print("Spoof check passed")
    return False, "Valid"
# -------------------- Attendance Marking --------------------
def mark_attendance(user_id: str, cooldown_minutes: int = 5):
    print(f"Marking attendance for user_id: {user_id}")  # Function start
    
    last = attendance_collection.find_one(
        {"user_id": str(user_id)}, sort=[("time", -1)]
    )
    print(f"Last attendance record fetched: {last}")  # Show last attendance record

    now = datetime.now(timezone.utc)
    print(f"Current time: {now}")  # Show current time

    if last and (now - last["time"]) < timedelta(minutes=cooldown_minutes):
        print(f"Attendance cooldown active. Last marked at: {last['time']}")  # Cooldown check
        return False, last["time"]

    record = {"user_id": str(user_id), "time": now}
    attendance_collection.insert_one(record)
    print(f"Attendance recorded for user_id: {user_id} at {now}")  # Record inserted
    return True, now
