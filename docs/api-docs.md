# API Docs

## Base URLs

Local:
- backend root: `http://localhost:8000`
- API root: `http://localhost:8000/api/v1`

## Response Style

Success responses return normal JSON payloads.

Structured errors return:

```json
{
  "status": "error",
  "message": "Human readable message",
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "details": {}
  }
}
```

## Public Endpoints

### `GET /health`

Simple service health.

### `GET /api/v1/health`

Returns:
- app status
- face engine state
- anti-spoof state
- liveness enabled state
- privacy mode
- registered user count
- attendance count

### `GET /api/v1/liveness/challenge`

Behavior:
- if liveness is disabled, returns `status: "disabled"`
- if enabled, returns one quick challenge step and token

Example enabled response:

```json
{
  "status": "success",
  "challenge": {
    "token": "token",
    "steps": ["blink"],
    "expires_at": "2026-04-24T10:00:00+00:00"
  },
  "instructions": "Complete the active liveness challenge before attendance capture."
}
```

### `POST /api/v1/capture`
### `POST /api/v1/capture/auto`

Attendance capture endpoint.

Form fields:
- `file` required
- `liveness_token` optional unless liveness is enabled
- `liveness_proof` optional unless liveness is enabled

Possible outcomes:
- `success`
- `duplicate`
- structured error

## Admin Authentication

### `POST /api/v1/admin/login`

Form fields:
- `username`
- `password`

Returns:
- token
- admin profile

Can return:
- `401` invalid credentials
- `429` login rate limited

### `GET /api/v1/admin/me`

Header:
- `Authorization: Bearer <token>`

## Admin Endpoints

### `GET /api/v1/students`

Lists registered students.

### `POST /api/v1/register`

Registers one student.

Form fields:
- `name`
- `file`

Can return:
- `400` invalid name or invalid image
- `409` duplicate student or duplicate face

### `GET /api/v1/attendance`

Returns attendance records ordered by newest first.

### `GET /api/v1/attendance/export.csv`

Downloads attendance CSV.

### `GET /api/v1/dashboard/summary`

Dashboard counters for admin panel.

### `GET /api/v1/analytics/summary`

Analytics overview.

Optional query:
- `date=YYYY-MM-DD`

### `GET /api/v1/audit-logs`

Returns recent audit log entries.

### `POST /api/v1/security/embeddings/re-encrypt`

Rewrites stored embeddings using the current active encryption key.

### `POST /api/v1/students/{student_id}/purge`

Deletes the student and related biometric attendance data.

Form field:
- `confirm_password`

## Common Error Codes

- `INVALID_IMAGE`
- `FACE_CAPTURE_REJECTED`
- `FACE_NOT_RECOGNIZED`
- `ANTI_SPOOF_REJECTED`
- `INVALID_CREDENTIALS`
- `LOGIN_RATE_LIMITED`
- `AUTH_REQUIRED`
- `SESSION_EXPIRED`
- `STUDENT_ALREADY_REGISTERED`
- `DUPLICATE_FACE_MATCH`
- `REAUTH_FAILED`
- `STUDENT_NOT_FOUND`
- `LIVENESS_REQUIRED`
- `LIVENESS_CHALLENGE_INVALID`
- `LIVENESS_STEP_MISSING`

## Debugging Notes

If `capture/auto` returns `400`, the likely causes are:
- invalid image payload
- no usable face extracted
- frame quality rejected
- liveness proof rejected, if liveness is enabled

If `register` returns `409`, the likely causes are:
- same student name already exists
- same face is already registered
