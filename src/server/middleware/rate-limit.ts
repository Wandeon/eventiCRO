import type { Context, Next } from 'hono';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is not set');
}

export const redis = new Redis(redisUrl);

interface Rule {
  limit: number;
  window: number; // seconds
  key: (c: Context) => string;
}

async function tokenBucket(key: string, limit: number, window: number) {
  const now = Date.now();
  const rate = limit / (window * 1000); // tokens per ms
  const data = await redis.get(key);
  let tokens = limit;
  let last = now;
  if (data) {
    try {
      const parsed = JSON.parse(data);
      tokens = parsed.tokens;
      last = parsed.last;
    } catch {
      tokens = limit;
      last = now;
    }
    const delta = now - last;
    tokens = Math.min(limit, tokens + delta * rate);
  }
  const allowed = tokens >= 1;
  if (allowed) {
    tokens -= 1;
  }
  await redis.set(key, JSON.stringify({ tokens, last: now }), 'EX', window);
  return { allowed, remaining: Math.floor(tokens) };
}

function rateLimit(rule: Rule) {
  return async (c: Context, next: Next) => {
    const { allowed, remaining } = await tokenBucket(rule.key(c), rule.limit, rule.window);
    c.header('X-RateLimit-Limit', rule.limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    if (!allowed) {
      c.header('Retry-After', rule.window.toString());
      return c.text('Too Many Requests', 429);
    }
    await next();
  };
}

const ip = (c: Context) =>
  c.req.header('x-forwarded-for') ||
  (c.req.raw as any).socket?.remoteAddress ||
  '';

export const eventsRateLimit = rateLimit({
  limit: 120,
  window: 60 * 60,
  key: (c) => `rl:events:${ip(c)}`,
});

export const submitRateLimit = [
  rateLimit({
    limit: 5,
    window: 60,
    key: (c) => `rl:submit:min:${ip(c)}`,
  }),
  rateLimit({
    limit: 30,
    window: 60 * 60 * 24,
    key: (c) => {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return `rl:submit:day:${ip(c)}:${day}`;
    },
  }),
];

export default rateLimit;
