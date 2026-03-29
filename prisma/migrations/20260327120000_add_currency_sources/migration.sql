ALTER TABLE "users"
ADD COLUMN "income_currency_code" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "transactions"
ADD COLUMN "currency_code" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "savings_entries"
ADD COLUMN "currency_code" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "savings_goals"
ADD COLUMN "currency_code" TEXT NOT NULL DEFAULT 'USD';
