# App configuration

## Private administrator

The app uses private administrator login. Switching to administrator mode opens
the login form; it never signs in using a public account. Successful login
refreshes the current report, action queue and directory. Sessions are kept in
the current browser session and can be ended with **লগআউট**.

Create an operator locally:

```powershell
node apps/api/scripts/setup-operator.cjs your@email.com
```

This writes `OPERATOR_EMAIL`, `OPERATOR_NAME` and a bcrypt password hash to
`apps/api/.env`. Login details are saved in `apps/api/credentials.json`, which
is ignored by Git. The script refuses to replace an existing operator.
Restart the API to provision the account. For Render, copy `OPERATOR_EMAIL`
and `OPERATOR_PASSWORD_HASH` from the local environment into the service's
environment settings, and optionally set `OPERATOR_NAME`. Never put the plain
password in frontend code. Existing provisioned accounts continue to work.

## Gemini free tier

The default model is `gemini-2.5-flash-lite`, which has free input and output
on the Gemini API Free tier:
https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-lite

Create a key at https://aistudio.google.com/apikey using a Google project on
the **Free** tier. Set the following in `apps/api/.env` locally, or in the
Render service's environment settings for the hosted mobile app:

```dotenv
GEMINI_API_KEY=your_actual_key
GEMINI_MODEL=gemini-2.5-flash-lite
```

Restart the API, then check connectivity:

```powershell
node apps/api/scripts/check-gemini.cjs
```

The key stays on the server. Preview, report analysis, action drafts and planning
interpretation use the configured model. The app does not enable billing or
switch to a paid provider. Google controls project billing and quota: choosing
a model alone does not make a paid Google project free. When a preview cannot
reach Gemini, users can request a labelled rule-based summary or submit a report
directly. Administrator action drafts can use category templates when no key
is configured.

## Citizen data and hosting

Home statistics, report lists, planning tools and maps default to citizen
reports. Sample data is accessible through the separate **নমুনা রিপোর্ট**
source. Existing sample records retain their provenance; they are not converted
into citizen reports.

Use `DATABASE_PROVIDER=postgres` with a valid `DATABASE_URL` for durable data.
Memory mode is temporary and loses records when the server restarts.

The mobile app loads `https://nagarbondhu-api.onrender.com` unless
`EXPO_PUBLIC_APP_SERVER_URL` is set at build time. Local code changes must be
deployed to that backend before they appear in the installed app.

## Verification

```powershell
npm run build:shared
npm --prefix apps/api run build
npm --prefix apps/api test
```

Administrator UI tests run the actual frontend code in a DOM environment
connected to the real Express API. They cover private login, refreshed report
buttons, draft generation, assignment, status updates, progress, expiry/logout,
information requests and source filtering. They do not replace visual testing
on a physical Android device.
