import { Hono } from 'hono';
import { db, Event, Venue, Organizer } from '../db/client';
import { requireIngestSecret } from '../middleware/auth';

export interface ProcessedEvent {
  source?: string | null;
  source_id?: string | null;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  venue_name?: string | null;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  organizer_name?: string | null;
  url?: string | null;
  image_url?: string | null;
  price?: string | null;
  category?: string | null;
}

export interface IngestResult {
  status: 'inserted' | 'updated' | 'skipped' | 'failed';
  id?: string;
  message?: string;
}

function upsertVenue(ev: ProcessedEvent): string | undefined {
  if (!ev.venue_name) return undefined;
  const name = ev.venue_name.toLowerCase();
  const address = (ev.address || '').toLowerCase();
  const city = (ev.city || '').toLowerCase();
  for (const v of db.venues.values()) {
    if (v.name.toLowerCase() === name && (v.address || '').toLowerCase() === address && (v.city || '').toLowerCase() === city) {
      if (ev.lat != null) v.lat = ev.lat;
      if (ev.lng != null) v.lng = ev.lng;
      return v.id;
    }
  }
  const id = crypto.randomUUID();
  const venue: Venue = { id, name: ev.venue_name!, address: ev.address || undefined, city: ev.city || undefined, lat: ev.lat || undefined, lng: ev.lng || undefined };
  db.venues.set(id, venue);
  return id;
}

function upsertOrganizer(ev: ProcessedEvent): string | undefined {
  if (!ev.organizer_name) return undefined;
  const name = ev.organizer_name.toLowerCase();
  for (const o of db.organizers.values()) {
    if (o.name.toLowerCase() === name) return o.id;
  }
  const id = crypto.randomUUID();
  const org: Organizer = { id, name: ev.organizer_name! };
  db.organizers.set(id, org);
  return id;
}

export function upsertProcessedEvent(ev: ProcessedEvent): IngestResult {
  try {
    if (!ev.title || !ev.start_time) {
      return { status: 'failed', message: 'missing fields' };
    }
    const venue_id = upsertVenue(ev);
    const organizer_id = upsertOrganizer(ev);
    let existing: Event | undefined;
    if (ev.source && ev.source_id) {
      existing = Array.from(db.events.values()).find((e) => e.source === ev.source && e.source_id === ev.source_id);
    }
    if (existing) {
      existing.title = ev.title;
      existing.description = ev.description || undefined;
      existing.start_time = ev.start_time;
      existing.end_time = ev.end_time || undefined;
      existing.city = ev.city || undefined;
      existing.venue_id = venue_id;
      existing.organizer_id = organizer_id;
      existing.url = ev.url || undefined;
      existing.image_url = ev.image_url || undefined;
      existing.price = ev.price || undefined;
      existing.lat = ev.lat || undefined;
      existing.lng = ev.lng || undefined;
      existing.updated_at = new Date().toISOString();
      return { status: 'updated', id: existing.id };
    }
    const id = crypto.randomUUID();
    const event: Event = {
      id,
      title: ev.title,
      description: ev.description || undefined,
      start_time: ev.start_time,
      end_time: ev.end_time || undefined,
      city: ev.city || undefined,
      venue_id,
      organizer_id,
      url: ev.url || undefined,
      image_url: ev.image_url || undefined,
      price: ev.price || undefined,
      lat: ev.lat || undefined,
      lng: ev.lng || undefined,
      source: ev.source || undefined,
      source_id: ev.source_id || undefined,
      updated_at: new Date().toISOString(),
    };
    db.events.set(id, event);
    return { status: 'inserted', id };
  } catch (err: any) {
    return { status: 'failed', message: err?.message || 'error' };
  }
}

const app = new Hono();

app.post('/ingest', requireIngestSecret, async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body) || body.length === 0) {
    return c.json({ error: 'Invalid payload' }, 400);
  }
  const res: IngestResult[] = body.map((e) => upsertProcessedEvent(e));
  return c.json(res);
});

export default app;
