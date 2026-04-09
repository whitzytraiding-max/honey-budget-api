ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "insights_cache_json" TEXT;
ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "insights_cached_at" TIMESTAMP(3);
