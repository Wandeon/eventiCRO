# Map Integration (v2) — Leaflet + TileServer GL + Nominatim

> **Scope:** End‑to‑end mapping and geocoding plan for EventiCRO. Uses **Leaflet** with **raster tiles** from **TileServer GL**, and **server‑mediated Nominatim** for geocoding/reverse‑geocoding. Aligns with:
>
> - `frontend-ui-pwa.md (v2)` — UI hooks & env
> - `security-headers-csp.md (v1)` — CSP allowlists (`img-src`, `connect-src`)
> - `core_data_model_api.md (v2)` — radius filter contract
> - `infra-vps-runbook.md (v1)` — TileServer GL & Nominatim services
> - `tailscale-networking.md (v1)` — private bindings

---

## 0) Goals & constraints

- **No external paid map keys**. Fully self‑hosted tiles + geocoder.
- **Respect OSM/Nominatim policies:** 1 request/sec/IP, include contact in `User-Agent`, cache results.
- **Privacy:** Only the app’s API is public; Nominatim runs **tailnet‑only**. The browser calls **our** `/api/geocode`, never Nominatim directly.
- **Performance:** Debounced queries, server Redis cache, and viewport‑aware event queries.

---

## 1) Runtime env (Track‑A outputs)

- `TILESERVER_URL` — public HTTPS tiles host (Caddy): `https://tiles.example.com`
- `NOMINATIM_URL` — **private** tailnet URL: `http://vps-01.tailnet.local:8070`
- `MAP_DEFAULT_BBOX` — Croatia bounding box: `13.090,42.390,19.450,46.550`
- `MAP_ATTRIBUTION` — `© OpenStreetMap contributors`

> Add `TILESERVER_URL` to CSP `img-src`/`connect-src` in `security-headers-csp.md`.

---

## 2) Tiles (TileServer GL → Leaflet)

- **Tileserver binding:** loopback/tailnet; Caddy proxies `tiles.example.com` → `127.0.0.1:8081`.
- **Raster tiles URL template (Leaflet):** `${TILESERVER_URL}/styles/osm-bright/{z}/{x}/{y}.png`
  - Replace `osm-bright` with your style folder (e.g., `bright`/`basic`).
- **Attribution (required):** show OSM attribution in the map corner.
- **Cache:** Caddy: `Cache-Control: public, max-age=86400` on tile responses.

**Leaflet init snippet**

```ts
// src/lib/map.ts
import L from 'leaflet';

export function createMap(el: HTMLElement, opts?: { center?: [number, number]; zoom?: number }) {
  const map = L.map(el, { zoomControl: true, attributionControl: true });
  const center = opts?.center ?? [45.8150, 15.9819]; // Zagreb
  const zoom = opts?.zoom ?? 6;
  map.setView(center, zoom);

  L.tileLayer(`${import.meta.env.VITE_TILESERVER_URL}/styles/osm-bright/{z}/{x}/{y}.png`, {
    maxZoom: 19,
    attribution: import.meta.env.VITE_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors'
  }).addTo(map);

  return map;
}
```

> For **retina** displays you can use `@2x.png` tiles if the style provides them.

---

## 3) Geocoding (server‑mediated)

**Why:** Keep Nominatim private, respect rate limits, and centralize caching & UA.

### 3.1 API surface (new)

Add **internal API** endpoints (served by our API), then forward to Nominatim:

- `GET /api/geocode?q=Zagreb&limit=5` → array of `{ display_name, lat, lon, boundingbox }`
- `GET /api/reverse?lat=45.81&lon=15.98` → `{ display_name, address }`

> **OpenAPI:** Add these in `openapi/openapi.yaml (v1.1)` next. Client uses these routes only.

### 3.2 Implementation notes

- **Debounce** client input by **400ms**; ignore if length < 3 or unchanged.
- **Headers:** `User-Agent: EventiCRO/1.0 (admin@example.com)` and `Accept-Language: hr,en;q=0.8`.
- **Redis cache:**
  - Key: `geo:q:<sha1(q|lang)>` TTL **7 days**
  - Key: `geo:r:<lat>:<lon>` TTL **14 days**
