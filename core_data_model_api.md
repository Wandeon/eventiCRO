# Core Data Model & API (v2)

> **Scope:** Canonical schema + query contract for `/events`, `/ingest`, `/api/submit`, `/api/admin/*` and supporting indices. This aligns with **openapi/openapi.yaml (v1)** and implements **PR‑2** (cursor pagination, quotas, radius) and **PR‑3/4/5** foundations (ingestion upserts, admin surface, FTS).
>
> **References**
>
> - `openapi/openapi.yaml (v1)` — source of truth for request/response shapes.
> - `deployment-docs.md (v2)` — CI tests against `/api/openapi.json`.
> - [Observability (v1) runbook](observability_md_v_1_otel_→_prometheus_loki_grafana_sentry_errors_traces.md) — `/api/health` contract.
> - `gpu-worker-architecture.md (v1)` — `ProcessedEvent` producers.
> - `security-headers-csp.md (v1)` — public hardening.

---

## 0) Conventions & environment

- **Timezone:** store all timestamps in **UTC**; convert on read for UI.
- **IDs:** short, sortable ULIDs or `uuid` (Postgres `uuid` type). Examples below use `uuid`.
- **Text search locale:** PostgreSQL ``** + **`` config (Croatian dictionary is not built-in). Optional trigram for fuzzy.
- **Sentry:** replace any `GLITCHTIP_*` with ``.

---

## 1) Tables (DDL)

> Create as versioned migrations. Below is a consolidated view with comments. Adjust names if you already have partial schema.

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram for fuzzy
CREATE EXTENSION IF NOT EXISTS unaccent;    -- strip diacritics for FTS

-- 1. organizations / venues -------------------------------------------------
CREATE TABLE IF NOT EXISTS organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lower(name), coalesce(website, ''))
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- pragmatic uniqueness; allows multiple branches if address differs
  CONSTRAINT venues_name_addr_city_uniq UNIQUE (lower(name), coalesce(address,''), coalesce(city,''))
);

-- 2. categories (optional simple list) --------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL
);

-- 3. events (canonical) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  city TEXT,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  organizer_id UUID REFERENCES organizers(id) ON DELETE SET NULL,
  url TEXT,
  image_url TEXT,
  price TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- idempotency / de-dup for ingestion
  source TEXT,           -- e.g. 'crawl', 'submit', 'feed:foo'
  source_id TEXT,        -- external id or canonical URL
  CONSTRAINT events_source_unique UNIQUE (source, source_id)
);

-- many-to-many event categories
CREATE TABLE IF NOT EXISTS event_categories (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, category_id)
);

-- 4. submissions (public intake + moderation) -------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payload JSONB NOT NULL,
  reviewer TEXT,
  reviewed_at TIMESTAMPTZ,
  reason TEXT
);

-- 5. feature flags ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. FTS support ------------------------------------------------------------
-- Normalized tsvector using unaccent + simple config. Keep small for perf.
ALTER TABLE events DROP COLUMN IF EXISTS search_vec;
ALTER TABLE events ADD COLUMN search_vec tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', unaccent(coalesce(title,''))), 'A') ||
  setweight(to_tsvector('simple', unaccent(coalesce(description,''))), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS idx_events_search_vec ON events USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops);

-- 7. Stable pagination indices ---------------------------------------------
-- stable sort by (start_time ASC, id ASC)
CREATE INDEX IF NOT EXISTS idx_events_start_id ON events (start_time ASC, id ASC);

-- 8. Geo helpers (no PostGIS) ----------------------------------------------
-- basic btree indexes to help pre-filtering by city and lat/lng
CREATE INDEX IF NOT EXISTS idx_events_city ON events (lower(city));
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues (lower(city));
CREATE INDEX IF NOT EXISTS idx_venues_latlng ON venues (lat, lng);
```

> If you already use PostGIS, you can replace the Haversine filter in §3 with `ST_DWithin`.

---

## 2) Cursor pagination algorithm (stable & opaque)

- **Ordering:** `ORDER BY start_time ASC, id ASC`.
- **Cursor encoding:** Base64 of JSON `{ t: <ISO8601 zulu>, id: <uuid> }` where `t` is the last row’s `start_time` in UTC.
- **Next page condition:** `WHERE (start_time, id) > (cursor.t, cursor.id)` using tuple comparison.

**SQL fragment**

```sql
-- :cursor_t::timestamptz, :cursor_id::uuid may be NULL on first page
SELECT e.*
FROM events e
WHERE e.start_time >= coalesce(:start_from, now())
  AND (
    :cursor_t IS NULL OR (e.start_time, e.id) > (:cursor_t, :cursor_id)
  )
