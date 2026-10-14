# নাগরিক অংশগ্রহণ ও পরিকল্পনার ছয়টি ফিচার

The server UI is shared by the browser and existing WebView APK. No APK rebuild is needed. The six phases and resolution-photo star ratings have separate commits. All new persisted fields are added with non-destructive Prisma migrations, applied by the existing Render start command.

| Phase | Feature | Endpoints |
| --- | --- | --- |
| 1 | Nearby schools, health services, markets, transport and worship sites within 200 m; transparent capped +15 priority bonus | `GET /api/v1/reports/:id/nearby`, `GET /api/v1/nearby?latitude=…&longitude=…`, `POST /api/v1/admin/backfill-nearby` |
| 2 | Unique browser support; receipt or supporter verification; automatic reopening on reporter rejection or opposing quorum | `POST /api/v1/reports/:id/affirm`, `POST /api/v1/reports/:id/citizen-verification` |
| 3 | Public ward statistics, transparent A–E grades and category/source filters | `GET /api/v1/wards/scorecard?source=citizen_report&category=DRAINAGE` |
| 4 | Gemini compares uploaded photo with complaint description; never blocks submission | `POST /api/v1/ai/check-photo` |
| 5 | Up to 60 seconds of browser audio; editable Bangla transcription | `POST /api/v1/ai/transcribe` |
| 6 | Next 24 hours of rain in Dhaka time; authority maintenance queue with temporary boosts | `GET /api/v1/rain-queue?source=citizen_report` |
| Rating | 1–5 stars on resolved reports with after photos; browser votes update, public aggregate only | `POST /api/v1/reports/:id/rating`, aggregate in `/tracking` |

New optional environment variable: `RAIN_ALERT_MM=20`. Existing `GEMINI_API_KEY` and `GEMINI_MODEL` power text, vision and audio. Existing `JWT_SECRET` salts device/IP hashes; do not rotate it casually because receipt capabilities depend on it. PostgreSQL retains nearby data, affirmations, verification, reopening counts, photo checks and ratings.

The live API engine already uses severity 65%, unresolved age 25% and verified duplicates 10%, rather than the historical shared utility's 40/30/20/10. It retains this existing base, adds the OSM bonus, and adds an evidence-based impact term (6 × factor, capped at +30): 0–2 supporters = 0; 3–9 = 3; 10–24 = 4; 25+ = 5. Total is capped at 100. All new terms appear in the explanation. Historical guessed demo impact is excluded. Existing safety triggers and administrator priority overrides are retained.

OSM results are cached for 24 hours, persisted per report and reusable by rounded coordinate. An unavailable result is retried after a short failure-cache period. Report enrichment has a 2.8-second network budget and cannot reject report submission. Backfill accepts `{source,offset,limit}` with maximum five reports, returns a continuation offset, and spaces queries by at least two seconds. It requires a provisioned operator; the public demo identity cannot mutate ordinary admin routes.

New participation/media POST endpoints have a 20/hour limit per hashed IP and supplied browser/receipt identity. Support identities are browser-based, not verified people. Clearing local storage creates a new identity. Raw device IDs, IP addresses and vote identities are excluded from public reports; comments/photos on verification are retained privately for review. Reporter receipts remain bearer capabilities on the submitting device. Raw audio is not saved on the server; only hashed request keys and validated transcription responses are cached in memory for 30 minutes.

Photo checks accept uploaded local images or image data up to 4 MB. Arbitrary external URLs are not fetched. Gemini errors and unclear images are explicitly labelled. Speech accepts browser-supported WebM/MP4/Ogg and supported audio data up to 5 MB. Microphone availability and permission depend on the browser/WebView. Failed transcription can be retried or replaced by typing.

Ward grades require at least three reports. Missing resolution timestamps do not earn a timeliness bonus. Unknown wards are counted separately. The score measures only reports received by this app, not individual performance or all city problems. Fictional source data stays labelled নমুনা, including scorecards and rain queues.

Live providers: [Google Gemini](https://ai.google.dev/gemini-api/docs), [OpenStreetMap Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [Open-Meteo](https://open-meteo.com/en/docs). Map tiles: OpenStreetMap contributors; satellite imagery and labels: Esri, Maxar and Earthstar Geographics. Credits appear in the app footer and on provider-specific views. Weather errors never become a fabricated no-rain forecast. The forecast threshold and queue boosts never change persisted report priority.

## 60-second screen-recording path

1. 0–8s: **সমস্যা রিপোর্ট** → 🎤 **বলে অভিযোগ করুন**, or type a short Bangla drainage complaint. Review and edit the transcription.
2. 8–16s: Choose a relevant photo → **বিবরণ বিশ্লেষণ করুন** → show the labelled AI summary and photo-consistency result.
3. 16–24s: Use GPS or place the map pin → confirm location → submit → show **আশেপাশে কারা ঝুঁকিতে**, nearby OSM places and explained score. For a quick recording, prepare the report beforehand; provider latency varies.
4. 24–30s: From a second browser/device open the report → **🙋 আমিও ভুক্তভোগী**; a reporter's own browser cannot self-affirm.
5. 30–37s: **ওয়ার্ড স্কোরকার্ড** → select the appropriate source → open a ward's map/reports and transparent score formula.
6. 37–44s: Switch to the provisioned authority session → planning dashboard → **বৃষ্টির আগে রক্ষণাবেক্ষণ** and the queue's temporary boost.
7. 44–52s: Open a prepared assigned report → mark it in progress, then resolved with a repair note and after photo. Assignment and revision checks remain enforced.
8. 52–60s: Return to the reporter browser → **সমস্যাটা কি সত্যিই ঠিক হয়েছে?** → confirm or reject; show a confirmation badge or automatic reopening. After-photo star ratings are immediately below the repair photo.

Use only labelled fictional reports for demonstration, or clearly identified local QA data. Do not create fake citizen reports to populate production metrics. A full voice recording, provider waits and administrative assignment can exceed 60 seconds; prepare the two sessions and report beforehand for a continuous recording.
