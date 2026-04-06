-- Add subscription fields to users for paywall/Pro tier support.

ALTER TABLE "users"
  ADD COLUMN "subscription_status"   VARCHAR(20)  NOT NULL DEFAULT 'free',
  ADD COLUMN "subscription_expires_at" TIMESTAMPTZ,
  ADD COLUMN "subscription_provider"  VARCHAR(20);
