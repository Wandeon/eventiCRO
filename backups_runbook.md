# Backups & Disaster Recovery Runbook (v1)

> **Scope:** Postgres **point‑in‑time recovery (PITR)** with WAL‑G to MinIO, MinIO **versioning + lifecycle**, optional **off‑site replication**, and **restore rehearsals**. This runbook supports the Dual‑Track plan: complete it in **Track A** and record outputs before the App Agent builds in **Track B**.
>
> **References:**
> - `project-baseline-index.md` → A5
> - `infra-vps-runbook.md` → §§4, 9–11
> - [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md) → backup success metrics/alerts

---

## 0) Objectives
- **RPO (data loss tolerance):** ≤ 5 minutes for DB (depends on WAL shipping interval), ≤ 24 hours for object storage.
- **RTO (time to recover):** ≤ 60 minutes for DB, ≤ 2 hours for object storage (single VPS replacement).
- **Test frequency:** Monthly **restore drill** with written evidence.

---

## 1) What we back up
- **Postgres (Supabase DB)** — base backups + WAL for PITR.
- **MinIO buckets** — `uploads`, `thumbnails`, `backups` (versioned). Optionally replicate off‑site.
- **Configs** — Caddyfile, Compose files, `.env*` (encrypted bundle), Nominatim config, TileServer config. Stored in `backups/config/` **encrypted**.

> Secrets are never committed. The encrypted config bundle uses age/GPG and is uploaded to `backups/config/` with strict bucket policies.

---

## 2) MinIO configuration (VPS‑01)
1. **Create buckets**
   ```bash
   mc mb local/uploads local/thumbnails local/backups
   ```
2. **Enable bucket versioning**
   ```bash
   mc version enable local/uploads
   mc version enable local/thumbnails
   mc version enable local/backups
   ```
3. **Lifecycle policies** (expire old versions, keep recent)
   ```bash
   mc ilm add --expiry-days 180 local/uploads
   mc ilm add --expiry-days 180 local/thumbnails
   mc ilm add --expiry-days 365 --noncurrent-expiry-days 90 local/backups
   ```
4. **(Optional) Off‑site replication** to an external S3 (e.g., R2/Wasabi) — strongly recommended
   ```bash
   mc alias set offsite https://<s3-endpoint> <KEY> <SECRET>
   mc replicate add local/backups offsite/backups --remote-bucket offsite-backups \
     --replicate "delete,metadata,existing-objects" --bandwidth 50MiB
   ```

---

## 3) Postgres PITR with WAL‑G → MinIO
> Deploy WAL‑G **inside** the Postgres container or as a sidecar. We assume Docker and the data dir `/var/lib/postgresql/data`.

### 3.1 Environment
Create `/srv/postgres/walg.env` (readable by root only):
```bash
# MinIO (S3‑compatible)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_ENDPOINT=http://vps-01.tailnet.local:9000
AWS_S3_FORCE_PATH_STYLE=true
WALG_S3_PREFIX=s3://backups/postgres

# Optional: client‑side encryption with age (preferred) or GPG
# WALG_USE_REDIS=false
# WALG_PGP_KEY=/srv/postgres/keys/walg_pubkey.asc
```

> We recommend **client‑side encryption** for WAL‑G archives (age/GPG). If you skip it, ensure MinIO server‑side encryption/policies are enforced.

### 3.2 `postgresql.conf` (inside container)
```conf
wal_level = replica
archive_mode = on
archive_command = 'bash -lc "wal-g wal-push %p"'
# speed up WAL recycling if needed
max_wal_senders = 5
wal_compression = on
```

### 3.3 Recovery settings (for restore scenarios)
Create `/srv/postgres/recovery.conf.sample` (Postgres 15: use `postgresql.auto.conf` entries during restore):
```conf
restore_command = 'bash -lc "wal-g wal-fetch %f %p"'
recovery_target_time = 'latest'   # or an ISO timestamp for PITR
```

### 3.4 Base backup & retention scripts
Create `scripts/backup-postgres.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
export $(grep -v '^#' /srv/postgres/walg.env | xargs)

echo "[WAL-G] Starting base backup $(date -Is)"
docker exec postgres wal-g backup-push /var/lib/postgresql/data

echo "[WAL-G] Retain last 7 full backups + prune old WALs"
docker exec postgres wal-g delete retain FULL 7 --confirm || true

echo "[WAL-G] Purge WALs not required by retained backups"
docker exec postgres wal-g delete before FIND FULL --confirm || true
```
Make executable: `chmod +x scripts/backup-postgres.sh`.

