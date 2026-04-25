# Backend

FastAPI backend for the face attendance system.

## Responsibilities

- admin authentication
- student registration
- attendance capture and duplicate protection
- analytics and summary endpoints
- CSV export
- audit logs
- encrypted embedding storage
- anti-spoof and optional liveness validation

## Run Locally

```powershell
cd "D:\Project Build\Face\backend"
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API base:
- `http://localhost:8000/api/v1`

Health endpoints:
- `http://localhost:8000/health`
- `http://localhost:8000/api/v1/health`

## Docker

Build:

```powershell
cd "D:\Project Build\Face\backend"
docker build -t face-attendance-backend:latest .
```

Run:

```powershell
docker run -p 8000:8000 face-attendance-backend:latest
```

## Important Environment Variables

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `EMBEDDING_ENCRYPTION_KEY`
- `PREVIOUS_EMBEDDING_ENCRYPTION_KEYS`
- `ENABLE_LIVENESS_CHECKS`
- `LIVENESS_SECRET`
- `ANTI_SPOOF_MODEL_PATH`
- `ANTI_SPOOF_THRESHOLD`
- `DATABASE_PATH`
- `UPLOAD_DIR`
- `ATTENDANCE_COOLDOWN_MINUTES`
- `FACE_MATCH_THRESHOLD`
- `DUPLICATE_MATCH_THRESHOLD`
- `STORE_FACE_IMAGES`
- `PURGE_LEGACY_FACE_IMAGES`

## Main Endpoints

Public:
- `GET /api/v1/health`
- `GET /api/v1/liveness/challenge`
- `POST /api/v1/capture`
- `POST /api/v1/capture/auto`

Admin auth:
- `POST /api/v1/admin/login`
- `GET /api/v1/admin/me`

Admin data:
- `GET /api/v1/students`
- `POST /api/v1/register`
- `GET /api/v1/attendance`
- `GET /api/v1/attendance/export.csv`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/analytics/summary`
- `GET /api/v1/audit-logs`
- `POST /api/v1/security/embeddings/re-encrypt`
- `POST /api/v1/students/{student_id}/purge`

## Deployability

The backend is deployable on Render or any container-based Python host.

Recommended:
- Render web service using [Dockerfile](D:\Project Build\Face\backend\Dockerfile)

Not recommended:
- Vercel serverless for this backend, because native computer-vision dependencies are too heavy for that runtime.
