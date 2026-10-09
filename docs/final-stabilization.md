# Final stabilization and competition verification

The hosted app is updated at https://nagarbondhu-api.onrender.com/. Users do not need to run the commands below or rebuild the existing WebView APK for these hosted changes.

## Root causes and repairs

- Homepage had an older aggregate based on legacy report status, while operations used action-plan status. High/critical totals included terminal reports. `dashboard-summary.ts` now reuses the same workflow-aware analytics, scoped by DEMO or citizen source. Unresolved excludes RESOLVED, CLOSED and REJECTED. Resolved includes RESOLVED and CLOSED. IN_PROGRESS is a separate count. Each report is counted once.
- Earlier placeholder `--` values are no longer in homepage KPI markup. Loading, genuine zero and unavailable API data are distinct. Render free cold starts can delay initial loading. Timeout/error responses do not become zero. Failed reload clears old charts and offers retry.
- Category bars forced a minimum width, making zero categories visible as nonzero. Width now follows the actual percentage.
- Duplicate dashboard used only the feed page and could repeat a pair. Backend summary now selects all pending pairs in scope and deduplicates mirrored IDs. Links fetch fresh details.
- Main dashboard, homepage, feed and operations queue now share the selected source. Advanced feature tools retain their own visibly labelled source selector. Status/priority distributions and overdue counts use records, not defaults. Hotspots require nearby same-category reports with finite coordinates, and do not mix citizen/demo observations.
- Preview already called the server provider but missing keys/provider failures returned heuristic results. Live preview now requires a successful validated provider response; missing key, HTTP errors, timeout or malformed JSON return safe Bengali 503/retry. A separate explicit button requests provisional keyword assistance labelled Live AI নয়. Title and description are sent server-side; stale preview inputs are rejected. Manual category correction and submission without live AI work.
- Browser verification found the AI retry controls hidden inside the collapsed result card. They now occupy a separate visible status panel. Saved report details display their analysis provider/fallback label too.
- Citizen priority previously aged only at submission/reanalysis and duplicate confirmation did not refresh it. Current read views derive the same provisional backend estimate, while relevant mutations save a recalculation. Confirmed counterpart IDs count once. Terminal age stops at the recorded resolution/terminal timestamp. Confirmed action-plan priority and explicit admin overrides remain authoritative and are identified separately from the numeric estimate. Legacy fictional scores remain unchanged and labelled.
- Report details now fetch fresh data every opening; successful action mutations refresh both details and aggregates. Homepage/summary refresh on relevant tab navigation, successful submission, visibility return and once per visible minute.
- API GET requests probe PostgreSQL availability before presenting cached repository results. Failed writes continue to roll back and return 503. Repository remains one API process with serialized mutations; external SQL edits need a restart to reload cache.

## Changed files and database compatibility

Backend: `apps/api/src/db.ts`, `src/persistence.ts`, `src/routes/{ai,dashboard,report,action}.routes.ts`, `src/services/{dashboard-summary,priority,ai,action,duplicate,analytics}.service.ts` (the summary filename is `dashboard-summary.ts`).
Frontend: `apps/api/public/{index.html,app.js,actions.js,platform.js}`.
Tests: `apps/api/tests/stabilization.test.ts`.
Documentation: this file. Existing advanced features remain in `competition.js`, `competition.service.ts` and `competition.routes.ts`.

No new migration, schema deletion or production seed/reset is required. Existing three migrations are preserved and applied by the Render start command. Read-only hashes verify existing production report, mission and cluster-review rows are unchanged.

Credits preserve Fahad MD Akramul Islam and add the exact separate Tashika Hossain credit and requested URP/RUET/24 Series line.

## Priority methodology

Current citizen estimate: `round(20 × (0.65 × severity + 0.25 × age + 0.10 × unique confirmed corroboration))`.
Severity is 1–5, provisional classifier evidence; absent analysis uses existing recorded severity, or a labelled provisional baseline of 2. Age is `min(5, 1 + floor(unresolvedDays/7))`. Corroboration is capped at 5. No population, damage, cost or recurrence is invented. Thresholds: LOW <40; MEDIUM 40–64; HIGH ≥65; CRITICAL may be an explicit provisional safety-review trigger from severity ≥4 and specific reported safety terms. It is not a verified diagnosis. A plan/administrator may set a different priority band with the score still identified as an estimate. Optional weights must be nonnegative and sum to one.

## Verification performed

