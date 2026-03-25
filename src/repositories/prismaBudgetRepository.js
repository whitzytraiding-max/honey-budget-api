import { HttpError } from "../lib/http.js";

function toNumber(value) {
  return Number(value);
}

function derivePercentages(cashAmount, cardAmount) {
  const total = cashAmount + cardAmount;
  if (total <= 0) {
    return {
      salaryCashAllocationPct: 0,
      salaryCardAllocationPct: 100,
    };
  }

  const salaryCashAllocationPct = Math.round((cashAmount / total) * 100);
  return {
    salaryCashAllocationPct,
    salaryCardAllocationPct: 100 - salaryCashAllocationPct,
  };
}

function mapUser(user) {
  if (!user) {
    return null;
  }

  const salaryCashAmount = toNumber(user.salaryCashAmount ?? 0);
  const salaryCardAmount =
    user.salaryCardAmount !== undefined && user.salaryCardAmount !== null
      ? toNumber(user.salaryCardAmount)
      : Math.max(0, toNumber(user.monthlySalary) - salaryCashAmount);
  const percentages = derivePercentages(salaryCashAmount, salaryCardAmount);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    monthlySalary: toNumber(user.monthlySalary),
    salaryPaymentMethod: user.salaryPaymentMethod,
    salaryCashAmount,
    salaryCardAmount,
    salaryCashAllocationPct:
      Number(user.salaryCashAllocationPct ?? percentages.salaryCashAllocationPct),
    salaryCardAllocationPct:
      Number(user.salaryCardAllocationPct ?? percentages.salaryCardAllocationPct),
    incomeDayOfMonth: Number(user.incomeDayOfMonth ?? 1),
    monthlySavingsTarget: toNumber(user.monthlySavingsTarget ?? 0),
    partnerId: user.partnerId ?? null,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
  };
}

function mapCouple(couple) {
  if (!couple) {
    return null;
  }

  return {
    id: couple.id,
    userOne: mapUser(couple.userOne),
    userTwo: mapUser(couple.userTwo),
    createdAt: couple.createdAt?.toISOString?.() ?? couple.createdAt,
  };
}

function mapTransaction(transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    userName: transaction.user?.name,
    amount: toNumber(transaction.amount),
    description: transaction.description,
    category: transaction.category,
    type: transaction.type,
    paymentMethod: transaction.paymentMethod,
    date: transaction.date.toISOString().slice(0, 10),
    createdAt: transaction.createdAt?.toISOString?.() ?? transaction.createdAt,
  };
}

function mapPasswordResetToken(token) {
  if (!token) {
    return null;
  }

  return {
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt?.toISOString?.() ?? token.expiresAt,
    usedAt: token.usedAt?.toISOString?.() ?? token.usedAt,
    createdAt: token.createdAt?.toISOString?.() ?? token.createdAt,
    user: mapUser(token.user),
  };
}

function mapSavingsEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    userId: entry.userId,
    userName: entry.user?.name,
    amount: toNumber(entry.amount),
    note: entry.note,
    date: entry.date.toISOString().slice(0, 10),
    createdAt: entry.createdAt?.toISOString?.() ?? entry.createdAt,
  };
}

function mapSavingsGoal(goal) {
  if (!goal) {
    return null;
  }

  return {
    id: goal.id,
    coupleId: goal.coupleId,
    title: goal.title,
    targetAmount: toNumber(goal.targetAmount),
    targetDate: goal.targetDate
      ? goal.targetDate.toISOString?.().slice(0, 10) ?? goal.targetDate
      : null,
    createdAt: goal.createdAt?.toISOString?.() ?? goal.createdAt,
    updatedAt: goal.updatedAt?.toISOString?.() ?? goal.updatedAt,
  };
}

