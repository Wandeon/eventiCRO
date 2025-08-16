# Observability (v1) — OTel → Prometheus + Loki + Grafana; Sentry for errors/traces

> **Goal:** Collect **metrics** and **logs** through the OpenTelemetry Collector into **Prometheus** and **Loki**, visualize in **Grafana**, and send **errors/traces** to **self‑hosted Sentry** via the official SDKs. This matches the Track‑A plan and the security posture: private‑first via tailnet.
>
> **References:**
> - `project-baseline-index.md` → A6
> - `infra-vps-runbook.md` → §§5, 8
> - `security-headers-csp.md` → header hardening (no changes required for telemetry)
> - `backups-runbook.md` → uses observability heartbeats

---

## 0) Architecture
- **App (API + PWA)**
  - **Sentry SDK** captures errors + traces (JS/Node). Env: `SENTRY_DSN`, `RELEASE`, `ENVIRONMENT`.
  - **OTel SDK** (optional) exports metrics to the **OTel Collector** at `OTEL_EXPORTER_OTLP_ENDPOINT` (gRPC 4317).
  - **Structured logs** via `pino` (JSON) and captured by **Promtail** from Docker.
- **OTel Collector (VPS‑01)**
  - Receives OTLP (metrics/logs/traces if enabled) over tailnet.
  - **Exports metrics** via a local **Prometheus scrape endpoint**.
  - **Exports logs** to **Loki**.
  - (Optional) **Forwards traces** to Sentry via SDKs in app, or advanced: via collector exporter to Sentry (enable only if you know you need this; default is SDK path).
- **Prometheus + Loki + Grafana (VPS‑01)**
  - Prometheus scrapes the Collector’s `/metrics`, Caddy’s metrics, Node Exporters, etc.
  - Loki stores application logs; Grafana dashboards join metrics + logs.
- **Uptime Kuma** checks `/api/health` and service readiness endpoints.

All internal traffic stays on **Tailscale** (see `tailscale-networking.md`).

---

## 1) App instrumentation (Track‑B handoff)
### 1.1 Environment variables (add to `.env` and doc in `deployment-docs.md`)
```
SENTRY_DSN=...
RELEASE=${GIT_COMMIT_SHA}
ENVIRONMENT=production

# OTel metrics/logs path
OTEL_EXPORTER_OTLP_ENDPOINT=http://vps-01.tailnet.local:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_SERVICE_NAME=eventicro-api
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=${GIT_COMMIT_SHA}
```

### 1.2 Node (API) — Sentry + OTel sketch
```ts
// /api/lib/telemetry.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Sentry for errors + traces
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  release: process.env.RELEASE,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.2, // tune per env
});

// Optional: OpenTelemetry SDK for metrics only
// Initialize an OTel MeterProvider here if you want custom app metrics
```

### 1.3 Logs (API)
- Use `pino` with pretty logs in dev and JSON in prod.
- Include fields: `service`, `env`, `version`, `request_id`, `user_id`.

---

## 2) OTel Collector — production config (VPS‑01)
Create `/srv/otel-collector/config.yaml`:
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317  # tailnet or loopback binding set at Docker level
      http:
        endpoint: 127.0.0.1:4318

processors:
  batch: {}
  memory_limiter:
    check_interval: 1s
    limit_percentage: 75
    spike_limit_percentage: 30
  resource:
    attributes:
      - action: upsert
        key: deployment.environment
        value: production

exporters:
  # Prometheus exporter exposes a scrape endpoint at :8889
  prometheus:
    endpoint: 0.0.0.0:8889
  # Loki exporter for logs
  loki:
    endpoint: http://vps-01.tailnet.local:3100/loki/api/v1/push
    labels:
      job: otel
    tenant_id: default
  # Optional: send traces to Sentry via OTLP *only if configured and supported*
  # otlphttp/sentry:
  #   endpoint: https://sentry.example.com
  #   headers:
  #     # Check Sentry self-hosted docs for required auth headers; prefer SDK path by default
  #     x-sentry-token: ${SENTRY_AUTH_TOKEN}

service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [loki]
    # traces:
    #   receivers: [otlp]
    #   processors: [memory_limiter, batch, resource]
    #   exporters: [otlphttp/sentry]
