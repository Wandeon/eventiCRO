-- Full-text search and supporting indexes

-- FTS support
ALTER TABLE events DROP COLUMN IF EXISTS search_vec;
ALTER TABLE events ADD COLUMN search_vec tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', unaccent(coalesce(title,''))), 'A') ||
  setweight(to_tsvector('simple', unaccent(coalesce(description,''))), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS idx_events_search_vec ON events USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops);

-- Stable pagination index
CREATE INDEX IF NOT EXISTS idx_events_start_id ON events (start_time ASC, id ASC);

-- Geo helper indexes
CREATE INDEX IF NOT EXISTS idx_events_city ON events (lower(city));
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues (lower(city));
CREATE INDEX IF NOT EXISTS idx_venues_latlng ON venues (lat, lng);
