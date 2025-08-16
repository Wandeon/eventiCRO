import { Hono } from 'hono';
import { db } from '../../db/client';
import { requireAdmin } from '../../middleware/auth';
import { encodeCursor, decodeCursor } from '../../lib/cursor';
import { upsertProcessedEvent } from '../ingest';

const app = new Hono();

app.get('/api/admin/submissions', requireAdmin, (c) => {
  const status = (c.req.query('status') as any) || 'pending';
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? '20'), 1), 50);
  const cursor = c.req.query('cursor');
  const cur = cursor ? decodeCursor(cursor) : null;

  let subs = Array.from(db.submissions.values()).filter((s) => s.status === status);
  subs.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta === tb) return a.id > b.id ? 1 : -1;
    return ta - tb;
  });
  if (cur) {
    subs = subs.filter((s) => {
      const t = new Date(s.created_at).toISOString();
      return t > cur.t || (t === cur.t && s.id > cur.id);
    });
  }
  const page = subs.slice(0, limit);
  const next = page.length === limit ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id) : null;
  return c.json({ items: page, next_cursor: next });
});

app.post('/api/admin/submissions/:id/approve', requireAdmin, (c) => {
  const id = c.req.param('id');
  const sub = db.submissions.get(id);
  if (!sub) return c.json({ error: 'NotFound' }, 404);
  const payload = { ...sub.payload, source: 'submit', source_id: id };
  const res = upsertProcessedEvent(payload);
  if (res.status === 'failed' || !res.id) return c.json({ error: 'Failed', message: res.message }, 400);
  sub.status = 'approved';
  sub.reviewer = 'admin';
  sub.reviewed_at = new Date().toISOString();
  sub.promoted_event_id = res.id;
  db.submissions.set(id, sub);
  return c.json({ promoted_event_id: res.id });
});

app.post('/api/admin/submissions/:id/reject', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const sub = db.submissions.get(id);
  if (!sub) return c.json({ error: 'NotFound' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as any;
  sub.status = 'rejected';
  sub.reviewer = 'admin';
  sub.reviewed_at = new Date().toISOString();
  if (body.reason) sub.reason = body.reason;
  db.submissions.set(id, sub);
  return c.body(null, 204);
});

export default app;
