# Frontend UI & PWA (v2) — SvelteKit app spec

> **Scope:** Canonical guidance for building the EventiCRO web app UI (SvelteKit), PWA features (Workbox), i18n (HR/EN), Sentry instrumentation, and map integration hooks. This version aligns with:
>
> - `core-data-model-api.md (v2)` — schemas, pagination, search, admin endpoints
> - `security-headers-csp.md (v1)` — CSP/HSTS; SW/CSP compatibility
> - `deployment-docs.md (v2)` — CI scripts, `/api/health` (no `/health` page)
> - `map-integration.md (v2)` — Leaflet + TileServer GL + Nominatim
> - `project-baseline-index.md (v2.1)` — Track‑B tasks & dependencies

---

## 0) Stack & env

- **Framework:** SvelteKit v2 + TypeScript. Styling: TailwindCSS (stable), Headless UI patterns.
- **Libraries:** Zod (validation), typesafe‑i18n (HR/EN), Leaflet (map), `@sentry/sveltekit` (self‑hosted Sentry), Workbox v7 (SW).
- **Env (read at build/runtime):** `APP_BASE_URL`, `API_BASE_URL`, `SENTRY_DSN`, `TILESERVER_URL`. Public endpoints are **HTTPS** via Caddy; internal calls use **tailnet**.

---

## 1) Information architecture (routes)

- `/` — Event list + filters (category, date range, city, radius, verified, q).
- `/event/[id]` — Event detail + map pin + structured data.
- `/submit` — Public submission form + Friendly Captcha.
- `/about` — About + Privacy (canonical text lives in privacy doc).

> **Removed:** `/health` UI route (health is served by API at `/api/health`).

Navigation: sticky header (logo, search, language HR/EN, submit), responsive drawer on mobile. Footer: OSM attribution, privacy link.

---

## 2) UX rules & accessibility

- WCAG 2.2 AA: focus order, landmarks, ARIA for interactive components. Minimum 44×44 tap targets. Respect reduced‑motion.
- Keyboard: all actions reachable via Tab/Enter/Escape; visible focus ring.
- Forms: label/description/invalid hints; live region for submission status.

---

## 3) Event list & filters

**Card fields:** title, date/time (localised), venue, city, category, price (or “Free”), verified badge, thumbnail (≤120 KB). Clicking opens detail.

**Filters UI:** collapsible drawer; binds to URL query (`?q=&city=&from=&to=&radius_km=&category=&verified=`). Persist across navigation. Debounce search input (300 ms).

**Data fetching:** call `GET ${API_BASE_URL}/events` with params; consume `{ items, next_cursor }` and implement **infinite scroll** using the stable cursor. Show skeletons; handle empty states.

---

## 4) Event detail

- Hero image, primary metadata, share buttons.
- Map section: if `lat/lng` known, render Leaflet map; else show address + “Open in Maps”. Follow `map-integration.md` for geocoding fallback and 1 rps cap.
- SEO: include schema.org/Event JSON‑LD (name, startDate, endDate, location).

---

## 5) Submit form

- Fields and constraints mirror `submissions` schema in `core-data-model-api.md`.
- Client validation via Zod; on submit, include `captcha_token`; POST to `/api/submit` endpoint. Show `202 Accepted` success with reference ID.

---

## 6) Internationalisation (HR/EN)

- Library: **typesafe‑i18n** with lazy‑loaded locales. Default to browser language; remember choice.
- **Seed bundles (create these files):**
  - `src/lib/i18n/en.json`
  - `src/lib/i18n/hr.json`

**Suggested keys (initial set):**

```json
// en.json
{
  "nav": {"search": "Search events", "submit": "Submit event", "language": "Language"},
  "home": {"title": "Events in Croatia", "empty": "No events found.", "load_more": "Load more"},
  "filters": {"title": "Filters", "category": "Category", "date_from": "From", "date_to": "To", "city": "City", "radius": "Radius", "verified": "Verified only"},
  "event": {"free": "Free", "price": "Price", "when": "When", "where": "Where", "organizer": "Organizer", "open_in_maps": "Open in Maps"},
  "submit": {"title": "Submit an event", "success": "Thanks! Your event was submitted for review.", "error": "Submission failed."},
  "about": {"title": "About", "privacy": "Privacy"}
}
```

```json
// hr.json
{
  "nav": {"search": "Pretraži događaje", "submit": "Pošalji događaj", "language": "Jezik"},
  "home": {"title": "Događaji u Hrvatskoj", "empty": "Nema pronađenih događaja.", "load_more": "Učitaj još"},
  "filters": {"title": "Filteri", "category": "Kategorija", "date_from": "Od", "date_to": "Do", "city": "Grad", "radius": "Radijus", "verified": "Samo provjereni"},
  "event": {"free": "Besplatno", "price": "Cijena", "when": "Kada", "where": "Gdje", "organizer": "Organizator", "open_in_maps": "Otvori u Kartama"},
  "submit": {"title": "Pošalji događaj", "success": "Hvala! Vaš događaj je poslan na pregled.", "error": "Slanje nije uspjelo."},
  "about": {"title": "O projektu", "privacy": "Privatnost"}
}
```

---

