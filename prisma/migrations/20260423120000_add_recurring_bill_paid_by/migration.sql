-- Add paid_by field to recurring_bills (joint | user | partner)
ALTER TABLE "recurring_bills" ADD COLUMN IF NOT EXISTS "paid_by" TEXT NOT NULL DEFAULT 'joint';
