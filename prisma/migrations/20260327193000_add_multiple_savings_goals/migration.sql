ALTER TABLE "savings_entries"
  ADD COLUMN "savings_goal_id" INTEGER;

CREATE INDEX "savings_entries_savings_goal_id_date_idx"
  ON "savings_entries"("savings_goal_id", "date");

ALTER TABLE "savings_entries"
  ADD CONSTRAINT "savings_entries_savings_goal_id_fkey"
  FOREIGN KEY ("savings_goal_id") REFERENCES "savings_goals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "savings_goals_couple_id_key";

CREATE INDEX "savings_goals_couple_id_created_at_idx"
  ON "savings_goals"("couple_id", "created_at");
