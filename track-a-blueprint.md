# Track A Blueprint — Infra/VPS & Services

> Authoritative plan for establishing the infrastructure required before any application code is built. Follow the stages in order. Each stage has a clear exit criterion that must be met before proceeding.

## A0. Network topology & hosts

- **Setup**
  - Provision two hosts: `VPS-01` (public) and `GPU-01` (tailnet only).
  - Join both to the same Tailscale tailnet and enable MagicDNS.
  - Restrict ACLs so only required ports from `VPS-01` can reach `GPU-01`.
- **Exit when** both hosts are reachable by their tailnet names and `vps-01` can ping `gpu-01`.

## A1. Domain & DNS

- **Setup**
  - Purchase project domain at registrar of choice.
  - Create `A` records pointing to the public IP of `VPS-01` for `app` and `api` subdomains.
  - Optionally add records for dashboards or other public services.
- **Exit when** `app.<domain>` and `api.<domain>` resolve to the VPS IP.

## A2. VPS base & reverse proxy

- **Setup**
  - Harden the OS: firewall, fail2ban, automatic updates.
  - Install Caddy as reverse proxy with automatic HTTPS.
  - Apply HSTS and CSP snippets from `security-headers-csp.md`.
- **Exit when** HTTPS requests to the domain return the Caddy placeholder page.

## A3. Core services

- **Setup** on `VPS-01` unless noted:
  - **Postgres/Supabase** – database and auth.
  - **Redis** – queues and rate limits with AOF.
  - **MinIO** – S3‑compatible object storage with buckets for `uploads`, `thumbnails`, and `backups`.
  - **TileServer GL** – map tiles.
  - **Nominatim** – geocoding.
  - **Sentry (self-hosted)** – error and performance monitoring.
  - **OTel Collector + Prometheus + Loki + Grafana** – metrics, logs and traces.
  - **Uptime Kuma** – synthetic checks.
  - Optional: Portainer, Netdata, Gotenberg/WeasyPrint, Crawl4AI, SearXNG, Qdrant, OpenWebUI.
- **Exit when** each required service is reachable at its URL and credentials are recorded in `track-a-outputs.md`.

## A4. Secrets & configuration

- **Setup**
  - Store runtime configuration in environment variables (`.env` files or Caddy env blocks).
  - Keep secrets out of version control; use password manager for sharing.
- **Exit when** all services start using environment variables and the values are documented.

## A5. Backups & disaster recovery

- **Setup**
  - Configure WAL-G for Postgres PITR to MinIO (`backups` bucket).
  - Enable MinIO bucket versioning and lifecycle policies.
  - Schedule cron jobs for base backups, WAL shipping and restore drills.
- **Exit when** the first successful backup and restore drill are logged and retention policies are active.

## A6. Health & observability

- **Setup**
  - Expose `/api/health` endpoint returning `{ status, version, git_sha }`.
  - Wire metrics, logs and traces to Prometheus, Loki and Sentry; create Grafana dashboards.
  - Add Uptime Kuma monitors for public endpoints.
- **Exit when** dashboards show live data and the health endpoint responds with HTTP 200.

## A7. GPU worker plane

- **Setup**
  - Run n8n in Queue mode on `VPS-01`; connect to Redis.
  - Start n8n workers on `GPU-01` with required tools (ffmpeg, browserless, crawl4ai, etc.).
  - Reverse proxy any GPU services through Caddy over Tailscale.
- **Exit when** workers pull jobs from Redis and internal routes proxy correctly.

---

**After completing all stages:** fill in [`track-a-outputs.md`](track-a-outputs.md) with real values. Track B must not begin until this table is complete.
