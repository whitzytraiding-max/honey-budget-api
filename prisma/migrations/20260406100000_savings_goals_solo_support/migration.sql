-- Allow savings goals to belong to a solo user instead of a couple.
-- Existing couple goals are unaffected (couple_id stays set, user_id stays null).

-- Make couple_id nullable so solo goals don't need a couple.
ALTER TABLE "savings_goals" ALTER COLUMN "couple_id" DROP NOT NULL;

-- Add user_id for solo-owned goals (nullable so couple goals don't need it).
ALTER TABLE "savings_goals" ADD COLUMN "user_id" INTEGER;

ALTER TABLE "savings_goals"
  ADD CONSTRAINT "savings_goals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "savings_goals_user_id_created_at_idx" ON "savings_goals"("user_id", "created_at");