function mapCoupleInvite(invite) {
  if (!invite) {
    return null;
  }

  return {
    id: invite.id,
    status: invite.status,
    createdAt: invite.createdAt?.toISOString?.() ?? invite.createdAt,
    updatedAt: invite.updatedAt?.toISOString?.() ?? invite.updatedAt,
    respondedAt: invite.respondedAt?.toISOString?.() ?? invite.respondedAt,
    sender: mapUser(invite.sender),
    recipient: mapUser(invite.recipient),
  };
}

function sortTransactions(rows) {
  return rows
    .map(mapTransaction)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
}

function createPrismaBudgetRepository({ prisma }) {
  return {
    async createUser({
      name,
      email,
      passwordHash,
      monthlySalary,
      salaryPaymentMethod,
      salaryCashAmount,
      salaryCardAmount,
      salaryCashAllocationPct,
      salaryCardAllocationPct,
      incomeDayOfMonth = 1,
      monthlySavingsTarget = 0,
    }) {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          monthlySalary,
          salaryPaymentMethod,
          salaryCashAmount,
          salaryCardAmount,
          salaryCashAllocationPct,
          salaryCardAllocationPct,
          incomeDayOfMonth,
          monthlySavingsTarget,
        },
      });

      return mapUser(user);
    },

    async getUserById(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      return mapUser(user);
    },

    async getUserAuthByEmail(email) {
      return prisma.user.findUnique({
        where: { email },
      });
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      return mapUser(user);
    },

    async createPasswordResetToken({ userId, tokenHash, expiresAt }) {
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId,
        },
      });

      const token = await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
        include: {
          user: true,
        },
      });

      return mapPasswordResetToken(token);
    },

    async getPasswordResetTokenByHash(tokenHash) {
      const token = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: {
          user: true,
        },
      });

      return mapPasswordResetToken(token);
    },

    async resetPasswordWithToken({ tokenId, userId, passwordHash }) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash,
          },
        });

        await tx.passwordResetToken.update({
          where: { id: tokenId },
          data: {
            usedAt: new Date(),
          },
        });

        await tx.passwordResetToken.deleteMany({
          where: {
            userId,
            id: {
              not: tokenId,
            },
          },
        });

        return tx.user.findUnique({
          where: { id: userId },
        });
      });

      return mapUser(result);
    },

    async getCoupleById(coupleId) {
      const couple = await prisma.couple.findUnique({
        where: { id: coupleId },
        include: {
          userOne: true,
          userTwo: true,
        },
      });

      return mapCouple(couple);
    },

    async getCoupleForUser(userId) {
      const couple = await prisma.couple.findFirst({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
        include: {
          userOne: true,
          userTwo: true,
        },
      });

      return mapCouple(couple);
    },

    async createCouple({ userOneId, userTwoId }) {
      const existing = await prisma.couple.findFirst({
        where: {
          OR: [
            { userOneId },
            { userTwoId },
            { userOneId: userTwoId },
            { userTwoId: userOneId },
          ],
        },
      });

      if (existing) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "One of these users is already linked in a couple.",
        );
      }

      const couple = await prisma.couple.create({
        data: {
          userOneId,
          userTwoId,
        },
        include: {
          userOne: true,
          userTwo: true,
        },
      });

      return mapCouple(couple);
    },

    async linkCoupleByPartnerEmail({ userId, partnerEmail }) {
      const normalizedEmail = partnerEmail.trim().toLowerCase();
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      const partner = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!partner) {
        throw new HttpError(404, "PARTNER_NOT_FOUND", "Partner not found.");
      }

      if (!currentUser) {
        throw new HttpError(404, "USER_NOT_FOUND", "Authenticated user not found.");
      }

      if (Number(partner.id) === Number(currentUser.id)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "You cannot link yourself as your partner.",
        );
      }

      const currentCouple = await prisma.couple.findFirst({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
      });
      if (currentCouple || currentUser.partnerId) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "Current user is already linked to a partner.",
        );
      }

      const partnerCouple = await prisma.couple.findFirst({
        where: {
          OR: [{ userOneId: Number(partner.id) }, { userTwoId: Number(partner.id) }],
        },
      });
      if (partnerCouple || partner.partnerId) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "Partner user is already linked to a partner.",
        );
      }

      const invite = await prisma.$transaction(async (tx) => {
        await tx.coupleInvite.updateMany({
          where: {
            senderId: Number(currentUser.id),
            recipientId: Number(partner.id),
            status: "pending",
          },
          data: {
            status: "cancelled",
            respondedAt: new Date(),
          },
        });

        return tx.coupleInvite.create({
          data: {
            senderId: Number(currentUser.id),
            recipientId: Number(partner.id),
          },
          include: {
            sender: true,
            recipient: true,
          },
        });
      });

      return mapCoupleInvite(invite);
    },

    async listPendingCoupleInvitesForUser(userId) {
      const [incoming, outgoing] = await Promise.all([
        prisma.coupleInvite.findMany({
          where: {
            recipientId: userId,
            status: "pending",
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            sender: true,
            recipient: true,
          },
        }),
        prisma.coupleInvite.findMany({
          where: {
            senderId: userId,
            status: "pending",
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            sender: true,
            recipient: true,
          },
        }),
      ]);

      return {
        incoming: incoming.map(mapCoupleInvite),
        outgoing: outgoing.map(mapCoupleInvite),
      };
    },

    async respondToCoupleInvite({ inviteId, userId, action }) {
      const invite = await prisma.coupleInvite.findUnique({
        where: { id: inviteId },
        include: {
          sender: true,
          recipient: true,
        },
      });

      if (!invite || invite.recipientId !== userId) {
        throw new HttpError(404, "INVITE_NOT_FOUND", "Invite not found.");
      }

      if (invite.status !== "pending") {
        throw new HttpError(409, "INVITE_RESOLVED", "This invite has already been handled.");
      }

      if (action === "decline") {
        const declined = await prisma.coupleInvite.update({
          where: { id: inviteId },
          data: {
            status: "declined",
            respondedAt: new Date(),
          },
          include: {
            sender: true,
            recipient: true,
          },
        });

        return {
          invite: mapCoupleInvite(declined),
          couple: null,
        };
      }

      const currentCouple = await prisma.couple.findFirst({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
      });
      if (currentCouple || invite.recipient.partnerId) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "Current user is already linked to a partner.",
        );
      }

      const senderCouple = await prisma.couple.findFirst({
        where: {
          OR: [{ userOneId: invite.senderId }, { userTwoId: invite.senderId }],
        },
      });
      if (senderCouple || invite.sender.partnerId) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "Sender is already linked to a partner.",
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: invite.senderId },
          data: { partnerId: Number(invite.recipientId) },
        });

        await tx.user.update({
          where: { id: invite.recipientId },
          data: { partnerId: Number(invite.senderId) },
        });

        const couple = await tx.couple.create({
          data: {
            userOneId: Number(invite.senderId),
            userTwoId: Number(invite.recipientId),
          },
          include: {
            userOne: true,
            userTwo: true,
          },
        });

        const acceptedInvite = await tx.coupleInvite.update({
          where: { id: inviteId },
          data: {
            status: "accepted",
            respondedAt: new Date(),
          },
          include: {
            sender: true,
            recipient: true,
          },
        });

        await tx.coupleInvite.updateMany({
          where: {
            status: "pending",
            OR: [
              { senderId: invite.senderId },
              { recipientId: invite.senderId },
              { senderId: invite.recipientId },
              { recipientId: invite.recipientId },
            ],
            id: {
              not: inviteId,
            },
          },
          data: {
            status: "cancelled",
            respondedAt: new Date(),
          },
        });

        return {
          invite: acceptedInvite,
          couple,
        };
      });

      return {
        invite: mapCoupleInvite(result.invite),
        couple: mapCouple(result.couple),
      };
    },

    async addTransaction({
      userId,
      amount,
      description,
      category,
      type,
      paymentMethod,
      date,
    }) {
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          description,
          category,
          type,
          paymentMethod,
          date: new Date(`${date}T00:00:00.000Z`),
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      return mapTransaction(transaction);
    },

    async updateUserIncomeProfile({
      userId,
      monthlySalary,
      salaryPaymentMethod,
      salaryCashAmount,
      salaryCardAmount,
      salaryCashAllocationPct,
      salaryCardAllocationPct,
      incomeDayOfMonth,
      monthlySavingsTarget,
    }) {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          monthlySalary,
          salaryPaymentMethod,
          salaryCashAmount,
          salaryCardAmount,
          salaryCashAllocationPct,
          salaryCardAllocationPct,
          ...(incomeDayOfMonth !== undefined ? { incomeDayOfMonth } : {}),
          ...(monthlySavingsTarget !== undefined ? { monthlySavingsTarget } : {}),
        },
      });

      return mapUser(user);
    },

    async listCoupleTransactions({ coupleId, days = 30, fromDate, toDate }) {
      const couple = await prisma.couple.findUnique({
        where: { id: coupleId },
      });

      if (!couple) {
        return [];
      }

      const cutoff = fromDate
        ? new Date(`${fromDate}T00:00:00.000Z`)
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      cutoff.setUTCHours(0, 0, 0, 0);
      const upperBound = toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined;

      const transactions = await prisma.transaction.findMany({
        where: {
          userId: {
            in: [couple.userOneId, couple.userTwoId],
          },
          date: {
            gte: cutoff,
            ...(upperBound ? { lte: upperBound } : {}),
          },
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      });

      return sortTransactions(transactions);
    },

    async listTransactionsForUserIds({ userIds, days = 30, fromDate, toDate }) {
      const filteredUserIds = [...new Set(userIds.filter((value) => Number.isInteger(value)))];

      if (!filteredUserIds.length) {
        return [];
      }

      const cutoff = fromDate
        ? new Date(`${fromDate}T00:00:00.000Z`)
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      cutoff.setUTCHours(0, 0, 0, 0);
      const upperBound = toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined;

      const transactions = await prisma.transaction.findMany({
        where: {
          userId: {
            in: filteredUserIds,
          },
          date: {
            gte: cutoff,
            ...(upperBound ? { lte: upperBound } : {}),
          },
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      });

      return sortTransactions(transactions);
    },

    async addSavingsEntry({ userId, amount, note, date }) {
      const entry = await prisma.savingsEntry.create({
        data: {
          userId,
          amount,
          note,
          date: new Date(`${date}T00:00:00.000Z`),
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      return mapSavingsEntry(entry);
    },

    async listSavingsEntriesForUserIds({ userIds, days = 365 }) {
      const filteredUserIds = [...new Set(userIds.filter((value) => Number.isInteger(value)))];

      if (!filteredUserIds.length) {
        return [];
      }

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      cutoff.setUTCHours(0, 0, 0, 0);

      const entries = await prisma.savingsEntry.findMany({
        where: {
          userId: {
            in: filteredUserIds,
          },
          date: {
            gte: cutoff,
          },
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      });

      return entries
        .map(mapSavingsEntry)
        .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
    },

    async getSavingsGoalForCouple(coupleId) {
      const goal = await prisma.savingsGoal.findUnique({
        where: {
          coupleId,
        },
      });

      return mapSavingsGoal(goal);
    },

    async upsertSavingsGoalForCouple({ coupleId, title, targetAmount, targetDate }) {
      const goal = await prisma.savingsGoal.upsert({
        where: {
          coupleId,
        },
        update: {
          title,
          targetAmount,
          targetDate,
        },
        create: {
          coupleId,
          title,
          targetAmount,
          targetDate,
        },
      });

      return mapSavingsGoal(goal);
    },
  };
}

export { createPrismaBudgetRepository };
