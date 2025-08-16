import type { ProcessedEvent } from '../routes/ingest';

export interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  city?: string;
  lat?: number;
  lng?: number;
  venue_id?: string;
  organizer_id?: string;
  url?: string;
  image_url?: string;
  price?: string;
  source?: string;
  source_id?: string;
  updated_at?: string;
}

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface Organizer {
  id: string;
  name: string;
  website?: string;
}

export interface Submission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  payload: any;
  reviewer?: string;
  reviewed_at?: string;
  reason?: string;
  promoted_event_id?: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  updated_at: string;
}

// Very small in-memory data store used for the API examples and tests.
export const db = {
  events: new Map<string, Event>(),
  venues: new Map<string, Venue>(),
  organizers: new Map<string, Organizer>(),
  submissions: new Map<string, Submission>(),
  featureFlags: new Map<string, FeatureFlag>(),
};

export type { ProcessedEvent };
