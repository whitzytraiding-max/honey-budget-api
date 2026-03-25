CREATE TABLE "savings_goals" (
  "id" SERIAL NOT NULL,
  "couple_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "target_amount" DECIMAL(12,2) NOT NULL,
  "target_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "savings_goals_couple_id_key" ON "savings_goals"("couple_id");

ALTER TABLE "savings_goals"
ADD CONSTRAINT "savings_goals_couple_id_fkey"
FOREIGN KEY ("couple_id") REFERENCES "couples"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
