-- Tracks the last time a host acknowledged dashboard booking activity.
-- The bell menu still shows recent activity; this timestamp only controls the
-- unseen badge count.
ALTER TABLE user_settings
  ADD COLUMN notifications_seen_at TIMESTAMPTZ;
