# Final competition MVP

The existing Express / Prisma / PostgreSQL API, Bengali web interface, Leaflet maps and Expo WebView remain in use. No new application framework or large dependency was added.

## Features

- **Urban Digital Twin Lite:** current and dated report states from submission, existing status history and action audit evidence; ward, category, priority, status and submission-date filters; category colours, priority borders, status symbols, existing screen-space clustering; selected-report panel with classification, rationale and timeline. Snapshot A/B includes not-yet-reported states. Missing intermediate history is labelled. Two fictional cases have **simulated SVG illustrations**, not photographs or proof of construction.
- **What-If Urban Planner:** five explainable simulations (priority, nearby visits, recurring observations, reported severity, custom ward/category), hypothetical budget/teams/case limit/planning days, selected and deferred references, reasons, suggested geographic groups, workload and trade-offs. Only nine canonical demo cases have configured illustrative BDT costs. Unknown costs are deferred rather than fabricated. Capacity is an explicit assumption of two cases per team-day; nearby stops use an illustrative 20% shared-visit reduction. This does not approve spending or estimate actual engineering repair costs.
- **Root-Cause Cluster Intelligence:** complete-link geographic groups (each pair within 300 m), compatible categories and separate sources. Descriptions and date patterns support recurrence / duplicate hypotheses (token similarity at least 15%; recurrence at least seven days apart; possible duplicates within 100 m and two days). Evidence, limitations, approximate location and report links are visible. Persistent administrator reviews require written field evidence. `FIELD_VERIFIED` records the operator's assertion, not independent engineering certification. Demo verification remains explicitly fictional.
- **Urban Voice & Reporting Coverage:** all configured wards plus unknown-ward records, including zero-data areas, counts, diversity, unresolved cases, dates, component scores and editable weights. Default period is the last 90 local calendar days. Completeness measures description/category/location/ward availability; consistency measures occupied weekly buckets; category coverage uses seven configured categories. Score is the weighted sum, not an AI probability. No population normalization, infrastructure quality ranking or deprivation inference.
- **Smart Field Mission Planner:** select reports or a cluster, suggested geographic groups and nearest-neighbor stops, category-specific checklist, department/team/officer, persistent revision-protected states, notes/findings/photos/follow-ups and underlying report audit history. Assignment can be supplied later. Completion requires findings and does **not** resolve the reports. Map segments are straight lines, not navigation or live GPS.

## Main implementation files and migration

- `apps/api/src/services/competition.service.ts`: dataset, historical view, scenarios, cluster evidence, coverage, mission / review validation.
- `apps/api/src/routes/competition.routes.ts`: validated read-only analytics and authenticated mutations.
- `apps/api/public/competition.js`: integrated map panel and four dashboard tools.
- `apps/api/public/index.html`, `platform.js`, `demo-before.svg`, `demo-after.svg`: existing screens, marker behaviour and labelled illustrations.
- `apps/api/src/db.ts`, `persistence.ts`, `middleware/auth.ts`, `services/citizen.service.ts`: persistence integration, narrow demo authorization and public mission-history labels.
- **Additive migration:** `apps/api/prisma/migrations/202610100002_competition_mvp/migration.sql` creates `cluster_reviews` and `field_missions`; existing tables and rows are retained. Actor foreign keys are enforced in PostgreSQL. Report membership / operational identities are validated by the service and stored as JSON / IDs. Existing architecture uses one API instance with a transaction-backed repository cache.
- `apps/api/tests/competition.test.ts`, `scripts/check-persistence.cjs`: functional, integrity, authorization and opt-in PostgreSQL reconnect checks.

## Load / restore fictional data

In the application: **Planning Dashboard → fictional DEMO source → “নমুনা dataset restore” → “কাল্পনিক dataset load / restore”**. Confirm the concrete action. The existing admin demo session is activated if necessary. This saves nine fixed fictional cases, dated histories, two cluster reviews, a fictional department/officer and the three-stop preloaded mission. Reload works without generating duplicate cases. Only known seed IDs are restored; real records and user-created missions are retained. A collision with a real record or an operator action plan refuses the restore rather than overwriting it.

CLI alternative, from the repository root, after building and configuring the database:

```powershell
npm.cmd --prefix apps/api run prisma:deploy
npm.cmd --prefix apps/api run seed:competition
```

Stop / restart an already running API around a CLI seed so its repository cache reloads; the UI restore runs in the active process and does not require a restart. Nothing seeds this new dataset on every server startup.

`sourceType=demo_seed` separates fictional records from `citizen_report`. Markers and results show **Demo Mode — কাল্পনিক নমুনা তথ্য** and fictional record cards show **Demo Data — কাল্পনিক নমুনা তথ্য**. Demo coordinates are approximate simulations, not official ward assignments or boundaries. The app has nine configured ward templates, not complete official geographic coverage.

