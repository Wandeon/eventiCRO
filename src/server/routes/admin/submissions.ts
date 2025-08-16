import { Hono } from 'hono';
import db from '../../db/client';
import requireAuth from '../../middleware/auth';

interface SubmissionRow {
  id: string;
  created_at: Date;
  status: string;
  payload: Record<string, unknown>;
  reviewer: string | null;
  reviewed_at: Date | null;
  reason: string | null;
}

const route = new Hono();

route.use('*', requireAuth);

route.get('/', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const q = c.req.query('q') ?? '';
  const limitParam = parseInt(c.req.query('limit') || '50', 10);
  const limit = Math.min(isNaN(limitParam) ? 50 : limitParam, 50);
  const cursor = c.req.query('cursor');
  let cursorTime: string | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const [t, id] = cursor.split('|');
    if (t && id) {
      cursorTime = t;
      cursorId = id;
    }
  }

  const rows = await db<SubmissionRow[]>`
    SELECT id, created_at, status, payload, reviewer, reviewed_at, reason
    FROM submissions
    WHERE status = ${status}
    ${q ? db`AND (payload->>'title' ILIKE ${'%' + q + '%'} OR payload->>'url' ILIKE ${'%' + q + '%'})` : db``}
    ${cursorTime ? db`AND (created_at, id) > (${cursorTime}, ${cursorId})` : db``}
    ORDER BY created_at, id
    LIMIT ${limit + 1}
  `;

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit];
    nextCursor = `${last.created_at.toISOString()}|${last.id}`;
    rows.length = limit;
  }

  return c.json({ items: rows, next_cursor: nextCursor });
});

route.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const reviewer = (c.get('user') as any)?.sub ?? 'admin';

  const submission = await db<SubmissionRow[]>`
    SELECT id, payload FROM submissions WHERE id = ${id}
  `;
  if (submission.length === 0) {
    return c.text('Not Found', 404);
  }
  const payload = submission[0].payload as Record<string, any>;

  const eventRows = await db<{ id: string }[]>`
    INSERT INTO events (title, description, start_time, end_time, city, url, image_url, price, created_at, updated_at, source, source_id)
    VALUES (
      ${payload.title},
      ${payload.description ?? null},
      ${payload.start_time},
      ${payload.end_time ?? null},
      ${payload.city ?? null},
      ${payload.url ?? null},
      ${payload.image_url ?? null},
      ${payload.price ?? null},
      now(),
      now(),
      'submit',
      ${id}
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const promotedEventId = eventRows[0]?.id ?? null;

  await db`
    UPDATE submissions
    SET status = 'approved', reviewer = ${reviewer}, reviewed_at = now(), reason = NULL
    WHERE id = ${id}
  `;

  if (payload.submitter_email) {
    console.log(`Submission ${id} approved; notifying ${payload.submitter_email}`);
  }

  return c.json({ promoted_event_id: promotedEventId });
});

route.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const reviewer = (c.get('user') as any)?.sub ?? 'admin';

  let reason: string | undefined;
  try {
    const body = await c.req.json();
    if (body && typeof body.reason === 'string') {
      reason = body.reason;
    }
  } catch {}

  const submission = await db<SubmissionRow[]>`SELECT payload FROM submissions WHERE id = ${id}`;
  if (submission.length === 0) {
    return c.text('Not Found', 404);
  }
  const payload = submission[0].payload as Record<string, any>;

  await db`
    UPDATE submissions
    SET status = 'rejected', reviewer = ${reviewer}, reviewed_at = now(), reason = ${reason ?? null}
    WHERE id = ${id}
  `;

  if (payload.submitter_email) {
    console.log(`Submission ${id} rejected; notifying ${payload.submitter_email}`);
  }

  return c.body(null, 204);
});

export default route;

