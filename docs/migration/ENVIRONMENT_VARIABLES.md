# Environment variables

Values below are descriptions only. Keep the current ignored `.env`, `credentials.json`, service settings and production connection string out of Git and Codex handoff text. The existing personal Render service can retain its current private values. Root `.env.example` and `apps/mobile/.env.example` contain placeholders. The API loads `apps/api/.env`; Render supplies variables through its service environment. Rows calling for a new service, key or URL reflect the superseded deployment proposal, not a requirement for this workflow handoff.

| Name | Role / migration action |
| --- | --- |
| `PORT` | HTTP port; Render supplies one, local default is 5000. |
| `NODE_ENV` | Set `production` on deployed service; production requires `JWT_SECRET`. |
| `DATABASE_PROVIDER` | `postgres` for durable deployment; `memory` only for temporary local demo. |
| `DATABASE_URL` | Private Postgres URL from new personal database. Never commit/print. |
| `JWT_SECRET` | New high-entropy secret in personal service. Rotation can invalidate sessions and receipt-related capabilities; plan data continuity separately. |
| `JWT_EXPIRES_IN` | Token lifetime; default is 7 days. |
| `GEMINI_API_KEY` | New personal server-side Gemini key. Optional for labelled heuristic fallback. |
| `GEMINI_MODEL` | Model name. Check current API availability/quota in personal Google project. |
| `OPERATOR_EMAIL`, `OPERATOR_NAME`, `OPERATOR_PASSWORD_HASH` | Private operator provisioning; create a new account/hash. Never store plaintext password in env or docs. |
| `MAX_DUPLICATE_DISTANCE_METERS` | Duplicate proximity threshold; default 300. |
| `STORAGE_PROVIDER`, `UPLOAD_DIR` | Upload configuration; inspect target behavior before using non-default storage. Postgres image bytes are used in persistent mode. |
| `PUBLIC_BASE_URL` | Public URL for server-generated links; set to new personal HTTPS URL. |
| `RAIN_ALERT_MM` | Rain queue threshold; optional. |
| `PRIORITY_SEVERITY_WEIGHT`, `PRIORITY_AGE_WEIGHT`, `PRIORITY_EVIDENCE_WEIGHT` | Optional nonnegative weights summing to one; change only with product validation. |
| `EXPO_PUBLIC_APP_SERVER_URL` | Mobile build-time backend URL. It is public, not a secret. Update both local mobile env and EAS build profile when migrating. |
| `NODE_VERSION` | Render runtime pin in Blueprint. |
| `RENDER_GIT_COMMIT` | Render-provided release metadata read by health endpoint; do not set manually. |

`apps/api/.env` currently exists locally and contains secret-bearing names; its values were not placed in these docs. `apps/api/credentials.json` also exists and is ignored. Both must stay outside any portable copy. `apps/api/.env.persistence-test` is an optional ignored test file and can contain a DB connection. Existing sample/default literals in tracked configuration require history review before a mirror.
