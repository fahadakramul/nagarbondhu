# Personal development workspace setup

Use only an approved source snapshot or authorized private clone. A new editor/Codex conversation needs this repository and its documentation, not old chat history.

## Accounts and tools

Install VS Code, Git, Node.js `22.16.0` with npm and optionally Docker Desktop. Use personal GitHub authentication in Git Credential Manager or GitHub CLI; verify the signed-in account before creating a private destination. Configure `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"` for new commits. Sign into personal Render, Google AI Studio and Expo/EAS only if using those services. Codex and Antigravity should open the approved project directory with personal accounts; copy the instructions in `AGENTS.md` and docs, not account sessions or conversations. No tracked `.vscode` settings or extension recommendations were found; TypeScript, Prisma and Docker editor extensions are optional preferences, not project requirements.

## Local API and web app (PowerShell, repository root)

```powershell
npm.cmd ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api
npm.cmd run build:shared
Copy-Item .env.example apps/api/.env
# Edit apps/api/.env privately: choose memory for ephemeral demo or a personal Postgres URL.
npm.cmd --prefix apps/api run build
npm.cmd run test:api
npm.cmd run dev:api
```

Open `http://localhost:5000/` and `http://localhost:5000/api/v1/health`. If using Postgres, create a personal local database, set `DATABASE_PROVIDER=postgres` and `DATABASE_URL`, then run `npm.cmd --prefix apps/api run prisma:deploy` before starting the API. Do not point local migration/seed commands at the old production DB. `npm.cmd run seed:api` changes the configured database and should be used only for a disposable local environment. Memory mode needs no database but loses changes on restart. The root `.env.example` is a list of placeholders and must be edited before use.

## Optional Expo mobile

```powershell
npm.cmd ci --workspace=@nagarbondhu/mobile --include=dev
Copy-Item apps/mobile/.env.example apps/mobile/.env
# Set EXPO_PUBLIC_APP_SERVER_URL to the reachable personal/local API URL.
npm.cmd run build:shared
npm.cmd run dev:mobile
```

The current mobile app is mainly a WebView of the API-hosted web interface. A phone cannot use your PC's `localhost`; use a reachable LAN or HTTPS development URL. Native microphone/location/image picker behavior requires device testing and appropriate Expo permissions. Before any personal EAS build, review account owner/project ID in `apps/mobile/app.json`, the package identifiers, and backend URL in `apps/mobile/eas.json`. EAS account migration is separate from source copying.

## Optional containers and release checks

`docker compose up --build -d` is present for local PostgreSQL/PostGIS + API, but review and replace tracked development credential-like defaults with private local overrides before use. The Dockerfile uses Node 20 whereas Render pins Node 22.16.0; validate the chosen path. For a release candidate, run the shared/API builds, API suite, browser smoke flows, and a separate Postgres persistence check. The optional `apps/api/scripts/check-persistence.cjs` requires an ignored `.env.persistence-test`; use only a disposable personal database, because it writes test records in an isolated schema.
