CREATE TABLE "couple_invites" (
    "id" SERIAL NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "couple_invites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "couple_invites_recipient_id_status_created_at_idx"
ON "couple_invites"("recipient_id", "status", "created_at");

CREATE INDEX "couple_invites_sender_id_status_created_at_idx"
ON "couple_invites"("sender_id", "status", "created_at");

ALTER TABLE "couple_invites"
ADD CONSTRAINT "couple_invites_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "couple_invites"
ADD CONSTRAINT "couple_invites_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
