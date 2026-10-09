# Render deployment

The Render Blueprint is `render.yaml` in the repository root. Push the project
to a GitHub/GitLab repository, then create a Blueprint in Render from that
repository. It creates a free Node web service and generates a JWT signing secret.
Keep Root Directory empty because the API needs `packages/shared`.

For a manually created Web Service, use:

- Build: `npm ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api && npm run build:shared && npm --prefix apps/api run build`
- Start: `npm --prefix apps/api run start:render`
- Health check: `/api/v1/health`
- Environment: `NODE_ENV=production`, `NODE_VERSION=22.16.0`, a random `JWT_SECRET`, `DATABASE_PROVIDER=postgres`, and the private Render PostgreSQL internal connection URL in `DATABASE_URL`.
- Optional: `GEMINI_API_KEY` to enable live Gemini analysis. Otherwise the existing heuristic analyzer runs.

After the service is live, verify `/`, `/api/v1/health`, login, reports, and image
upload on its actual HTTPS URL. Set `EXPO_PUBLIC_APP_SERVER_URL` in
`apps/mobile/.env` to that URL. Both the WebView and API client use this setting.
Configure the same value in EAS build environment variables before rebuilding
an APK; an already installed APK keeps its previous URL.

## Data retention

Postgres mode now persists accounts, reports, drafts, action plans, progress and audit events through Prisma. Mutations commit before returning success, failed writes restore the cache, and startup errors do not silently fall back to memory. Keep one API instance: the compatibility cache does not support independent replicas or direct database edits while running. Restart after out-of-band changes. `DATABASE_PROVIDER=memory` remains an explicit local/demo option that resets on restart.

JPEG/PNG/WebP uploads (maximum 4 MB) are stored as PostgreSQL bytes and retain their existing `/uploads/...` URLs. External photo URLs remain dependent on their external host. Photo storage shares the free database's 1 GB capacity.

The start command runs Prisma migrations. `202610090001_action_workflow` is an initial migration for a fresh database because the project had no committed migrations. Inspect and baseline an existing SQL database before deployment; never reset production tables. Render free PostgreSQL expires after 30 days. The created `nagarbondhu-db` expires **8 November 2026**; export/migrate data or upgrade before expiry.

The installed WebView APK already uses this hosted URL, so these server UI changes require no APK rebuild.

For an opt-in real database smoke check, create ignored `apps/api/.env.persistence-test` with `DATABASE_URL` and run `node scripts/check-persistence.cjs` from `apps/api` after building. It migrates and uses a separate `workflow_smoke_test` schema, verifies reconnect persistence for drafts/plans/audit/photos/receipts/feedback/notices and transactional FK rejection. It retains its isolated test records for inspection and does not delete production data.

The existing role toggle opens the public demo planning view. In production this account is read-only; sensitive writes require a provisioned operator account. JWT roles are resolved from stored users, and registration always grants CITIZEN. See [full platform upgrade](full-platform-upgrade.md) for server-only operator provisioning and the inline dashboard session. Separate login screens remain deferred. Ward centres are approximate; boundaries need admin verification. No commissioner names are seeded; generic teams are labelled DEMO. No external notifications are sent.

Render free services can sleep during inactivity, so the first app load may take
longer. See https://render.com/docs/free for current limits.

The additive `202610100001_citizen_tracking` migration preserves the already deployed database and adds citizen receipt/feedback/notice tables. Existing start commands apply it automatically.
