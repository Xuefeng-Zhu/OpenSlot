-- Performance indexes

-- Profile lookups
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);

-- Event type lookups
CREATE INDEX idx_event_types_user_id ON event_types(user_id);
CREATE INDEX idx_event_types_slug ON event_types(user_id, slug);

-- Availability queries
CREATE INDEX idx_availability_rules_user_weekday ON availability_rules(user_id, weekday) WHERE is_active = true;
CREATE INDEX idx_availability_overrides_user_date ON availability_overrides(user_id, date);

-- Booking queries
CREATE INDEX idx_bookings_host_status ON bookings(host_user_id, status);
CREATE INDEX idx_bookings_host_time ON bookings(host_user_id, start_at, end_at) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_cancellation_token ON bookings(cancellation_token);

-- Hold queries
CREATE INDEX idx_slot_holds_host_time ON slot_holds(host_user_id, start_at, end_at) WHERE status = 'active';
CREATE INDEX idx_slot_holds_token ON slot_holds(hold_token);
CREATE INDEX idx_slot_holds_expires ON slot_holds(expires_at) WHERE status = 'active';