- **Rate limiting:** 1 req/sec/IP to our endpoints; inside, **token bucket** to Nominatim global 1 rps.
- **Data minimization:** Return only necessary fields; strip extra properties.

**Sketch (Hono + undici)**

```ts
// api/routes/geocode.ts
import { z } from 'zod';
import { rateLimit } from '../util/ratelimit';

const Q = z.object({ q: z.string().min(3), limit: z.coerce.number().min(1).max(10).default(5) });
export async function geocode(c) {
  await rateLimit(c, 'geocode', 60, 60); // 60/min per IP
  const { q, limit } = Q.parse(Object.fromEntries(c.req.query()));
  // redis get → if miss, fetch `${NOMINATIM_URL}/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=${limit}` with UA & AL headers
  // cache & return minimal fields
}

const R = z.object({ lat: z.coerce.number(), lon: z.coerce.number() });
export async function reverse(c) {
  await rateLimit(c, 'reverse', 60, 60);
  const { lat, lon } = R.parse(Object.fromEntries(c.req.query()));
  // redis cache pattern like above
}
```

---

## 4) Viewport → radius coupling

When users pan/zoom, derive a **radius** from the current bounds to query `/events` efficiently.

```ts
export function boundsToRadiusKm(bounds: L.LatLngBounds) {
  const center = bounds.getCenter();
  const north = bounds.getNorth();
  // approx: 1 deg lat ≈ 111.32 km
  const dKm = Math.abs(north - center.lat) * 111.32;
  return Math.min(Math.max(dKm, 1), 250); // clamp to [1,250]
}
```

UI: when map idle, compute `lat`, `lng`, `radius_km` from bounds and call `/events?lat=…&lng=…&radius_km=…` with the other filters.

> This matches the Haversine filter in `core_data_model_api.md (v2)`.

---

## 5) Event markers

- **Pin conditions:** render only when `lat/lng` are present (from event or venue). Otherwise, show address text.
- **Clustering:** Avoid for MVP; paginate list; cap map pins to the items on screen. If needed later, use `leaflet.markercluster`.
- **Accessibility:** large hit‑areas, high‑contrast focus ring, tooltip with event title/date.

**Marker code**

```ts
export function addEventMarker(map: L.Map, e: { id: string; title: string; lat: number; lng: number }) {
  const m = L.marker([e.lat, e.lng]);
  m.bindPopup(`<a href="/event/${e.id}">${e.title}</a>`);
  m.addTo(map);
  return m;
}
```

---

## 6) Reverse geocoding for details (optional)

On the event page, if only `lat/lng` exist, call `/api/reverse` to get a human address for display and sharing. Cache in Redis and store in the UI state; do **not** persist back to the DB automatically.

---

## 7) Ingestion normalization

When ingesting `ProcessedEvent` with address fields:

- Normalize `city` (trim, title‑case, remove accents via `unaccent` on server side).
- Best‑effort resolve venue coordinates by **one** geocode call at ingest time (respect 1 rps bucket) and store `venues.lat/lng`.
- If geocode is inconclusive, keep the textual address; the map falls back gracefully.

---

## 8) Privacy & compliance

- Do not send user IPs or PII to Nominatim. Our server acts as a proxy with a fixed UA and no client identifiers.
- Respect OSM’s Tile and Nominatim usage guidelines; avoid bulk geocoding beyond project scope.

---

## 9) Testing & QA

- Tiles load over HTTPS; attribution displays and remains visible.
- Geocoding autocomplete debounced and rate‑limited; cached answers returned.
- Map idle triggers a correct radius query; list and map stay in sync.
- CSP has `img-src` and `connect-src` allowing tiles endpoint.

---

## 10) Future: vector tiles (optional)

- Swap Leaflet raster for **MapLibre GL** with vector tiles generated via **OpenMapTiles**.
- CSP requires `worker-src blob:` and possibly `script-src 'wasm-unsafe-eval'` (already included).
- Tiles URL then becomes `${TILESERVER_URL}/data/v3/{z}/{x}/{y}.pbf` with proper CORS and `Content-Encoding: gzip`.

---

## 11) Change log

- **v2:** Introduced server‑mediated geocoding `/api/geocode` & `/api/reverse`, Redis caching, viewport‑radius coupling, and clarified tile URLs & CSP. Aligns with core API radius query.

