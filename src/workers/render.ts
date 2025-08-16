import { Worker } from 'bullmq';

export interface RenderJob {
  /** URL to render */
  url: string;
  /** When true, generate a PDF instead of a screenshot */
  pdf?: boolean;
}

/**
 * Spawns a worker that uses browserless to render screenshots or PDFs. Jobs
 * are read from the `render` queue in Redis. The worker returns a base64
 * encoded string representing the generated artifact.
 */
export function startRenderWorker(
  redisUrl = process.env.REDIS_URL || 'redis://localhost:6379',
) {
  const wsUrl = process.env.BROWSERLESS_WS_URL;
  if (!wsUrl) {
    throw new Error('BROWSERLESS_WS_URL not set');
  }

  // browserless exposes HTTP endpoints that mirror the websocket host
  const httpBase = wsUrl.replace(/^ws/, 'http');
  const token = process.env.BROWSERLESS_TOKEN;

  return new Worker<RenderJob>(
    'render',
    async (job) => {
      const endpoint = job.data.pdf ? 'pdf' : 'screenshot';

      const response = await fetch(`${httpBase}/${endpoint}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { 'x-token': token } : {}),
        },
        body: JSON.stringify({ url: job.data.url }),
      });

      if (!response.ok) {
        throw new Error(`browserless responded ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    },
    { connection: { url: redisUrl } },
  );
}

