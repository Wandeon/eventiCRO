import type { Context, Next } from "hono";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

export const redis = new Redis(redisUrl);

interface Rule {
  limit: number;
  window: number; // seconds
  key: (c: Context) => string;
}

async function applyLimit(key: string, limit: number, window: number) {
  const res = await redis.multi().incr(key).ttl(key).exec();
  const count = Number(res?.[0]?.[1] ?? 0);
  let ttl = Number(res?.[1]?.[1] ?? -1);
  if (ttl < 0) {
    await redis.expire(key, window);
    ttl = window;
  }
  const remaining = Math.max(0, limit - count);
  return { count, ttl, remaining };
}

function rateLimit(rule: Rule) {
  return async (c: Context, next: Next) => {
    const key = rule.key(c);
    const { count, ttl, remaining } = await applyLimit(
      key,
      rule.limit,
      rule.window,
    );

    c.header("X-RateLimit-Limit", rule.limit.toString());
    c.header("X-RateLimit-Remaining", remaining.toString());
    c.header("X-RateLimit-Reset", ttl.toString());

    if (count > rule.limit) {
      c.header("Retry-After", ttl.toString());
      return c.json(
        { error: "TooManyRequests", message: "Rate limit exceeded" },
        429,
      );
    }

    await next();
  };
}

const ip = (c: Context) => {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded;
  const raw = (c.req as any).raw as unknown;
  if (typeof raw === "object" && raw) {
    const socket = (raw as { socket?: { remoteAddress?: string } }).socket;
    if (socket && typeof socket.remoteAddress === "string") {
      return socket.remoteAddress;
    }
  }
  return "";
};

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
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      return `rl:submit:day:${ip(c)}:${day}`;
    },
  }),
];

export default rateLimit;
