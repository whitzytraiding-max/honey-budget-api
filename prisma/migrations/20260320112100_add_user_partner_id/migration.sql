-- AlterTable
ALTER TABLE "users" ADD COLUMN "partner_id" INTEGER;

-- Backfill partner links from existing couple rows when present.
UPDATE "users" AS "user"
SET "partner_id" = "couple"."user_two_id"
FROM "couples" AS "couple"
WHERE "couple"."user_one_id" = "user"."id";

UPDATE "users" AS "user"
SET "partner_id" = "couple"."user_one_id"
FROM "couples" AS "couple"
WHERE "couple"."user_two_id" = "user"."id";

-- CreateIndex
CREATE UNIQUE INDEX "users_partner_id_key" ON "users"("partner_id");

-- AddForeignKey
ALTER TABLE "users"
ADD CONSTRAINT "users_partner_id_fkey"
FOREIGN KEY ("partner_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
