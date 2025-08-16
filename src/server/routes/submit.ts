import { Hono } from 'hono';
import { db } from '../db/client';
import { rateLimit } from '../middleware/rate-limit';
import { verifyFriendlyCaptcha } from '../lib/captcha';

const app = new Hono();

app.post('/api/submit', async (c) => {
  let rl = rateLimit(c, 'submit:minute', 5, 60);
  if (rl) return rl;
  rl = rateLimit(c, 'submit:day', 30, 86400);
  if (rl) return rl;

  const body = await c.req.json();
  if (body.honeypot) {
    return c.json({ error: 'Invalid', message: 'Honeypot filled' }, 400);
  }
  const ok = await verifyFriendlyCaptcha(body.captcha_token);
  if (!ok) {
    return c.json({ error: 'CaptchaFailed' }, 401);
  }
  const id = crypto.randomUUID();
  const payload = { ...body };
  delete payload.captcha_token;
  delete payload.honeypot;
  db.submissions.set(id, { id, status: 'pending', created_at: new Date().toISOString(), payload });
  c.header('Cache-Control', 'no-store');
  return c.json({ submission_id: id }, 202);
});

export default app;
