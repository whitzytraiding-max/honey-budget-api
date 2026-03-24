ALTER TABLE "users"
ADD COLUMN "salary_cash_allocation_pct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "salary_card_allocation_pct" INTEGER NOT NULL DEFAULT 100;

UPDATE "users"
SET
  "salary_cash_allocation_pct" = CASE
    WHEN "salary_payment_method" = 'cash' THEN 100
    ELSE 0
  END,
  "salary_card_allocation_pct" = CASE
    WHEN "salary_payment_method" = 'cash' THEN 0
    ELSE 100
  END;
