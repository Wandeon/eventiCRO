# Deployment Docs (v2) — CI/CD, Tests, Releases

> **Scope:** How we build, test, and release EventiCRO. This file ties together the OpenAPI artifact, security headers, observability, and the infra outputs. Use this as the step‑by‑step for CI and production releases.
>
> **References:**
>
> - `project-baseline-index.md` → PR‑1, PR‑2, PR‑9
> - `openapi/openapi.yaml` & `api/openapi.ts`
> - `security-headers-csp.md`
> - [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md), `backups-runbook.md`, `tailscale-networking.md`, `infra-vps-runbook.md`, `track-a-outputs.md`

---

## 0) Environments

| Env     | URL examples                                          | Purpose            |
| ------- | ----------------------------------------------------- | ------------------ |
| local   | `http://localhost:3000`, `http://localhost:8787`      | dev, fast feedback |
| staging | `https://staging.app.example.com`                     | pre‑prod checks    |
| prod    | `https://app.example.com` / `https://api.example.com` | end users          |

**Note:** Public endpoints are **HTTPS** behind **Caddy**. Internal service‑to‑service calls can use tailnet HTTP (see `tailscale-networking.md`).

---

## 1) Required secrets (per environment)

Populate from [track-a-outputs.md](track-a-outputs.md). Store these in your CI secrets manager and on the servers.

