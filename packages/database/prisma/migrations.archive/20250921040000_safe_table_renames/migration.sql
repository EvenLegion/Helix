-- No-op migration to resolve missing file and align migration history without changing schema
DO $$ BEGIN
  -- intentionally empty
END $$;