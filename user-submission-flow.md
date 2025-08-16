# User Submission Flow (v2) — Public submit → moderation → publish

> **Scope:** End‑to‑end flow for accepting public event submissions, validating and rate‑limiting them, protecting against abuse (captcha + heuristics), placing them into a **moderation queue**, and promoting approved items into normalized tables (`events`, `venues`, `organizers`). Aligns with:
>
> - `core_data_model_api.md (v2)` — tables (`submissions`, `events`, `venues`, `organizers`) and ingestion upserts.
> - `frontend-ui-pwa.md (v2)` — Submit form UI, Zod validation, Workbox Background Sync.
> - `security-headers-csp.md (v1)` — CORS/CSP rules.
> - `deployment-docs.md (v2)` — tests & `/api/health`.
> - `map-integration.md (v2)` — geocoding rate limits for enrichment.

---

## 0) Goals & constraints

- **Simple UX**: one clean form, mobile‑friendly, HR/EN, clear success state (`202 Accepted`).
- **Abuse control**: **Friendly Captcha** + IP rate limits + honeypot + minimal PII.
- **Privacy**: no submitter accounts, no emails by default; store only what’s required to moderate and publish.
- **Moderation‑first**: nothing goes live without approval.

---

## 1) Public API

### 1.1 `POST /api/submit`  → `202 Accepted`

- **Request body (JSON)**

  ```json
  {
    "title": "string",                     // required
    "description": "string",               // optional, ≤ 2000 chars
    "start_time": "2025-09-12T18:00:00Z",  // required (UTC or with TZ)
    "end_time": "2025-09-12T21:00:00Z",    // optional; must be > start
    "venue_name": "string",                // optional
    "address": "string",                   // optional
    "city": "string",                      // optional but recommended
    "lat": 45.81,                           // optional
    "lng": 15.98,                           // optional
    "organizer_name": "string",            // optional
    "url": "https://…",                    // optional, validated if present
    "image_url": "https://…",              // optional (see §2 signed upload)
    "price": "Free / 10€ / …",             // optional short label
    "captcha_token": "…",                   // required (Friendly Captcha)
    "honeypot": ""                          // must be empty (hidden field)
  }
  ```

- **Responses**

  - `202 { "submission_id": "uuid" }` on success (queued for moderation)
  - `400` on validation error (JSON with field errors)
  - `401/403` on captcha failure
  - `429` on rate limit (with `Retry-After`)

- **Headers**

  - Always return `Cache-Control: no-store`.
  - Rate limit headers: `X-RateLimit-*` (see §3.1).

- **Behavior**

  - Validate body (Zod) and reject if `honeypot` is non‑empty.
  - Verify `captcha_token` with **Friendly Captcha** server endpoint using secret (see §1.3).
  - Insert payload into `submissions(payload)` with `status='pending'`.
  - Do **not** derive or geocode here; enrichment happens **asynchronously** (n8n or admin action) respecting Nominatim limits.

### 1.2 `GET /api/admin/submissions` (protected)

- Query: `status` (`pending|approved|rejected`), `cursor`, `limit` (≤ 50).
- Response: `{ items: [ { id, created_at, status, payload, reviewer, reviewed_at, reason } ], next_cursor }` (matches cursor rules in core API).

### 1.3 `POST /api/admin/submissions/:id/approve` (protected)

- Action: Promotes `payload` → normalized tables using the **same upsert mapping** as `/ingest`.
- Writes `status='approved'`, `reviewer`, `reviewed_at`, and returns `{ promoted_event_id }`.
- Optional enrichment before insert: if no `lat/lng` and address present, do **one** server‑side geocode (respect 1 rps and Redis cache).

### 1.4 `POST /api/admin/submissions/:id/reject` (protected)

- Body: `{ reason?: string }` → sets `status='rejected'`, persists optional `reason`.

> **Auth:** Bearer JWT (service role/admin). Never expose admin routes without auth.

---

## 1.3 Friendly Captcha Verification

- **Env**
  - `FRIENDLY_CAPTCHA_SITEKEY=…`
  - `FRIENDLY_CAPTCHA_SECRET=…`
- **Server call**: POST to Friendly Captcha verify endpoint with `secret` and `solution` (= `captcha_token`). On failure, return `403`.
- **Timeouts**: 3s connect, 5s total; on timeout, return `503` (client retries allowed).
- **CSP**: Allow the Friendly Captcha script origin in CSP only on the **submit page** if using their widget; otherwise use the privacy‑friendly invisible widget variant.

> If you later self‑host a captcha or swap provider, keep the server verification contract identical to avoid frontend changes.

---

## 2) Images: signed uploads (optional)

Two safe options; pick **A** for simplicity.

**A) Proxy upload via API** (default)

- Client uploads `multipart/form-data` to `POST /api/upload`.
- API streams to **MinIO** using server creds; returns a permanent URL (or media key in MinIO). Adds image constraints and scanning.

**B) Browser direct → MinIO (pre‑signed)**

- Client asks `POST /api/uploads/sign` with `{ contentType, size }`.
- API returns `{ url, fields }` for a short‑lived presigned POST; client uploads directly to MinIO.
- Requires MinIO CORS to allow only `APP_BASE_URL`.

**Constraints**

- Max size **2 MB**, types: `image/jpeg`, `image/png`, `image/webp`.
- Generate thumbnails server‑side (n8n worker) and optimize (sharp/ffmpeg).
- (Optional) antivirus (ClamAV) or mime sniffing before accepting.

