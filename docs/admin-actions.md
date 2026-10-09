# Admin action workflow

The existing Bengali Planning Dashboard and report modal now support stored AI action drafts, human confirmation, ward/department/officer assignment, progress, evidence, separate verification and closure. Existing maps, reports, navigation and developer credit remain.

Drafts contain all nine recommendation fields with provider/model/time metadata. No Gemini key produces a labelled rule-based draft. A configured provider failure returns a retryable error; manual plans remain available. Photos are stored but not analysed. AI context excludes citizen identities and audit actor names and redacts email/phone strings from complaint text; this is not complete de-identification of free text.

Every plan mutation sends its current revision (0 before the first plan). Stale revisions return 409. Assignment preserves original complaint data. A ward requires explicit admin verification; approximate centres are not verified boundaries. A centre more than 5 km away requires a documented override. An officer must be active and match the department and ward (or be department-wide). No people are seeded; generic teams are DEMO. Admin-created directory records require sources and verification status.

The workflow supports Submitted, Under Review, Awaiting Field Verification, Ready for Assignment, Assigned, In Progress, On Hold, Resolved, Closed and Rejected, with constrained transitions and notes. Resolution requires a note and an after photo or documented alternative verification. Verification does not close a report automatically. Audits record drafts, assignments, edits, due-date changes, progress, priority overrides, status and verification. Reopening clears verification.

Dashboard cards and filters use stored records, including seven requested summary counts. Target dates end at 23:59:59.999 Asia/Dhaka; Resolved/Closed/Rejected plans are excluded from overdue. Summary cards reflect active filters. Existing priority impact/recurrence defaults are estimates, not measured population or confirmed recurrence; admins can override priority with a reason.

## API

All new paths begin `/api/v1/admin` and enforce existing JWT ADMIN/URBAN_PLANNER roles:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/action-directory` | Wards, departments, officers |
| POST / PATCH | `/departments` / `/departments/:id` | Manage departments |
| POST / PATCH | `/officers` / `/officers/:id` | Manage responsible persons |
| GET | `/actions/dashboard` | Filtered counts and action list |
| GET | `/reports/:id/actions` | Drafts, plan, progress, audit and transitions |
| POST | `/reports/:id/action-recommendations` | Generate/regenerate draft; body `{}` |
| PUT | `/reports/:id/action-plan` | Confirm/edit plan and assignment |
| PATCH | `/reports/:id/action-status` | Status with note and revision |
| POST | `/reports/:id/progress` | Progress and optional photo |
| POST | `/reports/:id/resolution-verification` | Verified/rejected verdict and note |

Legacy status routes cannot bypass assignment/evidence requirements. The existing public demo role toggle is preserved; role checks do not make this secure production admin access. Separate login, notifications, image AI and verified ward boundaries remain future work.

## Setup and implementation

See [Render deployment](render-deployment.md) for migrations, retention and the one-instance persistence cache. Required server variables: `DATABASE_PROVIDER=postgres`, private `DATABASE_URL`, production `JWT_SECRET`. Optional server-only `GEMINI_API_KEY`, `GEMINI_MODEL` enable live recommendations. The initial `202610090001_action_workflow` migration is for a fresh database; baseline existing SQL tables before use.

Main files: shared `actions.ts`, Prisma schema/migration, `src/persistence.ts`, `services/action*.ts`, `routes/action.routes.ts`, `public/actions.js`, existing app/dashboard/modal/upload routes, configuration and `tests/actions.test.ts`. Original report/user/ward entities are reused.

Verification commands: `npm run build:shared`, `npm --prefix apps/api run build`, `npm --prefix apps/api test`. Real database reconnect/photo/audit checks use the isolated schema smoke script documented in deployment instructions. Database expiry and photo capacity apply to all retained records.
