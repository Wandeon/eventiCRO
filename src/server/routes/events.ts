import { Hono } from 'hono';
import db from '../db/client';
import { encodeCursor, decodeCursor } from '../util/cursor';
import { eventsRateLimit } from '../middleware/rate-limit';

const route = new Hono();

function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

route.get('/', eventsRateLimit, async (c) => {
  const q = c.req.query('q');
  const cursorParam = c.req.query('cursor');
  const limitParam = parseNumber(c.req.query('limit'));
  const startFrom = c.req.query('start_time_from');
  const startTo = c.req.query('start_time_to');
  const city = c.req.query('city');
  const category = c.req.query('category');
  const lat = parseNumber(c.req.query('lat'));
  const lng = parseNumber(c.req.query('lng'));
  const radius = parseNumber(c.req.query('radius_km'));

  const limit = Math.min(Math.max(limitParam ?? 20, 1), 50);
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;

  const params: any[] = [];
  const where: string[] = [];
  const joins: string[] = [];

  if (q) {
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    where.push(`(e.title ILIKE $${params.length-1} OR e.description ILIKE $${params.length})`);
  }

  if (startFrom) {
    params.push(startFrom);
    where.push(`e.start_time >= $${params.length}`);
  }

  if (startTo) {
    params.push(startTo);
    where.push(`e.start_time <= $${params.length}`);
  }

  if (city) {
    params.push(city);
    where.push(`LOWER(e.city) = LOWER($${params.length})`);
  }

  if (category) {
    joins.push('JOIN event_categories ec ON ec.event_id = e.id');
    joins.push('JOIN categories c ON c.id = ec.category_id');
    params.push(category);
    params.push(category);
    where.push(`(c.slug = $${params.length-1} OR c.id::text = $${params.length})`);
  }

  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    params.push(lat);
    params.push(lng);
    params.push(radius);
    const latIdx = params.length - 2;
    const lngIdx = params.length - 1;
    const radIdx = params.length;
    where.push(`(6371 * acos(cos(radians($${latIdx})) * cos(radians(e.lat)) * cos(radians(e.lng) - radians($${lngIdx})) + sin(radians($${latIdx})) * sin(radians(e.lat)))) <= $${radIdx}`);
  }

  if (cursor) {
    params.push(cursor.start_time);
    params.push(cursor.id);
    where.push(`(e.start_time, e.id) > ($${params.length-1}, $${params.length})`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const joinClause = joins.join(' ');

  params.push(limit);
  const sql = `SELECT e.* FROM events e ${joinClause} ${whereClause} ORDER BY e.start_time ASC, e.id ASC LIMIT $${params.length}`;
  const rows = await db.unsafe(sql, params);

  let next_cursor: string | null = null;
  if (rows.length === limit) {
    const last = rows[rows.length - 1];
    next_cursor = encodeCursor(new Date(last.start_time).toISOString(), String(last.id));
  }

  return c.json({ items: rows, next_cursor });
});

export default route;
