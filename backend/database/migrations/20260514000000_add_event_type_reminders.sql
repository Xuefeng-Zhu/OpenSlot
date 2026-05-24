-- Event-type reminder policy for one configurable pre-meeting email reminder.
-- Reminder dispatch is scheduled through outbox_events.available_at when a
-- booking is confirmed or rescheduled.
ALTER TABLE event_types
  ADD COLUMN reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN reminder_minutes_before INTEGER NOT NULL DEFAULT 1440,
  ADD COLUMN reminder_guest_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN reminder_host_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE event_types
  ADD CONSTRAINT valid_reminder_minutes
  CHECK (reminder_minutes_before BETWEEN 5 AND 10080);

ALTER TABLE event_types
  ADD CONSTRAINT valid_reminder_channels
  CHECK (
    reminder_enabled = false
    OR reminder_guest_enabled = true
    OR reminder_host_enabled = true
  );
