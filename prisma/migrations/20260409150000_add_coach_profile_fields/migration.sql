ALTER TABLE "couple_coach_profiles" ADD COLUMN IF NOT EXISTS "monthly_budget_target" DECIMAL(14,2);
ALTER TABLE "couple_coach_profiles" ADD COLUMN IF NOT EXISTS "pay_schedule" TEXT;
ALTER TABLE "couple_coach_profiles" ADD COLUMN IF NOT EXISTS "personal_allowance" DECIMAL(14,2);
ALTER TABLE "couple_coach_profiles" ADD COLUMN IF NOT EXISTS "total_debt_amount" DECIMAL(14,2);
