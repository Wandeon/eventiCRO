# Infra/VPS Runbook (v1) — domain → VPS → services

> **Scope:** Step‑by‑step from domain purchase to a fully configured multi‑host setup: **VPS‑01 (public)** and **GPU‑01 (tailnet‑only)**. This is the foundation for Track‑B. Use the outputs table at the end to feed app configs.
>
> **References:**
>
> - `project-baseline-index.md` → Track‑A plan & execution order
> - `tailscale-networking.md` → ACLs, hostnames, private bindings
> - `security-headers-csp.md` → Caddy hardening (HTTPS)
> - `backups-runbook.md` → WAL‑G + MinIO
- [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md) → OTel → Prom/Loki/Grafana; Sentry
> - `gpu-worker-architecture.md` → n8n queue workers on GPU‑01
> - `deployment-docs.md` → CI/CD and tests

---

## A) Prereqs & checklist

- Domain registrar access (Cloudflare/Namecheap/etc.).
- Two hosts: **VPS‑01** (2–4 vCPU, 8–16GB RAM, fast SSD) and **GPU‑01** (local box with GPU or CPU‑heavy; Docker installed). No public GPU ports.
- OS: Ubuntu 22.04/24.04 LTS.
- Admin email for TLS & alerts.

---

## B) Base OS hardening (both hosts)

```bash
# 1) Update & basic tools
sudo apt update && sudo apt -y upgrade
sudo apt -y install curl git jq ufw fail2ban ca-certificates gnupg

# 2) Unattended upgrades
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 3) Firewall (deny by default; allow 80/443 on VPS only)
sudo ufw default deny incoming
sudo ufw default allow outgoing
# VPS‑01 only:
sudo ufw allow 80,443/tcp
# (No SSH over internet — we will use Tailscale SSH)
sudo ufw enable

# 4) Timezone & NTP
sudo timedatectl set-timezone Europe/Zagreb
sudo timedatectl set-ntp on
```

> SSH: Disable public SSH once **Tailscale SSH** is working (see `tailscale-networking.md`).

---

## C) Install Docker & Compose plugin (both)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out/in or: newgrp docker
sudo mkdir -p /etc/docker
cat | sudo tee /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "features": { "containerd-snapshotter": true }
}
JSON
sudo systemctl enable --now docker
```

---

## D) Tailscale (both) & hostnames

Follow `tailscale-networking.md`:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --accept-routes --advertise-tags=tag:vps   # on VPS‑01
sudo tailscale up --ssh --advertise-tags=tag:gpu                   # on GPU‑01
```

Enable **MagicDNS** in admin, verify:

```bash
tailscale status
ping -c1 vps-01.tailnet.local
ping -c1 gpu-01.tailnet.local
```

Apply ACLs from `tailscale-networking.md`.

---

## E) Caddy (VPS‑01) as the public entrypoint (HTTPS)

```bash
sudo apt install -y debian-keyring debian-archive-keyring
sudo mkdir -p /etc/apt/keyrings
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo tee /etc/apt/keyrings/caddy-stable.asc
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Create `/srv/caddy/Caddyfile` and include the hardened headers from `security-headers-csp.md`. Minimal example:

```caddyfile
(app_vars) {
  # Replace with your real hosts
  @vars {
    APP_BASE_URL https://app.example.com
    API_BASE_URL https://api.example.com
    TILESERVER_URL https://tiles.example.com
    SENTRY_DSN_ORIGIN https://sentry.example.com
  }
}