---

## 3) Anti‑abuse & rate limiting

### 3.1 Limits

- **Public submit**: **5/min/IP** and **30/day/IP**; return `429` with `Retry-After`.
- **Admin**: Protect by auth; optional **10/sec/user** limit to avoid accidental floods.

**Redis keys (examples)**

- `rl:submit:min:{ip}` window 60s → limit 5
- `rl:submit:day:{ip}:{YYYYMMDD}` window 86400s → limit 30

### 3.2 Honeypot & heuristics

- Hidden `honeypot` field must be empty.
- Reject if title or description is mostly URL spam or contains known bad domains list (configurable).
- Normalize and trim fields; maximum lengths enforced server‑side.

### 3.3 Background Sync (offline submit)

- The PWA queues `/api/submit` (Workbox **BackgroundSync**) when offline (see frontend doc §7.3). Server treats late arrivals identically.

---

## 4) Moderation workflow (admin UI MVP)

- **Queue view**: table with `created_at`, title, start\_time, venue/city snippet, and link preview.
- **Detail**: shows full payload + derived map if coordinates present + quick check links (open `url` in new tab).
- **Actions**: **Approve** (runs upsert + optional geocode), **Reject** (with reason), **Duplicate** (reject w/ reason template).
- **Shortcuts**: `a` approve, `r` reject, `d` duplicate.
- **Filters**: pending/approved/rejected; search by `q` over title and `url`.

**n8n hooks** (optional)

- On new `pending`, send Slack/email to moderators.
- On **approve**, queue a thumbnail fetch (browserless screenshot fallback), image optimization, and cache warm for `/events`.

---

## 5) Validation rules (server)

- `title`: 3..140 chars.
- `description`: 0..2000 chars; HTML stripped or sanitized (DOMPurify server equivalent) to plain text.
- `start_time`: ISO8601; must be ≥ `now() - 1 day` (allow back‑dated recent events only for corrections).
- `end_time`: if present, must be after `start_time` and < `start_time + 14 days`.
- `city`: 2..80 chars; title‑cased on insert.
- `url`/`image_url`: `https://` only; host length guard; block known bad hosts.
- `lat/lng`: if present, in valid ranges; otherwise ignore.

All violations → `400` with `{ fieldErrors: { field: 'message' } }`.

---

## 6) Promotion to canonical tables (the “approve” path)

- Use the **same SQL upsert** sequence as `/ingest` (see core API §7).
- Idempotency via `(source, source_id)`:
  - For submissions, set `source='submit'` and `source_id` = **hash** of normalized `{title,start_time,venue_name,address,city}` (SHA‑1 or xxHash64). Store the hash in a local variable during approval to prevent duplicates.
- Return `{ promoted_event_id }` and store it on the submission record (add nullable column `promoted_event_id UUID` if you choose; optional — see note below).

> **Note (schema additions):** If you want to persist links between submissions and the final event, add columns in a migration: `ALTER TABLE submissions ADD COLUMN promoted_event_id UUID REFERENCES events(id);` This is optional and not required for MVP behavior.

---

## 7) Frontend specifics (Submit page)

- Zod schema mirrors server constraints; localization for error messages.
- Include Friendly Captcha widget and pass the solution as `captcha_token`.
- After `202`, show reference ID and text from i18n bundles (see keys below).
- Provide links to guidelines (what to submit; no ads).

**New i18n keys (append to bundles)**

```json
// en.json
{
  "submit": {
    "guidelines": "Please submit public events in Croatia. No ads or unrelated content.",
    "reference": "Your reference ID is {id}.",
    "captcha_failed": "Captcha verification failed. Please try again.",
    "rate_limited": "Too many submissions. Please wait a bit and try again."
  }
}
```

```json
// hr.json
{
  "submit": {
    "guidelines": "Pošaljite javne događaje u Hrvatskoj. Nisu dopušteni oglasi ili nepovezani sadržaj.",
    "reference": "Vaš referentni ID je {id}.",
    "captcha_failed": "Provjera captche nije uspjela. Pokušajte ponovno.",
    "rate_limited": "Previše pokušaja. Pričekajte malo i pokušajte ponovno."
  }
}
```

---

## 8) Observability & metrics

Expose basic counters/gauges (OTel) from the API:

- `submissions_received_total`
- `submissions_captcha_failed_total`
- `submissions_rate_limited_total`
- `submissions_approved_total`
- `submissions_rejected_total`
- `submissions_pending_current`

Send all unhandled errors to **Sentry** with request ID; **never** log full payloads (PII minimization). Redact URLs if they contain query params.

---

## 9) Security & compliance

- Enforce HTTPS for public endpoints; API sits behind **Caddy** with hardened headers.
- Store only the raw `payload` and moderation metadata; no submitter PII by default.
- If you later add contact email, update Privacy Policy and add `submitter_email TEXT` with explicit consent capture.
- Purge **rejected** submissions older than **90 days** (see `backups-runbook.md` purge jobs) if desired.

---

## 10) Tests (Playwright & integration)

- Form validation happy path → `202` with ID.
- Captcha fail → `403`.
- Honeypot filled → `400`.
- Rate limiting → `429` with `Retry-After` present.
- Admin list/approve/reject flows (mock auth) → correct status transitions and, on approve, an `events` row exists.

---

## 11) Change log

- **v2:** Solidified public submit contract, captcha + rate limits, optional signed uploads, admin actions mapping to canonical upserts, i18n keys, and metrics hooks.

