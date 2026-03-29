CREATE TABLE "couple_coach_profiles" (
  "id" SERIAL NOT NULL,
  "couple_id" INTEGER NOT NULL,
  "primary_goal" TEXT NOT NULL,
  "goal_horizon" TEXT NOT NULL,
  "biggest_money_stress" TEXT NOT NULL,
  "hardest_category" TEXT NOT NULL,
  "conflict_trigger" TEXT NOT NULL,
  "coaching_focus" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "couple_coach_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "couple_coach_profiles_couple_id_key" ON "couple_coach_profiles"("couple_id");

ALTER TABLE "couple_coach_profiles"
ADD CONSTRAINT "couple_coach_profiles_couple_id_fkey"
FOREIGN KEY ("couple_id") REFERENCES "couples"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
