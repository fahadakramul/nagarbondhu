# Project handoff context for future Codex sessions

## Purpose and users

NagarBondhu AI is a Bengali-first Rajshahi civic reporting and urban-planning prototype for citizens, provisioned operators and planners. It is an independent decision-support prototype, not an official Rajshahi City Corporation system. Public reporting and analytics should separate real citizen submissions from clearly labelled fictional demo records. City-level inference must acknowledge sparse and uneven report coverage.

## Current implementation

Monorepo: `apps/api` is Express/TypeScript + static browser UI; `apps/mobile` is an Expo/React Native WebView app; `packages/shared` holds types and utilities. Prisma/PostgreSQL provides durable state. The API has an in-process compatibility cache and must run as one instance. Render serves both API and browser app; the installed mobile app points to the current Render URL unless rebuilt with a different `EXPO_PUBLIC_APP_SERVER_URL`.

Implemented citizen capabilities include a three-step report wizard, text/voice complaint, optional photo and AI/photo check, confirmed map location, duplicate suggestions, report receipt/tracking, resolution feedback and ratings, nearby affected services, ward scorecards, weather/AQI and rain queue. The assistant uses grounded app data. Map layers use Leaflet with OSM/Esri credits. AI uses server-side Gemini with labelled heuristic/template fallback where supported.

Operator capabilities include private login, action recommendations, assignment, progress, evidence, information requests, resolution verification, soft delete/restore and audit history. Production demo admin is restricted from ordinary sensitive writes. Planning capabilities include dashboard aggregates, maps/hotspots, CSV/print brief, controlled Copilot, urban twin/history, what-if scenarios, root-cause cluster hypotheses, coverage score and field missions. Scenarios, budgets, routes and some visuals are illustrative; no official boundaries, verified engineering outcome or population denominator is claimed.

## Key files and commands

Start at `README.md`, `docs/full-platform-upgrade.md`, `docs/differentiating-features.md`, `docs/competition-mvp.md`, `docs/render-deployment.md` and this migration directory. API composition: `apps/api/src/app.ts`; config: `apps/api/src/config.ts`; persistence: `apps/api/src/persistence.ts`; schema/migrations: `apps/api/prisma`; browser entry: `apps/api/public/index.html`; mobile URL: `apps/mobile/src/config.ts`; deployment: `render.yaml`.

From repository root on Windows PowerShell: `npm.cmd ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api`, `npm.cmd run build:shared`, `npm.cmd --prefix apps/api run build`, `npm.cmd run test:api`, `npm.cmd run dev:api`. For Postgres, configure private `apps/api/.env` and run `npm.cmd --prefix apps/api run prisma:deploy` against a **new personal** DB only. For mobile, install its workspace and use `npm.cmd run dev:mobile`. See `PERSONAL_WORKSPACE_SETUP.md` for complete steps.

## Design and operational conventions

Keep Bengali copy clear and source labels honest. Protect citizen privacy in public routes. Never send secret keys to browser/mobile. Let AI assist, but show fallback and uncertainty. Keep CSS/Leaflet critical assets local so layout does not depend on a CDN. Maintain provider credits. Prefer additive database migrations and test one-instance persistence. Do not fabricate citizen reports or field validation. Keep the old live service stable during migration.

## Known limitations and next work

The free Render database expiry documented as 8 November 2026 needs urgent owner verification and retention planning. Current Git history contains credential-like development values and a tracked upload-path image, so mirroring is blocked pending review. GitHub/Render ownership, personal destination and production-data rights are unverified. The API cache cannot support multiple instances or live out-of-band DB edits. Weather/OSM/Gemini are external services with latency/availability limits. Browser receipt identity is device-local; external notifications are not configured. Ward centers are approximate, operator directory needs real authorization, and mobile audio needs physical-device QA. Future improvements may include database-native multi-instance reads, account recovery, monitored provider health, verified ward data and a durable paid DB plan, after live stability is secured.

Old Codex/Antigravity chats, sign-ins, connections and billing are account-specific. This document carries technical context; it does not migrate those histories or permissions.
