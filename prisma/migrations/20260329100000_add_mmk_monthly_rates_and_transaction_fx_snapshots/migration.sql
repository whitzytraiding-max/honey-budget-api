CREATE TABLE "couple_mmk_monthly_rates" (
  "id" SERIAL NOT NULL,
  "couple_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "rate_source" TEXT NOT NULL,
  "rate" DECIMAL(14,6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "couple_mmk_monthly_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "couple_mmk_monthly_rates_couple_id_year_month_key"
ON "couple_mmk_monthly_rates"("couple_id", "year", "month");

ALTER TABLE "couple_mmk_monthly_rates"
ADD CONSTRAINT "couple_mmk_monthly_rates_couple_id_fkey"
FOREIGN KEY ("couple_id") REFERENCES "couples"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions"
ADD COLUMN "converted_amount" DECIMAL(14,4),
ADD COLUMN "converted_currency_code" TEXT,
ADD COLUMN "conversion_anchor_amount" DECIMAL(14,4),
ADD COLUMN "conversion_anchor_currency_code" TEXT,
ADD COLUMN "exchange_rate_used" DECIMAL(14,6),
ADD COLUMN "exchange_rate_source" TEXT;
