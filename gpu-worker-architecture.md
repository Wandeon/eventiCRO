# GPU Worker Architecture (v1) — n8n Queue mode on GPU‑01

> **Goal:** Run heavy/async jobs on **GPU‑01** behind Tailscale while keeping public webhooks/UI on **VPS‑01**. Use **n8n Queue mode** with Redis, and attach worker‑adjacent services (browserless/Puppeteer, ffmpeg+yt‑dlp, ImageMagick/pdf2png, Crawl4AI). Secure by default: tailnet‑only, least privileges, health checks, and resource limits.
>
> **References:**
> - `project-baseline-index.md` → A7, PR‑0.1
> - `infra-vps-runbook.md` → §§6
> - `tailscale-networking.md` → ACLs, reverse proxy patterns
> - `backups-runbook.md` → GDPR purge jobs (can be scheduled via n8n)
> - [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md) → metrics/logs/heartbeats

---

## 0) Topology
- **VPS‑01** (public): n8n **web** (UI, REST, webhooks) + Redis. Exposes only via HTTPS (Caddy). No workers here (optional 1 light worker for redundancy).
- **GPU‑01** (tailnet‑only): **n8n workers** that pull jobs over Redis via Tailscale. Worker‑adjacent services run locally and are reachable only over the tailnet.

**Queues (logical):**
- `crawl` → Crawl4AI fetch/extract, HTML snapshotting.
- `media` → ffmpeg/yt‑dlp, waveform/thumbs, pdf2png, ImageMagick.
- `ingest` → Normalize to `ProcessedEvent`, call `/api/ingest` with `INGEST_SECRET`.
- `moderation` → Generate screenshots/OG images; post admin notifications.

---

## 1) Redis (VPS‑01)
Use the instance from `infra-vps-runbook.md` (AOF enabled). Export `REDIS_URL=redis://vps-01.tailnet.local:6379` to all n8n containers.

---

## 2) n8n Queue mode — services
> We prefer the **sidecar pattern** for heavy tools to keep the n8n image small. You can also bake tools into a custom n8n image; see §2.4.

### 2.1 n8n (web) on VPS‑01
- `EXECUTIONS_MODE=queue`
- `N8N_ENCRYPTION_KEY=...`
- `N8N_QUEUE_BULL_REDIS_HOST=vps-01.tailnet.local`
- `WEBHOOK_URL=https://api.example.com` (or app host)

### 2.2 n8n workers on GPU‑01 (scale out)
- Read only the queue and process jobs; **no web interface**.
- Constrain CPU/RAM per worker; increase `--scale` instead of oversizing one.

**Compose (GPU‑01):**
```yaml
version: '3.9'
services:
  n8n-worker:
    image: n8nio/n8n:latest
    command: n8n worker --concurrency=5
    environment:
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - EXECUTIONS_MODE=queue
      - N8N_QUEUE_BULL_REDIS_HOST=vps-01.tailnet.local
      - N8N_QUEUE_BULL_REDIS_PORT=6379
      - N8N_LOG_LEVEL=info
      - TZ=Europe/Zagreb
      # app endpoints
      - API_BASE_URL=https://api.example.com
      - INGEST_SECRET=${INGEST_SECRET}
      # service URLs (tailnet)
      - BROWSERLESS_WS_URL=ws://gpu-01.tailnet.local:3000
      - MEDIA_SERVICE_URL=http://gpu-01.tailnet.local:8088
      - CRAWL4AI_URL=http://gpu-01.tailnet.local:8089
      - MINIO_URL=http://vps-01.tailnet.local:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
    volumes:
      - n8n-data:/home/node/.n8n
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2g
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  n8n-data: {}
```

> Scale with: `docker compose up -d --scale n8n-worker=4` and adjust `--concurrency` per queue type.

