-- Seed data for OpenSlot Scheduling Platform
-- This script creates demo data for local development and testing.
--
-- NOTE: In a real Supabase setup, users are created via Supabase Auth.
-- For seeding purposes, we insert directly into auth.users to satisfy
-- the foreign key constraint on profiles.auth_user_id.

-- Use a DO block to keep UUIDs consistent across all inserts
DO $$
DECLARE
  demo_auth_user_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  demo_profile_id UUID := 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  event_type_30min_id UUID := 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  event_type_60min_id UUID := 'd4e5f6a7-b8c9-0123-defa-234567890123';
  booking_id UUID := 'e5f6a7b8-c9d0-1234-efab-345678901234';
  tomorrow_date DATE := CURRENT_DATE + INTERVAL '1 day';
  booking_start TIMESTAMPTZ;
  booking_end TIMESTAMPTZ;
BEGIN
  -- Calculate booking times: tomorrow at 10:00 AM Eastern
  booking_start := (tomorrow_date || ' 10:00:00')::TIMESTAMP AT TIME ZONE 'America/New_York';
  booking_end := (tomorrow_date || ' 10:30:00')::TIMESTAMP AT TIME ZONE 'America/New_York';

  -- 1. Create demo user in auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    demo_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo@openslot.dev',
    crypt('demo-password-123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. Create demo profile
  INSERT INTO profiles (
    id,
    auth_user_id,
    email,
    name,
    username,
    default_timezone,
    created_at,
    updated_at
  ) VALUES (
    demo_profile_id,
    demo_auth_user_id,
    'demo@openslot.dev',
    'Demo User',
    'demo',
    'America/New_York',
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  -- 3. Create event types
  INSERT INTO event_types (
    id,
    user_id,
    title,
    slug,
    description,
    duration_minutes,
    buffer_before_minutes,
    buffer_after_minutes,
    min_notice_minutes,
    max_booking_days_ahead,
    location_type,
    location_value,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    event_type_30min_id,
    demo_profile_id,
    '30 Minute Meeting',
    '30-minute-meeting',
    'A quick 30-minute meeting to discuss any topic.',
    30,
    0,
    5,
    60,
    60,
    'online',
    'https://meet.example.com/demo',
    true,
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO event_types (
    id,
    user_id,
    title,
    slug,
    description,
    duration_minutes,
    buffer_before_minutes,
    buffer_after_minutes,
    min_notice_minutes,
    max_booking_days_ahead,
    location_type,
    location_value,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    event_type_60min_id,
    demo_profile_id,
    '60 Minute Consultation',
    '60-minute-consultation',
    'An in-depth 60-minute consultation session.',
    60,
    5,
    10,
    120,
    60,
    'online',
    'https://meet.example.com/demo',
    true,
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  -- 4. Create weekday availability rules (Monday-Friday, 9:00-17:00)
  -- Weekday mapping: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  INSERT INTO availability_rules (user_id, weekday, start_time, end_time, timezone, is_active)
  VALUES
    (demo_profile_id, 1, '09:00', '17:00', 'America/New_York', true),
    (demo_profile_id, 2, '09:00', '17:00', 'America/New_York', true),
    (demo_profile_id, 3, '09:00', '17:00', 'America/New_York', true),
    (demo_profile_id, 4, '09:00', '17:00', 'America/New_York', true),
    (demo_profile_id, 5, '09:00', '17:00', 'America/New_York', true);

  -- 5. Create a sample confirmed booking (tomorrow at 10:00-10:30 AM Eastern)
  INSERT INTO bookings (
    id,
    event_type_id,
    host_user_id,
    guest_name,
    guest_email,
    guest_timezone,
    notes,
    start_at,
    end_at,
    status,
    created_at,
    updated_at
  ) VALUES (
    booking_id,
    event_type_30min_id,
    demo_profile_id,
    'Jane Guest',
    'jane.guest@example.com',
    'America/Chicago',
    'Looking forward to discussing the project!',
    booking_start,
    booking_end,
    'confirmed',
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

END $$;
