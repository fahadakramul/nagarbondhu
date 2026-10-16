# NagarBondhu AI agent guide

Read `README.md` and `docs/migration/PROJECT_HANDOFF_CONTEXT.md` before changing the app. Source is a Node/npm monorepo: API/web in `apps/api`, Expo WebView in `apps/mobile`, shared types in `packages/shared`. Preserve Bengali-first UI, clear real-versus-demo labels, privacy boundaries and provider attribution.

Use additive Prisma migrations. Production runs a single API instance because of the process-local repository cache. Keep API keys server-side; never print or commit `.env`, `credentials.json`, database exports or citizen uploads. Tests: `npm.cmd run build:shared`, `npm.cmd --prefix apps/api run build`, `npm.cmd run test:api` from the repository root. Review `render.yaml` before deployment.

Workflow handoff boundary: the owner confirms the existing `fahadakramul/nagarbondhu` repository, local checkout and Render services are personal. The current history includes credential-like development configuration and a tracked upload-path file. Do not push, rewrite history, transfer ownership, copy production data, rotate secrets, change remotes or deploy from this handoff work without the owner's explicit approval. See `docs/migration/MIGRATION_PLAN.md`.
