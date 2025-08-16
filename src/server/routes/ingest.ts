import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";

const ingestSecret = process.env.INGEST_SECRET;
if (!ingestSecret) {
  throw new Error("INGEST_SECRET is not set");
}

const route = new Hono();

function normalizeCity(city?: string | null) {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

route.post("/", async (c: Context) => {
  const header =
    c.req.header("ingest_secret") || c.req.header("x-ingest-secret");
  if (!header || header !== ingestSecret) {
    return c.text("Unauthorized", 401);
  }

  let items: unknown;
  try {
    items = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new HTTPException(400, { message: "Expected non-empty array" });
  }

  interface IngestItem {
    title?: unknown;
    description?: unknown;
    start_time?: unknown;
    end_time?: unknown;
    city?: unknown;
    url?: unknown;
    image_url?: unknown;
    source?: unknown;
    source_id?: unknown;
    venue_name?: unknown;
    address?: unknown;
    lat?: unknown;
    lng?: unknown;
    organizer_name?: unknown;
    organizer_website?: unknown;
    price?: unknown;
  }
  interface IngestResult {
    status: string;
    message?: string;
    id?: string;
  }
  const results: IngestResult[] = [];
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;

  for (const item of items as IngestItem[]) {
    try {
      if (
        typeof item.title !== "string" ||
        typeof item.start_time !== "string"
      ) {
        results.push({
          status: "skipped",
          message: "Missing title or start_time",
        });
        continue;
      }

      const start = new Date(item.start_time);
      if (isNaN(start.getTime())) {
        results.push({ status: "skipped", message: "Invalid start_time" });
        continue;
      }
      if (start.getTime() < cutoff) {
        results.push({ status: "skipped", message: "start_time too old" });
        continue;
      }

      const end =
        typeof item.end_time === "string" ? new Date(item.end_time) : null;
      const city = normalizeCity(
        typeof item.city === "string" ? item.city : undefined,
      );
      const url =
        typeof item.url === "string" ? String(item.url).toLowerCase() : null;
      const imageUrl =
        typeof item.image_url === "string"
          ? String(item.image_url).toLowerCase()
          : null;

      const source =
        typeof item.source === "string" && item.source ? item.source : "crawl";
      const sourceId =
        typeof item.source_id === "string" && item.source_id
          ? item.source_id
          : url;

      const result = await db.begin<{
        id: string;
        inserted: boolean;
      }>(async (tx) => {
        let venueId: string | null = null;
        if (typeof item.venue_name === "string" && item.venue_name) {
          const [venue] = await tx`
            INSERT INTO venues (name, address, city, lat, lng)
            VALUES (
              ${item.venue_name},
              ${typeof item.address === "string" ? item.address : null},
              ${city},
              ${typeof item.lat === "number" ? item.lat : null},
              ${typeof item.lng === "number" ? item.lng : null}
            )
            ON CONFLICT (lower(name), coalesce(address,''), coalesce(city,'')) DO UPDATE SET
              lat = COALESCE(EXCLUDED.lat, venues.lat),
              lng = COALESCE(EXCLUDED.lng, venues.lng)
          RETURNING id`;
          venueId = venue?.id ?? null;
        }

        let organizerId: string | null = null;
        if (typeof item.organizer_name === "string" && item.organizer_name) {
          const [org] = await tx`
            INSERT INTO organizers (name, website)
            VALUES (
              ${item.organizer_name},
              ${
                typeof item.organizer_website === "string"
                  ? item.organizer_website
                  : null
              }
            )
            ON CONFLICT (lower(name), coalesce(website,'')) DO UPDATE SET
              website = COALESCE(EXCLUDED.website, organizers.website)
          RETURNING id`;
          organizerId = org?.id ?? null;
        }

        const [ev] = await tx`
          INSERT INTO events (
            title, description, start_time, end_time, city, venue_id, organizer_id,
            url, image_url, price, source, source_id
          ) VALUES (
            ${item.title},
            ${typeof item.description === "string" ? item.description : null},
            ${start.toISOString()},
            ${end ? end.toISOString() : null},
            ${city},
            ${venueId},
            ${organizerId},
            ${url},
            ${imageUrl},
            ${typeof item.price === "number" ? item.price : null},
            ${source},
            ${sourceId}
          )
          ON CONFLICT (source, source_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            city = EXCLUDED.city,
            venue_id = COALESCE(EXCLUDED.venue_id, events.venue_id),
            organizer_id = COALESCE(EXCLUDED.organizer_id, events.organizer_id),
            url = COALESCE(EXCLUDED.url, events.url),
            image_url = COALESCE(EXCLUDED.image_url, events.image_url),
            price = COALESCE(EXCLUDED.price, events.price),
            updated_at = now()
          RETURNING id, xmax = 0 as inserted`;
        return ev;
      });

      results.push({
        status: result.inserted ? "inserted" : "updated",
        id: result.id,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ status: "failed", message });
    }
  }

  return c.json(results);
});

export default route;
