import L from 'leaflet';

export function createMap(el: HTMLElement, opts?: { center?: [number, number]; zoom?: number }) {
  const map = L.map(el, { zoomControl: true, attributionControl: true });
  const center = opts?.center ?? [45.8150, 15.9819];
  const zoom = opts?.zoom ?? 6;
  map.setView(center, zoom);

  const tileserverUrl = import.meta.env.VITE_TILESERVER_URL;
  const tileUrl = `${tileserverUrl}/styles/osm-bright/{z}/{x}/{y}.png`;
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors';

  L.tileLayer(tileUrl, {
    maxZoom: 19,
    attribution
  }).addTo(map);

  return map;
}

export function addEventMarker(
  map: L.Map,
  e: { id: string; title: string; lat: number; lng: number }
) {
  const marker = L.marker([e.lat, e.lng]);
  marker.bindPopup(`<a href="/event/${e.id}">${e.title}</a>`);
  marker.addTo(map);
  return marker;
}
