# Project Baseline Index (v2) — EventiCRO

> **Goal:** Make the path crystal clear and split the work into two independent tracks:
>
> 1. **Track A — Infra/VPS & Services** (domain → VPS → self‑hosted tools → secrets → observability → backups).
> 2. **Track B — App Build by LLM Agent** (data model, API, UI, PWA, packaging).
>
> Track B **must not start** until Track A is completed and all required runtime values (DNS, TLS, URLs, DSNs, keys) exist.

---

## 0) How to use this index

- This file is the **single source of truth** for project order and responsibilities.
- Each referenced spec is authoritative for its scope. Do not invent behavior outside the specs.
- When a spec says "ask a concise question if something is missing," pause and ask.

---

## A. Track A — Infra/VPS & Services (Infra-first)

**Outcome:** After this track, you have a domain, HTTPS, and every self-hosted dependency reachable with stable URLs + credentials.

### A0. Network topology & hosts (Tailscale)

- **Hosts:**
  - **VPS-01 (public)** — reverse proxy (Caddy), primary services, databases, observability, public webhooks.
  - **GPU-01 (tailnet-only)** — GPU-heavy & CPU-intensive workers (media, crawling, rendering). No public exposure; reachable via Tailscale **MagicDNS** or 100.x address.
- **Access:**
  - Join both hosts to the same **Tailscale** tailnet. Enable **MagicDNS** and ACLs to allow `vps-01 → gpu-01` only for needed ports.
  - Prefer private tailnet URLs for service-to-service calls; expose only the app API/UI and selected dashboards publicly.
- **Service placement rule of thumb:** public endpoints on **VPS-01**; heavy batch/stream jobs and optional AI tooling on **GPU-01**.

### A1. Domain & DNS

- Purchase domain and configure DNS at your registrar.
- Create records:
  - `A` → VPS IPv4 for **app** (Caddy) (e.g., `app.example.com`).
  - `A` → VPS IPv4 for **API** (optional separate host, else reuse) (e.g., `api.example.com`).
  - Optional: subdomains for services (e.g., `sentry.`, `minio.`, `tiles.`, `geo.`, `redis.` if exposed via VPN only, then skip DNS).

### A2. VPS Base & Reverse Proxy

- OS hardening, firewall, fail2ban.
- Install **Caddy** as the reverse proxy with automatic HTTPS for public endpoints.
- Add HSTS and CSP snippets (see `security-headers-csp.md`).

### A3. Core Services (self-hosted)

- **Postgres/Supabase** — DB + Auth + RLS. **Host:** VPS-01.
- **Redis** — rate limits/queues with **AOF** enabled. **Host:** VPS-01.
- **MinIO** — S3-compatible media buckets (thumbnails, uploads). **Host:** VPS-01.
- **TileServer GL** — tiles for maps (raster now; optional vector later). **Host:** VPS-01.
- **Nominatim** — geocoding (rate limited). **Host:** VPS-01.
- **Sentry (self-hosted)** — errors + performance + replays (`SENTRY_DSN`). **Host:** VPS-01.
- **OTel Collector + Prometheus + Loki + Grafana** — metrics/logs/traces. **Host:** VPS-01.
- **Uptime Kuma** — synthetic checks. **Host:** VPS-01.
- **Portainer** — optional Docker management UI (protect behind auth/VPN). **Host:** VPS-01.
- **Netdata** — optional node/system monitoring. **Host:** VPS-01.
- **Gotenberg or WeasyPrint** — HTML→PDF service. Pick one; default to **Gotenberg**. **Host:** VPS-01.
- **Crawl4AI** — crawler/extractor for ingestion enrichment. **Host:** GPU-01 (or VPS-01 if light use).
- **SearXNG (optional)** — meta-search for research/enrichment; restrict to VPN/admin. **Host:** VPS-01.
- **Qdrant (optional)** — vector store for semantic de-duplication/recommendations (post-MVP). **Host:** VPS-01.
- **OpenWebUI (optional, dev)** — local LLM UI for admin/testing only. **Host:** GPU-01.
- **Nginx** — **not used** (we standardize on **Caddy**). Remove to avoid duplication.
- **Windmill** — optional orchestrator; we standardize on **n8n**. Keep off by default.

### A4. Secrets & Config

- Canonical approach: **environment variables** (.env / Caddy env) for runtime.
- Optional: Integrate a secrets manager later (Vault or Infisical). Vaultwarden is for human passwords, not runtime app config.

### A5. Backups & Disaster Recovery

- Postgres PITR via **WAL-G** to S3 (MinIO or cloud bucket).
- MinIO versioning + lifecycle policies.
- Runbook (`backups-runbook.md`) with test-restore steps.

### A6. Health & Observability

