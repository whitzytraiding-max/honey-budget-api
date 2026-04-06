-- Allow coach profiles to exist for solo users (not just couples).
-- couple_id becomes optional; user_id is a new optional unique FK.

ALTER TABLE "couple_coach_profiles"
  ALTER COLUMN "couple_id" DROP NOT NULL;

ALTER TABLE "couple_coach_profiles"
  ADD COLUMN "user_id" INTEGER UNIQUE;

ALTER TABLE "couple_coach_profiles"
  ADD CONSTRAINT "couple_coach_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "couple_coach_profiles_user_id_idx"
  ON "couple_coach_profiles"("user_id");
