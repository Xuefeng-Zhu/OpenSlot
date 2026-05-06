-- Row-Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Public can view profiles with username" ON profiles FOR SELECT USING (username IS NOT NULL);

-- Event types
CREATE POLICY "Users can manage own event types" ON event_types FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Public can view active event types" ON event_types FOR SELECT USING (is_active = true);

-- Availability rules
CREATE POLICY "Users can manage own availability rules" ON availability_rules FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- Availability overrides
CREATE POLICY "Users can manage own availability overrides" ON availability_overrides FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- Slot holds (service role bypasses RLS, but we need a permissive policy for anon reads in slot computation)
CREATE POLICY "Service role manages holds" ON slot_holds FOR ALL USING (true) WITH CHECK (true);

-- Bookings
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (host_user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Service role manages bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
