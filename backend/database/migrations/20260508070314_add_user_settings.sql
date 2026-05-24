-- Persistent host settings for dashboard display preferences and notification
-- choices. Account identity remains in profiles/auth.users.
CREATE TABLE user_settings (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format TEXT NOT NULL DEFAULT '12h',
  notify_new_booking BOOLEAN NOT NULL DEFAULT true,
  notify_cancellation BOOLEAN NOT NULL DEFAULT true,
  notify_reminder BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_user_settings_date_format
    CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
  CONSTRAINT valid_user_settings_time_format
    CHECK (time_format IN ('12h', '24h'))
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_settings TO service_role;
REVOKE ALL ON TABLE user_settings FROM anon;

CREATE POLICY "Users can view own settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own settings"
  ON user_settings
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid())
    )
  );