### 2.3 Worker‑adjacent services (GPU‑01)
**browserless (Puppeteer)**
```yaml
services:
  browserless:
    image: browserless/chrome:latest
    environment:
      - MAX_CONCURRENT_SESSIONS=4
      - CONNECTION_TIMEOUT=300000
      - ENABLE_DEBUGGER=false
      - PREBOOT_CHROME=true
      - TOKEN=${BROWSERLESS_TOKEN}
    ports:
      - "100.X.Y.Z:3000:3000"  # bind to tailnet IP
    restart: unless-stopped
```
**ffmpeg + yt‑dlp microservice** (simple HTTP wrapper)
```yaml
services:
  media:
    image: ghcr.io/yourorg/media-api:latest  # or use linuxserver/ffmpeg + cust. entrypoint
    environment:
      - FFMPEG_HWACCEL=auto   # nvenc if available, falls back to cpu
    ports:
      - "100.X.Y.Z:8088:8088"
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4g
    restart: unless-stopped
```
**Crawl4AI**
```yaml
services:
  crawl4ai:
    image: ghcr.io/yourorg/crawl4ai:latest
    environment:
      - WORKERS=4
      - ALLOW_URL_PATTERNS=^https?://(www\.)?[^/]+\.(hr|eu)
      - DISALLOW_ROBOTS=false
    ports:
      - "100.X.Y.Z:8089:8089"
    restart: unless-stopped
```
**ImageMagick/pdf2png** — prefer invoking binaries inside `media` image or a tiny sidecar to keep surface area small.

> Replace `100.X.Y.Z` with the GPU‑01 tailnet IPv4 (get it via `tailscale ip -4`).

### 2.4 Alternative: custom n8n worker image (all tools baked in)
Create `Dockerfile.n8n-worker` (GPU‑01):
```dockerfile
FROM n8nio/n8n:latest
USER root
RUN apt-get update && apt-get install -y \
    ffmpeg imagemagick poppler-utils \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*
USER node
```
Use this in §2.2 instead of the stock image if you prefer direct binary calls.

---

## 3) Workflow design (n8n)
### 3.1 Crawl → Extract → Normalize → Ingest
1. **Trigger:** schedule or webhook.
2. **Crawl4AI:** fetch page (respect robots, limits).
3. **Parse:** extract title/date/venue via built‑in HTML, Cheerio, or LLM if allowed.
4. **Normalize:** build `ProcessedEvent` JSON.
5. **Ingest:** POST to `/api/ingest` with `INGEST_SECRET` header.
6. **Store artifacts:** upload raw HTML/snapshots to MinIO (bucket `uploads/ingest/…`).

### 3.2 Media processing
- If event has poster/video:
  - **yt‑dlp** to fetch metadata/thumbnail.
  - **ffmpeg** to transcode preview or generate waveform.
  - **ImageMagick/pdf2png** to create thumbnails.
  - Upload outputs to MinIO → return URLs to the app.

### 3.3 Moderation support
- Generate **screenshots** with browserless at canonical viewport sizes.
- Publish to an **admin channel** (email, Matrix, or Slack) with approve/reject links (calls `/api/admin/submissions`).

### 3.4 Digest generation (optional)
- Weekly HTML digest → **Gotenberg** for PDF → email to subscribers (future).

---

## 4) Concurrency, rate limits, and backpressure
- **Redis queues per type**; set `--concurrency` lower for `crawl` to avoid hitting remote sites.
- **Nominatim**: never exceed **1 req/s/IP**. Enforce in n8n with a limiter node (token bucket) and add jitter.
- **Retries**: exponential backoff with dead‑letter queue; alert on DLQ via Grafana/Slack.
- **Timeouts**: 30–60s external calls; 10m max for media jobs.

---

## 5) Security & networking
- All services bind to **tailnet IP** (see Compose `ports:` bindings) and are not exposed publicly.
- Caddy **may** proxy limited paths from `app.example.com` to GPU‑01 (see `tailscale-networking.md`), but default is **tailnet‑only**.
- Use **tokens** for browserless and any internal HTTP APIs.
- MinIO credentials are scoped to the minimum necessary buckets.

---

## 6) Observability & health
- Each service has a Docker **healthcheck**.
- n8n workflows send **heartbeats** to Uptime Kuma.
- Promtail tails container and syslogs; labels include `host=gpu-01`, `service=<name>` for Grafana.

---

## 7) Autoscaling outline (manual → script)
- Start with `--scale n8n-worker=N`.
- Optional script reads **queue depth** and **CPU/GPU** utilization; scales workers (up to max) via `docker compose up --scale`.
- Cooldown to prevent flapping; minimum 2 workers.

---

## 8) Outputs (record in runbook)
| Key | Value |
|---|---|
| BROWSERLESS_WS_URL | `ws://gpu-01.tailnet.local:3000` |
| MEDIA_SERVICE_URL | `http://gpu-01.tailnet.local:8088` |
| CRAWL4AI_URL | `http://gpu-01.tailnet.local:8089` |
| N8N_WORKER_COUNT | e.g. `4` |
| N8N_WORKER_CONCURRENCY | e.g. `5` |

---

## 9) Change log
- **v1:** Initial GPU worker lane with queues, sidecars, security posture, and compose examples.

