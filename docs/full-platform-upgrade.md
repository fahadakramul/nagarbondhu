# Citizen and operations upgrade — October 2026

The existing Express/TypeScript API, shared types, Prisma/PostgreSQL repository, static Bengali SPA, Leaflet maps and Expo WebView are preserved. Home credit and existing navigation remain. No separate login screens or APK build are introduced.

## Architecture and implementation map

| Area | Implementation |
| --- | --- |
| Citizen submission | `routes/report.routes.ts`, `public/platform.js`: bounded validation, explicit pin confirmation, optional known ward, image errors stop submission, UUID request key and SHA-256 request fingerprint |
| AI preview | `services/ai.service.ts`: Bengali/English classification, keywords, missing information, provisional severity, editable description suggestion, field verification flag; server-only Gemini credentials and explicit heuristic fallback |
| Similar reports | Side-effect-free `POST /reports/duplicate-suggestions`; proximity/category/text matching, recency window of 180 days, maximum eight public references; no automatic merge or suppression |
| Tracking | `services/citizen.service.ts`, `GET /reports/:id/tracking`: public assignment, target, progress, resolution verification and sanitized timeline; private audit/details/actor identities excluded |
| Feedback | `CitizenFeedback` separate from report status; receipt capability required, one current feedback per receipt/report, pending admin review; acknowledged/reopened reviews are audited |
| In-app information request | `ReportNotice`, admin request endpoint, visible report timeline; no email/SMS/push/WhatsApp integration claimed |
| Map | Existing Leaflet with category/status/priority/date/source filters, screen-distance clusters, public previews, source labels and coverage disclaimer |
| Operations / GIS | `analytics.service.ts`, `platform.routes.ts`: filtered backend counts, ward/category/status/priority, overdue, reporting months, adjacent-month count differences, nearby unresolved connected components within 300 m, location confirmation coverage and supporting IDs |
| Copilot | Controlled question enum; backend facts kept separate from optional validated Gemini interpretations. No SQL execution or database tools are given to the model |
| Planning brief | Ward/category/date/source filters, counts, references, density clusters, review suggestions, limitations; UTF-8 CSV export with spreadsheet formula escaping; browser print / Save PDF when supported |
| Queue | Existing admin dashboard adds total/closed cards, date filters, latest progress/update, pagination (50 rows), overdue follow-up/escalation review suggestions |
| Existing operations | AI action drafts, human-confirmed plans/department/officer/ward assignment, revision checks, evidence, resolution verification, closure and audit events reused |

Dates selected in the interface use Asia/Dhaka day boundaries. Source filters default to real citizen reports for planning tools; DEMO and mixed data must be explicitly selected. Maps and exports represent recorded reports, not a complete city survey. Two observed consecutive months allow count differences; partial months and unequal reporting coverage are not normalized. Nearby reports do not prove recurrence, a common cause or hazard severity.

## Additive migration and persistence

`202610100001_citizen_tracking` adds `submission_receipts`, `citizen_feedback` and `report_notices` with report foreign keys, the feedback receipt relation, uniqueness and indexes. No existing report/user/ward/plan tables or records are deleted, renamed or recreated. Deploy using the existing `start:render` migration command. Do not use a Prisma reset.

Successful mutations return only after the transaction commits. Failed validation or persistence restores the request snapshot. Submission retry with the same UUID and same normalized payload returns the same report; changed content with a reused key returns 409. Receipts store only a capability hash. A per-device receipt token permits resolution feedback for that submission; it is not authenticated identity or securely private “My Reports”. Lost receipts cannot be recovered through a public endpoint. Legacy submissions without a request key remain compatible, but cannot receive retry deduplication guarantees.

The compatibility cache still requires **one API instance**. Out-of-band SQL changes require a restart. Do not scale independent replicas without replacing the cache with database-backed repository queries. Render free PostgreSQL expires **8 November 2026**; retained data/photos require export/migration or an upgraded database before then.

## Priority Engine 2.0

