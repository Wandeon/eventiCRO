import type { Context, Next } from 'hono';

export async function requireAdmin(c: Context, next: Next) {
  const header = c.req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const expected = process.env.ADMIN_TOKEN || 'admin';
  if (token !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
}

export async function requireIngestSecret(c: Context, next: Next) {
  const secret = c.req.header('x-ingest-secret');
  const expected = process.env.INGEST_SECRET || 'ingest';
  if (secret !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
}
