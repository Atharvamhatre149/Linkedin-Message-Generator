# Outreach Message Generator

Generate **Short template**, **Full template**, and **Groq draft** variants from Atharva Mhatre's resume. Supports message and email output, with no application tracker.

## Start locally

Requires Node 22 or newer.

```sh
npm ci
cp .env.example .env.local
```

Set `GROQ_API_KEY` in `.env.local` using a key from https://console.groq.com/keys, then run:

```sh
npm run dev
```

The templates work without a key. Groq remains disabled until a server key is configured. Restart the server after changing the key or model. `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`.

The repository lockfile points to an internal npm mirror. If that mirror is unavailable, use your normal registry configuration. No new npm packages are needed for the Groq integration; it uses Node's built-in fetch.

## Use

1. Enter company, audience, and optionally role/contact/job ID/link.
2. Select **Message** or **Email**. Email optionally accepts a recipient address.
3. Choose a built-in achievement and optionally paste a job description.
4. Click **Generate drafts** for the short and full hardcoded templates.
5. Click **Generate with Groq** for the third variant. It uses the plain-text resume, form snapshot, and job description. Review generated facts and wording before use.
6. Edit any result, copy it, or use **Open email** to open the default mail handler with recipient, subject, and body. Nothing is sent automatically. The resume is included as a link; mailto does not attach files.

**Resume & connection settings** contains the editable resume text, resume URL, and 200/300-character connection-note budget. The built-in text is in `src/resume.js`; hardcoded template facts live in `src/messages.js`. Editing resume text affects Groq only. Groq always uses the current form and resume. If inputs changed since the templates were generated, both templates refresh before the Groq request. Regenerating Groq with unchanged inputs preserves template edits.

Message history keeps the last 20 generated/saved messages in this browser. Full resume and job-description text are never stored in history. Basic company drafts are saved on template generation and can be restored explicitly. Application tracking and CSV export have been removed; prior browser application data is left untouched.

## API contract

The Vite server, preview server, and Vercel Functions expose these same-origin routes:

- `GET /api/groq/status`: `{ configured: boolean, model: string }`; never returns credentials.
- `POST /api/groq/generate`: JSON with `company`, `position` (required for specific-role audiences), `msgType` (`referral`, `recruiter`, `generic-hr`, `generic-employee`), `channel` (`message`, `email`), `resumeText`, `resumeUrl` (HTTPS), and optional `contactName`, `jobId`, `jobLink` (HTTPS), `focus`, `jobDescription`.
- Success: `{ subject: string, message: string }`. Subject is empty for messages.
- Errors: `{ error: string }` with 400 for invalid inputs/JSON, 403 for foreign origins, 413 for oversized requests, 415 for wrong content type, 429 for busy/rate limits, 502 for upstream failures, and 503 for a missing server key.

The API key stays in server configuration and is never sent to the browser or stored in localStorage. Only an explicit Groq generation sends resume/job-description text to Groq. Requests are bounded, one generation runs at a time per server/function instance, and upstream calls time out after 25 seconds. Provider errors are sanitized and distinguish unsupported/decommissioned models, JSON-output failures, input size, quota, and service errors. The server instructs the model to treat resumes and job descriptions as untrusted data and use only supported facts; users must still review AI output.

The integration uses Groq's [Chat Completions API](https://console.groq.com/docs/api-reference) and [JSON Object mode](https://console.groq.com/docs/structured-outputs). For a local production preview use `npm run build` followed by `npm run preview`. Vercel runs `api/groq/status.js` and `api/groq/generate.js` as Node Functions, reusing the same backend validation and Groq client. Other static-only hosts still require a backend.

## Check

```sh
npm test
npm run lint
npm run build
```

Tests mock Groq and cover payloads, validation, missing keys, provider errors, output parsing, origin/body restrictions, template facts, history, and email link encoding. They do not establish live Groq availability.

## Deploy on Vercel

1. Deploy the repository with the Vite framework preset, build command `npm run build`, and output directory `dist`.
2. Add `GROQ_API_KEY` under Project → Settings → Environment Variables for Production (and Preview if used). Optionally add `GROQ_MODEL`. Do not use a `VITE_` prefix.
3. Push/deploy the commit that includes the root `api/` directory. Redeploy after changing environment variables.
4. Open `/api/groq/status` on the deployed domain: it must return JSON with `configured: true`. `configured: false` means the key is absent from that deployment; HTML or 404 indicates that the functions were not deployed or routing is overriding `/api`.
5. Generate a draft in the app. Check Vercel Function logs for failures; the status endpoint confirms configuration only, not validity of the provider key.

`vercel.json` allows 30 seconds for generation, covering the 25-second upstream timeout. The in-memory concurrency guard is per function instance, not a deployment-wide quota.
