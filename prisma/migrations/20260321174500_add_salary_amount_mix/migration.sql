ALTER TABLE "users"
ADD COLUMN "salary_cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "salary_card_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "users"
SET
  "salary_cash_amount" = ROUND(("monthly_salary" * "salary_cash_allocation_pct" / 100.0)::numeric, 2),
  "salary_card_amount" = ROUND(("monthly_salary" * "salary_card_allocation_pct" / 100.0)::numeric, 2);