- **App:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `REDIS_URL`, `MINIO_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `INGEST_SECRET`.
- **Sentry release (optional):** `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_URL` (self‑hosted origin).
- **Playwright basic auth credentials** if staging is protected.

---

## 2) Package scripts (unified)

> Ensure `package.json` contains the following scripts. (Keep existing ones; append these.)

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
      "test": "pnpm run test:integration && pnpm run test:e2e",
    "build:ui": "vite build",                     
    "build:sw": "workbox injectManifest",
    "build:api": "tsc -p api/tsconfig.json",
    "build": "pnpm run build:ui && pnpm run build:sw && pnpm run build:api",

    "test:openapi": "node -e \"require('fs').accessSync('openapi/openapi.yaml')\"",
    "test:integration": "schemathesis run --checks all --rate-limit=50 --hypothesis-max-examples=50 --base-url=$API_BASE_URL $API_BASE_URL/openapi.json",
    "test:e2e": "playwright test",

      "ci": "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run test:openapi && pnpm run build"
  }
}
```

 - `test` runs the integration (`test:integration`) and end-to-end (`test:e2e`) suites in sequence.
 - `build:sw` assumes you wired [Workbox](frontend-ui-pwa.md#7-pwa--offline-workbox-v7) in `frontend-ui-pwa.md`.
 - `test:integration` points to the served artifact from `api/openapi.ts` at `/openapi.json`. If the API lives under `/api`, use `$API_BASE_URL/openapi.json` (e.g., `https://api.example.com/openapi.json`).

---

## 3) GitHub Actions (CI)

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-test:
    runs-on: ubuntu-latest
    env:
      API_BASE_URL: https://api.example.com   # staging/api for PRs if available
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 1
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Lint & typecheck & unit
        run: pnpm run lint && pnpm run typecheck && pnpm run test

      - name: Build (UI+SW+API)
        run: pnpm run build

      - name: Schemathesis (integration)
        env:
          API_BASE_URL: ${{ secrets.CI_API_BASE_URL }}
        run: pnpm run test:integration

      - name: Playwright E2E
        env:
          APP_BASE_URL: ${{ secrets.CI_APP_BASE_URL }}
        run: pnpm run test:e2e

      - name: Trivy scan (deps & container, optional)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
```

**Quality gates:** CI must fail on any of: ESLint errors, TS errors, unit test failures, Schemathesis failures, E2E failures, or High/Critical vulnerabilities.

---

## 4) GitHub Actions (Release)

Create `.github/workflows/release.yml` (manual or on tag):

```yaml
name: Release
on:
  workflow_dispatch:
  push:
    tags: ['v*.*.*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build

      - name: Create Sentry release (optional)
        if: ${{ secrets.SENTRY_AUTH_TOKEN != '' }}
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
          SENTRY_URL: ${{ secrets.SENTRY_URL }}
          RELEASE: ${{ github.sha }}
        run: |
          npx sentry-cli --url "$SENTRY_URL" releases new "$RELEASE" --projects "$SENTRY_PROJECT"
          npx sentry-cli --url "$SENTRY_URL" releases set-commits "$RELEASE" --auto
          npx sentry-cli --url "$SENTRY_URL" releases finalize "$RELEASE"

      - name: Build & push images (optional)
        run: |
          echo "Build & push your Docker images here (multi-arch if needed)"

      - name: Deploy (SSH or rsync)
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_USER: ${{ secrets.VPS_USER }}
        run: |
          echo "Deploy via your preferred method (rsync, docker compose pull, etc.)"
```

---

## 5) Server deploy steps (VPS‑01)

> If you use Docker Compose per service, deploy by pull + restart. Keep services bound to loopback/tailnet.

1. **Pull images & restart services**
   ```bash
   docker compose pull && docker compose up -d  # per service directory
   ```
2. **Run DB migrations** (Supabase or SQL files):
   - If using Supabase CLI: `supabase db push` against your instance.
   - If using SQL migrations: `psql -f db/migrations/*.sql` in order.
3. **Pre‑warm caches** (optional): call `/events?limit=1` to set up prepared plans.
4. **Rotate Sentry release** env: `RELEASE=$(git rev-parse --short HEAD)`.
5. **Reload Caddy** if config changed: `caddy reload --config /srv/caddy/Caddyfile`.

---

## 6) Tests we run

### 6.1 Schemathesis (contract + negative tests)

- Base URL: `https://api.example.com` (or staging)
- Target: `/openapi.json`
- Checks: **all** (including response timeouts, content type, invalid media types)
- Rate limit: 50 RPS cap to avoid tripping quotas in CI

### 6.2 Playwright (E2E flows)

- Smoke tests: home loads, search `q` works, map loads tiles, event detail opens, submit form validates and returns `202`.
- Admin (behind auth): submissions list loads, approve/reject calls succeed (mocked if needed).
- Visual: optional screenshot diff for home and detail pages.

### 6.3 Lighthouse (optional budget)

- Check PWA installability, performance budget (JS < 250KB gz).

---

## 7) Post‑deploy verification (checklist)

- ✅ `GET /api/health` returns `{ status: ok, version, git_sha }`.
- ✅ `GET /events?limit=3` returns items + `X-RateLimit-*` headers.
- ✅ Captcha‑protected `/api/submit` responds `202` with `submission_id`.
- ✅ Error in app shows up in **Sentry** with correct **release** and **environment**.
- ✅ Grafana dashboard shows Prometheus and Loki data; Uptime Kuma checks are green.
- ✅ Tiles load and geocoder responds (internal if private).

---

## 8) Rollback

- Keep the last **two** app images and a previous Caddy config.
- Roll back by re‑deploying the previous image/version and running the **DB restore** *only if* a migration was faulty.
- Consult `backups-runbook.md` for PITR.

---

## 9) Service discovery

See [track-a-outputs.md](track-a-outputs.md) for the authoritative list of runtime URLs and endpoints.

---

## 10) Security & compliance notes

- CSP/HSTS/CORS per `security-headers-csp.md` are mandatory for public hosts.
- Keep Grafana/Prometheus/Loki **tailnet‑only** unless there’s a strong reason; if public, put them behind **Caddy** with auth.
- Store CI secrets at org level; rotate quarterly and after staff changes.
- Use **Trivy** and **gitleaks** in CI to block vulnerable deps and leaked secrets.

---

## 11) Change log

- **v2**: Switched telemetry docs to **self‑hosted Sentry**; added `/api/openapi.json` for Schemathesis; unified scripts; added quality gates & post‑deploy checks.

