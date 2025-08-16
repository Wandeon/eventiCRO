/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
  CacheFirst,
  StaleWhileRevalidate,
  NetworkOnly,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { BackgroundSyncPlugin } from "workbox-background-sync";

// @ts-expect-error injected by workbox at build time
precacheAndRoute(self.__WB_MANIFEST);

// Cache static assets like JS/CSS/fonts for a year
registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font",
  new CacheFirst({
    cacheName: "assets-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  }),
);

// Stale‑while‑revalidate caching for event queries
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/events"),
  new StaleWhileRevalidate({
    cacheName: "api-events-v1",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 10 }),
    ],
  }),
);

// Background sync for offline submissions
const submitQueue = new BackgroundSyncPlugin("submit-queue", {
  maxRetentionTime: 60, // minutes
});
registerRoute(
  ({ url, request }) =>
    url.pathname === "/api/submit" && request.method === "POST",
  new NetworkOnly({ plugins: [submitQueue] }),
  "POST",
);

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
