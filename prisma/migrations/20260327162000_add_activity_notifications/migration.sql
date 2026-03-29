CREATE TABLE "activity_notifications" (
  "id" SERIAL NOT NULL,
  "recipient_id" INTEGER NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3),

  CONSTRAINT "activity_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_notifications_recipient_id_created_at_idx"
  ON "activity_notifications"("recipient_id", "created_at");

ALTER TABLE "activity_notifications"
  ADD CONSTRAINT "activity_notifications_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_notifications"
  ADD CONSTRAINT "activity_notifications_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
