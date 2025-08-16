# Track A Handover Checklist

> Use this document to confirm that infrastructure setup is complete and ready for the application build in Track B. All items must be satisfied and recorded before handoff.

## 1. Network & DNS

- Tailnet hosts `vps-01` and `gpu-01` reachable by MagicDNS names.
- Public domain resolves for `app` and `api` subdomains.
- Output: tailnet names and public IP saved in `track-a-outputs.md`.

## 2. Reverse proxy & security

- Caddy serves HTTPS for app and API endpoints with HSTS and CSP.
- Firewall and basic hardening in place on VPS-01.
- Output: Caddyfile and security notes stored in admin password manager.

## 3. Core services running

- Postgres/Supabase, Redis (AOF), MinIO, TileServer GL, Nominatim, Sentry, OTel stack, Uptime Kuma all operational.
- Optional services installed as required by project scope.
- Output: service URLs and credentials entered in `track-a-outputs.md`.

## 4. Secrets & configuration

- `.env` files created for services; secrets shared via password manager.
- No secrets committed to repository.
- Output: reference to secret storage location noted in `track-a-outputs.md` or companion secure doc.

## 5. Backups & DR verified

- WAL-G backups to MinIO succeed; first restore drill performed.
- MinIO buckets versioned with lifecycle policies.
- Output: latest backup and restore dates recorded.

## 6. Observability active

- `/api/health` endpoint returns status JSON.
- Metrics, logs and traces visible in Grafana, Loki and Sentry dashboards.
- Uptime Kuma monitors configured for public endpoints.
- Output: dashboard URLs and alert contacts noted.

## 7. GPU worker plane

- n8n main instance on VPS-01 in Queue mode.
- Workers on GPU-01 connected and processing sample jobs.
- Output: internal routes and worker count recorded.

## 8. Handover package

- `track-a-outputs.md` filled with real values.
- Export of runbooks, configs and this checklist shared with Track B team.
- Confirmed point of contact for infra issues during Track B.

---

**Handoff complete when:** every output field is populated, services are reachable at the documented URLs, and this checklist is acknowledged by the receiving team.
