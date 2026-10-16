# Dependencies and external services

**Scope correction:** The owner confirmed that the listed GitHub repository and Render services are already personal. The right-hand column records an earlier new-infrastructure proposal and is superseded for this Codex workflow handoff. Continue with the existing repository and services; do not create replacements from this document.

| Service/asset | Purpose and observed integration | Personal migration and check |
| --- | --- | --- |
| GitHub `fahadakramul/nagarbondhu` | Current `origin`, branch `main`; six checkpoint tags. Ownership/permissions were not authenticated in this audit. | Confirm owner and authorization. Create private destination only after approval; test clone and branch protection separately. |
| Render `nagarbondhu-api` | Node web app in Singapore, free plan per `render.yaml`; live URL `https://nagarbondhu-api.onrender.com`. | Create a separate personal service and verify `/api/v1/health`; keep existing service intact. |
| Render `nagarbondhu-db` | Free Postgres 16 Blueprint database. | Create new private database and connection. Verify migrations and data retention plan. Existing production data needs separate authorization. |
| Google Gemini | Server-side text, assistant, action/planning interpretation, image and audio calls to Gemini API. | New personal Google project/key, `GEMINI_API_KEY` and optional `GEMINI_MODEL`; run `node apps/api/scripts/check-gemini.cjs` with private env configured. Never embed key in mobile/web. |
| Open-Meteo | Weather and air quality endpoints; bundled last-known data may be used as labelled fallback. | No key identified in source. Verify weather/AQI endpoint and freshness labels on new host. |
| OpenStreetMap Overpass | Nearby sensitive place queries. | No key identified. Verify proximity result, attribution and provider failure behavior. |
| OpenStreetMap/Esri | Map tiles, satellite imagery/labels. | Verify tiles and required on-screen attribution. These external providers and policies may change. |
| Expo/EAS | Android/iOS builds and project association. `app.json` contains an account owner and EAS project ID; `eas.json` embeds the current Render URL. | Sign into personal Expo account, confirm package IDs/ownership, create or link personal EAS project with authorization, set new backend URL before build. |
| Local icons/illustrations/fonts/Leaflet assets | Static UI and map display. | Review file licenses/provenance. Local Leaflet license and attribution assets are included. |

No tracked `.github/workflows`, VS Code settings, Git submodule declaration, Git LFS pointer/config, custom DNS zone, domain record, webhook secret, scheduled background worker, Supabase client or external notification provider was found in the checkout. `STORAGE_PROVIDER` supports a configuration name, but persistent upload behavior should be verified from `persistence.ts`; do not assume a configured Supabase bucket. GitHub/Render dashboards may contain account-side settings absent from source and must be checked by an authorized owner. Public web resources may still load remote images/tiles even though critical CSS/Leaflet assets are local.
