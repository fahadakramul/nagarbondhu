# NagarBondhu assistant and task-first interface

Release date: 15 October 2026. Indigo `#4338CA` and Mango `#F59E0B` remain the brand colors. No database migration or existing API removal is included.

## Phased release history

1. `9539c1c` — data-grounded assistant; deployed and health checked.
2. `d0e1cdf` — bottom navigation, sidebar, task-first home and chip filters; deployed and health checked.
3. `270e1af` — three-step report wizard and receipt card; deployed and health checked.
4. Final polish — report cards, Lucide SVG subset, skeletons, nonblocking toasts, accessibility and provider-format correction. The deployed commit is available from `/api/v1/health`.

Checkpoint before work: `checkpoint/assistant-ui-2026-10-15`.

## Differentiation self-check

| Pattern to avoid | Implemented NagarBondhu interface |
| --- | --- |
| Dark hero with badge and three buttons | Time-based Bangla greeting, three task cards and a ward-aware local area card; no dark hero or pill badge. |
| Four large stat cards in a 2×2 grid | Compact four-value city pulse with source note below the local area and feature strip; original statistic IDs remain present. |
| Segmented tabs under statistics | Five-item mobile bottom navigation with raised report action; desktop uses a 240px sidebar. |
| Stacked filter dropdowns | Horizontal category/status/priority/ward chips open multi-select filter sheets; original select IDs and handlers remain. Feed multi-select filtering explicitly applies to the current page. |
| Whole-country administrative map | Rajshahi report/ward filters, real priority-colored markers, optional report-density shading and the existing 200m sensitive-place circle. No invented administrative polygons. |
| Long modal form with manual severity choice | Full-page three-step wizard; existing voice, image, AI preview, category correction, GPS, ward, duplicate and submit controls retain their IDs. Severity comes from the existing analysis pipeline. |
| Tracking-ID success popup | Receipt card with actual server score, review next step, public tracking and share/copy actions. |
| Generic chat lists | Structured assistant cards with do/don't, service-derived contacts/facts, source tags and allowlisted app actions; no automatic submission or affirming. |
| Planner login on home | Existing authority login is reachable through More, alongside the existing role control. |
| Green portal styling and mixed icon fonts | Indigo/Mango, soft Indigo surfaces, rounded task cards/pills and a locally bundled official Lucide SVG subset; original credits remain intact. |

## New endpoint and configuration

`POST /api/v1/ai/assistant`

Body: `deviceId` (UUID), up to ten `{role,text}` messages (each at most 1000 characters), and `{tab, latitude?, longitude?, wardId?}` context. Returns `{success, data, fallback}` with a Zod-validated structured answer and allowlisted actions.

No new environment variables. It uses the existing server-only `GEMINI_API_KEY` and `GEMINI_MODEL`. The seven read-only tools call existing city summary, scorecard, weather, nearby, public report and department services. At most three tools execute per turn, with an eight-second bound per tool. Model requests have a separate bounded timeout and the complete turn is capped at fifty seconds.

Rate limit: twenty questions per ten minutes, checked independently against hashed device identity and IP. Conversation history is held in browser memory only (last ten turns; request history remains within the endpoint limit). New chat clears it. Messages are not persisted. Assistant logs contain call count, fallback metric and latency, not messages. Provider messages redact phone/email and receipt capability strings. Fact/contact cards come from server-authored service results, never arbitrary model-provided fact text. Missing/failed providers return the labelled safe fallback without invented facts.

The assistant microphone reuses `/api/v1/ai/transcribe`. Its draft action fills the existing form and requires user submission. Its affirm action opens the existing detail view and requires a separate user tap. Sharing includes only the public report ID, never the private receipt capability.

The existing `handleFormSubmit` function is unchanged, as verified by the UI integration test. Original IDs, form fields, API payload, idempotency/retry handling, receipt storage and authority permissions are retained. The wizard uses UI composition and response presentation adapters.

## Verification

- 13 suites / 93 tests passed, including assistant schema/grounding/privacy/rate limits, all original IDs, unchanged submit handler, wizard validation/real submission/receipt, token-free sharing, multi-select filters, role/login, affirming, report scores and existing admin workflows.
- Production build and changed browser JavaScript syntax checks passed.
- Local browser: 390px mobile and 1280px desktop, all six main screens, populated planning modules, area card, filter sheets, assistant starter cards/actions, photo upload/automatic check, analysis/fallback, location confirmation, duplicate affirm, report submission, receipt/share/tracking and authority login.
- No new console errors or page horizontal overflow in the final main-screen checks. Text contrast samples passed 4.5:1; raster map imagery is outside this DOM sampling check.
- Lighthouse 13.5.0 mobile **home-page Accessibility: 100**, no failed automated audits. This is not certification of every screen or physical device.
- A real configured Gemini request returned a non-fallback structured answer with service-grounded facts after the provider-format correction.
- `teal-` search over frontend files returns no matches. No production test report was created.

Local artifacts are under ignored `.feature-qa/`: `task-*-mobile.jpg`, `task-*-desktop.jpg`, `task-final-qa.json`, final test/build logs, and `lighthouse-final.report.html` / `.json`.

## Explicit limits

- The project has approximate ward centers, not authoritative ward polygons. GPS is used only when already permitted; a user must confirm their ward. Density shading is a visualization of actual visible report clusters, not a population/risk surface or administrative boundary.
- A priority score is calculated by the existing server on submission. The review step deliberately shows an unscored ring and explains this; the receipt shows the actual score.
- Physical Android microphone/GPS success is not certified by desktop tests. Permission/record-state/error paths, typing recovery and ordinary report submission remain tested. Provider or permission failure stays explicit.
- Some retained technical feature names, source attributions and original disclaimers include English; they are not replaced with invented translations of evidence or credits.
- No new APK was built. The installed WebView app receives the hosted UI when reopened; native shell permissions remain unchanged.
