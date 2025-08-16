import L from 'leaflet';

/**
 * Options for initializing the map.
 */
export interface MapInitOptions {
  /** Initial center of the map as `[lat, lng]`. */
  center?: [number, number];
  /** Initial zoom level. */
  zoom?: number;
}

/**
 * A reference to a Leaflet map instance. Exposed for component typing.
 */
export type MapInstance = L.Map;

/**
 * A reference to a Leaflet marker instance.
 */
export type MarkerInstance = L.Marker;

const TILESERVER_URL = import.meta.env.VITE_TILESERVER_URL;
const TILESERVER_STYLE = import.meta.env.VITE_TILESERVER_STYLE ?? 'osm-bright';
const MAP_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors';

/**
 * Create and initialize a Leaflet map.
 */
export function createMap(
  el: HTMLElement,
  opts: MapInitOptions = {}
): MapInstance {
  const map = L.map(el, {
    zoomControl: true,
    attributionControl: true
  });

  const center = opts.center ?? [45.815, 15.9819]; // Zagreb
  const zoom = opts.zoom ?? 6;
  map.setView(center, zoom);

  const tileUrl = `${TILESERVER_URL}/styles/${TILESERVER_STYLE}/{z}/{x}/{y}.png`;

  L.tileLayer(tileUrl, {
    maxZoom: 19,
    attribution: MAP_ATTRIBUTION
  }).addTo(map);

  return map;
}

export interface EventMarker {
  id: string;
  title: string;
  lat: number;
  lng: number;
}

/**
 * Add an event marker to the map with a simple popup linking to the event.
 */
export function addEventMarker(
  map: MapInstance,
  e: EventMarker
): MarkerInstance {
  const marker = L.marker([e.lat, e.lng]);
  marker.bindPopup(`<a href="/event/${e.id}">${e.title}</a>`);
  marker.addTo(map);
  return marker;
}

/**
 * Convert map bounds to an approximate radius in kilometres.
 */
export function boundsToRadiusKm(bounds: L.LatLngBounds): number {
  const center = bounds.getCenter();
  const north = bounds.getNorth();
  const dKm = Math.abs(north - center.lat) * 111.32; // 1° lat ≈ 111.32 km
  return Math.min(Math.max(dKm, 1), 250);
}

