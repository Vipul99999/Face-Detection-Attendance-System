# Project Docs

## Goal

Build a deployable face-recognition attendance system that is:
- easy to demo
- understandable to recruiters and evaluators
- practical for a final-year major project
- strong enough to show product thinking, not just model usage

## Core Modules

### Frontend

- public attendance scanner
- admin login
- admin dashboard
- student registration page
- camera flow and live scan feedback

### Backend

- FastAPI API
- face recognition engine
- anti-spoof checks
- optional liveness validation
- SQLite persistence
- admin auth and audit logs

## Main Flows

### Attendance Flow

1. User opens the public scanner.
2. Camera starts.
3. If liveness is enabled, the frontend requests one quick live action.
4. The frontend uploads the frame to `/api/v1/capture/auto`.
5. Backend validates image quality, anti-spoof checks, and face match.
6. Attendance is either marked, returned as duplicate, or rejected with a structured error.

### Registration Flow

1. Admin logs in.
2. Admin uploads or captures a student image.
3. Backend validates image quality and duplicate checks.
4. Student embedding is stored in encrypted form.

### Admin Operations

- view attendance
- export CSV
- inspect analytics
- inspect audit logs
- purge student biometric data
- re-encrypt embeddings

## Data Model

SQLite tables:
- `users`
- `attendance`
- `admins`
- `audit_logs`
- `admin_login_attempts`

Stored artifacts:
- encrypted embeddings in SQLite
- raw face images only if explicitly enabled
- anti-spoof model under `backend/models`
- browser liveness assets under `frontend/public/models`

## Security Design

- protected admin routes
- persistent admin session in frontend
- signed admin tokens
- login rate limiting
- encrypted embeddings at rest
- re-encryption support for key rotation
- anti-spoof checks on the backend
- optional liveness checks
- audit logging for sensitive admin actions
- password re-authentication before biometric purge

## Operational Notes

- liveness is configurable with `ENABLE_LIVENESS_CHECKS`
- liveness is optional by default for faster attendance capture
- duplicate attendance is blocked during the cooldown window
- SQLite is fine for demos and small deployments, but not ideal for high-scale production

## Known Limits

- face recognition quality depends on lighting, pose, and registration image quality
- anti-spoofing and liveness are MVP-grade, not bank-grade identity proofing
- SQLite is single-node local storage
- Render free tier sleep behavior can slow cold starts
