# Migration checklist

Status as of 16 October 2026: preparation only. Checked boxes mean verified in this audit, not a completed account migration.

## Source and authorization

- [x] Inspect local repository, packages, routes, tests, migrations, deploy files and docs.
- [x] Check working tree: clean at audit start on `main` / `e001e8b`; no untracked source found.
- [x] Inventory six checkpoint tags; one local branch and `origin/main` found.
- [x] Identify ignored `.env`, `credentials.json`, build outputs and local settings as non-portable.
- [x] Identify tracked upload-path image and credential-like literals in historical configuration.
- [x] Run local shared/API production builds and API suite against the existing checkout: 15 suites, 104 tests passed. This used an existing local install, not a clean personal environment.
- [ ] Confirm written authority to transfer source, assets, Git history and any data.
- [ ] Perform approved history/asset sensitivity review; decide snapshot versus history migration.
- [ ] Verify current GitHub repository owner, visibility, admin permission, and destination account/repository.
- [ ] Verify current Render workspace owner, service/database ownership, billing and free DB expiry.
- [ ] Check account-side GitHub/Render webhooks, deploy connections, DNS and custom domains with owner access.

## Personal setup

- [ ] Create approved private personal repository without copying old credentials.
- [ ] Generate new DB, JWT, Gemini and operator credentials in personal accounts.
- [ ] Review Expo/EAS account-specific IDs and configure personal build project.
- [ ] Install dependencies in a fresh checkout; run shared/API builds and API tests.
- [ ] Initialize new empty DB and apply all committed Prisma migrations.
- [ ] Start local API/web and exercise report, image, auth, map, weather, dashboard and assistant paths.
- [ ] Test live Gemini with new key, provider fallback, Overpass, Open-Meteo and map tiles.
- [ ] Build mobile against personal backend; test actual Android permissions/voice on device.
- [ ] Deploy separate personal Render service and verify health, persistence and UI before any cutover.
- [ ] If explicitly approved, plan secure production data/photo transfer and reconciliation.
- [ ] Verify no organization-owned credentials/data remain in personal repo or service.
- [ ] Document rollback and domain/mobile endpoint cutover; keep old deployment intact until approved.

## Work performed in this task

Repository audit and documentation were performed. On 16 October 2026, `npm.cmd run build:shared`, `npm.cmd --prefix apps/api run build`, and `npm.cmd --prefix apps/api test -- --cacheDirectory <workspace-local-cache>` passed (15 suites, 104 tests). The API tests needed local loopback access because the sandbox denied connections to `127.0.0.1`; no code change was needed. No dependency reinstall, separate manual server/physical-device test, live Gemini test, data export, new GitHub repository, push, account transfer, personal deployment, domain change or secret rotation has yet been performed. Later testing must record exact date, commit, environment and results.
