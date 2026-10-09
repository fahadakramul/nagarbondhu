# Render deployment

The Render Blueprint is `render.yaml` in the repository root. Push the project
to a GitHub/GitLab repository, then create a Blueprint in Render from that
repository. It creates a free Node web service and generates a JWT signing secret.
Keep Root Directory empty because the API needs `packages/shared`.

For a manually created Web Service, use:

- Build: `npm ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api && npm run build:shared && npm --prefix apps/api run build`
- Start: `npm run start:api`
- Health check: `/api/v1/health`
- Environment: `NODE_ENV=production`, `NODE_VERSION=22.16.0`, and a random `JWT_SECRET`.
- Optional: `GEMINI_API_KEY` to enable live Gemini analysis. Otherwise the existing heuristic analyzer runs.

After the service is live, verify `/`, `/api/v1/health`, login, reports, and image
upload on its actual HTTPS URL. Set `EXPO_PUBLIC_APP_SERVER_URL` in
`apps/mobile/.env` to that URL. Both the WebView and API client use this setting.
Configure the same value in EAS build environment variables before rebuilding
an APK; an already installed APK keeps its previous URL.

## Data retention

The current repository uses an in-memory database, including in production.
`DATABASE_URL` does not currently enable PostgreSQL persistence. New accounts,
reports, and changes reset when the server restarts. Uploaded files use Render's
ephemeral filesystem and can also disappear. The free service is suitable for
the current demo; durable storage requires implementing a database repository
and persistent image storage before collecting real reports.

Render free services can sleep during inactivity, so the first app load may take
longer. See https://render.com/docs/free for current limits.
