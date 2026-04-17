-- Add Google OAuth support
ALTER TABLE "User" ADD COLUMN "google_id" TEXT UNIQUE;
ALTER TABLE "User" ALTER COLUMN "password_hash" DROP NOT NULL;
