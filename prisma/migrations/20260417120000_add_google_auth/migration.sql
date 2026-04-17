-- Add Google OAuth support (idempotent)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_key'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_google_id_key" UNIQUE ("google_id");
  END IF;
END $$;
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
