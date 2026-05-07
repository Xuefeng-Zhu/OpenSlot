-- Allow authenticated users to repair or create their own profile shell.
-- The signup trigger creates this row for normal accounts, but onboarding also
-- needs to recover accounts created before the trigger/migration was applied.
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);