**Cron (on VPS‑01)**
```
# m h  dom mon dow   command
0 2 * * * /srv/scripts/backup-postgres.sh >> /var/log/backup-postgres.log 2>&1
*/5 * * * * docker exec postgres wal-g wal-push --push-interval 300 || true
```

> The 5‑min runner ensures recent WALs are shipped even without a base backup.

---

## 4) Encrypted config bundle
- Use **age** for simplicity:
  ```bash
  age-keygen -o /srv/secure/age.key
  tar -czf - /etc/caddy/Caddyfile /srv/*/*.env /srv/*/compose.yml | \
    age -r <AGE_PUBLIC_KEY> > /srv/secure/config-$(date +%F).tar.gz.age
  mc cp /srv/secure/config-*.age local/backups/config/
  ```
- Store the **private key** offline (admin laptop + password manager secure note).

---

## 5) Restore procedures
### 5.1 DB restore on a fresh VPS (same major Postgres)
1. **Provision Postgres** container stopped; empty data dir.
2. Place `walg.env` and (if used) decryption keys.
3. Run:
   ```bash
   export $(grep -v '^#' /srv/postgres/walg.env | xargs)
   docker run --rm -it --network=host --env-file /srv/postgres/walg.env \
     -v /srv/postgres/data:/var/lib/postgresql/data \
     postgres:15 bash -lc "wal-g backup-fetch /var/lib/postgresql/data LATEST"
   ```
4. Write recovery settings (target time if not latest) using the sample in §3.3.
5. Start Postgres; monitor logs until recovery completes.
6. Repoint app/services to the restored DB URL if the host changed.

### 5.2 Object restore
- For **specific files**: use `mc cp --versions` to fetch by version ID.
- For **large restores** (e.g., thumbnails bucket): mirror back from off‑site if replication is enabled.

### 5.3 Config restore
- Decrypt the latest `.age` bundle; place files back; reload Caddy/Compose.

---

## 6) Verification & drills
Create `scripts/restore-check.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Smoke test query and bucket existence
PGURL="postgres://..."  # read from protected env
psql "$PGURL" -c "select now();" >/dev/null
mc ls local/backups >/dev/null
mc ls local/uploads  >/dev/null
```

**Monthly drill (1st Sunday 03:00)**
```
0 3 * * 0 [ $(date +\%d) -le 07 ] && /srv/scripts/restore-check.sh >> /var/log/restore-check.log 2>&1
```

**Observability hooks**
- Emit a **heartbeat** to Uptime Kuma after successful backup and drill (HTTP GET to a private monitor URL).
- Optional: push `backup_success{job="postgres"}=1` to a Prometheus Pushgateway (see [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md)).

---

## 7) Policies & retention
- **DB backups:** keep **7 full** base backups; WALs pruned accordingly.
- **Object versions:** retain **180 days** on `uploads/thumbnails`, **365 days** on `backups` with noncurrent 90 days.
- **Encrypted configs:** keep **180 days**.
- **Off‑site copy:** strongly recommended; at minimum **weekly** replication of `backups` bucket.

---

## 8) Data retention jobs (GDPR alignment)
> Mirrors the policy we’ll publish in `/about`. Jobs can run via cron or n8n on VPS‑01.

### 8.1 Purge raw HTML > 30 days
```sql
delete from raw_html where fetched_at < now() - interval '30 days';
```

### 8.2 Purge logs/metrics > 90 days
```sql
delete from request_logs where created_at < now() - interval '90 days';
delete from metrics_hourly where ts < now() - interval '180 days';
```

Schedule daily at 04:15.

---

## 9) Security
- MinIO buckets private by default; generate **pre‑signed URLs** for any temporary public access.
- WAL‑G archives are **client‑side encrypted** (preferred) or rely on MinIO server‑side enc.
- Limit access keys to least privilege (`backups` bucket only for WAL‑G user).
- Store decryption keys **off‑site** (password manager, printed recovery sheet optional).

---

## 10) Outputs (fill after setup)
| Key | Value |
|---|---|
| MINIO_BACKUP_BUCKET | `backups` |
| WALG_S3_PREFIX | `s3://backups/postgres` |
| BACKUP_SCHEDULE | `02:00 daily base, 5‑min WAL push` |
| RETENTION_DB | `7 full backups + pruned WALs` |
| RETENTION_OBJECTS | `uploads/thumbnails: 180d; backups: 365d/90d noncurrent` |
| OFFSITE_REPLICATION | `yes/no + target` |
| LAST_RESTORE_DRILL | `YYYY‑MM‑DD` |

---

## 11) Change log
- **v1**: Initial PITR + object lifecycle + restore drills + GDPR purge jobs.