import /srv/caddy/snippets/*.caddy  # place security headers snippets here

api.example.com {
  import security_headers_api
  import cors_strict
  reverse_proxy /*  http://127.0.0.1:8787
}

app.example.com {
  import security_headers_csp_app
  reverse_proxy /api/*  http://127.0.0.1:8787
  reverse_proxy /*      http://127.0.0.1:3000
}
```

Reload:

```bash
sudo mkdir -p /srv/caddy/snippets
sudo caddy validate --config /srv/caddy/Caddyfile && sudo caddy reload --config /srv/caddy/Caddyfile
```

> All public traffic uses **HTTPS** via Caddy. Internal containers bind to loopback/tailnet only.

---

## F) Core services (VPS‑01) — Docker Compose

Create `/srv/core/compose.yml`:

```yaml
version: '3.9'
services:
  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    ports: ["127.0.0.1:6379:6379"]
    volumes:
      - redis-data:/data
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    volumes:
      - minio-data:/data
    restart: unless-stopped

  tileserver:
    image: klokantech/tileserver-gl:latest
    command: ["--port", "8081", "--public_url", "${TILESERVER_PUBLIC_URL:-}"]
    volumes:
      - ./tiles:/data
    ports:
      - "127.0.0.1:8081:8081"
    restart: unless-stopped

  nominatim:
    image: mediagis/nominatim:4.4
    environment:
      PBF_URL: ${NOMINATIM_PBF_URL}
      NOMINATIM_PASSWORD: ${NOMINATIM_PASSWORD}
      THREADS: 4
    shm_size: 1gb
    volumes:
      - nominatim-data:/var/lib/postgresql/14/main
    ports:
      - "127.0.0.1:8070:8080"
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:1
    volumes:
      - uptime-data:/app/data
    ports:
      - "127.0.0.1:3002:3001"
    restart: unless-stopped

volumes:
  redis-data: {}
  minio-data: {}
  nominatim-data: {}
  uptime-data: {}
```

Bring up:

```bash
cd /srv/core && docker compose up -d
```

> Bindings are **loopback**. Expose any of these publicly only via **Caddy** if required.

---

## G) Postgres / Supabase

> You can run **managed Supabase** (simpler) or **self‑hosted** (advanced). The schema in `core_data_model_api.md` works with plain Postgres. If you need Auth + Storage, either use managed Supabase or the official self‑hosted stack.

### Option 1 — Plain Postgres (recommended for MVP)

Use your hosted Postgres (from Supabase managed or your own PG container). Ensure extensions from `core_data_model_api.md` are enabled:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

Record the connection string in outputs.

### Option 2 — Supabase self‑hosted (advanced)

Follow Supabase’s official **self-hosted** repo. Configure **Storage** to use **MinIO (S3‑compatible)** by setting the S3 endpoint/keys. Keep the internal Postgres and Kong ports **private**. Record `SUPABASE_URL`, anon/service keys in outputs.

---

## H) Sentry (self‑hosted)

Follow the official **getsentry/self-hosted** install. After setup:

- Create a project → copy **DSN** for the app: `SENTRY_DSN`.
- Set the base URL (e.g., `https://sentry.example.com`) and expose via **Caddy**.
- Optionally deploy **Relay** and **Symbolicator** per docs.

---

## I) Observability stack (VPS‑01)

Use [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md):

- Create `/srv/observability/*.yml` as specified and `docker compose up -d` there.
- Keep **Grafana/Prometheus/Loki** on loopback/tailnet; proxy via Caddy only if you need public access.

---

## J) n8n web (VPS‑01) & workers (GPU‑01)

- Web/UI on VPS‑01 (public webhooks) with `EXECUTIONS_MODE=queue` and `N8N_QUEUE_BULL_REDIS_HOST=vps-01.tailnet.local`.
- Workers on GPU‑01 using `gpu-worker-architecture.md` compose.

Example `/srv/automations/compose.yml` (VPS‑01):

```yaml
version: '3.9'
services:
  n8n:
    image: n8nio/n8n:latest
    ports: ["127.0.0.1:5678:5678"]
    environment:
      - EXECUTIONS_MODE=queue
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_QUEUE_BULL_REDIS_HOST=vps-01.tailnet.local
      - N8N_QUEUE_BULL_REDIS_PORT=6379
      - WEBHOOK_URL=https://api.example.com
      - GENERIC_TIMEZONE=Europe/Zagreb
    volumes:
      - n8n-data:/home/node/.n8n
    restart: unless-stopped
volumes: { n8n-data: {} }
```

Expose via Caddy if required (auth recommended for UI).

---

## K) Caddy routes for internal services (optional public)

Add to Caddyfile only if you need public access:

```caddyfile
minio.example.com {
  import security_headers_api
  reverse_proxy /* http://127.0.0.1:9000
}

grafana.example.com {
  import security_headers_csp_app
  basicauth /* {
    admin JDJhJDEwJE1uU0Z6b1N4MkdDTVdvczZPZ1Jkc2Y1dG5qSnM2a2FybVNmZ0d2TklkNFF1M3pVb2JPMWpn
  }
  reverse_proxy /* http://127.0.0.1:3001
}

sentry.example.com {
  import security_headers_csp_app
  reverse_proxy /* http://127.0.0.1:9000  # adjust to sentry web port
}
```

---

## L) Backups

Implement `backups-runbook.md`:

- Create MinIO buckets, versioning, lifecycle.
- Configure WAL‑G env and cron.
- Monthly restore drill.

---

## M) Post‑setup verification

- `curl https://api.example.com/api/health` → `{ status: ok, ... }`
- `/events?limit=3` returns items and `X-RateLimit-*` headers (after app deploy).
- Grafana shows data; Loki logs arriving.
- n8n can run a test workflow; workers pull from Redis.
- Backups successful & drill green.

---

## N) Outputs (fill all before Track‑B)

Record all runtime values in [track-a-outputs.md](track-a-outputs.md) once infrastructure is provisioned.

---

## O) Change log

- **v1:** Initial runbook: OS hardening, Docker, Tailscale, Caddy, core services (Redis/MinIO/tiles/Nominatim/Kuma), Sentry, Observability, n8n (web), backups, and outputs.