- Shared TypeScript build, Prisma generation and API production TypeScript build.
- Complete Jest regression suite: 58 tests in 9 suites. Eleven stabilization tests include missing-key behavior, configured mock provider, rate limit/malformed/timeout errors, count invariants, empty/source-specific views, submission/feed, priority consistency/terminal age/overrides, unique corroboration and frontend error/zero states.
- Browser checks: explicit live-error/retry, labelled rule preview, manual category correction, local report submission/reference/detail/feed, category/status distributions and pending duplicate links; five planning feature navigation entries and useful demo content.
- Actual PostgreSQL isolated `workflow_smoke_test` check: report receipt/feedback/notice, action workflow, mission/cluster updates, demo restore preserving real rows, reconnect, uploaded image persistence and failed FK transaction rollback. Production public-schema records are not modified by this check.
- JavaScript syntax checks for all four browser scripts and mobile TypeScript no-emit check.
- Render deployed build, live source-scoped counts checked against direct read-only SQL, and responsive browser inspection recorded after deployment.

## Five advanced features

1. Digital Twin Lite: map categories/priority/current workflow, source/ward/date filters, dated action evidence and clearly fictional comparison illustrations.
2. What-if: five scenarios (priority, nearby, recurring observations, severity, selected scope), configurable budget/case/team/day assumptions; actual case IDs, selected/deferred reasons. Citizen reports can use capacity-only mode without invented costs.
3. Clusters: compatible categories, complete-link distance ≤300 m, descriptions/time evidence and inspection suggestions; no confirmed cause claim. Demo review mutations only affect canonical fictional IDs.
4. Coverage: all configured wards plus unknown, explicit sample/insufficient-data state and completeness/weekly reporting/category weights; no population normalization or infrastructure-quality claim.
5. Missions: multi-case selection, suggested nearest-neighbor visit order, numbered map stops, checklists, department/team/officer, revision-checked status/findings and associated report history. Completion does not automatically resolve reports.

## Environment and security

Already configured on Render: production NODE_ENV, PostgreSQL DATABASE_PROVIDER/DATABASE_URL and JWT_SECRET. PORT comes from Render. Never put DATABASE_URL/JWT_SECRET/GEMINI_API_KEY in browser JS or version control.

Optional server-only live AI: `GEMINI_API_KEY` and `GEMINI_MODEL` (existing default gemini-2.5-flash). A real key is currently absent in production, so no live Gemini success is claimed. Successful configured-provider parsing was tested with a mock; missing-key and fallback flows were tested in the real browser. The deployed app works without AI.

Existing provisioned-operator configuration uses `OPERATOR_EMAIL`, `OPERATOR_PASSWORD_HASH` (bcrypt hash) and optional `OPERATOR_NAME`. Production currently has no provisioned operator. Shared demo login cannot mutate real reports, assignments, directories or priority; only the canonical fictional mission/cluster/restore routes can write. Unauthenticated mutation requests and citizen privilege escalation are rejected. Demo is competition-ready; actual municipal operations require a verified operator identity and directory.

CORS currently permits public API access with no credentialed cookie session. Admin writes still require signed bearer JWT, server-side role lookup, validation and authorization. CORS is not an authorization boundary. Production responses omit secrets/stack traces; the prototype is not claimed to be a fully audited municipal service. Rate limiting/anti-abuse beyond input validation and bounded mission/demo operations is not implemented.

Free PostgreSQL expires November 8, 2026. A later hosting/database lifecycle decision is required to keep permanent service; no paid upgrade was purchased. Native Android runtime/device behavior, actual GPS/camera access and real Gemini output remain unverified in this session.

## Exact commands (optional local development only)

From repository root:

```powershell
npm.cmd ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api
npm.cmd run build:shared
npm.cmd --prefix apps/api run build
npm.cmd run test:api
node node_modules/typescript/bin/tsc -p apps/mobile/tsconfig.json --noEmit
npm.cmd run dev:api
```

With DATABASE_PROVIDER=postgres, a valid DATABASE_URL and JWT_SECRET in the server environment:

```powershell
npm.cmd --prefix apps/api run prisma:deploy
npm.cmd --prefix apps/api run seed:competition
npm.cmd --prefix apps/api run start:render
```

The mobile type check needs the existing mobile dependencies installed. Render builds only shared/API workspaces; a native APK rebuild is not part of this hosted fix.

Seed command restores only known canonical fictional fixture IDs, never deletes citizen reports; collision checks reject real data under fixture IDs. If a running API process already loaded its cache, use the authenticated demo restore UI or restart after CLI seed. Existing hosted 16 DEMO reports are already present, so no new seed is needed.

Inspect: Home → কাল্পনিক DEMO; dashboard source selector; Advanced tools → কাল্পনিক DEMO. Read-only JSON: `/api/v1/dashboard/summary?source=demo_seed`, `/api/v1/reports?source=demo_seed&limit=100`, `/api/v1/competition/overview?source=demo_seed`.

## Video flow

Open the app ahead of recording so Render can wake. Show homepage DEMO counts → report Preview error/explicit non-live helper and manual category → list/priority → map dated comparison → dashboard scenarios → cluster evidence → ward coverage → preloaded field mission route and stored inspection history. All fictional data and simulations remain labelled.
