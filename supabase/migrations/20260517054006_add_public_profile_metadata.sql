ALTER TABLE profiles
  ADD COLUMN public_headline TEXT,
  ADD COLUMN public_bio TEXT,
  ADD COLUMN response_time_label TEXT;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_public_headline_length
    CHECK (public_headline IS NULL OR char_length(public_headline) <= 80),
  ADD CONSTRAINT profiles_public_bio_length
    CHECK (public_bio IS NULL OR char_length(public_bio) <= 280),
  ADD CONSTRAINT profiles_response_time_label_length
    CHECK (response_time_label IS NULL OR char_length(response_time_label) <= 80);
