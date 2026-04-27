-- CreateTable
CREATE TABLE "debts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "couple_id" INTEGER,
    "title" TEXT NOT NULL,
    "original_amount" DECIMAL(12,2) NOT NULL,
    "current_balance" DECIMAL(12,2) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "minimum_payment" DECIMAL(12,2),
    "payment_method" TEXT NOT NULL DEFAULT 'card',
    "paid_off_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" SERIAL NOT NULL,
    "debt_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debts_user_id_created_at_idx" ON "debts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "debts_couple_id_created_at_idx" ON "debts"("couple_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "debt_payments_transaction_id_key" ON "debt_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "debt_payments_debt_id_date_idx" ON "debt_payments"("debt_id", "date");

-- CreateIndex
CREATE INDEX "debt_payments_user_id_date_idx" ON "debt_payments"("user_id", "date");

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
