-- Add Sign in with Apple support (idempotent)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_id" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_apple_id_key'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_apple_id_key" UNIQUE ("apple_id");
  END IF;
END $$;
