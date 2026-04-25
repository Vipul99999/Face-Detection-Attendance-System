# Guidance Docs

## For Demo Day

- Keep lighting even and avoid overexposed webcam frames.
- Use a front-facing camera at eye level.
- Register each student using a single clear photo with one face only.
- Explain that liveness is configurable and may be disabled for faster attendance demos.
- Show both the public scanner and the protected admin panel.

## For Resume and Interview Use

Highlight these parts:
- full-stack ownership
- computer vision integrated into a product workflow
- anti-spoofing and configurable liveness instead of plain face matching
- Docker-based deployment readiness
- admin analytics and CSV export

Suggested talking points:
- why you used SQLite for MVP simplicity
- why liveness is configurable instead of always forced
- why raw face-image storage was disabled by default for privacy
- why encrypted embeddings are safer than plaintext biometric vectors
- how key rotation support helps with long-term security maintenance
- how audit logs help with admin accountability
- how you separated public attendance from admin operations
- how you designed the app for demo reliability

## For Evaluators

Best order to review:
1. Read root `README.md`
2. Run `docker compose up --build`
3. Open public scanner at `http://localhost:8080`
4. Log in as admin
5. Register a student
6. Mark attendance and, if enabled, demonstrate the liveness flow
7. View analytics and export CSV

## For Future Hardening

- replace token auth with JWT or session-backed auth
- move secrets to real cloud secret management
- add HTTPS-only cookie auth for production
- self-host all browser assets on deployment CDN or app server
- add a second anti-spoof model or temporal replay detector
- move audit logs to stronger long-term storage
