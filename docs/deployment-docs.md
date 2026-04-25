# Deployment Docs

## Is This Project Deployable?

Yes.

Recommended deployment model:
- frontend on Vercel
- backend on Render

Alternative:
- frontend on Render
- backend on Render

Best local demo model:
- Docker Compose

## Why This Split Works

Frontend:
- static React/Vite app
- ideal for Vercel or static hosting

Backend:
- uses FastAPI, OpenCV, InsightFace, and ONNX Runtime
- best deployed as a containerized Python service
- Render is a practical fit

## Local Docker Deployment

Requirements:
- Docker Desktop running

Commands:

```powershell
cd "D:\Project Build\Face"
docker compose up --build
```

URLs:
- frontend: `http://localhost:8080`
- backend: `http://localhost:8000`

Compose file:
- [docker-compose.yml](D:\Project Build\Face\docker-compose.yml)

## Docker Images

Build via Compose:

```powershell
docker compose build
```

Tagged images:
- `face-attendance-backend:latest`
- `face-attendance-frontend:latest`

Build individually:

```powershell
cd "D:\Project Build\Face\backend"
docker build -t face-attendance-backend:latest .

cd "D:\Project Build\Face\frontend"
docker build -t face-attendance-frontend:latest --build-arg VITE_API_BASE_URL=/api/v1 .
```

## Render Deployment

Files used:
- [render.yaml](D:\Project Build\Face\render.yaml)
- [backend/Dockerfile](D:\Project Build\Face\backend\Dockerfile)
- [frontend/Dockerfile](D:\Project Build\Face\frontend\Dockerfile)

### Backend On Render

Use a web service with Docker.

Set secrets:
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `EMBEDDING_ENCRYPTION_KEY`
- `LIVENESS_SECRET`

Recommended backend env vars:
- `APP_ENV=production`
- `ENABLE_LIVENESS_CHECKS=false`
- `STORE_FACE_IMAGES=false`
- `DATABASE_PATH=/app/data/face_attendance.db`
- `UPLOAD_DIR=/app/data/images`

Important note:
- SQLite on ephemeral storage is acceptable for demos, not robust production persistence.

### Frontend On Render

Set:
- `VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1`

Important:
- The frontend service must point to the backend public URL.
- [render.yaml](D:\Project Build\Face\render.yaml) now expects `VITE_API_BASE_URL` to be set.

## Vercel Frontend Deployment

Use:
- [frontend/vercel.json](D:\Project Build\Face\frontend\vercel.json)

Settings:
- framework preset: `Vite`
- root directory: `frontend`
- build command: default Vite build

Set env var:
- `VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1`

## Is Backend Deployable On Vercel?

Not recommended.

Reason:
- backend relies on heavy native CV dependencies
- serverless execution is a poor fit for InsightFace and ONNX Runtime

Use Render for the backend instead.

## Post-Deploy Checklist

1. Confirm backend `/health`
2. Confirm backend `/api/v1/health`
3. Confirm frontend can call the backend
4. Log in to admin panel
5. Register one student
6. Mark attendance
7. Confirm duplicate attendance behavior
8. Test CSV export
9. Confirm audit log screen works

## Common Deployment Mistakes

### Frontend cannot reach backend

Usually:
- `VITE_API_BASE_URL` is missing or wrong

### Attendance works locally but not after deploy

Usually:
- backend models are missing
- backend cold start delay on free hosting
- wrong CORS origin
- old container still running with old config

### Data disappears after redeploy

Usually:
- SQLite is on ephemeral container storage

For serious persistence, use a durable volume or move to a managed database.
