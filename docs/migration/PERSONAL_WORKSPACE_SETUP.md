# Personal development workspace setup

The existing personal repository is `fahadakramul/nagarbondhu`. Open the existing checkout on the same PC or clone that same repository on another PC after the approved documentation commit is pushed. A new Codex conversation needs this repository and its documentation, not old chat history.

## Accounts and tools

Install VS Code, Git, Node.js `22.16.0` with npm and optionally Docker Desktop. Sign into personal Codex and personal GitHub; verify that `origin` is `https://github.com/fahadakramul/nagarbondhu.git` and that `git status -sb` shows the expected branch. Configure Git author name/email for new commits. Continue using the existing personal Render, Google AI Studio and Expo/EAS accounts only if those services are needed. In personal Codex, open this project folder and start a new chat using `AGENTS.md` and `docs/migration/PROJECT_HANDOFF_CONTEXT.md` as context; old workspace chat history and sign-ins do not follow the folder. No tracked `.vscode` settings or extension recommendations were found; TypeScript, Prisma and Docker editor extensions are optional preferences, not project requirements.

## Local API and web app (PowerShell, repository root)

```powershell
npm.cmd ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api
npm.cmd run build:shared
Copy-Item .env.example apps/api/.env
# Edit apps/api/.env privately: choose memory for ephemeral demo or a local Postgres URL.
npm.cmd --prefix apps/api run build
npm.cmd run test:api
npm.cmd run dev:api
```

Open `http://localhost:5000/` and `http://localhost:5000/api/v1/health`. If using Postgres, create a local development database, set `DATABASE_PROVIDER=postgres` and `DATABASE_URL`, then run `npm.cmd --prefix apps/api run prisma:deploy` before starting the API. Do not point local migration/seed commands at the existing production DB. `npm.cmd run seed:api` changes the configured database and should be used only for a disposable local environment. Memory mode needs no database but loses changes on restart. The root `.env.example` is a list of placeholders and must be edited before use.

## Optional Expo mobile

```powershell
npm.cmd ci --workspace=@nagarbondhu/mobile --include=dev
Copy-Item apps/mobile/.env.example apps/mobile/.env
# Set EXPO_PUBLIC_APP_SERVER_URL to the existing Render URL or a reachable local API URL.
npm.cmd run build:shared
npm.cmd run dev:mobile
```

The current mobile app is mainly a WebView of the API-hosted web interface. A phone cannot use your PC's `localhost`; use a reachable LAN or HTTPS development URL. Native microphone/location/image picker behavior requires device testing and appropriate Expo permissions. The existing EAS project and Render URL can remain in use. Review account owner/project ID in `apps/mobile/app.json`, package identifiers and backend URL in `apps/mobile/eas.json` before a new build.

## Optional containers and release checks

`docker compose up --build -d` is present for local PostgreSQL/PostGIS + API, but review and replace tracked development credential-like defaults with private local overrides before use. The Dockerfile uses Node 20 whereas Render pins Node 22.16.0; validate the chosen path. For a release candidate, run the shared/API builds, API suite, browser smoke flows, and a separate Postgres persistence check. The optional `apps/api/scripts/check-persistence.cjs` requires an ignored `.env.persistence-test`; use only a disposable personal database, because it writes test records in an isolated schema.