New/reassessed reports use `20 * (0.65 * reportedSeverity + 0.25 * age + 0.10 * verifiedCorroboration)`, bounded evidence factors and documented safety review triggers. Age is a submission-age proxy (one factor step per seven days, capped at five). Confirmed duplicate relationships contribute limited corroboration; pending similarities do not. The engine does not assume population exposure or recurrence. Unknown public impact, critical infrastructure and calibrated location/classification confidence are excluded and explained. Safety language recommends urgent field review rather than a confirmed diagnosis. Existing historical assessments remain unchanged and retain their original explanations until an authorized reassessment.

Optional server variables `PRIORITY_SEVERITY_WEIGHT`, `PRIORITY_AGE_WEIGHT`, `PRIORITY_EVIDENCE_WEIGHT` must be nonnegative and sum to one. These weights are configurable heuristics, not a validated engineering risk model. Existing audited priority overrides remain available to provisioned operators.

## Authorization and operator setup

The existing role toggle still opens the demo planning view. In `NODE_ENV=production`, the known demo admin **cannot perform administrative mutations** (403). Controlled Copilot POST is read-only. Directory contact fields and private plan/audit information are masked in demo reads; citizen feedback comments require a provisioned operator session. Registration always creates CITIZEN, even if a client supplies a privileged role. JWT authentication resolves the stored account/role on every request; client role claims are ignored. Existing report reanalysis now requires an authorized administrator and reuses the report's analysis record.

For actual administrative writes, provision an operator through server-only deployment variables:

- `OPERATOR_EMAIL`: a real operator's email, distinct from existing citizen/demo accounts.
- `OPERATOR_PASSWORD_HASH`: bcrypt hash generated privately from the operator's chosen strong password (never plaintext in environment examples or repository).
- `OPERATOR_NAME`: display name (optional).

Startup validates these fields and upserts only `user-provisioned-operator`, then persists it. No public promotion/bootstrap endpoint exists. A hash/email collision with another account fails startup instead of granting privileges. Keep these values absent until ready to provision. Use the existing dashboard's collapsed **Operator session** control with the corresponding email/password; its JWT stays in memory. Logout by switching back to citizen mode/reloading. Separate account management/login screens remain deferred.

Required deployment variables remain `DATABASE_PROVIDER=postgres`, private `DATABASE_URL`, strong `JWT_SECRET`, `NODE_ENV=production`. Optional `GEMINI_API_KEY` and `GEMINI_MODEL` enable live citizen assistance, action drafts and planning interpretation. Gemini receives redacted complaint content or aggregate-only planning facts. No private directory contacts or account details are sent. Provider failures expose an explicit fallback/unavailable label; ordinary report submission continues. Never put keys in frontend/native code.

## Verification and limitations

Run shared/API builds, JavaScript syntax checks and `npm --prefix apps/api test`. Behavioral coverage includes report retries/key conflicts/no guessed ward, side-effect-free duplicate previews, receipt ownership, feedback/status separation/reopening audit, public tracking privacy, role escalation prevention, production demo write blocking, analytics/date filters/pagination, CSV formula protection, priority unknown evidence and AI failure fallback. Existing action tests cover assignment, stale revision, evidence, closure verification, progress, overdue and invalid directory/ward/date inputs.

`scripts/check-persistence.cjs` uses only the isolated `workflow_smoke_test` schema. It applies migrations, checks existing workflow data, receipt/feedback/notice reconnect persistence, photos and transactional FK rejection. Temporary `.env.persistence-test` is ignored and removed after verification.

A verified ward boundary inventory, real officer/department directory and suitable field evidence are still needed. No government officers or confirmed responsibilities are invented. Report-density clusters and provisional classifications are not engineering certification. Comparable intervention data is insufficient for before/after outcome attribution. Browser PDF printing is conditional on browser/WebView support; there is no server-generated PDF attachment. Supporting an existing incident as an unauthenticated non-submitter is deliberately omitted because identity/abuse controls are unavailable. Timelines provide in-app updates; external notification channels remain unconfigured.
