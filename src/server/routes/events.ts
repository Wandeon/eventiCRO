import { Hono } from 'hono';
import { db } from '../db/client';
import { rateLimit } from '../middleware/rate-limit';
import { encodeCursor, decodeCursor } from '../lib/cursor';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

const app = new Hono();

app.get('/events', (c) => {
  const rl = rateLimit(c, 'events', 120, 3600);
  if (rl) return rl;

  const q = c.req.query('q')?.toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? '20'), 1), 50);
  const cursor = c.req.query('cursor');
  const startFrom = c.req.query('start_time_from') ? new Date(c.req.query('start_time_from')!) : new Date();
  const startTo = c.req.query('start_time_to') ? new Date(c.req.query('start_time_to')!) : null;
  const city = c.req.query('city');
  const lat = c.req.query('lat');
  const lng = c.req.query('lng');
  const radius = c.req.query('radius_km');
  const cur = cursor ? decodeCursor(cursor) : null;

  let events = Array.from(db.events.values());
  events = events.filter((e) => new Date(e.start_time) >= startFrom);
  if (startTo) events = events.filter((e) => new Date(e.start_time) <= startTo);
  if (q) events = events.filter((e) => e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
  if (city) events = events.filter((e) => e.city?.toLowerCase() === city.toLowerCase());
  if (cur) {
    events = events.filter((e) => {
      const t = new Date(e.start_time).toISOString();
      return t > cur.t || (t === cur.t && e.id > cur.id);
    });
  }
  if (lat && lng && radius) {
    const la = Number(lat); const ln = Number(lng); const r = Number(radius);
    events = events.filter((e) => {
      if (e.lat == null || e.lng == null) return false;
      return haversine(la, ln, e.lat, e.lng) <= r;
    });
  }
  events.sort((a, b) => {
    const ta = new Date(a.start_time).getTime();
    const tb = new Date(b.start_time).getTime();
    if (ta === tb) return a.id > b.id ? 1 : -1;
    return ta - tb;
  });
  const page = events.slice(0, limit);
  const next = page.length === limit ? encodeCursor(page[page.length - 1].start_time, page[page.length - 1].id) : null;
  return c.json({ items: page, next_cursor: next });
});

export default app;
