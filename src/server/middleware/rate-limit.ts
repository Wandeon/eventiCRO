import type { Context } from 'hono';

interface Entry { count: number; expires: number; }
const store = new Map<string, Entry>();

function getIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.raw?.remoteAddr?.hostname ||
    'unknown'
  );
}

export function rateLimit(
  c: Context,
  key: string,
  limit: number,
  windowSec: number,
) {
  const ip = getIp(c);
  const now = Date.now();
  const k = `${key}:${ip}`;
  const entry = store.get(k);
  if (!entry || entry.expires < now) {
    store.set(k, { count: 1, expires: now + windowSec * 1000 });
  } else {
    entry.count += 1;
  }
  const data = store.get(k)!;
  const remaining = Math.max(0, limit - data.count);
  const reset = Math.ceil((data.expires - now) / 1000);

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(reset));

  if (data.count > limit) {
    c.header('Retry-After', String(reset));
    return c.json({ error: 'TooManyRequests', message: 'Rate limit exceeded' }, 429);
  }
}
