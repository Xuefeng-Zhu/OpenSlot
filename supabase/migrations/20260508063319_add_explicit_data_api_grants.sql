-- Supabase projects can disable implicit Data API grants for new public tables.
-- Make the intended REST/table access explicit and keep internal ledgers server-only.

-- Service-role code is the only direct writer for public guest mutations and
-- internal ledgers. The service role also bypasses RLS, but still needs table
-- privileges when implicit grants are disabled.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE availability_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE availability_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE slot_holds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE request_idempotency TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE outbox_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE host_reservations TO service_role;

-- Public booking pages and slot computation go through server-side routes and
-- Server Components, so anon does not need direct table access.
REVOKE ALL ON TABLE profiles FROM anon;
REVOKE ALL ON TABLE event_types FROM anon;
REVOKE ALL ON TABLE availability_rules FROM anon;
REVOKE ALL ON TABLE availability_overrides FROM anon;
REVOKE ALL ON TABLE bookings FROM anon;

-- Authenticated dashboard/client surfaces manage only rows allowed by RLS.
GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE availability_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE availability_overrides TO authenticated;
GRANT SELECT ON TABLE bookings TO authenticated;

-- Public guest writes and availability blocking reads go through route handlers
-- with the service role, not direct anon/auth table access.
REVOKE ALL ON TABLE request_idempotency FROM anon, authenticated;
REVOKE ALL ON TABLE outbox_events FROM anon, authenticated;
REVOKE ALL ON TABLE host_reservations FROM anon, authenticated;
REVOKE ALL ON TABLE slot_holds FROM anon, authenticated;

-- These policies were permissive FOR ALL policies. The service role bypasses
-- RLS, so leaving them in place would make direct anon/auth grants dangerous.
DROP POLICY IF EXISTS "Public can view profiles with username" ON profiles;
DROP POLICY IF EXISTS "Public can view active event types" ON event_types;
DROP POLICY IF EXISTS "Service role manages holds" ON slot_holds;
DROP POLICY IF EXISTS "Service role manages bookings" ON bookings;
