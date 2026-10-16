# Project architecture

## Repository map

| Path | Role |
| --- | --- |
| `apps/api/src` | Express/TypeScript HTTP server, route handlers, services, auth, persistence. |
| `apps/api/public` | Bengali-first static web app (HTML/CSS/JavaScript), Leaflet assets, mobile WebView content. |
| `apps/api/prisma` | Prisma schema, eight committed migrations, seed logic. |
| `apps/api/tests` | Jest/Supertest and browser DOM tests. |
| `apps/api/data` | Bundled Rajshahi weather/air data used for fallback; inspect provenance before reuse. |
| `apps/mobile` | Expo/React Native wrapper, WebView, native permissions, EAS config. |
| `packages/shared` | Shared types, Bengali metadata, priority and similarity helpers. |
| `docs` | Feature, deployment and design decisions. |
| `render.yaml`, `docker-compose.yml` | Render Blueprint and local container setup. |

## Runtime flow

Browser or Expo WebView loads the API server's static app. Web scripts call `/api/v1/*`. Express mounts auth, reports, AI, map, duplicates, dashboard, admin/actions, platform, competition, feature and assistant routes. The same server serves `/uploads/:filename` and the SPA fallback. `GET /api/v1/health` reports process and persistence state.

The server keeps an in-process repository/cache with Prisma-backed PostgreSQL persistence. Writes commit before a success response; startup with Postgres failure must fail instead of silently switching to memory. `DATABASE_PROVIDER=memory` is a deliberate local/demo mode and loses state on restart. The cache requires a **single API instance**; out-of-band DB changes need a restart. Uploaded JPEG/PNG/WebP bytes are stored in PostgreSQL in persistent mode, with local file storage as a fallback. External photo URLs remain dependent on their source.

## Main workflows

- Citizen writes or dictates Bengali complaint, confirms map pin/ward, optionally uploads a photo, previews analysis, and submits. Server validates input, checks duplicate suggestions, scores priority, stores report and receipt.
- Public views show report tracking, map, filters, nearby sensitive places, city weather/AQI, ward scorecards, citizen affirmations and resolution feedback/ratings. Fictional sample data is marked separately from real citizen reports.
- Provisioned operator signs in privately, reviews reports, drafts AI or template actions, assigns departments/officers, records progress and evidence, verifies resolution, requests information, and manages audit-backed status changes.
- Planning views aggregate real database records for maps, dashboard, CSV/print briefs, controlled Copilot, urban twin, what-if scenarios, root-cause hypotheses, reporting coverage and field missions. Simulated costs/routes and approximate ward centers must remain labelled.

## Data and trust boundaries

JWT auth resolves current user/role from stored users. Registration creates citizens; the production demo identity cannot perform ordinary admin writes. Browser receipt capabilities are device-held tokens, not verified identity. Gemini keys remain server-side. AI classification and photo checks are assistive; failed provider calls use labelled fallback or unavailable states. Public data must be sanitized through service/route logic. No official municipal, SMS, email or push notification integration is evidenced.

The Prisma schema includes users, wards, reports, analysis, priority, duplicate links, histories, departments/officers, recommendations/plans, uploads, receipts, feedback, ratings, notices, progress, audit events, cluster reviews and field missions. Migrations are additive in the current source. Never use `prisma migrate reset` on live data.
