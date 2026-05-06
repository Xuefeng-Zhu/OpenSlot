-- Event types table
CREATE TABLE event_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_minutes INTEGER NOT NULL,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  min_notice_minutes INTEGER NOT NULL DEFAULT 60,
  max_booking_days_ahead INTEGER NOT NULL DEFAULT 60,
  location_type TEXT NOT NULL DEFAULT 'online',
  location_value TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_duration CHECK (duration_minutes > 0),
  CONSTRAINT valid_buffers CHECK (buffer_before_minutes >= 0 AND buffer_after_minutes >= 0),
  CONSTRAINT valid_notice CHECK (min_notice_minutes >= 0),
  CONSTRAINT valid_max_days CHECK (max_booking_days_ahead > 0),
  CONSTRAINT valid_location_type CHECK (location_type IN ('online', 'phone', 'in_person', 'custom')),
  CONSTRAINT unique_slug_per_user UNIQUE (user_id, slug)
);
