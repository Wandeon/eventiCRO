import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
const jwtSecret = process.env.JWT_SECRET;

export async function requireAuth(c: Context, next: Next) {
  const auth = c.req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.text('Unauthorized', 401);
  }
  const token = auth.slice(7);

  if (supabaseSecret) {
    try {
      const payload = jwt.verify(token, supabaseSecret);
      c.set('user', payload);
      return next();
    } catch {}
  }

  if (jwtSecret) {
    try {
      const payload = jwt.verify(token, jwtSecret);
      c.set('user', payload);
      return next();
    } catch {}
  }

  return c.text('Unauthorized', 401);
}

export default requireAuth;
