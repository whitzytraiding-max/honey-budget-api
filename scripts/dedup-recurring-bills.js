/**
 * One-time cleanup: remove duplicate recurring bills caused by the double-tap bug.
 *
 * A "duplicate" is two or more recurring bills in the same couple sharing the same
 * title (case-insensitive), amount, and dayOfMonth, created within 30 seconds of
 * each other. The oldest bill (lowest id) is kept; newer copies are deleted along
 * with any auto-created transactions linked to them.
 *
 * Run on Render shell:
 *   node scripts/dedup-recurring-bills.js
 *
 * Or locally with DATABASE_URL set:
 *   DATABASE_URL="..." node scripts/dedup-recurring-bills.js
 */

import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const WINDOW_MS = 30_000; // 30-second double-tap window

async function main() {
  const allBills = await prisma.recurringBill.findMany({
    orderBy: [{ coupleId: "asc" }, { id: "asc" }],
  });

  console.log(`Found ${allBills.length} recurring bill(s) total.`);

  // Group by coupleId
  const byCoupleId = {};
  for (const bill of allBills) {
    if (!byCoupleId[bill.coupleId]) byCoupleId[bill.coupleId] = [];
    byCoupleId[bill.coupleId].push(bill);
  }

  const toDelete = new Set();

  for (const [coupleId, bills] of Object.entries(byCoupleId)) {
    for (let i = 0; i < bills.length; i++) {
      const base = bills[i];
      if (toDelete.has(base.id)) continue;

      for (let j = i + 1; j < bills.length; j++) {
        const candidate = bills[j];
        if (toDelete.has(candidate.id)) continue;

        const sameTitle =
          base.title.trim().toLowerCase() === candidate.title.trim().toLowerCase();
        const sameAmount = Number(base.amount) === Number(candidate.amount);
        const sameDay = base.dayOfMonth === candidate.dayOfMonth;
        const timeDiff = Math.abs(
          new Date(candidate.createdAt).getTime() - new Date(base.createdAt).getTime(),
        );

        if (sameTitle && sameAmount && sameDay && timeDiff <= WINDOW_MS) {
          console.log(
            `  Duplicate in couple ${coupleId}: keeping bill ${base.id} ("${base.title}"), ` +
            `deleting bill ${candidate.id} (created ${timeDiff}ms apart)`,
          );
          toDelete.add(candidate.id);
        }
      }
    }
  }

  if (toDelete.size === 0) {
    console.log("No duplicates found — nothing to do.");
    return;
  }

  const ids = [...toDelete];
  console.log(`\nDeleting ${ids.length} duplicate bill(s) and their auto-created transactions…`);

  // Delete auto-created transactions linked to the duplicate bills first
  const txResult = await prisma.transaction.deleteMany({
    where: {
      recurringBillId: { in: ids },
      autoCreated: true,
    },
  });
  console.log(`  Deleted ${txResult.count} auto-created transaction(s).`);

  // Delete the duplicate bills
  const billResult = await prisma.recurringBill.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`  Deleted ${billResult.count} duplicate bill(s).`);

  console.log("\nDone.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
