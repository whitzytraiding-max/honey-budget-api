ALTER TABLE "users"
ADD COLUMN "income_day_of_month" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "monthly_savings_target" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "savings_entries" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "savings_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "savings_entries_user_id_date_idx" ON "savings_entries"("user_id", "date");

ALTER TABLE "savings_entries"
ADD CONSTRAINT "savings_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