## 7) PWA & offline (Workbox v7)

**Goal:** Cache static assets (immutable) and make `/events` queries resilient (SWR + background refresh). Respect CSP in `security-headers-csp.md` (allows `worker-src blob:`).

### 7.1 Files to add

- `workbox.config.cjs`
- `src/service-worker.ts`
- `static/manifest.webmanifest` (or `src/app.html` link)
- Registration snippet in `src/routes/+layout.svelte`

### 7.2 `workbox.config.cjs`

```js
module.exports = {
  globDirectory: 'build/client/',
  globPatterns: ['**/*.{js,css,svg,woff2,png,ico}'],
  swSrc: 'src/service-worker.ts',
  swDest: 'build/client/sw.js',
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
};
```

### 7.3 `src/service-worker.ts`

```ts
/// <reference lib="webworker" />
import {precacheAndRoute} from 'workbox-precaching';
import {registerRoute} from 'workbox-routing';
import {CacheFirst, StaleWhileRevalidate, NetworkOnly} from 'workbox-strategies';
import {ExpirationPlugin} from 'workbox-expiration';
import {BackgroundSyncPlugin} from 'workbox-background-sync';

// @ts-ignore injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

// Static assets
registerRoute(({request}) => request.destination === 'style' || request.destination === 'script' || request.destination === 'font',
  new CacheFirst({ cacheName: 'assets-v1', plugins: [ new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60*60*24*365 }) ] })
);

// API events with search/cursor — SWR
registerRoute(({url}) => url.pathname.startsWith('/api/events'),
  new StaleWhileRevalidate({ cacheName: 'api-events-v1', plugins: [ new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60*10 }) ] })
);

// Submission fallback (queue if offline)
const submitQueue = new BackgroundSyncPlugin('submit-queue', { maxRetentionTime: 60 /* minutes */ });
registerRoute(({url, request}) => url.pathname === '/api/submit' && request.method === 'POST',
  new NetworkOnly({ plugins: [submitQueue] }), 'POST');

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
```

### 7.4 Manifest (static/manifest.webmanifest)

```json
{
  "name": "EventiCRO",
  "short_name": "EventiCRO",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 7.5 Registration (`src/routes/+layout.svelte`)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
</script>
```

---

## 8) Sentry instrumentation (self‑hosted)

- **Env:** `SENTRY_DSN`, `ENVIRONMENT`, `RELEASE` (git SHA). DSN origin must match CSP `connect-src`.
- **Install:** `pnpm add @sentry/sveltekit @sentry/node @sentry/profiling-node`.
- **Wire:**

```ts
// src/hooks.client.ts
import * as Sentry from '@sentry/sveltekit';
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.2 });

// src/hooks.server.ts
import * as Sentry from '@sentry/sveltekit';
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2, environment: process.env.ENVIRONMENT, release: process.env.RELEASE });
export const handleError = ({ error }) => { Sentry.captureException(error); return { message: 'Internal error' }; };
```

> Frontend builds can expose DSN via `VITE_SENTRY_DSN` (public) while server uses `SENTRY_DSN`.

---

## 9) Map integration hooks

Follow `map-integration.md` strictly. Provide a small adapter in `src/lib/map.ts` that consumes `TILESERVER_URL` from env and renders a pin when `lat/lng` exist. UI fallback with address link when not. Respect 1 rps Nominatim limit and Redis‑backed server geocoding when needed.

---

## 10) API client & error handling

- Wrap fetch calls in a thin client that adds `Accept: application/json` and parses errors. On `429`, back off (exponential) and show a toast.
- Respect `X-RateLimit-*` headers for UI hints (e.g., fading the search box if remaining < 5).

---

## 11) Theming & components

- Use Tailwind utility classes with a small design token set (primary `#2563eb`, neutral grays). Cards: rounded‑2xl, subtle shadows, comfortable spacing. Provide dark mode with `media` query.
- Core components: `EventCard.svelte`, `FiltersDrawer.svelte`, `EventMap.svelte`, `SubmitForm.svelte`, `LangToggle.svelte`.

---

## 12) Build scripts & registration

Ensure `package.json` contains:

```json
{
  "scripts": {
    "build:ui": "vite build",
    "build:sw": "workbox injectManifest",
    "build": "pnpm run build:ui && pnpm run build:sw"
  }
}
```

And that the Caddy CSP (`security-headers-csp.md`) includes `worker-src blob:` and `connect-src` that allow `${API_BASE_URL}`, `${SENTRY_DSN_ORIGIN}`, `${TILESERVER_URL}`.

---

## 13) QA checklist

- PWA installable; offline home works; `/events` cached via SWR.
- i18n toggles HR/EN and persists.
- Map tiles load; geocoding adheres to 1 rps; address fallback works.
- Sentry captures client/server errors with correct release & environment.
- Lighthouse ≥ 90 (Perf/Access/SEO), no CSP violations.

---

## 14) Change log

- **v2:** Removed `/health` UI route; added Workbox `injectManifest` wiring; seeded HR/EN i18n bundles; switched GlitchTip → **self‑hosted Sentry**; aligned CSP; added SW BackgroundSync for `/api/submit`; clarified cursor‑based infinite scroll.

