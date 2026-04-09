-- CreateTable: coupon_codes
CREATE TABLE "coupon_codes" (
    "id"           SERIAL PRIMARY KEY,
    "code"         TEXT NOT NULL,
    "type"         TEXT NOT NULL,
    "duration_days" INTEGER,
    "max_uses"     INTEGER,
    "used_count"   INTEGER NOT NULL DEFAULT 0,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "note"         TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable: coupon_redemptions
CREATE TABLE "coupon_redemptions" (
    "id"             SERIAL PRIMARY KEY,
    "user_id"        INTEGER NOT NULL,
    "coupon_code_id" INTEGER NOT NULL,
    "redeemed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraints
CREATE UNIQUE INDEX "coupon_codes_code_key" ON "coupon_codes"("code");
CREATE UNIQUE INDEX "coupon_redemptions_user_id_coupon_code_id_key" ON "coupon_redemptions"("user_id", "coupon_code_id");

-- Foreign keys
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_code_id_fkey"
    FOREIGN KEY ("coupon_code_id") REFERENCES "coupon_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
