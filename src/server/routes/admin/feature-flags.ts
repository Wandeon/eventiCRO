import { Hono } from 'hono';
import { db } from '../../db/client';
import { requireAdmin } from '../../middleware/auth';

const app = new Hono();

app.get('/api/admin/feature-flags', requireAdmin, (c) => {
  return c.json(Array.from(db.featureFlags.values()));
});

app.put('/api/admin/feature-flags/:key', requireAdmin, async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json();
  const flag = db.featureFlags.get(key) || {
    key,
    enabled: false,
    description: undefined as string | undefined,
    updated_at: new Date().toISOString(),
  };
  flag.enabled = Boolean(body.enabled);
  if (body.description !== undefined) flag.description = body.description;
  flag.updated_at = new Date().toISOString();
  db.featureFlags.set(key, flag);
  return c.json(flag);
});

app.delete('/api/admin/feature-flags/:key', requireAdmin, (c) => {
  const key = c.req.param('key');
  db.featureFlags.delete(key);
  return c.body(null, 204);
});

export default app;
