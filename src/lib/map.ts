import * as L from "leaflet";

export function createMap(
  el: HTMLElement,
  opts?: { center?: [number, number]; zoom?: number },
) {
  const map = (L as any).map(el, {
    zoomControl: true,
    attributionControl: true,
  }) as L.Map;
  const center = opts?.center ?? [45.815, 15.9819];
  const zoom = opts?.zoom ?? 6;
  map.setView(center, zoom);

  (L as any)
    .tileLayer(
      `${import.meta.env.VITE_TILESERVER_URL}/styles/osm-bright/{z}/{x}/{y}.png`,
      {
        maxZoom: 19,
        attribution:
          import.meta.env.VITE_MAP_ATTRIBUTION ??
          "© OpenStreetMap contributors",
      },
    )
    .addTo(map);

  return map;
}

export function addEventMarker(
  map: L.Map,
  e: { id: string; title: string; lat: number; lng: number },
) {
  const m = (L as any).marker([e.lat, e.lng]);
  m.bindPopup(`<a href="/event/${e.id}">${e.title}</a>`);
  m.addTo(map);
  return m;
}
