# Technology stack

| Layer | Verified from repository |
| --- | --- |
| Runtime/package manager | Node.js/npm workspaces; Render Blueprint pins Node `22.16.0`; Dockerfile uses Node 20 Alpine, so these deployment paths differ. |
| API | TypeScript 5.4, Express 4, Zod 3, CORS, Multer, bcryptjs, jsonwebtoken. |
| Persistence | Prisma Client/CLI 5.14, PostgreSQL; local Compose uses PostGIS 16 image, while Render Blueprint requests Postgres 16. No PostGIS SQL dependency was established by this audit. |
| Browser UI | Static HTML/CSS/JavaScript served by Express; Tailwind CSS 3.4 built locally; Leaflet 1.9.4 copied to `public/vendor`. |
| Mobile | Expo SDK 51, React Native 0.74.5, React 18.2, React Native WebView 13.8.6, image picker and location. |
| Tests/build | Jest 29, ts-jest, Supertest, jsdom, TypeScript compiler, `tsx` watcher. |
| Hosting/build | Render web service and PostgreSQL, EAS mobile build configuration, optional Docker Compose. |

There is no separate browser framework build. The API build generates CSS, copies local Leaflet files, generates Prisma client, then compiles TypeScript. The tracked web assets are served by the backend. The mobile build embeds its backend URL through `EXPO_PUBLIC_APP_SERVER_URL`; changing the server address requires a new mobile build unless the existing URL remains in use.
