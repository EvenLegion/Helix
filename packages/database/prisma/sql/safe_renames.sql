-- Safe in-place renames to match expected migration state (CamelCase tables)
-- Run once; idempotent checks included

DO $$ BEGIN
  IF to_regclass('arbiter.nameChangeRequest') IS NULL AND to_regclass('arbiter.name_change_request') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "arbiter"."name_change_request" RENAME TO "nameChangeRequest"';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('arbiter.meritType') IS NULL AND to_regclass('arbiter.merit_type') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "arbiter"."merit_type" RENAME TO "meritType"';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('arbiter.eventSession') IS NULL AND to_regclass('arbiter.event_session') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "arbiter"."event_session" RENAME TO "eventSession"';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('arbiter.eventSessionParticipant') IS NULL AND to_regclass('arbiter.event_session_participant') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "arbiter"."event_session_participant" RENAME TO "eventSessionParticipant"';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('arbiter.eventType') IS NULL AND to_regclass('arbiter.event_type') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "arbiter"."event_type" RENAME TO "eventType"';
  END IF;
END $$;
