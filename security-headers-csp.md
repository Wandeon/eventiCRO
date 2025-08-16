# Security Headers & CSP (v1) — Caddy & Cloudflare hardened config

> **Purpose:** Provide production‑ready HTTP headers for EventiCRO’s public endpoints. This file is referenced by:
>
> - **Project Baseline Index (v2.1)** → A2 “VPS Base & Reverse Proxy”.
> - **Infra/VPS Runbook (v1)** → §§3, 8.
> - **Deployment Docs (v2)** → reverse proxy and CDN sections.
>
> All settings default to **secure**. Where functionality requires relaxations (maps, Sentry, workers), allowlisted origins are listed explicitly from Track‑A **Outputs**.

---

## 0) Inputs (from Track‑A Outputs)

Fill these from `infra-vps-runbook.md → Outputs`:

- `APP_BASE_URL` (e.g., `https://app.example.com`)
- `API_BASE_URL` (e.g., `https://api.example.com` or same host)
- `TILESERVER_URL` (e.g., `https://tiles.example.com`)
- `NOMINATIM_URL` (internal; not exposed to browsers unless you choose to)
- `MINIO_URL` (normally tailnet‑only; if public asset host is used, add here)
- `SENTRY_DSN_ORIGIN` (e.g., `https://sentry.example.com`) → **extract origin from DSN**
- Optional: `MEDIA_SERVICE_URL` (if any browser‑visible endpoints are proxied)

---

## 1) Caddy include: `security_headers` snippet

> Import this snippet inside your site blocks (see example below). Non‑browser services (APIs) get a slightly different set.

```caddyfile
# Global options can stay minimal; headers are per‑site

# === Reusable snippet ===
(security_headers) {
  # Transport & downgrade protection
  header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"

  # MIME sniffing & legacy defenses
  header X-Content-Type-Options "nosniff"
  header X-Frame-Options "DENY"  # kept for legacy UAs; CSP frame-ancestors is primary
  header X-XSS-Protection "0"     # disable buggy legacy filter
  header X-Permitted-Cross-Domain-Policies "none"

  # Referrer & permissions
  header Referrer-Policy "strict-origin-when-cross-origin"
  header Permissions-Policy "geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=(), usb=(), interest-cohort=()"

  # Cross‑origin isolation (opt‑in). Enable if you need SharedArrayBuffer or stricter agent behavior.
  # header Cross-Origin-Opener-Policy "same-origin"
  # header Cross-Origin-Embedder-Policy "require-corp"
  # If you enable COOP/COEP, ensure all subresources (tiles, fonts, workers) serve CORP/COEP compatible headers.

  # Hide origin details
  header -Server
}

# === Browser app (PWA/UI) with CSP ===
(security_headers_csp_app) {
  import security_headers

  # Content Security Policy for SvelteKit + Leaflet/MapLibre + Sentry
  # Use nonces for inline scripts if you add any; default policy avoids 'unsafe-inline'.
  @csp header Content-Security-Policy "default-src 'self'; \
    base-uri 'self'; \
    object-src 'none'; \
    frame-ancestors 'none'; \
    img-src 'self' data: blob: ${TILESERVER_URL}; \
    font-src 'self' data:; \
    style-src 'self' 'unsafe-inline'; \
    script-src 'self' 'wasm-unsafe-eval'; \
    worker-src 'self' blob:; \
    connect-src 'self' ${API_BASE_URL} ${SENTRY_DSN_ORIGIN} ${TILESERVER_URL}; \
    media-src 'self' data: blob:; \
    form-action 'self'; \
    upgrade-insecure-requests"
}

# === API service headers (no CSP img/style/fonts needed) ===
(security_headers_api) {
  import security_headers
  # Narrower CSP for pure JSON APIs
  header Content-Security-Policy "default-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"
  header Access-Control-Allow-Methods "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  # CORS handled below per‑origin
}

# === CORS (strict allowlist from APP_BASE_URL) ===
(cors_strict) {
  @preflight method OPTIONS
  header @preflight Access-Control-Allow-Origin "${APP_BASE_URL}"
  header @preflight Access-Control-Allow-Methods "GET,POST,PUT,DELETE,OPTIONS"
  header @preflight Access-Control-Allow-Headers "authorization,content-type,x-requested-with"
  header @preflight Access-Control-Max-Age "600"
  header Access-Control-Allow-Credentials "true"
}
```

**Notes**

- `style-src 'unsafe-inline'` is included because Leaflet and some CSS‑in‑JS patterns inject inline styles. If you avoid that, remove it and use nonces instead.
- `script-src 'wasm-unsafe-eval'` allows MapLibre’s WASM init paths. If you use only Leaflet (no WASM), you can remove it.
- `connect-src` is restricted to your API, Sentry origin, and tiles host. Add additional origins only if required.