```

> Bind the container to `127.0.0.1:4317` or the **tailnet** IP to avoid exposing OTLP publicly (see Compose below).

---

## 3) Prometheus, Loki, Grafana, Collector — Compose (VPS‑01)
Create `/srv/observability/compose.yml`:
```yaml
version: '3.9'
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./otel-config.yaml:/etc/otelcol/config.yaml:ro
    ports:
      - "127.0.0.1:4317:4317"   # gRPC (tailnet binding preferred via Tailscale IP)
      - "127.0.0.1:4318:4318"   # HTTP (local only)
      - "127.0.0.1:8889:8889"   # Prometheus scrape endpoint
    restart: unless-stopped

  loki:
    image: grafana/loki:3.0.0
    command: ["-config.file=/etc/loki/config.yml"]
    volumes:
      - ./loki-config.yml:/etc/loki/config.yml:ro
      - loki-data:/loki
    ports:
      - "127.0.0.1:3100:3100"
    restart: unless-stopped

  promtail:
    image: grafana/promtail:3.0.0
    command: ["-config.file=/etc/promtail/config.yml"]
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/log:/var/log:ro
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "127.0.0.1:9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    ports:
      - "127.0.0.1:3001:3001"
    command: ["--http-port=3001"]
    restart: unless-stopped

volumes:
  loki-data: {}
  prometheus-data: {}
  grafana-data: {}
```

> Expose Grafana publicly **only** through Caddy with auth (or keep it tailnet‑only). Add a Caddy route if you want public access.

### 3.1 Prometheus config (`prometheus.yml`)
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: otel-collector
    static_configs:
      - targets: ["127.0.0.1:8889"]

  - job_name: caddy
    metrics_path: /metrics
    static_configs:
      - targets: ["127.0.0.1:2019"]  # if caddy metrics enabled in global options

  - job_name: node
    static_configs:
      - targets: ["127.0.0.1:9100"]  # add node_exporter if you run it
```

### 3.2 Promtail config (`promtail-config.yml`)
```yaml
server:
  http_listen_port: 0
  grpc_listen_port: 0

positions:
  filename: /var/log/positions.yaml

clients:
  - url: http://127.0.0.1:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    static_configs:
      - targets: [localhost]
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*-json.log
  - job_name: syslog
    static_configs:
      - targets: [localhost]
        labels:
          job: syslog
          __path__: /var/log/*.log
```

### 3.3 Loki config (`loki-config.yml`)
```yaml
server:
  http_listen_port: 3100
schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h
storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks
limits_config:
  ingestion_rate_mb: 8
  ingestion_burst_size_mb: 16
compactor:
  working_directory: /loki/compactor
  shared_store: filesystem
```

---

## 4) Grafana dashboards & alerts
- Import community dashboards for **Prometheus / Node Exporter / Loki** and create a custom dashboard:
  - API latency (p95), error rate, request volume.
  - Redis ops/sec and memory.
  - Postgres connections and slow queries (via exporter later if needed).
- **Alerts** (Grafana Alerting):
  - API error rate > 2% over 10m.
  - p95 latency > 1.5s over 10m.
  - Redis memory > 80% for 10m.
  - Backup heartbeat missing for > 1h (hook from `backups-runbook.md`).

---

## 5) `/api/health` contract (app side)
- JSON response: `{ status: 'ok', version: '<semver or git sha>', git_sha: '<sha>' }`.
- Include a lightweight dependency check: DB ping and Redis ping with short timeouts.
- Used by Uptime Kuma and by Prometheus blackbox/probes if desired.

---

## 6) Security
- All telemetry endpoints bind to **loopback** or **tailnet** only.
- Grafana secured behind auth; publish via **Caddy** with `security_headers` if public.
- OTel Collector limits memory via `memory_limiter` and batches to avoid resource spikes.
- Don’t forward traces to third parties; **self‑hosted Sentry** only.

---

## 7) Outputs (fill after setup)
| Key | Value |
|---|---|
| OTEL_EXPORTER_OTLP_ENDPOINT | `http://vps-01.tailnet.local:4317` |
| GRAFANA_URL | `https://grafana.example.com` (if public) or tailnet URL |
| PROMETHEUS_URL | `http://vps-01.tailnet.local:9090` |
| LOKI_URL | `http://vps-01.tailnet.local:3100` |
| UPTIME_KUMA_URL | `https://uptime.example.com` (if public) |

---

## 8) Change log
- **v1:** Initial OTel→Prom/Loki design, Sentry via SDKs, Compose configs, alerts, and `/api/health` contract.

