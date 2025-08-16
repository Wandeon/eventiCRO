import { Worker, Job } from "bullmq";

export interface CrawlJob {
  /** URL to crawl */
  url: string;
}

/**
 * Creates a worker that pulls crawl jobs from Redis and executes them via the
 * Crawl4AI microservice. The resulting payload is optionally posted to the
 * ingestion API defined by `API_BASE_URL` and `INGEST_SECRET`.
 */
export function startCrawlWorker(
  redisUrl = process.env.REDIS_URL || "redis://localhost:6379",
) {
  return new Worker<CrawlJob>(
    "crawl",
    async (job: Job<CrawlJob>) => {
      const crawlApi = process.env.CRAWL4AI_URL;
      if (!crawlApi) {
        throw new Error("CRAWL4AI_URL not set");
      }

      const crawlRes = await fetch(`${crawlApi}/crawl`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: job.data.url }),
      });

      if (!crawlRes.ok) {
        throw new Error(`Crawl4AI responded ${crawlRes.status}`);
      }

      const pageData = await crawlRes.json();

      // Forward to normalization + ingest pipeline if configured
      if (process.env.API_BASE_URL) {
        const ingestRes = await fetch(
          `${process.env.API_BASE_URL}/api/ingest`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(process.env.INGEST_SECRET
                ? { INGEST_SECRET: process.env.INGEST_SECRET }
                : {}),
            },
            body: JSON.stringify(pageData),
          },
        );

        if (!ingestRes.ok) {
          throw new Error(`Ingest failed with ${ingestRes.status}`);
        }
      }

      return pageData;
    },
    { connection: { url: redisUrl } },
  );
}
