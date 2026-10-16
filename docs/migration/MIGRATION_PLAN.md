# NagarBondhu AI migration plan

## Corrected scope: personal Codex workflow handoff

On 16 October 2026 the owner clarified that `fahadakramul/nagarbondhu`, the local VS Code checkout and the current Render services already belong to the personal account. Keep the same repository, Git history, Render service, database and mobile endpoint. No new repository, deployment, database or ownership transfer is needed. The original assessment below records the earlier, broader proposal and is superseded wherever it suggests creating or transferring those assets.

The only synchronization target is the existing `origin/main`. Before a push, compare local `main` with a freshly verified remote `main`, review every unpublished commit and file, scan the proposed diff for secrets and private uploads, and run shared/API builds and API tests. Push only after the owner approves the exact reviewed commit set. Do not force-push, rewrite history, rotate credentials or modify production data as part of this handoff. In personal Codex, open the existing local folder or clone this same repository after the approved push, then start with `AGENTS.md`, `PROJECT_HANDOFF_CONTEXT.md` and `PERSONAL_WORKSPACE_SETUP.md`.

Historical credential-like defaults and the tracked upload-path file are already in the local ancestry of `origin/main`; omitting them from a new documentation commit does not remove earlier exposure. Review their nature and access before broader sharing. A normal fast-forward documentation push will not add application code or a new upload, but live GitHub state must be checked before declaring it safe.

## Original assessment (superseded for repository and deployment strategy)

Audit date: 16 October 2026. Source checkout: `main` at `e001e8b`; clean before this documentation work. This plan does not establish legal ownership. The existing GitHub repository, Render service and database must remain running during preparation.

## Decision gates

1. Confirm in writing that the project source, Git history, assets, and data proposed for transfer are personally owned or approved for transfer. The repository path `fahadakramul/nagarbondhu` and Render workspace display name alone do not establish this.
2. Review Git history before copying it. The tracked initial configuration contains development credential-like literals, and a file under `apps/api/uploads/` was committed. Determine whether either contains a real secret or private image. If so, do not mirror history; use an approved sanitized snapshot or an authorized history-cleaning process after impact review.
3. Confirm personal GitHub account/repository, private visibility, personal Render workspace, database plan, and billing responsibility. No destination was supplied during this audit.
4. Create new personal credentials: GitHub authentication, Google Gemini key, database role/password, JWT secret, and operator account/hash. Existing credential values are not migration assets.
5. Create a fresh personal database and web service. Apply committed Prisma migrations to that empty database; test with non-sensitive demo records. Treat production data and uploads as a separate, explicit authorization decision.
6. Validate browser, API, mobile build, integrations and persistence on the new service before any cutover. Keep the current service intact and retain rollback access.

## Asset classification

| Asset | Proposed treatment |
| --- | --- |
| Tracked source, package manifests, tests, documentation, migrations, icons, fictional demo assets | Transfer only after ownership/third-party license review; suitable for a sanitized source snapshot. |
| Git commits/tags | Preserve only if authorized and secret/history review clears them. |
| GitHub repository, permissions, Actions/installations | Account-specific; verify owner and recreate or transfer only with owner approval. |
| Render service, free Postgres, domain, deploy hook, connection | Account-specific; create separate personal resources. Do not assume the existing resource can be transferred. |
| `.env`, `credentials.json`, database credentials, API keys, JWT secret | Never copy into the portable package. Recreate privately. |
| Production reports, accounts, feedback, photos, audit events | Potential personal data; no export/copy until ownership, consent, retention and authorization are verified. |
| Codex/Antigravity conversations, billing, sessions, plugins | Cannot be automatically migrated. Technical context is captured in these files. |

## Repository strategy

**Recommended now:** after approval, create a private personal repository from a reviewed, sanitized source snapshot. This avoids carrying the current history risk. It starts a new commit graph and loses original commit attribution in that destination. If legal ownership and a full history scan later clear all commits, an authorized private mirror can preserve branches, tags and attribution. A GitHub ownership transfer preserves repository identity/issues/history but changes the existing repository's control and may affect integrations; use only if all current owners approve and the live deployment impact is planned.

No remote change, push, ownership transfer, production deployment, database copy or credential rotation was performed in this preparation phase.

## Immediate operational risk

The existing deployment guide records a **free Render PostgreSQL expiry on 8 November 2026**. Verify this date in the current Render dashboard and arrange an authorized retention or upgrade plan before expiry. A new code deployment alone does not migrate data or photos. The API persistence cache supports one instance; do not scale it to multiple replicas without changing the data layer.
