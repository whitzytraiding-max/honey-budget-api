-- Add recurring bills, household rules, and push device groundwork.
-- This migration is additive and does not remove or rewrite existing production data.

CREATE TABLE "push_devices" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "platform" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_user_id_enabled_idx" ON "push_devices"("user_id", "enabled");

CREATE TABLE "recurring_bills" (
  "id" SERIAL NOT NULL,
  "couple_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency_code" TEXT NOT NULL DEFAULT 'USD',
  "category" TEXT NOT NULL,
  "payment_method" TEXT NOT NULL,
  "day_of_month" INTEGER NOT NULL,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "auto_create" BOOLEAN NOT NULL DEFAULT true,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_bills_couple_id_is_active_day_of_month_idx"
  ON "recurring_bills"("couple_id", "is_active", "day_of_month");
CREATE INDEX "recurring_bills_user_id_created_at_idx"
  ON "recurring_bills"("user_id", "created_at");

CREATE TABLE "household_rules" (
  "id" SERIAL NOT NULL,
  "couple_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "threshold_amount" DECIMAL(12,2),
  "currency_code" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "household_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "household_rules_couple_id_is_active_created_at_idx"
  ON "household_rules"("couple_id", "is_active", "created_at");

ALTER TABLE "transactions"
  ADD COLUMN "recurring_bill_id" INTEGER,
  ADD COLUMN "auto_created" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "transactions_recurring_bill_id_date_idx"
  ON "transactions"("recurring_bill_id", "date");

ALTER TABLE "push_devices"
  ADD CONSTRAINT "push_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_bills"
  ADD CONSTRAINT "recurring_bills_couple_id_fkey"
  FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_bills"
  ADD CONSTRAINT "recurring_bills_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "household_rules"
  ADD CONSTRAINT "household_rules_couple_id_fkey"
  FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_recurring_bill_id_fkey"
  FOREIGN KEY ("recurring_bill_id") REFERENCES "recurring_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
