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
    incomeCurrencyCode: user.incomeCurrencyCode ?? "USD",
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
    recurringBillId: transaction.recurringBillId ?? null,
    autoCreated: Boolean(transaction.autoCreated),
    userName: transaction.user?.name,
    amount: toNumber(transaction.amount),
    currencyCode: transaction.currencyCode ?? "USD",
    convertedAmount:
      transaction.convertedAmount !== undefined && transaction.convertedAmount !== null
        ? toNumber(transaction.convertedAmount)
        : null,
    convertedCurrencyCode: transaction.convertedCurrencyCode ?? null,
    conversionAnchorAmount:
      transaction.conversionAnchorAmount !== undefined &&
      transaction.conversionAnchorAmount !== null
        ? toNumber(transaction.conversionAnchorAmount)
        : null,
    conversionAnchorCurrencyCode: transaction.conversionAnchorCurrencyCode ?? null,
    exchangeRateUsed:
      transaction.exchangeRateUsed !== undefined && transaction.exchangeRateUsed !== null
        ? toNumber(transaction.exchangeRateUsed)
        : null,
    exchangeRateSource: transaction.exchangeRateSource ?? null,
    description: transaction.description,
    category: transaction.category,
    type: transaction.type,
    paymentMethod: transaction.paymentMethod,
    date: transaction.date.toISOString().slice(0, 10),
    createdAt: transaction.createdAt?.toISOString?.() ?? transaction.createdAt,
  };
}

function mapRecurringBill(bill) {
  if (!bill) {
    return null;
  }

  return {
    id: bill.id,
    coupleId: bill.coupleId,
    userId: bill.userId,
    userName: bill.user?.name ?? null,
    title: bill.title,
    amount: toNumber(bill.amount),
    currencyCode: bill.currencyCode ?? "USD",
    category: bill.category,
    paymentMethod: bill.paymentMethod,
    dayOfMonth: Number(bill.dayOfMonth),
    notes: bill.notes ?? "",
    isActive: Boolean(bill.isActive),
    autoCreate: Boolean(bill.autoCreate),
    startDate: bill.startDate?.toISOString?.().slice(0, 10) ?? bill.startDate,
    endDate: bill.endDate?.toISOString?.().slice(0, 10) ?? bill.endDate ?? null,
    createdAt: bill.createdAt?.toISOString?.() ?? bill.createdAt,
    updatedAt: bill.updatedAt?.toISOString?.() ?? bill.updatedAt,
  };
}

function mapHouseholdRule(rule) {
  if (!rule) {
    return null;
  }

  return {
    id: rule.id,
    coupleId: rule.coupleId,
    title: rule.title,
    details: rule.details,
    thresholdAmount:
      rule.thresholdAmount !== undefined && rule.thresholdAmount !== null
        ? toNumber(rule.thresholdAmount)
        : null,
    currencyCode: rule.currencyCode ?? null,
    isActive: Boolean(rule.isActive),
    createdAt: rule.createdAt?.toISOString?.() ?? rule.createdAt,
    updatedAt: rule.updatedAt?.toISOString?.() ?? rule.updatedAt,
  };
}

function mapPushDevice(device) {
  if (!device) {
    return null;
  }

  return {
    id: device.id,
    userId: device.userId,
    platform: device.platform,
    token: device.token,
    enabled: Boolean(device.enabled),
    createdAt: device.createdAt?.toISOString?.() ?? device.createdAt,
    updatedAt: device.updatedAt?.toISOString?.() ?? device.updatedAt,
    lastSeenAt: device.lastSeenAt?.toISOString?.() ?? device.lastSeenAt,
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
    savingsGoalId: entry.savingsGoalId ?? null,
    savingsGoalTitle: entry.savingsGoal?.title ?? null,
    userName: entry.user?.name,
    amount: toNumber(entry.amount),
    currencyCode: entry.currencyCode ?? "USD",
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
    currencyCode: goal.currencyCode ?? "USD",
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

function mapActivityNotification(notification) {
  if (!notification) {
    return null;
  }

  return {
    id: notification.id,
    recipientId: notification.recipientId,
    actorId: notification.actorId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt?.toISOString?.() ?? notification.createdAt,
    readAt: notification.readAt?.toISOString?.() ?? notification.readAt,
    actor: mapUser(notification.actor),
  };
}

function mapCoupleCoachProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    coupleId: profile.coupleId,
    primaryGoal: profile.primaryGoal,
    goalHorizon: profile.goalHorizon,
    biggestMoneyStress: profile.biggestMoneyStress,
    hardestCategory: profile.hardestCategory,
    conflictTrigger: profile.conflictTrigger,
    coachingFocus: profile.coachingFocus,
    notes: profile.notes ?? "",
    completed: Boolean(
      profile.primaryGoal &&
        profile.goalHorizon &&
        profile.biggestMoneyStress &&
        profile.hardestCategory &&
        profile.conflictTrigger &&
        profile.coachingFocus,
    ),
    createdAt: profile.createdAt?.toISOString?.() ?? profile.createdAt,
    updatedAt: profile.updatedAt?.toISOString?.() ?? profile.updatedAt,
  };
}

