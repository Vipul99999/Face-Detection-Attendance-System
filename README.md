# FaceCheck

FaceCheck is a full-stack face-recognition attendance platform with a public scanner flow and a protected admin workspace.
It is designed for real-world demos and portfolio deployment, with secure biometric handling, anti-spoof checks, optional active liveness, analytics, and CSV exports.

---

## Highlights

- **Public scanning flow** (no student account required)
- **Admin-controlled onboarding** (register students, view attendance, export CSV)
- **Face matching with InsightFace embeddings**
- **Duplicate attendance cooldown protection**
- **Anti-spoof checks** plus optional **active liveness challenge**
- **Encrypted embeddings at rest**
- **SQLite storage** (simple local setup, Render disk-compatible)
- **Dockerized backend/frontend for reproducible deployment**

---

## Repository Structure

```text
frontend/     React + Vite + Tailwind UI
backend/      FastAPI services, face pipeline, auth, DB
docs/         API, deployment, and implementation notes
docker-compose.yml
render.yaml
```

---

## System Architecture

### Frontend
- React + Vite
- Camera capture and liveness interaction in reusable UI components
- Axios-based API client for public and authenticated admin routes

### Backend
- FastAPI REST API
- Face embedding extraction and matching
- Anti-spoof analysis and liveness validation hooks
- Admin authentication + rate limiting
- SQLite persistence for users, attendance, and audit logs

---

## Core Flows

### 1) Attendance Capture Flow
1. User opens scanner and starts camera.
2. If liveness is enabled, user completes one active challenge.
3. Backend validates image quality and anti-spoof status.
4. Backend extracts embedding and finds best match.
5. Attendance is marked if recognized and outside cooldown window.

### 2) Admin Flow
1. Admin signs in.
2. Registers students from the protected workspace.
3. Reviews attendance, analytics, and audit logs.
4. Exports attendance/audit records as CSV.

---

## Local Development

## Requirements
- Python 3.10+
- Node.js 18+
- npm

### Backend (local)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

### Local URLs
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/v1`
- Health: `http://localhost:8000/api/v1/health`

---

## Environment Variables

### Backend (important)

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
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

### Frontend

- `VITE_API_BASE_URL`

Examples:
- local: `http://localhost:8000/api/v1`
- deployed frontend to Render backend: `https://<your-backend>.onrender.com/api/v1`

---

## Documentation Index

- Deployment + setup: this README
- QA runbook: [`docs/pre-launch-qa.md`](docs/pre-launch-qa.md)
- API docs: [`docs/api-docs.md`](docs/api-docs.md)

---

## Deployment (Render + Vercel)

## Recommended Production Split
- **Backend**: Render (Docker web service + persistent disk)
- **Frontend**: Vercel (static Vite deployment)

### A) Deploy Backend on Render

1. Push repository to GitHub.
2. In Render, create a **Web Service** from the repo (Docker runtime).
3. Use `backend/Dockerfile`.
4. Add a **persistent disk** and mount at `/app/data`.
5. Set environment variables (minimum):
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET`
   - `EMBEDDING_ENCRYPTION_KEY`
   - `LIVENESS_SECRET`
   - `DATABASE_PATH=/app/data/face_attendance.db`
   - `UPLOAD_DIR=/app/data/images`
   - `ENABLE_LIVENESS_CHECKS=false` (start simple)
   - `STORE_FACE_IMAGES=false`
6. Deploy and verify:
   - `GET https://<backend>.onrender.com/health`
   - `GET https://<backend>.onrender.com/api/v1/health`

### B) Deploy Frontend on Vercel

1. Import the repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable:
   - `VITE_API_BASE_URL=https://<backend>.onrender.com/api/v1`
6. Deploy and test login + scanner flows.

---

## Deploy Now (Fast Path)

1. Deploy backend to Render using `backend/Dockerfile` and attach disk at `/app/data`.
2. Set backend env vars: `ADMIN_PASSWORD`, `AUTH_SECRET`, `EMBEDDING_ENCRYPTION_KEY`, `LIVENESS_SECRET`, `DATABASE_PATH=/app/data/face_attendance.db`, `UPLOAD_DIR=/app/data/images`.
3. Deploy frontend to Vercel from `frontend/` with `VITE_API_BASE_URL=https://<backend>.onrender.com/api/v1`.
4. Run the full QA checklist from [`docs/pre-launch-qa.md`](docs/pre-launch-qa.md).

---

## Face Recognition Verification Checklist

Before sharing your live link, verify in this order:

1. **Health check** returns `status: ok` and `face_engine.available`.
2. Register at least 2 people with clear frontal photos.
3. Perform scanner captures for each registered user.
4. Confirm duplicate cooldown behavior (`status: duplicate`) when rescanning quickly.
5. Verify attendance rows appear in admin table.
6. Export attendance CSV and confirm latest records.
7. If enabled, verify liveness challenge can be completed and accepted.

### If recognition appears weak
- Improve lighting and face framing.
- Re-register users using sharp, front-facing images.
- Tune `FACE_MATCH_THRESHOLD` carefully (default may be strict for noisy webcam images).
- Ensure anti-spoof threshold is not overly aggressive for your camera conditions.

---

## Operational Notes

- Backend on Vercel serverless is **not recommended** due to OpenCV/InsightFace/ONNX runtime constraints.
- Render free instances may sleep; expect cold starts.
- SQLite is sufficient for demos; use managed DB/storage for long-term production.

---

## License

Use and modify according to your project requirements.
