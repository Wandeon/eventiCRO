# Tailscale Networking (v1) — Private network, ACLs, and service discovery

> **Goal:** Build a least‑privilege private network between **VPS‑01 (public)** and **GPU‑01 (tailnet‑only)** using Tailscale. All sensitive services bind to localhost or the tailnet. Only the app UI/API (via Caddy) are public.

---

## 1) Design principles

- **Private‑first:** Databases, Redis, object storage, internal media/crawl services are *not* reachable from the internet.
- **Identity over IP:** Access is granted to devices via **tags** and **ACLs**, not IP allowlists.
- **MagicDNS everywhere:** Prefer `vps-01.tailnet.local` and `gpu-01.tailnet.local` over raw 100.x IPs for readability and portability.
- **Auditable egress:** Only Caddy exposes 80/443 publicly. Everything else is on the tailnet or loopback.
- **SSH via Tailscale:** Disable public SSH; use **Tailscale SSH** and keys.

---

## 2) Host inventory & tags

- **VPS‑01 (public)** — tag: `tag:vps`
- **GPU‑01 (tailnet‑only)** — tag: `tag:gpu`
- Optional admin laptops — group: `autogroup:admins`

> Assign tags at join time (or in the admin panel). Examples:
>
> ```bash
> # on each host after install
> sudo tailscale up \
>   --ssh \
>   --advertise-tags=tag:vps   # (or tag:gpu on GPU‑01)
> ```

Enable **MagicDNS** in the tailnet admin so both hosts resolve as `vps-01.tailnet.local` and `gpu-01.tailnet.local`.

---

## 3) ACL policy (HUJSON example)

> Paste the following in **Access Controls** and adjust emails/usernames.

```js
{
  // Device owners for tags
  "tagOwners": {
    "tag:vps":   ["group:admins"],
    "tag:gpu":   ["group:admins"]
  },

  // Admin group
  "groups": {
    "group:admins": ["you@example.com"]
  },

  // Allow SSH via Tailscale to servers for admins
  "ssh": [
    { "action": "accept", "src": ["group:admins"], "dst": ["tag:vps", "tag:gpu"], "users": ["root", "ubuntu", "debian"] }
  ],

  // Service access rules (least privilege)
  "acls": [
    // App/API public is handled by Caddy; tailnet clients may still hit 80/443
    { "action": "accept", "src": ["autogroup:members"], "dst": ["tag:vps:80,443"] },

    // n8n web (VPS‑01) may talk to Redis (VPS‑01) and internal services on GPU‑01
    { "action": "accept", "src": ["tag:vps"], "dst": [
      "tag:vps:6379",      // Redis
      "tag:gpu:3000",      // browserless (WS)
      "tag:gpu:8088",      // media API (ffmpeg/yt-dlp)
      "tag:gpu:8089"       // Crawl4AI
    ] },

    // GPU workers may pull from Redis, hit MinIO, and send telemetry to OTel
    { "action": "accept", "src": ["tag:gpu"], "dst": [
      "tag:vps:6379",      // Redis
      "tag:vps:9000",      // MinIO
      "tag:vps:4317",      // OTel Collector (gRPC)
      "tag:vps:9001"       // MinIO console (optional)
    ] }
  ]
}
```

> Keep it tighter if some services are unused. Deny‑by‑default is implicit.

---

## 4) Binding services to tailnet or loopback

Ensure each internal service binds to **127.0.0.1** or the **tailnet IP** (100.x) instead of `0.0.0.0`.

- **Docker Compose service examples**

  ```yaml
  services:
    redis:
      image: redis:7
      command: ["redis-server", "--appendonly", "yes"]
      ports:
        - "127.0.0.1:6379:6379"     # loopback only

    minio:
      image: minio/minio
      command: server /data --console-address ":9001"
      environment:
        - MINIO_ROOT_USER=...
        - MINIO_ROOT_PASSWORD=...
      ports:
        - "127.0.0.1:9000:9000"
        - "127.0.0.1:9001:9001"
  ```

- **Systemd (non‑Docker)**: set `ListenAddress=100.x.y.z` in service config or start command.

---

## 5) Service discovery & connection strings

Use MagicDNS names in app configs and envs:

- `REDIS_URL=redis://vps-01.tailnet.local:6379`
- `MINIO_URL=http://vps-01.tailnet.local:9000`
- `BROWSERLESS_WS_URL=ws://gpu-01.tailnet.local:3000`
- `MEDIA_SERVICE_URL=http://gpu-01.tailnet.local:8088`
- `CRAWL4AI_URL=http://gpu-01.tailnet.local:8089`

This matches the **Outputs** table in `infra-vps-runbook.md` and the envs referenced in `project-baseline-index.md`.

---

## 6) Caddy → GPU reverse proxy patterns

Only proxy specific internal paths to GPU‑01 over Tailscale.

```caddyfile
app.example.com {
  import security_headers

  # Public app (SvelteKit) & API
  reverse_proxy /api/* http://127.0.0.1:8787
  reverse_proxy /*        http://127.0.0.1:3000

  # Internal media endpoints tunneled to GPU‑01
  handle_path /media-proc/* {
    reverse_proxy http://gpu-01.tailnet.local:8088
  }

  # WebSocket to browserless for screenshots (dev/admin only via auth)
  @browserless path /_bl_ws
  reverse_proxy @browserless ws://gpu-01.tailnet.local:3000
}
```

> Lock these paths behind auth if exposed; prefer tailnet‑only for admin/dev.

---

## 7) SSH & firewall strategy

- **Disable public SSH** on VPS‑01; rely on **Tailscale SSH**.
- Keep OS firewall deny‑by‑default. Allow 80/443 inbound on VPS‑01.
- Internal ports (Redis, MinIO, Postgres, OTel, Prom/Loki/Grafana) bind to loopback/tailnet only.

---

## 8) Health checks over tailnet

Point **Uptime Kuma** to:

- `http://vps-01.tailnet.local:9090/-/ready` (Prometheus)
- `http://vps-01.tailnet.local:3100/ready` (Loki)
- `http://vps-01.tailnet.local:4317` (OTel gRPC TCP check)
- `http://api.example.com/api/health` (public)
- `http://vps-01.tailnet.local:9000/minio/health/ready` (MinIO)
- Tiles & Nominatim internal URLs

---

## 9) Diagnostics

- `tailscale status`
- `tailscale ping gpu-01`
- `tailscale netcheck`
- `ss -tulpn | grep LISTEN` (verify bindings)

---

## 10) Outputs (record in runbook)

| Key                  | Value                               |
| -------------------- | ----------------------------------- |
| VPS\_TAILNET\_NAME   | `vps-01.tailnet.local`              |
| GPU\_TAILNET\_NAME   | `gpu-01.tailnet.local`              |
| REDIS\_URL           | `redis://vps-01.tailnet.local:6379` |
| MINIO\_URL           | `http://vps-01.tailnet.local:9000`  |
| MEDIA\_SERVICE\_URL  | `http://gpu-01.tailnet.local:8088`  |
| BROWSERLESS\_WS\_URL | `ws://gpu-01.tailnet.local:3000`    |
| CRAWL4AI\_URL        | `http://gpu-01.tailnet.local:8089`  |

---

## 11) Security notes

- Avoid exposing any tailnet services to the internet; when necessary, restrict by auth and IP.
- Prefer **short‑lived** tokens/keys and rotate them (documented in `backups-runbook.md` and `observability.md`).
- Review ACLs after any new service is added.

