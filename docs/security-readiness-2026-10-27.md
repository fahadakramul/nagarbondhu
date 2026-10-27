# Render security readiness — 27 October 2026

## Prepared changes

- Native Render runtime pinned to Node.js 22.23.4 per https://render.com/docs/advisory-emudhra.
- Docker build and runtime stages use the same patched Node.js release and refresh Alpine packages and CA certificates. Production currently uses the native Node runtime; Docker has not been built locally.
- Production npm audit identified vulnerable body-parser and Zod versions. Lockfile updated, Zod upgraded to 4.6.7, validation error handling uses `issues`, and record schemas explicitly require string keys for Zod 4 compatibility.
- Production workspace audit after updates: zero reported vulnerabilities. This does not guarantee absence of vulnerabilities.
- Final validation: shared build and API build succeeded; all 18 API test suites / 131 tests passed. `git diff --check` passed. Earlier runs overlapped dependency installation or used the pre-adaptation Zod schemas; the final completed run is the validation result.

## Live observations and remaining actions

- Public health endpoint returned healthy, PostgreSQL ready, release `70d6907d6166fbc1d14611a3f05a1d053857db5a` on 27 October 2026.
- Render email states database suspension on 8 November 2026 and deletion after a grace period. Dashboard confirms database is still Free; minimum listed paid compute is $6/month, with final storage/tax/billing details to be reviewed before purchase.
- Owner must approve the reviewed security change set for push/deployment under the existing handoff boundary. Rebuild the service after setting Node.js 22.23.4 in Render; verify runtime version in deploy logs and health, login, reports and static assets after deployment. Keep a single API instance.
- Owner must choose and authorize database retention before 8 November. An in-place paid upgrade avoids a database migration. No database export, copy, upgrade, secret rotation, push or deployment was performed during preparation.
- Local validation runs on installed Node.js 24.21.0; production Node.js 22.23.4 and Docker verification remain deployment checks.

Reference email: “Important advisory on recent industry security disclosures”, Render, 27 October 2026. PHP guidance does not apply to this Node.js application.
