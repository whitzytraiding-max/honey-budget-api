-- CreateTable
CREATE TABLE "budget_plans" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "couple_id" INTEGER,
    "name" TEXT NOT NULL,
    "start_month" TEXT NOT NULL,
    "end_month" TEXT NOT NULL,
    "plan_json" TEXT NOT NULL,
    "goal_amount" DECIMAL(14,2),
    "goal_currency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;