ORDER BY e.start_time ASC, e.id ASC
LIMIT :limit; -- 1..50, default 20
```

**Response:** `{ items: [...], next_cursor: string|null }` where `next_cursor` encodes the last row.

---

## 3) Radius & filters (portable Haversine)

**Inputs:** `lat`, `lng`, `radius_km` (1..250). We filter by the **event venue** if present; otherwise by the event’s own lat/lng if set.

**Pre-filter:** a bounding box to reduce the candidate set; **then** Haversine.

```sql
-- Parameters: :lat, :lng, :r_km
-- Earth radius ~6371 km
WITH bbox AS (
  SELECT :lat::float8 AS lat, :lng::float8 AS lng, :r_km::float8 AS r
), cand AS (
  SELECT e.*,
         v.lat AS v_lat, v.lng AS v_lng
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
)
SELECT * FROM (
  SELECT e.*,
    6371 * 2 * asin( sqrt( pow(sin(radians((coalesce(v_lat,e.lat) - bbox.lat)/2)),2)
      + cos(radians(bbox.lat)) * cos(radians(coalesce(v_lat,e.lat)))
      * pow(sin(radians((coalesce(v_lng,e.lng) - bbox.lng)/2)),2) ) ) AS dist_km
  FROM cand e, bbox
  WHERE coalesce(v_lat,e.lat) BETWEEN bbox.lat - bbox.r/111.32 AND bbox.lat + bbox.r/111.32
    AND coalesce(v_lng,e.lng) BETWEEN bbox.lng - bbox.r/ (111.32 * cos(radians(bbox.lat)))
) q
WHERE dist_km <= :r_km
```

> Combine this as an **additional AND clause** in the main query when all three radius params are provided.

---

## 4) Text search (`q`) behavior

- **Default:** FTS against `search_vec` using `plainto_tsquery('simple', unaccent(:q))`.
- **Fuzzy assist:** when FTS yields few results, fallback to trigram `title % :q` OR order by `similarity(title,:q)` as a tie-breaker.

**SQL fragment**

```sql
-- :q text may be NULL
WHERE (
  :q IS NULL OR (
    search_vec @@ plainto_tsquery('simple', unaccent(:q))
    OR title ILIKE '%' || :q || '%'
  )
)
```

**Ordering with search:** maintain base ordering `(start_time,id)` for pagination stability; do **not** re-rank by `ts_rank` unless you switch to page-number pagination.

---

## 5) `/events` handler (Hono + postgres example)

```ts
// api/routes/events.ts
import { z } from 'zod';
import type { Context } from 'hono';
import { sql } from 'slonik'; // or pg
import { decodeCursor, encodeCursor } from '../util/cursor';
import { rateLimit } from '../util/ratelimit';

const Query = z.object({
  q: z.string().min(2).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  start_time_from: z.string().datetime().optional(),
  start_time_to: z.string().datetime().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius_km: z.coerce.number().min(1).max(250).optional(),
});

export async function listEvents(c: Context) {
  await rateLimit(c, 'events', 120, 3600); // 120 req / hour / IP

  const p = Query.parse(Object.fromEntries(c.req.query()));
  const cur = p.cursor ? decodeCursor(p.cursor) : null;

  // Build SQL safely with parameters (using slonik/pg)
  // ... compose WHERE based on provided filters, including the Haversine clause if lat/lng/radius

  const rows = await db.any(sql.type(/* Event row type */)`
    SELECT e.*
    FROM events e
    /* joins + where as per sections 2–4 */
    ORDER BY e.start_time ASC, e.id ASC
    LIMIT ${p.limit}
  `);

  const next_cursor = rows.length === p.limit
    ? encodeCursor(rows[rows.length-1].start_time, rows[rows.length-1].id)
    : null;

  c.header('X-RateLimit-Limit', '120');
  c.header('X-RateLimit-Remaining', /* remaining */ '');
  c.header('X-RateLimit-Reset', /* seconds */ '');
  return c.json({ items: rows, next_cursor });
}
```

---

## 6) Redis rate limiting (middleware)

**Policy:** `GET /events` limited to **120 requests/hour per IP**. Return `429` with `Retry-After` when exceeded. Use a **sliding window** or **token bucket**.

```ts
// api/util/ratelimit.ts
import type { Context } from 'hono';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL!);

export async function rateLimit(c: Context, key: string, limit: number, windowSec: number) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.raw.connInfo?.remote?.address || 'unknown';
  const k = `rl:${key}:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const ttl = windowSec;

  const res = await redis.multi()
    .incr(k)
    .ttl(k)
    .exec();
  const count = Number(res?.[0]?.[1] ?? 0);
  let t = Number(res?.[1]?.[1] ?? -1);
  if (t < 0) await redis.expire(k, ttl), t = ttl; // first hit sets TTL

  const remaining = Math.max(0, limit - count);
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(t));

  if (count > limit) {
    c.header('Retry-After', String(t));
    return c.json({ error: 'TooManyRequests', message: 'Rate limit exceeded' }, 429);
  }
}
```