## Run, build and test

From the repository root:

```powershell
npm.cmd ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api
npm.cmd run build:shared
npm.cmd --prefix apps/api run build
npm.cmd run test:api
npm.cmd run dev:api
```

Production API after build:

```powershell
npm.cmd --prefix apps/api run start:render
```

For optional isolated PostgreSQL tests, provide an ignored `apps/api/.env.persistence-test` containing `DATABASE_URL`, then run:

```powershell
cd apps/api
node scripts/check-persistence.cjs
```

That script forces the separate `workflow_smoke_test` schema, deploys additive migrations there, tests missions/reviews/photos/reconnect/rollback and demo restore preserving a citizen report, and retains test rows. It does not use the production `public` schema. Remove the private temporary env file after use. No secrets are printed or committed.

## Configuration and authorization

Existing deployment variables: `DATABASE_PROVIDER=postgres`, `DATABASE_URL`, strong `JWT_SECRET`, `NODE_ENV=production`, optional `PORT`, `PUBLIC_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and provisioned-operator `OPERATOR_EMAIL`, `OPERATOR_PASSWORD_HASH`, `OPERATOR_NAME`. No new secret is needed for the five tools. Gemini stays server-side. Missing or failed AI provider uses the existing labelled fallback; fictional fixture classification is explicitly `DEMO_RULE_TEMPLATE`, never a pretend live response. Startup/database failures do not generate replacement fake analytics.

Ordinary production admin report/action/directory operations remain forbidden to the shared demo admin. The only additional authorized demo mutations are the exact `/api/v1/competition/demo/restore`, `/demo/missions`, `/demo/missions/:id/update` and `/demo/clusters/:id/review` paths. They require the existing signed, server-resolved admin role and enforce canonical fictional report IDs and demo-only operational identities. They cannot modify real or unrelated legacy sample reports. A maximum of 40 demo missions and 100 updates per demo mission limits storage growth. Provisioned operators use the separate protected `/competition/admin/...` paths for real data; actual assignments require verified operational identities. Demo writes are shared presentation state; anyone with the shared demo account can alter only that fictional state.

## Verification and remaining limits

47 tests across eight suites passed, including existing submission, privacy, duplicate checks, workflow, dashboard and AI fallback tests, and nine new MVP tests. Shared/API builds and browser script syntax checks passed. An isolated PostgreSQL run verified the additive migration, mission/review/photo persistence across reconnect, restore preserving real records and transaction rollback. Browser checks exercised scenario output, clusters, coverage, empty citizen-data state, mission creation and inspection updates, dated map panel and before/after illustrations. A 390 px iframe preview verified mobile dashboard/map layout and footer without horizontal overflow; this is responsive browser testing, not an Android device test. The IAB iframe automation emitted a MutationObserver error during its frame instrumentation; the normal app tab showed no console errors.

Live Gemini generation requires a configured key and was not tested against a live provider. Coordinates, routes, costs and fixture outcomes are simulations. No live GPS, official municipal integration, verified population denominator or road-network route optimization is claimed. The existing Render free PostgreSQL expires on 8 November 2026 unless upgraded / replaced.

Footer preserves **Fahad MD Akramul Islam**, adds **Ideation & Supported By: Tashika Hossain**, and states **Both are RUET, Department of Urban & Regional Planning (URP), 24 Series students.** The home credit also remains unchanged.

## Suggested 90-second video

Load the dataset before recording; keep the map tiles loaded and fictional source selected.

1. **0–10 s:** Home: identify the platform, visible fictional-data badge and developer credit.
2. **10–30 s:** Map: “Demo timeline: 5 অক্টোবর”, Snapshot A 20 August; choose `mvp-demo-water-1` from the dropdown. Show assigned → resolved, history and labelled illustrative before/after. Explain the nearby later report prevents a permanent-success claim.
3. **30–45 s:** Dashboard → alternative planning: compare the prefilled 6,000 BDT / one-team scenarios and one deferred-case reason. Say costs and workload are illustrative.
4. **45–60 s:** Potential root causes: show the water/drainage cluster evidence, recurrence qualification and coordinated inspection suggestion.
5. **60–70 s:** Coverage: contrast the higher reporting area with a low / missing-data ward and show component scores. Fewer reports do not mean fewer problems.
6. **70–85 s:** Field mission: preloaded three-stop route, fictional team, checklist and saved inspection update; optionally add a short demo note and confirm save.
7. **85–90 s:** Footer: developer, ideation/support credit and RUET URP 24 Series student attribution.