---

## 2) Caddy site examples

### 2.1 Single‑host app (`app.example.com`) that proxies API

```caddyfile
app.example.com {
  import security_headers_csp_app

  # App UI (SvelteKit)
  reverse_proxy /*        http://127.0.0.1:3000

  # API under /api
  import cors_strict
  reverse_proxy /api/*    http://127.0.0.1:8787

  # Optional GPU services (tight scope, consider auth)
  handle_path /media-proc/* { reverse_proxy http://gpu-01.tailnet.local:8088 }
  @browserless path /_bl_ws
  reverse_proxy @browserless ws://gpu-01.tailnet.local:3000
}
```

### 2.2 Separate API host (`api.example.com`)

```caddyfile
api.example.com {
  import security_headers_api
  import cors_strict
  reverse_proxy /* http://127.0.0.1:8787
}
```

---

## 3) Cloudflare Pages/Workers: `_headers` examples

> If you deploy the static front‑end via Cloudflare Pages, place an `_headers` file at the site root. Keep API behind Caddy.

```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-Permitted-Cross-Domain-Policies: none
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=(), usb=(), interest-cohort=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: ${TILESERVER_URL}; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' ${API_BASE_URL} ${SENTRY_DSN_ORIGIN} ${TILESERVER_URL}; media-src 'self' data: blob:; form-action 'self'; upgrade-insecure-requests
```

If you later migrate to MapLibre GL vector tiles with web workers, keep `worker-src blob:` and ensure the tiles server sets **CORP**.

---

## 4) CORP/COEP compatibility for subresources

When enabling **COEP: require-corp**, all fetched subresources must allow cross‑origin embedding:

- Tiles server responses add: `Cross-Origin-Resource-Policy: cross-origin` (or at least `same-site` if on a sibling subdomain) and `Cross-Origin-Embedder-Policy: require-corp` if needed.
- Fonts served cross‑origin require `Access-Control-Allow-Origin: ${APP_BASE_URL}` and `Cross-Origin-Resource-Policy: cross-origin`.
- Sentry’s SDKs and replay worker function with `worker-src blob:` and `connect-src` including your Sentry origin.

Only enable COOP/COEP if you need SharedArrayBuffer or advanced isolation—maps and standard PWA do **not** require it.

---

## 5) API caching & static asset caching

### 5.1 API routes (dynamic)

- Add on API site block:
  ```caddyfile
  header Cache-Control "no-store"
  header ETag "{http.response.header.ETag}"  # framework usually sets; harmless if absent
  ```

### 5.2 Static assets (UI)

- SvelteKit static files can be cached aggressively:
  ```caddyfile
  @assets path_regexp assets ^/build/.*\.(js|css|woff2|png|svg)$
  header @assets Cache-Control "public, max-age=31536000, immutable"
  ```

---

## 6) CORS rules

- Default stance: **single‑origin** CORS (only `APP_BASE_URL`).
- If you host the UI at `app.example.com` and API at `api.example.com`, add the app origin to the API allowlist (already done above). Do **not** use `*` with credentials.
- For preflight caching, `Access-Control-Max-Age: 600` is safe; raise if needed.

---

## 7) Service Worker & PWA notes

- CSP allows `worker-src blob:` so Workbox injected SW can run and spawn subworkers if needed.
- If you enforce nonces for `script-src`, ensure SvelteKit injects them; otherwise keep `script-src 'self'`.
- Add an **App Manifest** and icons per `frontend-ui-pwa.md`; no additional headers required here.

---

## 8) Sentry self‑hosted compatibility

- Allow `connect-src` to your Sentry origin extracted from DSN.
- If using **Replays**, keep `worker-src blob:` and avoid an over‑strict COEP unless Symbolicator/Relay endpoints also send proper CORP.

---

## 9) MinIO / public asset host (optional)

If you ever serve public images directly from MinIO (not recommended for end‑user traffic), ensure:

- CORS on MinIO bucket allows only `APP_BASE_URL`.
- For COEP setups, add `Cross-Origin-Resource-Policy: cross-origin` to object responses.
- Prefer proxying public assets through the app for consistent headers and cache control.

---

## 10) Verification checklist

- ✅ `curl -I https://app.example.com` shows each header above (except optional COOP/COEP).
- ✅ Browser DevTools → **Security** tab shows valid TLS + HSTS.
- ✅ DevTools **Network** tab shows no CSP violations; adjust allowlists if you see blocked origins.
- ✅ Map tiles load; Sentry events send.
- ✅ Uptime Kuma continues to succeed on `/api/health`.

---

## 11) Change log

- **v1**: Initial hardened set with Caddy snippet, API/CORS rules, Cloudflare `_headers`, and notes for COOP/COEP and vector‑tiles workers.

