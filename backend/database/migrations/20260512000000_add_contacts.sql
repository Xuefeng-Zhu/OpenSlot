-- Host-scoped contacts derived from booking attendees. Raw email remains on
-- booking rows; contacts store only a deterministic hash for repeat detection.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  display_name TEXT,
  last_guest_timezone TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_email_hash_sha256
    CHECK (email_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT contacts_seen_range
    CHECK (first_seen_at <= last_seen_at),
  CONSTRAINT contacts_unique_host_email_hash
    UNIQUE (host_user_id, email_hash)
);

CREATE INDEX idx_contacts_host_last_seen
  ON contacts(host_user_id, last_seen_at DESC);

CREATE INDEX idx_contacts_host_active
  ON contacts(host_user_id, deleted_at, last_seen_at DESC);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON contacts
  FOR SELECT
  USING (
    host_user_id IN (
      SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON TABLE contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contacts TO service_role;
REVOKE ALL ON TABLE contacts FROM anon;

-- Backfill contacts from existing booking attendees without duplicating email.
WITH booking_groups AS (
  SELECT
    host_user_id,
    encode(extensions.digest(lower(trim(guest_email)), 'sha256'), 'hex') AS email_hash,
    MIN(created_at) AS first_seen_at,
    MAX(created_at) AS last_seen_at
  FROM bookings
  WHERE length(trim(guest_email)) > 0
  GROUP BY
    host_user_id,
    encode(extensions.digest(lower(trim(guest_email)), 'sha256'), 'hex')
),
latest_bookings AS (
  SELECT DISTINCT ON (
    host_user_id,
    encode(extensions.digest(lower(trim(guest_email)), 'sha256'), 'hex')
  )
    host_user_id,
    encode(extensions.digest(lower(trim(guest_email)), 'sha256'), 'hex') AS email_hash,
    id AS last_booking_id,
    guest_name AS display_name,
    guest_timezone AS last_guest_timezone
  FROM bookings
  WHERE length(trim(guest_email)) > 0
  ORDER BY
    host_user_id,
    encode(extensions.digest(lower(trim(guest_email)), 'sha256'), 'hex'),
    created_at DESC,
    id DESC
)
INSERT INTO contacts (
  host_user_id,
  email_hash,
  display_name,
  last_guest_timezone,
  first_seen_at,
  last_seen_at,
  last_booking_id,
  created_at,
  updated_at
)
SELECT
  booking_groups.host_user_id,
  booking_groups.email_hash,
  latest_bookings.display_name,
  latest_bookings.last_guest_timezone,
  booking_groups.first_seen_at,
  booking_groups.last_seen_at,
  latest_bookings.last_booking_id,
  booking_groups.first_seen_at,
  booking_groups.last_seen_at
FROM booking_groups
JOIN latest_bookings
  ON latest_bookings.host_user_id = booking_groups.host_user_id
  AND latest_bookings.email_hash = booking_groups.email_hash
ON CONFLICT (host_user_id, email_hash) DO NOTHING;

-- Scrubs booking display PII for a host-owned contact while retaining booking
-- timing, event type, status, and audit rows.
CREATE OR REPLACE FUNCTION public.anonymize_contact_bookings(
  p_contact_id UUID,
  p_host_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_contact contacts%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_scrubbed_email TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  SELECT *
  INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
    AND host_user_id = p_host_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE contacts
  SET display_name = NULL,
      last_guest_timezone = NULL,
      deleted_at = COALESCE(deleted_at, v_now),
      updated_at = v_now
  WHERE id = v_contact.id;

  v_scrubbed_email := 'deleted-contact-' ||
    replace(v_contact.id::text, '-', '') ||
    '@openslot.invalid';

  UPDATE bookings
  SET guest_name = 'Deleted contact',
      guest_email = v_scrubbed_email,
      notes = '',
      cancel_reason = NULL,
      updated_at = v_now
  WHERE host_user_id = p_host_user_id
    AND encode(extensions.digest(lower(trim(guest_email)), 'sha256'), 'hex') = v_contact.email_hash;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_contact_bookings(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_contact_bookings(UUID, UUID) TO service_role;
