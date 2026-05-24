-- Provider watch callbacks look up channels/subscriptions directly from public
-- webhook handlers. These indexes keep lookup and idempotent renewal bounded.
CREATE UNIQUE INDEX IF NOT EXISTS unique_provider_watch_calendar
  ON provider_watches(connection_id, provider, external_calendar_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_provider_watch_channel
  ON provider_watches(provider, channel_id)
  WHERE channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_watches_connection_calendar_status
  ON provider_watches(connection_id, external_calendar_id, status);
