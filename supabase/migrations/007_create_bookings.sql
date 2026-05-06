-- Bookings table with exclusion constraint for anti-double-booking
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type_id UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_timezone TEXT NOT NULL,
  notes TEXT DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  cancel_reason TEXT,
  cancellation_token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  reschedule_token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_range CHECK (start_at < end_at),
  CONSTRAINT valid_booking_status CHECK (status IN ('confirmed', 'cancelled')),
  -- Anti-double-booking: prevents overlapping confirmed bookings for same host
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    host_user_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status = 'confirmed')
);
