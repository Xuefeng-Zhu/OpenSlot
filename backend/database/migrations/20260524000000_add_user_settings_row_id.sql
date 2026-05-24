-- Butterbase row writes address records by id. Keep profile_id as the
-- one-settings-per-profile conflict key while adding a provider row id.
ALTER TABLE user_settings
  ADD COLUMN id UUID DEFAULT gen_random_uuid();

UPDATE user_settings
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE user_settings
  ALTER COLUMN id SET NOT NULL,
  ADD CONSTRAINT user_settings_id_key UNIQUE (id);
