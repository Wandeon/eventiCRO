import type { PageLoad } from './$types';

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  city?: string | null;
  venue_id?: string | null;
  organizer_id?: string | null;
  url?: string | null;
  image_url?: string | null;
  price?: string | null;
  verified?: boolean;
  lat?: number | null;
  lng?: number | null;
}

export interface EventListResponse {
  items: Event[];
  next_cursor?: string | null;
}

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/events');
  const data: EventListResponse = await res.json();
  return {
    initialEvents: data.items,
    initialCursor: data.next_cursor ?? null
  };
};