> For bursts, you may add a **secondary** short window (e.g., 10 req / 10s) using another key.

---

## 7) Ingestion mapping (`/ingest`)

**Goal:** Map `ProcessedEvent` → upsert **venues** and **organizers**, then insert/update **events** with FK references. Maintain idempotency using `(source, source_id)`.

```sql
-- Upsert venue by (name,address,city) case-insensitively
INSERT INTO venues (name, address, city, lat, lng)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (lower(name), coalesce(address,''), coalesce(city,''))
DO UPDATE SET
  lat = COALESCE(EXCLUDED.lat, venues.lat),
  lng = COALESCE(EXCLUDED.lng, venues.lng)
RETURNING id;

-- Upsert organizer by (name, website)
INSERT INTO organizers (name, website)
VALUES ($6, $7)
ON CONFLICT (lower(name), coalesce(website,'')) DO UPDATE SET website = COALESCE(EXCLUDED.website, organizers.website)
RETURNING id;

-- Insert or update event by (source, source_id)
INSERT INTO events (
  title, description, start_time, end_time, city, venue_id, organizer_id,
  url, image_url, price, source, source_id
) VALUES ($8, $9, $10, $11, $12, $venue_id, $org_id, $13, $14, $15, $16, $17)
ON CONFLICT (source, source_id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  city = EXCLUDED.city,
  venue_id = COALESCE(EXCLUDED.venue_id, events.venue_id),
  organizer_id = COALESCE(EXCLUDED.organizer_id, events.organizer_id),
  url = COALESCE(EXCLUDED.url, events.url),
  image_url = COALESCE(EXCLUDED.image_url, events.image_url),
  price = COALESCE(EXCLUDED.price, events.price),
  updated_at = now()
RETURNING id;
```

**Validation rules**

- Required: `title`, `start_time`.
- Reject if `start_time` is in the far past (> 365 days ago) unless explicitly allowed.
- Normalize `city` (trim, title-case) and lowercase URLs.

**Per-item result** matches `IngestResult` schema.

---

## 8) Admin endpoints (moderation & flags)

- **List submissions**: `/api/admin/submissions?status=pending&cursor=…&limit=…` returns `{ items, next_cursor }`.
- **Approve**: moves `payload` → normalized tables via the same upsert as `/ingest`, sets `status='approved'`, writes `promoted_event_id`.
- **Reject**: sets `status='rejected'`, optional `reason`.
- **Feature flags**: CRUD limited to admins. Client reads **GET** for UI gating.

> Auth: bearer JWT (service role or admin user). Make sure admin routes are **never** exposed to public without auth.

---

## 9) `/api/submit` (public)

- Accepts a subset of event fields + `captcha_token`.
- Apply IP rate limit (e.g., **5/minute**) and captcha verification server-side.
- Insert raw payload into `submissions` with default `status='pending'`.
- Return `202 { submission_id }`.

---

## 10) Privacy & data retention

- Retain `submissions` for **180 days** minimum for audit; optionally purge rejected after 90d.
- Logs older than 90 days purged (see `backups-runbook.md`).
- Raw HTML scraped content purged after 30 days.

---

## 11) OpenAPI alignment (diff highlights)

- `/events` now documents `cursor`, `limit`, `lat`,`lng`,`radius_km`, `q`, time range, `city`, `category`.
- Response shape `{ items, next_cursor }` matches the SQL + cursor algorithm.
- Rate-limit headers `X-RateLimit-*` and `429 Retry-After` included.
- `/ingest` batch accepts array of `ProcessedEvent`; returns array of `IngestResult`.
- Admin endpoints for moderation and feature flags match §8.

---

## 12) Migrations batch (suggested filenames)

- `V2025_08_16_01_extensions.sql` — `pg_trgm`, `unaccent`.
- `V2025_08_16_02_core_tables.sql` — organizers, venues, events (+ unique `(source,source_id)`), categories, event\_categories.
- `V2025_08_16_03_submissions_flags.sql` — submissions, feature\_flags.
- `V2025_08_16_04_fts_indices.sql` — `search_vec` generated + GIN, trigram, stable sort indices, city indexes.

---

## 13) Testing notes

- **Schemathesis** against `/openapi.json` (already wired).
- **SQL explain**: ensure the `/events` query uses `idx_events_start_id` and GIN where appropriate; add bounding-box prefilter before Haversine for performance.
- **Playwright**: search (`q`), radius search (`lat`,`lng`,`radius_km`), pagination via `next_cursor`.

---

## 14) Change log

- **v2:** Added stable cursor pagination, rate-limiting policy + middleware, Haversine radius filter, FTS indices and behavior, ingestion upserts, submissions moderation tables, and feature flags. Renamed DSN var to `SENTRY_DSN` where applicable.

