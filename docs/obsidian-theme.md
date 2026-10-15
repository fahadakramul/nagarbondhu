# Electric Obsidian theme

The existing HTML/Tailwind/JavaScript frontend now uses an Obsidian and Neon Cyan presentation layer. No framework migration or additional package is required.

## Files and integration

- `apps/api/public/theme.css`: centralized surface, text, accent and semantic status tokens; glass cards, controls, badges, map presentation, risk rings, grade circles and reduced-motion rules. Compatibility selectors also cover existing dynamically generated Tailwind markup.
- `apps/api/public/theme.js`: presentation adapters for the existing report detail modal, actual recording state, map filter disclosure, severity values and server-health badge.
- `apps/api/public/index.html`: loads the stylesheet after `polish.css` and the script after the existing application scripts. Includes the cyan Tailwind civic palette, revised header/hero, recording decoration, vision panel and accessible form labels.
- `app.js`, `features.js`, `platform.js`, `competition.js`: limited styling hooks, category/cluster colors, the existing 200m circle, successful-upvote feedback and actual scenario/ward cards.
- `manifest.json`, `apps/mobile/App.tsx`, `apps/mobile/app.json`: matching browser/native shell colors and dark appearance.

To adjust the palette, edit the semantic variables at the beginning of `theme.css`. Keep semantic warning/critical/positive distinctions and use the lighter text variants on dark surfaces. Cyan filled buttons intentionally use dark text for contrast.

## Behavior preserved

Report submission, API endpoints, authentication, database schemas, calculations, URLs, credits and service disclaimers remain unchanged. The waveform animates only while the existing recorder is recording. The detail stepper derives its stage from the existing report status and omits holds/rejections rather than inventing progress. Risk rings display the actual priority score and priority level. Reported resolution remains distinct from official verification.

The Live Engine badge checks the existing health endpoint; it represents application-server availability, not a guarantee that Gemini is available. AI availability continues to be reported by the existing analysis workflow.

The current OSM street tiles receive a CSS dark treatment. Satellite tiles, providers and attribution remain intact. Hosted CARTO tiles were not added because that would introduce a provider/key requirement. Existing planning scenarios retain their names and calculations; budget/time strategies were not invented.

## Validation

- Git checkpoint before editing: `checkpoint/obsidian-theme-2026-10-15`.
- API test suite: 12 suites / 82 tests passed, including report/auth/API tests and presentation tests for real priority/status values, recording state and the timeline disclosure.
- Production API build passed; modified browser JavaScript syntax checked separately.
- Mobile dependencies are not installed in this checkout, so the native wrapper was not typechecked or built. Its edits are limited to color values and appearance configuration.
- Browser checks at 390px, 430px and 1280px: home, reporting, map, feed, dashboard and scorecard navigation; no page horizontal overflow.
- Existing planning modules, report details, mobile map controls and street/satellite switching reviewed in an isolated local memory preview.
- Automated DOM text contrast sampling across these main screens found a lowest sampled ratio of 5.15:1. This is a targeted check, not a complete accessibility certification; raster map labels and device-specific rendering need separate assessment.
- Reduced-motion CSS disables decorative animations. Physical Android microphone capture was not retested as part of this visual change. Live Gemini/other third-party requests were not end-to-end tested with production credentials.

Screenshots and the responsive contrast matrix are saved under the ignored `.feature-qa/obsidian-*` artifacts in the working checkout.

## Release

The web theme ships through the existing API/static-site deployment. Deployment to the existing Render service was authorized on 15 October 2026; verify the served `theme.css`, `theme.js`, homepage and health endpoint after rollout. No new APK is included in this release. The native status bar, loading screen and splash changes require a new Android build; web content continues to load from the configured WebView URL. Existing microphone permissions are retained.
