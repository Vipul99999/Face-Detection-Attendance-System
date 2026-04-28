# Face Detection Attendance System

Full-stack face-recognition attendance project with a public scanner flow, protected admin workspace, student registration, analytics, CSV export, encrypted biometric embeddings, anti-spoof checks, and Docker-based deployment.

## Live Link

[Live Link](https://face-check-six.vercel.app/)

---

## Live Demo

![Live Demo](./FaceCheck-Demo1.mp4)

---

## What The Project Does

- Students use a public attendance scanner without creating accounts.
- Admins log in to register students, review attendance, export CSVs, inspect audit logs, and manage biometric data.
- Face matching runs on the backend with InsightFace.
- Attendance duplicate protection prevents repeated marking within the cooldown window.
- Raw face images are disabled by default; encrypted embeddings are stored in SQLite.
- Backend anti-spoof checks are enabled.
- Liveness is configurable and currently optional by default for faster attendance scans.

---

## Current Status

The project is deployable.

Recommended deployment options:
- Local demo / college presentation: `docker compose up --build`
- Public hosting: frontend on Vercel, backend on Render
- Full-stack container hosting: backend on Render, frontend on Render or any static host

Not recommended:
- Running the Python backend on Vercel serverless functions. The backend depends on OpenCV, InsightFace, and ONNX Runtime, which are a much better fit for a container host like Render.

---

## Minimum-Cost Deployment Path

Use this if you want the simplest deployable setup with persistent SQLite storage and the lowest ongoing cost that still keeps your data.

### Recommended split

- Frontend on Vercel free tier
- Backend on Render starter plan
- SQLite on a Render persistent disk

### Why this is the cheapest practical path

- Vercel can host the frontend for free
- Render backend needs a paid plan if you want persistent disk support for SQLite
- you do not need Postgres or `DATABASE_URL` for this project right now

### Very simple deployment steps

1. Push this repo to GitHub.
2. Deploy backend on Render using [render.yaml](D:\Project Build\Face\render.yaml).
3. Let Render create the persistent disk mounted at `/app/data`.
4. Confirm backend health at `/api/v1/health`.
5. Deploy frontend on Vercel from the `frontend` folder.
6. Set `VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1` in Vercel.
7. Open frontend, log in, register one student, and test attendance.

## Tech Stack

Frontend:
- React
- Vite
- Tailwind CSS
- Axios
- React Router

Backend:
- FastAPI
- SQLite
- OpenCV
- InsightFace
- ONNX Runtime

Security / product features:
- signed admin access tokens
- login rate limiting
- encrypted embeddings at rest
- embedding re-encryption flow
- audit logs
- biometric purge workflow

## Repository Structure

```text
frontend/     React + Vite frontend
backend/      FastAPI backend
docs/         project, API, deployment, and guidance docs
docker-compose.yml
render.yaml
```

## Main User Flows

### Attendance Flow

1. Open the public scanner page.
2. Start the camera.
3. If liveness is enabled, complete one quick live action.
4. Backend validates the frame, runs anti-spoof checks, extracts the embedding, and matches it.
5. Attendance is marked if the user is recognized and not inside the cooldown window.

### Admin Flow

1. Go to `/admin/login`.
2. Log in with admin credentials.
3. Open the admin panel.
4. Register students, inspect attendance, export CSVs, or purge biometric data.

## Local Development

### Option 1: Run With Docker

Requirements:
- Docker Desktop running

Commands:

```powershell
cd "D:\Project Build\Face"
docker compose up --build
```

URLs:
- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- API health: `http://localhost:8000/api/v1/health`

### Option 2: Run Frontend And Backend Separately

Backend:

```powershell
cd "D:\Project Build\Face\backend"
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd "D:\Project Build\Face\frontend"
npm install
npm run dev
```

Default URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Environment Variables

### Backend

Important backend variables:

- `APP_ENV`
- `APP_HOST`
- `APP_PORT`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `AUTH_RATE_LIMIT_WINDOW_SECONDS`
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS`
- `AUTH_TOKEN_EXPIRY_HOURS`
- `EMBEDDING_ENCRYPTION_KEY`
- `PREVIOUS_EMBEDDING_ENCRYPTION_KEYS`
- `ENABLE_LIVENESS_CHECKS`
- `LIVENESS_SECRET`
- `LIVENESS_TOKEN_EXPIRY_SECONDS`
- `ANTI_SPOOF_MODEL_PATH`
- `ANTI_SPOOF_THRESHOLD`
- `DATABASE_PATH`
- `UPLOAD_DIR`
- `STORE_FACE_IMAGES`
- `PURGE_LEGACY_FACE_IMAGES`
- `ATTENDANCE_COOLDOWN_MINUTES`
- `FACE_MATCH_THRESHOLD`
- `DUPLICATE_MATCH_THRESHOLD`
- `CORS_ORIGINS`

Recommended production values:
- set strong secrets for `AUTH_SECRET`, `EMBEDDING_ENCRYPTION_KEY`, and `LIVENESS_SECRET`
- change default admin credentials
- keep `STORE_FACE_IMAGES=false` unless you explicitly need raw image retention
- start with `ENABLE_LIVENESS_CHECKS=false` if you want the fastest attendance demo

### Frontend

- `VITE_API_BASE_URL`

Examples:
- local Vite dev: `http://localhost:8000/api/v1`
- Docker / same-origin proxy setup: `/api/v1`
- deployed frontend talking to Render backend: `https://your-backend.onrender.com/api/v1`

## Docker Images

The repo already includes:
- [backend/Dockerfile](D:\Project Build\Face\backend\Dockerfile)
- [frontend/Dockerfile](D:\Project Build\Face\frontend\Dockerfile)

Compose now builds tagged images:
- `face-attendance-backend:latest`
- `face-attendance-frontend:latest`

Build manually:

```powershell
cd "D:\Project Build\Face\backend"
docker build -t face-attendance-backend:latest .

cd "D:\Project Build\Face\frontend"
docker build -t face-attendance-frontend:latest --build-arg VITE_API_BASE_URL=/api/v1 .
```

Build via Compose:

```powershell
cd "D:\Project Build\Face"
docker compose build
```

## Deployment

### Is It Deployable?

Yes.

Best production split:
- frontend on Vercel
- backend on Render

Also workable:
- both frontend and backend on Render

### Render Backend

Use:
- [render.yaml](D:\Project Build\Face\render.yaml)
- [backend/Dockerfile](D:\Project Build\Face\backend\Dockerfile)

Set backend secrets in Render:
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `EMBEDDING_ENCRYPTION_KEY`
- `LIVENESS_SECRET`

Recommended additional backend env vars:
- `ENABLE_LIVENESS_CHECKS=false`
- `STORE_FACE_IMAGES=false`
- `DATABASE_PATH=/app/data/face_attendance.db`
- `UPLOAD_DIR=/app/data/images`

Important note:
- Render free instances can sleep.
- SQLite on ephemeral disks is not ideal for serious production.
- For demos, Render is fine. For long-term usage, move persistence to a managed database and durable storage.

### Vercel Frontend

Use:
- [frontend/vercel.json](D:\Project Build\Face\frontend\vercel.json)

Set:
- `VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1`

Build settings:
- framework preset: `Vite`
- root directory: `frontend`

### Full Render Setup

If you deploy both services on Render:
- deploy backend first
- copy backend public URL
- set frontend `VITE_API_BASE_URL` to `https://your-backend.onrender.com/api/v1`

### Why Not Backend On Vercel?

The backend uses:
- OpenCV
- InsightFace
- ONNX Runtime

These are heavy native dependencies and are not a good match for Vercel serverless execution. Use Render or another container-based Python host instead.

## Verification Checklist

After local run or deployment:

1. Open `/api/v1/health`
2. Confirm `face_engine.available` is `true`
3. Confirm frontend loads and can reach backend
4. Log in as admin
5. Register one student
6. Take attendance successfully
7. Confirm duplicate attendance returns duplicate state instead of new mark
8. Export attendance CSV
9. Confirm admin audit logs load

## Common Issues

### `POST /api/v1/register` returns `409`

Usually means:
- same student name already exists
- same face is already registered

### `POST /api/v1/capture/auto` returns `400`

Usually means:
- no face detected
- frame is too blurry or poorly lit
- backend face quality checks rejected the frame
- liveness is still enabled and the proof was rejected

Check:
- `/api/v1/health`
- camera framing
- backend restart after config changes

### Attendance does not mark even after registration

Likely causes:
- backend process is still running with old config
- face match threshold is too strict for your environment
- the registered image and live camera image are too different

## Documentation

- [docs/README.md](D:\Project Build\Face\docs\README.md)
- [docs/project-docs.md](D:\Project Build\Face\docs\project-docs.md)
- [docs/api-docs.md](D:\Project Build\Face\docs\api-docs.md)
- [docs/deployment-docs.md](D:\Project Build\Face\docs\deployment-docs.md)
- [docs/guidance-docs.md](D:\Project Build\Face\docs\guidance-docs.md)

## Resume-Friendly Summary

Built a deployable face-recognition attendance system using React, Vite, FastAPI, SQLite, OpenCV, InsightFace, and ONNX Runtime, with protected admin workflows, encrypted biometric embeddings, anti-spoof detection, configurable liveness checks, audit logs, biometric purge, analytics dashboards, CSV export, Docker images, and Render/Vercel deployment support.
