/**
 * One-time cleanup: remove duplicate auto-created transactions caused by the
 * materializeRecurringBills race condition (parallel dashboard/summary/planner
 * requests all passing the exists-check before any of them wrote the row).
 *
 * A "duplicate" auto-created transaction is one sharing the same:
 *   userId + recurringBillId + date
 * More than one such row means materialization fired multiple times for the
 * same bill occurrence. We keep the lowest id and delete the rest.
 *
 * Run on Render shell:
 *   node scripts/dedup-materialized-transactions.js
 */

import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Find all auto-created transactions grouped by userId + recurringBillId + date
  const dupes = await prisma.$queryRaw`
    SELECT
      "user_id",
      "recurring_bill_id",
      "date",
      COUNT(*)::int          AS cnt,
      MIN(id)                AS keep_id,
      ARRAY_AGG(id ORDER BY id) AS all_ids
    FROM transactions
    WHERE auto_created = true
      AND recurring_bill_id IS NOT NULL
    GROUP BY "user_id", "recurring_bill_id", "date"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, "date" DESC
  `;

  if (dupes.length === 0) {
    console.log("No duplicate auto-created transactions found — nothing to do.");
    return;
  }

  console.log(`Found ${dupes.length} occurrence(s) with duplicates:\n`);

  const toDelete = [];

  for (const row of dupes) {
    const extras = row.all_ids.filter((id) => id !== row.keep_id);
    console.log(
      `  userId=${row.user_id} billId=${row.recurring_bill_id} date=${String(row.date).slice(0, 10)} ` +
      `→ ${row.cnt} copies, keeping id ${row.keep_id}, deleting [${extras.join(", ")}]`,
    );
    toDelete.push(...extras);
  }

  console.log(`\nDeleting ${toDelete.length} duplicate transaction(s)…`);
  const result = await prisma.transaction.deleteMany({
    where: { id: { in: toDelete } },
  });
  console.log(`Deleted ${result.count} transaction(s).`);
  console.log("\nDone.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
