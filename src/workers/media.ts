import { Worker, Job } from "bullmq";

export interface MediaJob {
  /** Source URL or path of the media asset */
  source: string;
  /** Operation to perform, e.g. download, transcode, thumbnail */
  type: "download" | "transcode" | "thumbnail";
  /** Optional extra parameters forwarded to the media service */
  options?: Record<string, unknown>;
}

/**
 * Start a BullMQ worker that proxies media jobs to the media microservice.
 * The worker reads jobs from the `media` queue using the Redis instance
 * defined by `REDIS_URL` (default `redis://localhost:6379`).
 */
export function startMediaWorker(
  redisUrl = process.env.REDIS_URL || "redis://localhost:6379",
) {
  const worker = new Worker<MediaJob>(
    "media",
    async (job: Job<MediaJob>) => {
      const serviceUrl = process.env.MEDIA_SERVICE_URL;
      if (!serviceUrl) {
        throw new Error("MEDIA_SERVICE_URL not set");
      }

      const response = await fetch(serviceUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(job.data),
      });

      if (!response.ok) {
        throw new Error(`Media service responded ${response.status}`);
      }

      return response.json();
    },
    {
      connection: { url: redisUrl },
    },
  );

  return worker;
}
