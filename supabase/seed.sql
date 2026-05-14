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
  demo_contact_id UUID := 'f6a7b8c9-d0e1-2345-fabc-456789012345';
  demo_cancellation_token UUID := '11111111-1111-4111-8111-111111111111';
  demo_reschedule_token UUID := '22222222-2222-4222-8222-222222222222';
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
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    email_change_token_new,
    email_change,
    email_change_confirm_status,
    phone_change,
    phone_change_token,
    reauthentication_token,
    last_sign_in_at,
    is_sso_user,
    is_anonymous
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
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    '',
    '',
    '',
    '',
    '',
    0,
    '',
    '',
    '',
    now(),
    false,
    false
  ) ON CONFLICT (id) DO UPDATE SET
    aud = EXCLUDED.aud,
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    confirmation_token = EXCLUDED.confirmation_token,
    recovery_token = EXCLUDED.recovery_token,
    email_change_token_current = EXCLUDED.email_change_token_current,
    email_change_token_new = EXCLUDED.email_change_token_new,
    email_change = EXCLUDED.email_change,
    email_change_confirm_status = EXCLUDED.email_change_confirm_status,
    phone_change = EXCLUDED.phone_change,
    phone_change_token = EXCLUDED.phone_change_token,
    reauthentication_token = EXCLUDED.reauthentication_token,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    is_sso_user = EXCLUDED.is_sso_user,
    is_anonymous = EXCLUDED.is_anonymous,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    demo_auth_user_id,
    demo_auth_user_id,
    demo_auth_user_id::text,
    jsonb_build_object(
      'sub', demo_auth_user_id::text,
      'email', 'demo@openslot.dev',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ) ON CONFLICT (provider_id, provider) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    updated_at = EXCLUDED.updated_at;

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
  ) ON CONFLICT (auth_user_id) DO UPDATE SET
    id = EXCLUDED.id,
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    default_timezone = EXCLUDED.default_timezone,
    updated_at = EXCLUDED.updated_at;

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
    cancellation_token,
    reschedule_token,
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
    demo_cancellation_token,
    demo_reschedule_token,
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    event_type_id = EXCLUDED.event_type_id,
    host_user_id = EXCLUDED.host_user_id,
    guest_name = EXCLUDED.guest_name,
    guest_email = EXCLUDED.guest_email,
    guest_timezone = EXCLUDED.guest_timezone,
    notes = EXCLUDED.notes,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    status = EXCLUDED.status,
    cancellation_token = EXCLUDED.cancellation_token,
    reschedule_token = EXCLUDED.reschedule_token,
    updated_at = EXCLUDED.updated_at;

  -- 6. Create a matching contact profile for dashboard contact pages
  INSERT INTO contacts (
    id,
    host_user_id,
    email_hash,
    display_name,
    last_guest_timezone,
    first_seen_at,
    last_seen_at,
    last_booking_id,
    created_at,
    updated_at
  ) VALUES (
    demo_contact_id,
    demo_profile_id,
    '9f4c07655c890f7bfa1ab7e0ac62ea8369a05f1ba57445af1a24fe0013c8baa1',
    'Jane Guest',
    'America/Chicago',
    now(),
    now(),
    booking_id,
    now(),
    now()
  ) ON CONFLICT (host_user_id, email_hash) DO UPDATE SET
    id = EXCLUDED.id,
    display_name = EXCLUDED.display_name,
    last_guest_timezone = EXCLUDED.last_guest_timezone,
    last_seen_at = EXCLUDED.last_seen_at,
    last_booking_id = EXCLUDED.last_booking_id,
    deleted_at = NULL,
    updated_at = EXCLUDED.updated_at;

END $$;