function mapCoupleMmkMonthlyRate(rate) {
  if (!rate) {
    return null;
  }

  return {
    id: rate.id,
    coupleId: rate.coupleId,
    year: Number(rate.year),
    month: Number(rate.month),
    rateSource: rate.rateSource,
    rate: toNumber(rate.rate),
    createdAt: rate.createdAt?.toISOString?.() ?? rate.createdAt,
    updatedAt: rate.updatedAt?.toISOString?.() ?? rate.updatedAt,
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
      incomeCurrencyCode = "USD",
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
          incomeCurrencyCode,
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

    async getCoupleCoachProfile(coupleId) {
      const profile = await prisma.coupleCoachProfile.findUnique({
        where: {
          coupleId,
        },
      });

      return mapCoupleCoachProfile(profile);
    },

    async upsertCoupleCoachProfile({
      coupleId,
      primaryGoal,
      goalHorizon,
      biggestMoneyStress,
      hardestCategory,
      conflictTrigger,
      coachingFocus,
      notes = "",
    }) {
      const profile = await prisma.coupleCoachProfile.upsert({
        where: {
          coupleId,
        },
        update: {
          primaryGoal,
          goalHorizon,
          biggestMoneyStress,
          hardestCategory,
          conflictTrigger,
          coachingFocus,
          notes,
        },
        create: {
          coupleId,
          primaryGoal,
          goalHorizon,
          biggestMoneyStress,
          hardestCategory,
          conflictTrigger,
          coachingFocus,
          notes,
        },
      });

      return mapCoupleCoachProfile(profile);
    },

    async getCoupleMmkMonthlyRate({ coupleId, year, month }) {
      const rate = await prisma.coupleMmkMonthlyRate.findUnique({
        where: {
          coupleId_year_month: {
            coupleId,
            year,
            month,
          },
        },
      });

      return mapCoupleMmkMonthlyRate(rate);
    },

    async upsertCoupleMmkMonthlyRate({ coupleId, year, month, rateSource, rate }) {
      const record = await prisma.coupleMmkMonthlyRate.upsert({
        where: {
          coupleId_year_month: {
            coupleId,
            year,
            month,
          },
        },
        update: {
          rateSource,
          rate,
        },
        create: {
          coupleId,
          year,
          month,
          rateSource,
          rate,
        },
      });

      return mapCoupleMmkMonthlyRate(record);
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

    async createActivityNotification({ recipientId, actorId, type, title, body }) {
      const notification = await prisma.activityNotification.create({
        data: {
          recipientId,
          actorId,
          type,
          title,
          body,
        },
        include: {
          actor: true,
        },
      });

      return mapActivityNotification(notification);
    },

    async listActivityNotificationsForUser(userId, limit = 30) {
      const notifications = await prisma.activityNotification.findMany({
        where: {
          recipientId: userId,
        },
        include: {
          actor: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });

      return notifications.map(mapActivityNotification);
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
      recurringBillId = null,
      autoCreated = false,
      amount,
      currencyCode = "USD",
      convertedAmount = null,
      convertedCurrencyCode = null,
      conversionAnchorAmount = null,
      conversionAnchorCurrencyCode = null,
      exchangeRateUsed = null,
      exchangeRateSource = null,
      description,
      category,
      type,
      paymentMethod,
      date,
    }) {
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          recurringBillId,
          autoCreated,
          amount,
          currencyCode,
          convertedAmount,
          convertedCurrencyCode,
          conversionAnchorAmount,
          conversionAnchorCurrencyCode,
          exchangeRateUsed,
          exchangeRateSource,
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

    async updateUserTransaction({
      transactionId,
      userId,
      recurringBillId = null,
      autoCreated = false,
      amount,
      currencyCode = "USD",
      convertedAmount = null,
      convertedCurrencyCode = null,
      conversionAnchorAmount = null,
      conversionAnchorCurrencyCode = null,
      exchangeRateUsed = null,
      exchangeRateSource = null,
      description,
      category,
      type,
      paymentMethod,
      date,
    }) {
      const existing = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
      });

      if (!existing) {
        throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
      }

      const previousTransaction = mapTransaction({
        ...existing,
        user: {
          name: existing.user?.name,
        },
      });

      const transaction = await prisma.transaction.update({
        where: {
          id: transactionId,
        },
        data: {
          recurringBillId,
          autoCreated,
          amount,
          currencyCode,
          convertedAmount,
          convertedCurrencyCode,
          conversionAnchorAmount,
          conversionAnchorCurrencyCode,
          exchangeRateUsed,
          exchangeRateSource,
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

      return {
        transaction: mapTransaction(transaction),
        previousTransaction,
      };
    },

    async deleteUserTransaction({ transactionId, userId }) {
      const existing = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!existing) {
        throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
      }

      await prisma.transaction.delete({
        where: {
          id: transactionId,
        },
      });

      return mapTransaction(existing);
    },

    async updateUserIncomeProfile({
      userId,
      monthlySalary,
      incomeCurrencyCode,
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
          ...(incomeCurrencyCode !== undefined ? { incomeCurrencyCode } : {}),
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

    async getUserOwnedTransaction({ transactionId, userId }) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      return transaction ? mapTransaction(transaction) : null;
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

    async listRecurringBillsForCouple(coupleId) {
      const bills = await prisma.recurringBill.findMany({
        where: {
          coupleId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ dayOfMonth: "asc" }, { createdAt: "asc" }],
      });

      return bills.map(mapRecurringBill);
    },

    async getRecurringBillForCouple({ recurringBillId, coupleId }) {
      const bill = await prisma.recurringBill.findFirst({
        where: {
          id: recurringBillId,
          coupleId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      return mapRecurringBill(bill);
    },

    async createRecurringBill({
      coupleId,
      userId,
      title,
      amount,
      currencyCode = "USD",
      category,
      paymentMethod,
      dayOfMonth,
      notes = "",
      isActive = true,
      autoCreate = true,
      startDate,
      endDate = null,
    }) {
      const bill = await prisma.recurringBill.create({
        data: {
          coupleId,
          userId,
          title,
          amount,
          currencyCode,
          category,
          paymentMethod,
          dayOfMonth,
          notes,
          isActive,
          autoCreate,
          startDate,
          endDate,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      return mapRecurringBill(bill);
    },

    async updateRecurringBill({
      recurringBillId,
      coupleId,
      title,
      amount,
      currencyCode = "USD",
      category,
      paymentMethod,
      dayOfMonth,
      notes = "",
      isActive = true,
      autoCreate = true,
      startDate,
      endDate = null,
    }) {
      const existing = await prisma.recurringBill.findFirst({
        where: {
          id: recurringBillId,
          coupleId,
        },
      });

      if (!existing) {
        throw new HttpError(404, "RECURRING_BILL_NOT_FOUND", "Recurring bill not found.");
      }

      const bill = await prisma.recurringBill.update({
        where: {
          id: recurringBillId,
        },
        data: {
          title,
          amount,
          currencyCode,
          category,
          paymentMethod,
          dayOfMonth,
          notes,
          isActive,
          autoCreate,
          startDate,
          endDate,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      return mapRecurringBill(bill);
    },

    async deleteRecurringBill({ recurringBillId, coupleId }) {
      const existing = await prisma.recurringBill.findFirst({
        where: {
          id: recurringBillId,
          coupleId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!existing) {
        throw new HttpError(404, "RECURRING_BILL_NOT_FOUND", "Recurring bill not found.");
      }

      await prisma.recurringBill.delete({
        where: {
          id: recurringBillId,
        },
      });

      return mapRecurringBill(existing);
    },

    async getMaterializedRecurringBillTransaction({
      recurringBillId,
      userId,
      date,
    }) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          recurringBillId,
          userId,
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

      return transaction ? mapTransaction(transaction) : null;
    },

    async listHouseholdRulesForCouple(coupleId) {
      const rules = await prisma.householdRule.findMany({
        where: {
          coupleId,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return rules.map(mapHouseholdRule);
    },

    async createHouseholdRule({
      coupleId,
      title,
      details,
      thresholdAmount = null,
      currencyCode = null,
      isActive = true,
    }) {
      const rule = await prisma.householdRule.create({
        data: {
          coupleId,
          title,
          details,
          thresholdAmount,
          currencyCode,
          isActive,
        },
      });

      return mapHouseholdRule(rule);
    },

    async updateHouseholdRule({
      ruleId,
      coupleId,
      title,
      details,
      thresholdAmount = null,
      currencyCode = null,
      isActive = true,
    }) {
      const existing = await prisma.householdRule.findFirst({
        where: {
          id: ruleId,
          coupleId,
        },
      });

      if (!existing) {
        throw new HttpError(404, "HOUSEHOLD_RULE_NOT_FOUND", "Household rule not found.");
      }

      const rule = await prisma.householdRule.update({
        where: {
          id: ruleId,
        },
        data: {
          title,
          details,
          thresholdAmount,
          currencyCode,
          isActive,
        },
      });

      return mapHouseholdRule(rule);
    },

    async deleteHouseholdRule({ ruleId, coupleId }) {
      const existing = await prisma.householdRule.findFirst({
        where: {
          id: ruleId,
          coupleId,
        },
      });

      if (!existing) {
        throw new HttpError(404, "HOUSEHOLD_RULE_NOT_FOUND", "Household rule not found.");
      }

      const rule = await prisma.householdRule.delete({
        where: {
          id: ruleId,
        },
      });

      return mapHouseholdRule(rule);
    },

    async registerPushDevice({ userId, platform, token, enabled = true }) {
      const device = await prisma.pushDevice.upsert({
        where: {
          token,
        },
        update: {
          userId,
          platform,
          enabled,
          lastSeenAt: new Date(),
        },
        create: {
          userId,
          platform,
          token,
          enabled,
        },
      });

      return mapPushDevice(device);
    },

    async listPushDevicesForUser(userId) {
      const devices = await prisma.pushDevice.findMany({
        where: {
          userId,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      return devices.map(mapPushDevice);
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

    async addSavingsEntry({
      userId,
      savingsGoalId = null,
      amount,
      currencyCode = "USD",
      note,
      date,
    }) {
      const entry = await prisma.savingsEntry.create({
        data: {
          userId,
          savingsGoalId,
          amount,
          currencyCode,
          note,
          date: new Date(`${date}T00:00:00.000Z`),
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
          savingsGoal: {
            select: {
              title: true,
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
          savingsGoal: {
            select: {
              title: true,
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
      const goal = await prisma.savingsGoal.findFirst({
        where: {
          coupleId,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return mapSavingsGoal(goal);
    },

    async listSavingsGoalsForCouple(coupleId) {
      const goals = await prisma.savingsGoal.findMany({
        where: {
          coupleId,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return goals.map(mapSavingsGoal);
    },

    async createSavingsGoalForCouple({
      coupleId,
      title,
      targetAmount,
      currencyCode = "USD",
      targetDate,
    }) {
      const goal = await prisma.savingsGoal.create({
        data: {
          coupleId,
          title,
          targetAmount,
          currencyCode,
          targetDate,
        },
      });

      return mapSavingsGoal(goal);
    },

    async updateSavingsGoalForCouple({
      goalId,
      coupleId,
      title,
      targetAmount,
      currencyCode = "USD",
      targetDate,
    }) {
      const existing = await prisma.savingsGoal.findFirst({
        where: {
          id: goalId,
          coupleId,
        },
      });

      if (!existing) {
        throw new HttpError(404, "SAVINGS_GOAL_NOT_FOUND", "Savings goal not found.");
      }

      const goal = await prisma.savingsGoal.update({
        where: {
          id: goalId,
        },
        data: {
          title,
          targetAmount,
          currencyCode,
          targetDate,
        },
      });

      return mapSavingsGoal(goal);
    },

    async deleteSavingsGoalForCouple({ goalId, coupleId }) {
      const existing = await prisma.savingsGoal.findFirst({
        where: {
          id: goalId,
          coupleId,
        },
      });

      if (!existing) {
        throw new HttpError(404, "SAVINGS_GOAL_NOT_FOUND", "Savings goal not found.");
      }

      const goal = await prisma.savingsGoal.delete({
        where: {
          id: goalId,
        },
      });

      return mapSavingsGoal(goal);
    },
  };
}

export { createPrismaBudgetRepository };
