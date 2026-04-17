-- Add Google OAuth support (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_google_id_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_google_id_key" UNIQUE ("google_id");
  END IF;
END $$;
ALTER TABLE "User" ALTER COLUMN "password_hash" DROP NOT NULL;