- `/api/health` returns `{ status, version, git_sha }`.
- Dashboards and alerts for API latency, error rate, rate-limit hits, storage usage.

### A7. GPU worker plane (n8n Queue mode over Tailscale)

- **Pattern:** n8n runs in **Queue mode** with Redis on VPS-01. The **n8n main (web)** service stays on VPS-01 (public webhooks). **Workers** run on GPU-01 and pull jobs via Redis over Tailscale.
- **Autoscaling:** Start with manual scaling (`docker compose up --scale n8n-worker=4`). Optional script scales workers based on queue depth + CPU/GPU usage.
- **Work types on GPU-01:**
  - Media: `ffmpeg` (NVENC if available), `yt-dlp`, waveform/thumb generation.
  - Rendering: `puppeteer` (via `browserless/chrome`), heavy HTML→PDF if chosen.
  - Imaging: `imagemagick`, `pdf2png`.
  - Crawling: `crawl4ai` headless jobs.
- **Routing:** Caddy on VPS-01 can reverse proxy internal paths (e.g., `/media-proc/*`) to GPU-01 over Tailscale.

**Gate to Track B:** You must have a completed **Infra Checklist** with all URLs, ports, and credentials recorded in `infra-vps-runbook.md` → **Outputs** section.

---

## B. Track B — App Build by LLM Agent (after Infra is ready)

**Outcome:** Working web app (PWA) + API + migrations + packaging, built against the live endpoints from Track A.

### B1. Data Model & API

- Use `core_data_model_api.md` for schema and OpenAPI (now first-class under `/openapi/openapi.yaml`).
- Cursor pagination, radius search, quotas; admin endpoints for moderation and feature flags.

### B2. Frontend UI & PWA

- Use `frontend-ui-pwa.md` (SvelteKit). Workbox `injectManifest` wired in `package.json`.
- Map via Map library (see `map-integration.md`).

### B3. Submission Flow

- Use `user-submission-flow.md`; Friendly Captcha; moderation queue.

### B4. Packaging

- Use [mobile-packaging.md](mobile-packaging.md) for TWA (Android) + Capacitor (iOS).

### B5. Deployment & Tests

- Use `deployment-docs.md`: CI (unit + schemathesis + Playwright), release checklist.

---

## C. Source-of-Truth Files (updated list)

> Files in **bold** are **new** in v2. Files marked with `▲` had breaking edits.

1. **`infra-vps-runbook.md`** — *New*. A step-by-step guide from domain purchase to a fully configured multi-host setup (VPS-01 public, GPU-01 tailnet). Includes DNS, Caddy HTTPS, Supabase, Redis AOF, MinIO, TileServer GL, Nominatim, Sentry self-hosted, OTel stack, Uptime Kuma, Portainer, Netdata. Provides a filled **Outputs** table (URLs/DSNs/keys) consumed by the app.
2. **`tailscale-networking.md`** — *New*. Tailnet join, ACLs, MagicDNS, service discovery, and examples of private reverse proxying from Caddy → GPU-01.
3. **`security-headers-csp.md`** — *New*. Hardened headers (CSP, HSTS, XFO, COOP/COEP), with Caddy and Cloudflare Pages examples.
4. **`backups-runbook.md`** — *New*. Postgres PITR with WAL-G, MinIO versioning, restore rehearsal, cron examples.
5. **[Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md)** — *New*. Minimal OTel → Prometheus (metrics), Loki (logs), Sentry (traces/errors) + Grafana dashboards.
6. **`openapi/openapi.yaml`** — *New*. Full OpenAPI (events, ingestion, admin, health) used by schemathesis. Served by `api/openapi.ts` at `/api/openapi.json`.
7. **`api/openapi.ts`** — *New*. Static JSON serving of compiled OpenAPI.
8. **`project-baseline-index.md`**\*\* (this file)\*\* ▲ — Introduces Dual‑Track plan, multi-host topology, and authoritative order of work.
9. **`deployment-docs.md`** ▲ — Switched telemetry to **Sentry self‑hosted**; adds `/api/health` contract, CI quality gates, and service discovery table.
10. **`core_data_model_api.md`** ▲ — Adds cursor pagination, radius filters, admin endpoints, stable ordering, FTS guidance, and renames `GLITCHTIP_DSN` → `SENTRY_DSN`.
11. **`frontend-ui-pwa.md`** ▲ — Adds explicit Workbox `injectManifest` wiring, i18n seed bundle references (HR/EN), and removes the `/health` page in favor of `/api/health`.
12. **`map-integration.md`** ▲ — Keeps self-hosted TileServer GL + Nominatim; clarifies rate limiting and fallback; notes optional MapLibre GL vector path for later.
13. **`user-submission-flow.md`** ▲ — Clarifies moderation endpoints and admin review flow.
14. **`mobile-packaging.md`** ▲ — Adds minimum OS versions, permission copy checklist, and store review items.
15. **`gpu-worker-architecture.md`** — *New*. n8n queue topology, worker classes, scaling policy, and GPU-01 service set (ffmpeg, yt-dlp, browserless, imagemagick, crawl4ai).

