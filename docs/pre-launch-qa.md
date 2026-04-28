# FaceCheck Pre-Launch QA Checklist

Use this checklist before sharing your live URL.

---

## 0) Preconditions

- Backend is deployed and reachable.
- Frontend is deployed and uses the correct backend URL (`VITE_API_BASE_URL`).
- At least two people are available for enrollment and test scans.
- Good lighting and camera positioning are available.

---

## 1) Environment & Health Validation

1. Open backend health URL:
   - `https://<your-backend>.onrender.com/health`
2. Open API health URL:
   - `https://<your-backend>.onrender.com/api/v1/health`
3. Confirm in `/api/v1/health` response:
   - `status` is `ok`
   - `face_engine.available` is `true`
   - `anti_spoof.available` is `true` (or known fallback state)

✅ Pass criteria:
- API responds 200 and reports usable face engine.

---

## 2) Admin Login + Protected Access

1. Open frontend live URL.
2. Click **Admin Login**.
3. Sign in with deployed admin credentials.
4. Confirm you can access:
   - Admin Panel
   - Register page
5. Log out and confirm protected pages redirect to login.

✅ Pass criteria:
- Auth works and protected routes are enforced.

---

## 3) Registration Flow (Critical)

1. Log in as admin.
2. Open **Register** page.
3. Register Person A with a clear frontal image.
4. Register Person B with a clear frontal image.
5. Verify both users appear in student list/panel.

Negative checks:
- Try uploading invalid/non-image file.
- Try re-registering same person image (duplicate face scenario).

✅ Pass criteria:
- Valid users register successfully.
- Invalid upload and duplicates return meaningful errors.

---

## 4) Face Recognition Attendance (Critical)

1. Open public **Scanner** page.
2. Start camera.
3. Scan Person A.
4. Confirm response is success and Person A appears in recent results.
5. Scan Person B.
6. Confirm response is success and Person B appears in recent results.

✅ Pass criteria:
- Known registered users are matched correctly with success responses.

---

## 5) Duplicate Cooldown Behavior

1. Immediately rescan Person A right after successful mark.
2. Confirm response status indicates duplicate (attendance not re-marked).
3. Wait beyond `ATTENDANCE_COOLDOWN_MINUTES`.
4. Scan Person A again.
5. Confirm attendance is marked again after cooldown.

✅ Pass criteria:
- Rapid repeat scan is blocked; post-cooldown scan succeeds.

---

## 6) Liveness Challenge (if ENABLE_LIVENESS_CHECKS=true)

1. Enable liveness in backend env and redeploy.
2. Open scanner page and start camera.
3. Observe challenge instruction (blink / turn action).
4. Complete challenge and scan.
5. Confirm successful attendance capture.

Negative checks:
- Start scan but do not complete liveness action.
- Confirm capture does not proceed as valid success.

✅ Pass criteria:
- Liveness challenge gates attendance correctly.

---

## 7) CSV Export Validation

1. Log in as admin.
2. Open attendance list.
3. Trigger **Export CSV**.
4. Open CSV file and verify:
   - Header columns are correct.
   - Contains recent entries (Person A / Person B).
   - Timestamps look valid.

✅ Pass criteria:
- CSV downloads and data matches dashboard records.

---

## 8) Audit Logs / Security Operations

1. Open audit logs view.
2. Confirm recent actions exist (login, registration, export).
3. (Optional) run embedding re-encryption from admin area.
4. Verify system remains operational after operation.

✅ Pass criteria:
- Audit trail and security actions are available without breaking primary flow.

---

## 9) Cross-Browser Smoke Test

Run scanner + login + one attendance capture on:
- Chrome (desktop)
- Edge (desktop)
- Mobile browser (optional)

✅ Pass criteria:
- Camera permission flow and attendance capture are reliable.

---

## 10) Final Go/No-Go Checklist

- [ ] Health endpoints are green.
- [ ] Admin login works.
- [ ] Registration works for 2+ users.
- [ ] Recognition works for known users.
- [ ] Duplicate cooldown works.
- [ ] Liveness works (if enabled).
- [ ] CSV export works.
- [ ] Audit logs visible.
- [ ] Public demo URL loads correctly.

If all are checked, FaceCheck is ready to share.
