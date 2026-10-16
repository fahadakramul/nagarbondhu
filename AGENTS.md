# NagarBondhu AI agent guide

Read `README.md` and `docs/migration/PROJECT_HANDOFF_CONTEXT.md` before changing the app. Source is a Node/npm monorepo: API/web in `apps/api`, Expo WebView in `apps/mobile`, shared types in `packages/shared`. Preserve Bengali-first UI, clear real-versus-demo labels, privacy boundaries and provider attribution.

Use additive Prisma migrations. Production runs a single API instance because of the process-local repository cache. Keep API keys server-side; never print or commit `.env`, `credentials.json`, database exports or citizen uploads. Tests: `npm.cmd run build:shared`, `npm.cmd --prefix apps/api run build`, `npm.cmd run test:api` from the repository root. Review `render.yaml` before deployment.

Migration boundary: repository/Git history ownership, Render ownership and production data authorization remain unverified. The current history includes credential-like development configuration and a tracked upload-path image. Do not mirror/push history, transfer ownership, copy production data, rotate secrets, change remotes or deploy from this migration work without the human owner's explicit approval. See `docs/migration/MIGRATION_PLAN.md`.
