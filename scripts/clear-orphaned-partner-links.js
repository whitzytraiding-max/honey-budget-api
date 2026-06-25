/**
 * One-time cleanup: clear orphaned User.partnerId values.
 *
 * Linking a couple sets BOTH a Couple row AND User.partnerId on each member,
 * but the old unlinkCouple only deleted the Couple row and never cleared
 * partnerId. The link checks treat a stale partnerId as "already linked", so
 * an unlinked user could never add a new partner ("you still have a partner
 * linked"), and couldn't unlink again because their Couple row was already
 * gone.
 *
 * This finds every user whose partnerId is set but who is NOT a member of any
 * Couple row, and clears partnerId. Users in a live couple are left untouched.
 *
 * Run on Render shell:
 *   node scripts/clear-orphaned-partner-links.js
 */

import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const linkedUsers = await prisma.user.findMany({
    where: { partnerId: { not: null } },
    select: { id: true, email: true, partnerId: true },
  });

  if (linkedUsers.length === 0) {
    console.log("No users have partnerId set. Nothing to do.");
    return;
  }

  const orphaned = [];
  for (const user of linkedUsers) {
    const couple = await prisma.couple.findFirst({
      where: { OR: [{ userOneId: user.id }, { userTwoId: user.id }] },
      select: { id: true },
    });
    if (!couple) orphaned.push(user);
  }

  if (orphaned.length === 0) {
    console.log(
      `${linkedUsers.length} user(s) have partnerId set, all backed by a live Couple row. Nothing to clear.`,
    );
    return;
  }

  console.log(`Found ${orphaned.length} orphaned partner link(s):`);
  for (const u of orphaned) {
    console.log(`  user ${u.id} <${u.email}> -> stale partnerId ${u.partnerId}`);
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: orphaned.map((u) => u.id) } },
    data: { partnerId: null },
  });

  console.log(`Cleared partnerId on ${result.count} user(s). They can now re-link.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