## D. Execution Order (PR-sized steps)

**PR-0 — Create Track A docs**

- Add `infra-vps-runbook.md`, `tailscale-networking.md`, `security-headers-csp.md`, `backups-runbook.md`, [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md) with checklists and output tables.

**PR-0.1 — Host mapping & GPU worker lane**

- Add `gpu-worker-architecture.md`; wire n8n queue mode (VPS web + GPU workers), define queues, and Caddy routes to GPU-01 over Tailscale.

**PR-1 — OpenAPI as an artifact**

- Add `openapi/openapi.yaml` + `api/openapi.ts` route; wire `pnpm test:integration` to `/api/openapi.json`.

**PR-2 — Pagination + Rate limits + Radius**

- Implement cursor `{ items, next_cursor }`, stable `(start_time, id)`, Redis rate limit 120/h/IP for `GET /events`, and Haversine SQL (or PostGIS) radius.

**PR-3 — Ingestion mapping & upserts**

- Map `ProcessedEvent` → upsert `venues`/`organizers` then `events` with FKs. Reject/queue invalid. Per-item status for n8n.

**PR-4 — Admin MVP**

- Protected `/api/admin/submissions` approve/reject; `feature_flags` table + read-only endpoint for client UI gating.

**PR-5 — FTS & indices**

- Generated column `events_search` + GIN; optional trigram on `title`; define exact `q` behavior.

**PR-6 — SW wiring & i18n seeds**

- `workbox injectManifest` in `package.json`; add `src/lib/i18n/{hr,en}.json`.

**PR-7 — Secrets (env-first)**

- Remove hypothetical Vaultwarden client from runtime; document env-first canonical approach.

**PR-8 — Privacy & retention**

- Add `/about` privacy copy; nightly purge jobs (logs>90d, raw HTML>30d). SQL included.

**PR-9 — Observability & backups**

- Dashboards, alerts, WAL-G cron + restore drill docs.

---

## E. Required Outputs from Track A (to unblock Track B)

Populate this table in `infra-vps-runbook.md` before starting Track B:

| Key                              | Value (example)                                        |
| -------------------------------- | ------------------------------------------------------ |
| APP\_BASE\_URL                   | `https://app.example.com`                              |
| API\_BASE\_URL                   | `https://api.example.com`                              |
| SUPABASE\_URL                    | `http://10.0.0.10:54321` or managed URL                |
| SUPABASE\_ANON\_KEY              | `***`                                                  |
| SUPABASE\_SERVICE\_KEY           | `***`                                                  |
| REDIS\_URL                       | `redis://10.0.0.20:6379`                               |
| MINIO\_URL                       | `https://minio.example.com`                            |
| MINIO\_ACCESS\_KEY / SECRET\_KEY | `***` / `***`                                          |
| TILESERVER\_URL                  | `https://tiles.example.com`                            |
| NOMINATIM\_URL                   | `https://geo.example.com`                              |
| SENTRY\_DSN                      | `https://<public>@sentry.example.com/<project>`        |
| OTEL\_EXPORTER\_OTLP\_ENDPOINT   | `http://otel-collector:4317`                           |
| INGEST\_SECRET                   | `***`                                                  |
| GPU\_TAILNET\_HOST               | `gpu-01.tailnet.local` or `100.x.x.x`                  |
| MEDIA\_SERVICE\_URL              | `http://gpu-01.tailnet.local:8088` (ffmpeg/yt-dlp API) |
| BROWSERLESS\_WS\_URL             | `ws://gpu-01.tailnet.local:3000`                       |
| CRAWL4AI\_URL                    | `http://gpu-01.tailnet.local:8089`                     |
| QDRANT\_URL (optional)           | `http://vps-01.tailnet.local:6333`                     |

---

## F. Non-goals / Explicit Exclusions

- No paid external geocoders or map providers in MVP.
- No GlitchTip; use **self-hosted Sentry**.
- No runtime dependency on Vaultwarden for app secrets.

---

## G. Glossary

- **Track A**: Infrastructure setup (domain, VPS, services) and ops.
- **Track B**: Application implementation using the specs and live service URLs.

---

## H. Changelog

- **v2.1**: Added multi-host (VPS + GPU via Tailscale), host placement table, GPU worker plane, optional components audit, and expanded required outputs.
- **v2**: Introduced Dual‑Track plan; added 5 new docs; switched to Sentry; formalized OpenAPI; defined execution order and gates.

---

