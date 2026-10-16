# Personal deployment guide (prepared, not executed)

**Historical proposal only.** The owner confirmed that the existing Render web service and database are already personal and requested no new deployment. The steps below are superseded for the Codex workflow handoff. Keep the current service and database; review `render.yaml` before any separately authorized deployment.

## Render web + database

1. In an authorized personal Render workspace, create private Postgres and a separate Node web service from the approved private repository. Keep repository root as service root because the API imports `packages/shared`.
2. Match `render.yaml`: Node `22.16.0`, Singapore region if appropriate, build `npm ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api && npm run build:shared && npm --prefix apps/api run build`, start `npm --prefix apps/api run start:render`, health `/api/v1/health`.
3. Set `NODE_ENV=production`, `DATABASE_PROVIDER=postgres`, new private `DATABASE_URL`, new `JWT_SECRET`, and appropriate `PUBLIC_BASE_URL`. Add new personal Gemini and operator settings if those features are needed. Configure values in Render, never in Git.
4. First run applies committed Prisma migrations via `prisma migrate deploy`. Apply only to a new empty database until any old data migration is explicitly authorized. Do not reset production tables.
5. Verify health returns `healthy` with ready persistence; then load `/`, report feed, map, weather/AQI, admin login, planning dashboard and a non-sensitive test report/photo. Test mobile against the new URL after an EAS rebuild.

The existing Render deployment and database remain untouched. Current `render.yaml` uses a free web service/database. Free service cold starts and database retention can affect availability; confirm current plan limits and expiry in the authorized dashboard. Keep one API instance because the cache is process-local. Do not enable automatic deploy until the source repo and release path have been reviewed.

## Domains, hooks and rollback

No custom domain, DNS record or deploy hook is declared in source. Inspect the current Render and DNS dashboards with owner access before cutover. A personal `onrender.com` URL can be used for validation. Custom domain/DNS changes need a separate reviewed cutover plan. To roll back a new personal release, deploy its last known good commit against its compatible database and check health; database migrations are additive but schema rollback is not automatic. Do not point the existing domain/mobile build at the new service until validation passes. Do not delete the original service.

## Data migration boundary

Code deployment does not transfer Postgres rows, uploaded photo bytes or external image hosting. If production data transfer is approved, inventory tables, retention/consent requirements and image storage first, choose a secure export/import path, rehearse on sanitized data, verify row/photo counts and access controls, then set an authorized cutover window. No production export was made in this audit.
