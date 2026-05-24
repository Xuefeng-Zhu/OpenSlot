-- Calendar provider foundation. Token material is intentionally kept in
-- server-only tables; authenticated clients read safe summaries through API
-- routes or Server Components.
CREATE TABLE provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_email TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_provider_connection_provider
    CHECK (provider IN ('google', 'microsoft')),
  CONSTRAINT valid_provider_connection_status
    CHECK (status IN ('active', 'revoked', 'error')),
  CONSTRAINT unique_provider_connection_account
    UNIQUE (profile_id, provider, account_email)
);

CREATE TABLE provider_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES provider_connections(id) ON DELETE CASCADE,
  external_calendar_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  timezone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  use_for_availability BOOLEAN NOT NULL DEFAULT true,
  use_for_writes BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_provider_calendar
    UNIQUE (connection_id, external_calendar_id)
);

CREATE TABLE provider_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES provider_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_calendar_id TEXT NOT NULL,
  channel_id TEXT,
  resource_id TEXT,
  sync_cursor TEXT,
  expiration_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_provider_watch_provider
    CHECK (provider IN ('google', 'microsoft')),
  CONSTRAINT valid_provider_watch_status
    CHECK (status IN ('active', 'renewal_due', 'expired', 'revoked', 'error'))
);

CREATE TABLE external_busy_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_calendar_id UUID NOT NULL REFERENCES provider_calendars(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  transparency TEXT NOT NULL DEFAULT 'busy',
  etag TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_external_busy_range CHECK (start_at < end_at),
  CONSTRAINT valid_external_busy_transparency
    CHECK (transparency IN ('busy', 'tentative', 'opaque')),
  CONSTRAINT unique_external_busy_source
    UNIQUE (provider_calendar_id, source_event_id)
);

CREATE INDEX idx_provider_connections_profile
  ON provider_connections(profile_id, provider, status);

CREATE INDEX idx_provider_calendars_connection
  ON provider_calendars(connection_id);

CREATE INDEX idx_provider_watches_due
  ON provider_watches(status, expiration_at)
  WHERE status IN ('active', 'renewal_due', 'error');

CREATE INDEX idx_external_busy_cache_calendar_range
  ON external_busy_cache(provider_calendar_id, start_at, end_at);

ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_busy_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE provider_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE provider_calendars TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE provider_watches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_busy_cache TO service_role;

REVOKE ALL ON TABLE provider_connections FROM anon, authenticated;
REVOKE ALL ON TABLE provider_calendars FROM anon, authenticated;
REVOKE ALL ON TABLE provider_watches FROM anon, authenticated;
REVOKE ALL ON TABLE external_busy_cache FROM anon, authenticated;
