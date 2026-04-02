import { EventEmitter } from "node:events";
import httpMocks from "node-mocks-http";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { HttpError } from "../src/lib/http.js";
import { createFallbackInsights, createInsightsService } from "../src/services/insightsService.js";

function recentIsoDate(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function isoDateForMonthOffset(monthOffset, day = 10) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, day))
    .toISOString()
    .slice(0, 10);
}

async function inject(app, { method, url, headers = {}, body }) {
  const request = httpMocks.createRequest({
    method,
    url,
    headers,
    body,
  });
  const response = httpMocks.createResponse({
    eventEmitter: EventEmitter,
  });

  await new Promise((resolve, reject) => {
    response.on("end", resolve);
    app.handle(request, response, reject);
  });

  const raw = response._getData();

  return {
    status: response.statusCode,
    body: raw ? JSON.parse(raw) : undefined,
  };
}

async function connectUsersByInvite({
  app,
  inviterToken,
  recipientToken,
  partnerUserId,
}) {
  const inviteResponse = await inject(app, {
    method: "POST",
    url: "/api/couples",
    headers: {
      authorization: `Bearer ${inviterToken}`,
    },
    body: {
      partnerUserId,
    },
  });

  const notificationsResponse = await inject(app, {
    method: "GET",
    url: "/api/notifications",
    headers: {
      authorization: `Bearer ${recipientToken}`,
    },
  });

  const inviteId = notificationsResponse.body?.data?.incoming?.[0]?.id;

  const acceptResponse = await inject(app, {
    method: "POST",
    url: `/api/couples/invites/${inviteId}/respond`,
    headers: {
      authorization: `Bearer ${recipientToken}`,
    },
    body: {
      action: "accept",
    },
  });

  return {
    inviteResponse,
    notificationsResponse,
    acceptResponse,
  };
}

function createMmkAwareExchangeRateService(repository) {
  function getMonthParts(value) {
    const date = value ? new Date(value) : new Date();
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    };
  }

  return {
    async getKbzMmkRate() {
      return {
        from: "USD",
        to: "MMK",
        rate: 4800,
        cached: true,
        date: recentIsoDate(0),
        source: "kbz",
      };
    },
    async getRate({ from, to, coupleId = null, date = null, requireMmkMonthly = false }) {
      const normalizedFrom = String(from ?? "").trim().toUpperCase();
      const normalizedTo = String(to ?? "").trim().toUpperCase();

      if (normalizedFrom === normalizedTo) {
        return {
          from: normalizedFrom,
          to: normalizedTo,
          rate: 1,
          cached: true,
          date: recentIsoDate(0),
          source: "identity",
        };
      }

      const mmkInvolved = normalizedFrom === "MMK" || normalizedTo === "MMK";
      if (mmkInvolved && coupleId) {
        const { year, month } = getMonthParts(date);
        const monthlyRate = await repository.getCoupleMmkMonthlyRate({
          coupleId,
          year,
          month,
        });

        if (monthlyRate) {
          if (normalizedFrom === "USD" && normalizedTo === "MMK") {
            return {
              from: normalizedFrom,
              to: normalizedTo,
              rate: Number(monthlyRate.rate),
              cached: true,
              date: `${year}-${String(month).padStart(2, "0")}-01`,
              source: monthlyRate.rateSource,
            };
          }

          if (normalizedFrom === "MMK" && normalizedTo === "USD") {
            return {
              from: normalizedFrom,
              to: normalizedTo,
              rate: 1 / Number(monthlyRate.rate),
              cached: true,
              date: `${year}-${String(month).padStart(2, "0")}-01`,
              source: monthlyRate.rateSource,
            };
          }
        }

        if (requireMmkMonthly) {
          const error = new Error("Monthly MMK rate is required.");
          error.code = "MMK_MONTHLY_RATE_REQUIRED";
          throw error;
        }
      }

      return {
        from: normalizedFrom,
        to: normalizedTo,
        rate: 2,
        cached: true,
        date: recentIsoDate(0),
        source: "live",
      };
    },
  };
}

function createInMemoryBudgetRepository() {
  let userId = 1;
  let coupleId = 1;
  let transactionId = 1;
  let savingsEntryId = 1;
  let passwordResetTokenId = 1;
  let coupleInviteId = 1;
  let savingsGoalId = 1;
  let activityNotificationId = 1;
  let coupleCoachProfileId = 1;
  let coupleMmkMonthlyRateId = 1;
  let recurringBillId = 1;
  let householdRuleId = 1;
  let pushDeviceId = 1;
  const users = [];
  const couples = [];
  const transactions = [];
  const savingsEntries = [];
  const passwordResetTokens = [];
  const coupleInvites = [];
  const savingsGoals = [];
  const activityNotifications = [];
  const coupleCoachProfiles = [];
  const coupleMmkMonthlyRates = [];
  const recurringBills = [];
  const householdRules = [];
  const pushDevices = [];

  function sanitizeUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      monthlySalary: user.monthlySalary,
      incomeCurrencyCode: user.incomeCurrencyCode ?? "USD",
      salaryPaymentMethod: user.salaryPaymentMethod,
      salaryCashAmount: user.salaryCashAmount ?? 0,
      salaryCardAmount: user.salaryCardAmount ?? user.monthlySalary ?? 0,
      salaryCashAllocationPct: user.salaryCashAllocationPct ?? 0,
      salaryCardAllocationPct: user.salaryCardAllocationPct ?? 100,
      incomeDayOfMonth: user.incomeDayOfMonth ?? 1,
      monthlySavingsTarget: user.monthlySavingsTarget ?? 0,
      partnerId: user.partnerId ?? null,
      createdAt: user.createdAt,
    };
  }

  function withCoupleUsers(couple) {
    if (!couple) {
      return null;
    }

    return {
      id: couple.id,
      userOne: sanitizeUser(users.find((user) => user.id === couple.userOneId)),
      userTwo: sanitizeUser(users.find((user) => user.id === couple.userTwoId)),
      createdAt: couple.createdAt,
    };
  }

  return {
    async createUser({
      name,
      email,
      passwordHash,
      monthlySalary,
      salaryPaymentMethod,
      salaryCashAmount = salaryPaymentMethod === "cash" ? monthlySalary : 0,
      salaryCardAmount = salaryPaymentMethod === "cash" ? 0 : monthlySalary,
      salaryCashAllocationPct = salaryPaymentMethod === "cash" ? 100 : 0,
      salaryCardAllocationPct = salaryPaymentMethod === "cash" ? 0 : 100,
      incomeCurrencyCode = "USD",
      incomeDayOfMonth = 1,
      monthlySavingsTarget = 0,
    }) {
      const user = {
        id: userId++,
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
        partnerId: null,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      return sanitizeUser(user);
    },

    async getUserById(id) {
      return sanitizeUser(users.find((user) => user.id === id));
    },

    async getUserAuthByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },

    async getUserByEmail(email) {
      return sanitizeUser(users.find((user) => user.email === email));
    },

    async createPasswordResetToken({ userId, tokenHash, expiresAt }) {
      for (let index = passwordResetTokens.length - 1; index >= 0; index -= 1) {
        if (passwordResetTokens[index].userId === userId) {
          passwordResetTokens.splice(index, 1);
        }
      }

      const token = {
        id: passwordResetTokenId++,
        userId,
        tokenHash,
        expiresAt: expiresAt.toISOString(),
        usedAt: null,
        createdAt: new Date().toISOString(),
        user: sanitizeUser(users.find((user) => user.id === userId)),
      };
      passwordResetTokens.push(token);
      return token;
    },

    async getPasswordResetTokenByHash(tokenHash) {
      return passwordResetTokens.find((token) => token.tokenHash === tokenHash) ?? null;
    },

    async resetPasswordWithToken({ tokenId, userId, passwordHash }) {
      const user = users.find((entry) => entry.id === userId);
      const token = passwordResetTokens.find((entry) => entry.id === tokenId);

      user.passwordHash = passwordHash;
      token.usedAt = new Date().toISOString();

      for (let index = passwordResetTokens.length - 1; index >= 0; index -= 1) {
        if (passwordResetTokens[index].userId === userId && passwordResetTokens[index].id !== tokenId) {
          passwordResetTokens.splice(index, 1);
        }
      }

      return sanitizeUser(user);
    },

    async getCoupleById(id) {
      return withCoupleUsers(couples.find((couple) => couple.id === id));
    },

    async getCoupleForUser(id) {
      return withCoupleUsers(
        couples.find((couple) => couple.userOneId === id || couple.userTwoId === id),
      );
    },

    async getCoupleCoachProfile(coupleId) {
      const profile = coupleCoachProfiles.find((entry) => entry.coupleId === coupleId) ?? null;
      return profile
        ? {
            ...profile,
            completed: true,
          }
        : null;
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
      const existing = coupleCoachProfiles.find((entry) => entry.coupleId === coupleId);

      if (existing) {
        existing.primaryGoal = primaryGoal;
        existing.goalHorizon = goalHorizon;
        existing.biggestMoneyStress = biggestMoneyStress;
        existing.hardestCategory = hardestCategory;
        existing.conflictTrigger = conflictTrigger;
        existing.coachingFocus = coachingFocus;
        existing.notes = notes;
        existing.updatedAt = new Date().toISOString();
        return {
          ...existing,
          completed: true,
        };
      }

      const profile = {
        id: coupleCoachProfileId++,
        coupleId,
        primaryGoal,
        goalHorizon,
        biggestMoneyStress,
        hardestCategory,
        conflictTrigger,
        coachingFocus,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      coupleCoachProfiles.push(profile);
      return {
        ...profile,
        completed: true,
      };
    },

    async getCoupleMmkMonthlyRate({ coupleId, year, month }) {
      return (
        coupleMmkMonthlyRates.find(
          (entry) =>
            entry.coupleId === coupleId &&
            entry.year === year &&
            entry.month === month,
        ) ?? null
      );
    },

    async upsertCoupleMmkMonthlyRate({ coupleId, year, month, rateSource, rate }) {
      const existing = coupleMmkMonthlyRates.find(
        (entry) =>
          entry.coupleId === coupleId &&
          entry.year === year &&
          entry.month === month,
      );

      if (existing) {
        existing.rateSource = rateSource;
        existing.rate = rate;
        existing.updatedAt = new Date().toISOString();
        return { ...existing };
      }

      const record = {
        id: coupleMmkMonthlyRateId++,
        coupleId,
        year,
        month,
        rateSource,
        rate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      coupleMmkMonthlyRates.push(record);
      return { ...record };
    },

    async createCouple({ userOneId, userTwoId }) {
      const userOne = users.find((user) => user.id === userOneId);
      const userTwo = users.find((user) => user.id === userTwoId);
      const couple = {
        id: coupleId++,
        userOneId,
        userTwoId,
        createdAt: new Date().toISOString(),
      };
      if (userOne && userTwo) {
        userOne.partnerId = userTwo.id;
        userTwo.partnerId = userOne.id;
      }
      couples.push(couple);
      return withCoupleUsers(couple);
    },

    async linkCoupleByPartnerEmail({ userId, partnerEmail }) {
      const currentUser = users.find((user) => user.id === userId);
      const partner = users.find((user) => user.email === partnerEmail);

      if (!partner) {
        throw new Error("Partner not found.");
      }

      const invite = {
        id: coupleInviteId++,
        senderId: currentUser.id,
        recipientId: partner.id,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        respondedAt: null,
      };
      coupleInvites.push(invite);

      return {
        ...invite,
        sender: sanitizeUser(currentUser),
        recipient: sanitizeUser(partner),
      };
    },

    async listPendingCoupleInvitesForUser(userId) {
      return {
        incoming: coupleInvites
          .filter((invite) => invite.recipientId === userId && invite.status === "pending")
          .map((invite) => ({
            ...invite,
            sender: sanitizeUser(users.find((user) => user.id === invite.senderId)),
            recipient: sanitizeUser(users.find((user) => user.id === invite.recipientId)),
          })),
        outgoing: coupleInvites
          .filter((invite) => invite.senderId === userId && invite.status === "pending")
          .map((invite) => ({
            ...invite,
            sender: sanitizeUser(users.find((user) => user.id === invite.senderId)),
            recipient: sanitizeUser(users.find((user) => user.id === invite.recipientId)),
          })),
      };
    },

    async createActivityNotification({ recipientId, actorId, type, title, body }) {
      const notification = {
        id: activityNotificationId++,
        recipientId,
        actorId,
        type,
        title,
        body,
        createdAt: new Date().toISOString(),
        readAt: null,
        actor: sanitizeUser(users.find((user) => user.id === actorId)),
      };
      activityNotifications.push(notification);
      return notification;
    },

    async listActivityNotificationsForUser(userId, limit = 30) {
      return activityNotifications
        .filter((notification) => notification.recipientId === userId)
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || right.id - left.id,
        )
        .slice(0, limit);
    },

    async respondToCoupleInvite({ inviteId, userId, action }) {
      const invite = coupleInvites.find((entry) => entry.id === inviteId);
      if (!invite || invite.recipientId !== userId) {
        throw new Error("Invite not found.");
      }

      invite.updatedAt = new Date().toISOString();
      invite.respondedAt = invite.updatedAt;

      if (action === "decline") {
        invite.status = "declined";
        return {
          invite: {
            ...invite,
            sender: sanitizeUser(users.find((user) => user.id === invite.senderId)),
            recipient: sanitizeUser(users.find((user) => user.id === invite.recipientId)),
          },
          couple: null,
        };
      }

      invite.status = "accepted";
      const couple = await this.createCouple({
        userOneId: invite.senderId,
        userTwoId: invite.recipientId,
      });

      for (const entry of coupleInvites) {
        if (
          entry.id !== inviteId &&
          entry.status === "pending" &&
          (
            [invite.senderId, invite.recipientId].includes(entry.senderId) ||
            [invite.senderId, invite.recipientId].includes(entry.recipientId)
          )
        ) {
          entry.status = "cancelled";
          entry.respondedAt = invite.updatedAt;
          entry.updatedAt = invite.updatedAt;
        }
      }

      return {
        invite: {
          ...invite,
          sender: sanitizeUser(users.find((user) => user.id === invite.senderId)),
          recipient: sanitizeUser(users.find((user) => user.id === invite.recipientId)),
        },
        couple,
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
      category,
      type,
      paymentMethod,
      date,
    }) {
      const owner = users.find((user) => user.id === userId);
      const transaction = {
        id: transactionId++,
        userId,
        recurringBillId,
        autoCreated,
        userName: owner?.name,
        amount,
        currencyCode,
        convertedAmount,
        convertedCurrencyCode,
        conversionAnchorAmount,
        conversionAnchorCurrencyCode,
        exchangeRateUsed,
        exchangeRateSource,
        description: arguments[0].description,
        category,
        type,
        paymentMethod,
        date,
        createdAt: new Date().toISOString(),
      };
      transactions.push(transaction);
      return transaction;
    },

    async updateUserTransaction({
      transactionId: nextTransactionId,
      userId,
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
      const transaction = transactions.find(
        (entry) => entry.id === nextTransactionId && entry.userId === userId,
      );

      if (!transaction) {
        throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
      }

      const previousTransaction = { ...transaction };
      transaction.amount = amount;
      transaction.recurringBillId = arguments[0].recurringBillId ?? transaction.recurringBillId ?? null;
      transaction.autoCreated = arguments[0].autoCreated ?? transaction.autoCreated ?? false;
      transaction.currencyCode = currencyCode;
      transaction.convertedAmount = convertedAmount;
      transaction.convertedCurrencyCode = convertedCurrencyCode;
      transaction.conversionAnchorAmount = conversionAnchorAmount;
      transaction.conversionAnchorCurrencyCode = conversionAnchorCurrencyCode;
      transaction.exchangeRateUsed = exchangeRateUsed;
      transaction.exchangeRateSource = exchangeRateSource;
      transaction.description = description;
      transaction.category = category;
      transaction.type = type;
      transaction.paymentMethod = paymentMethod;
      transaction.date = date;

      return {
        transaction: { ...transaction },
        previousTransaction,
      };
    },

    async getUserOwnedTransaction({ transactionId: nextTransactionId, userId }) {
      const transaction = transactions.find(
        (entry) => entry.id === nextTransactionId && entry.userId === userId,
      );
      return transaction ? { ...transaction } : null;
    },

    async deleteUserTransaction({ transactionId: nextTransactionId, userId }) {
      const index = transactions.findIndex(
        (entry) => entry.id === nextTransactionId && entry.userId === userId,
      );

      if (index < 0) {
        throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
      }

      const [transaction] = transactions.splice(index, 1);
      return { ...transaction };
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
      const user = users.find((entry) => entry.id === userId);
      user.monthlySalary = monthlySalary;
      user.incomeCurrencyCode = incomeCurrencyCode ?? user.incomeCurrencyCode ?? "USD";
      user.salaryPaymentMethod = salaryPaymentMethod;
      user.salaryCashAmount = salaryCashAmount;
      user.salaryCardAmount = salaryCardAmount;
      user.salaryCashAllocationPct = salaryCashAllocationPct;
      user.salaryCardAllocationPct = salaryCardAllocationPct;
      if (incomeDayOfMonth !== undefined) {
        user.incomeDayOfMonth = incomeDayOfMonth;
      }
      if (monthlySavingsTarget !== undefined) {
        user.monthlySavingsTarget = monthlySavingsTarget;
      }
      return sanitizeUser(user);
    },

    async addSavingsEntry({
      userId,
      savingsGoalId = null,
      amount,
      currencyCode = "USD",
      note,
      date,
    }) {
      const owner = users.find((user) => user.id === userId);
      const entry = {
        id: savingsEntryId++,
        userId,
        savingsGoalId,
        savingsGoalTitle: null,
        userName: owner?.name,
        amount,
        currencyCode,
        note,
        date,
        createdAt: new Date().toISOString(),
      };
      if (entry.savingsGoalId) {
        const goal = savingsGoals.find((item) => item.id === entry.savingsGoalId);
        entry.savingsGoalTitle = goal?.title ?? null;
      }
      savingsEntries.push(entry);
      return entry;
    },

    async listSavingsEntriesForUserIds({ userIds, days = 365 }) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      return savingsEntries
        .filter((entry) => userIds.includes(entry.userId) && entry.date >= cutoff)
        .map((entry) => ({
          ...entry,
          savingsGoalTitle: entry.savingsGoalId
            ? savingsGoals.find((goal) => goal.id === entry.savingsGoalId)?.title ?? null
            : null,
        }))
        .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
    },

    async getSavingsGoalForCouple(coupleId) {
      return savingsGoals.find((goal) => goal.coupleId === coupleId) ?? null;
    },

    async listSavingsGoalsForCouple(coupleId) {
      return savingsGoals
        .filter((goal) => goal.coupleId === coupleId)
        .sort((left, right) => left.id - right.id);
    },

    async createSavingsGoalForCouple({
      coupleId,
      title,
      targetAmount,
      currencyCode = "USD",
      targetDate,
    }) {
      const goal = {
        id: savingsGoalId++,
        coupleId,
        title,
        targetAmount,
        currencyCode,
        targetDate: targetDate ? targetDate.toISOString().slice(0, 10) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savingsGoals.push(goal);
      return goal;
    },

    async updateSavingsGoalForCouple({
      goalId,
      coupleId,
      title,
      targetAmount,
      currencyCode = "USD",
      targetDate,
    }) {
      const existing = savingsGoals.find(
        (goal) => goal.id === goalId && goal.coupleId === coupleId,
      );
      if (!existing) {
        throw new HttpError(404, "SAVINGS_GOAL_NOT_FOUND", "Savings goal not found.");
      }

      existing.title = title;
      existing.targetAmount = targetAmount;
      existing.currencyCode = currencyCode;
      existing.targetDate = targetDate ? targetDate.toISOString().slice(0, 10) : null;
      existing.updatedAt = new Date().toISOString();
      return existing;
    },

    async deleteSavingsGoalForCouple({ goalId, coupleId }) {
      const index = savingsGoals.findIndex(
        (goal) => goal.id === goalId && goal.coupleId === coupleId,
      );
      if (index < 0) {
        throw new HttpError(404, "SAVINGS_GOAL_NOT_FOUND", "Savings goal not found.");
      }

      const [goal] = savingsGoals.splice(index, 1);
      for (const entry of savingsEntries) {
        if (entry.savingsGoalId === goalId) {
          entry.savingsGoalId = null;
          entry.savingsGoalTitle = null;
        }
      }
      return goal;
    },

    async listCoupleTransactions({ coupleId, days = 30, fromDate, toDate }) {
      const couple = couples.find((entry) => entry.id === coupleId);
      if (!couple) {
        return [];
      }

      const cutoff = fromDate
        ? fromDate
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

      return transactions
        .filter((transaction) => {
          const belongsToCouple =
            transaction.userId === couple.userOneId || transaction.userId === couple.userTwoId;
          const withinUpperBound = toDate ? transaction.date <= toDate : true;
          return belongsToCouple && transaction.date >= cutoff && withinUpperBound;
        })
        .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
    },

    async listRecurringBillsForCouple(coupleId) {
      return recurringBills
        .filter((bill) => bill.coupleId === coupleId)
        .sort((left, right) => left.dayOfMonth - right.dayOfMonth || left.id - right.id);
    },

    async getMaterializedRecurringBillTransaction({ recurringBillId: nextRecurringBillId, userId, date }) {
      const transaction = transactions.find(
        (entry) =>
          entry.recurringBillId === nextRecurringBillId &&
          entry.userId === userId &&
          entry.date === date,
      );
      return transaction ? { ...transaction } : null;
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
      const bill = {
        id: recurringBillId++,
        coupleId,
        userId,
        userName: users.find((user) => user.id === userId)?.name ?? null,
        title,
        amount,
        currencyCode,
        category,
        paymentMethod,
        dayOfMonth,
        notes,
        isActive,
        autoCreate,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      recurringBills.push(bill);
      return bill;
    },

    async updateRecurringBill({ recurringBillId: nextRecurringBillId, coupleId, ...data }) {
      const bill = recurringBills.find(
        (entry) => entry.id === nextRecurringBillId && entry.coupleId === coupleId,
      );
      if (!bill) {
        throw new HttpError(404, "RECURRING_BILL_NOT_FOUND", "Recurring bill not found.");
      }
      Object.assign(bill, {
        ...data,
        startDate: data.startDate.toISOString().slice(0, 10),
        endDate: data.endDate ? data.endDate.toISOString().slice(0, 10) : null,
        updatedAt: new Date().toISOString(),
      });
      return { ...bill };
    },

    async deleteRecurringBill({ recurringBillId: nextRecurringBillId, coupleId }) {
      const index = recurringBills.findIndex(
        (entry) => entry.id === nextRecurringBillId && entry.coupleId === coupleId,
      );
      if (index < 0) {
        throw new HttpError(404, "RECURRING_BILL_NOT_FOUND", "Recurring bill not found.");
      }
      const [bill] = recurringBills.splice(index, 1);
      return bill;
    },

    async listHouseholdRulesForCouple(coupleId) {
      return householdRules.filter((rule) => rule.coupleId === coupleId);
    },

    async createHouseholdRule({
      coupleId,
      title,
      details,
      thresholdAmount = null,
      currencyCode = null,
      isActive = true,
    }) {
      const rule = {
        id: householdRuleId++,
        coupleId,
        title,
        details,
        thresholdAmount,
        currencyCode,
        isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      householdRules.push(rule);
      return rule;
    },

    async updateHouseholdRule({ ruleId, coupleId, ...data }) {
      const rule = householdRules.find(
        (entry) => entry.id === ruleId && entry.coupleId === coupleId,
      );
      if (!rule) {
        throw new HttpError(404, "HOUSEHOLD_RULE_NOT_FOUND", "Household rule not found.");
      }
      Object.assign(rule, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      return { ...rule };
    },

    async deleteHouseholdRule({ ruleId, coupleId }) {
      const index = householdRules.findIndex(
        (entry) => entry.id === ruleId && entry.coupleId === coupleId,
      );
      if (index < 0) {
        throw new HttpError(404, "HOUSEHOLD_RULE_NOT_FOUND", "Household rule not found.");
      }
      const [rule] = householdRules.splice(index, 1);
      return rule;
    },

    async registerPushDevice({ userId, platform, token, enabled = true }) {
      const existing = pushDevices.find((entry) => entry.token === token);
      if (existing) {
        existing.userId = userId;
        existing.platform = platform;
        existing.enabled = enabled;
        existing.lastSeenAt = new Date().toISOString();
        existing.updatedAt = new Date().toISOString();
        return { ...existing };
      }

      const device = {
        id: pushDeviceId++,
        userId,
        platform,
        token,
        enabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      pushDevices.push(device);
      return device;
    },

    async listPushDevicesForUser(userId) {
      return pushDevices.filter((entry) => entry.userId === userId);
    },

    async listTransactionsForUserIds({ userIds, days = 30, fromDate, toDate }) {
      const cutoff = fromDate
        ? fromDate
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

      return transactions
        .filter((transaction) => {
          const withinUpperBound = toDate ? transaction.date <= toDate : true;
          return (
            userIds.includes(transaction.userId) &&
            transaction.date >= cutoff &&
            withinUpperBound
          );
        })
        .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
    },
  };
}

describe("Couples Budgeting API", () => {
  let app;
  let repository;
  let sentResetEmails;

  beforeEach(() => {
    repository = createInMemoryBudgetRepository();
    sentResetEmails = [];
    const exchangeRateService = {
      async getRate({ from, to }) {
        return {
          from,
          to,
          rate: from === to ? 1 : 2,
          cached: true,
          date: recentIsoDate(0),
        };
      },
    };
    const insightsService = createInsightsService({
      budgetRepository: repository,
      exchangeRateService,
      openaiClient: null,
    });

    app = createApp({
      budgetRepository: repository,
      insightsService,
      exchangeRateService,
      jwtSecret: "test-secret",
      emailService: {
        async sendPasswordResetEmail(payload) {
          sentResetEmails.push(payload);
          return {
            delivered: true,
            preview: false,
          };
        },
      },
      resetPasswordUrlBase: "http://localhost:5173",
      jsonParser: (_request, _response, next) => next(),
    });
  });

  it("registers, logs in, and returns the authenticated profile", async () => {
    const registerResponse = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user.email).toBe("alex@example.com");
    expect(registerResponse.body.data.user.salaryCashAmount).toBe(0);
    expect(registerResponse.body.data.user.salaryCardAmount).toBe(4200);
    expect(registerResponse.body.data.user.salaryCashAllocationPct).toBe(0);
    expect(registerResponse.body.data.user.salaryCardAllocationPct).toBe(100);
    expect(registerResponse.body.data.accessToken).toBeTruthy();

    const loginResponse = await inject(app, {
      method: "POST",
      url: "/api/auth/login",
      body: {
        email: "alex@example.com",
        password: "supersecret",
      },
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.name).toBe("Alex");

    const meResponse = await inject(app, {
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${loginResponse.body.data.accessToken}`,
      },
    });

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.email).toBe("alex@example.com");
    expect(meResponse.body.data.couple).toBeNull();
  });

  it("returns EMAIL_TAKEN when createUser hits the email unique constraint", async () => {
    const repository = createInMemoryBudgetRepository();
    const duplicateApp = createApp({
      budgetRepository: {
        ...repository,
        async getUserAuthByEmail() {
          return null;
        },
        async createUser() {
          const error = new Error("Unique constraint failed on the fields: (`email`)");
          error.code = "P2002";
          error.meta = {
            target: ["email"],
          };
          throw error;
        },
      },
      insightsService: createInsightsService({
        budgetRepository: repository,
        exchangeRateService: {
          async getRate() {
            return { rate: 1 };
          },
        },
      }),
      jwtSecret: "test-secret",
    });

    const response = await inject(duplicateApp, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_TAKEN");
    expect(response.body.error.message).toBe("An account with this email already exists.");
  });

  it("returns a cached exchange rate from the backend service", async () => {
    let exchangeLookupCount = 0;
    const exchangeApp = createApp({
      budgetRepository: repository,
      insightsService: createInsightsService({
        budgetRepository: repository,
      }),
      exchangeRateService: {
        async getRate({ from, to }) {
          exchangeLookupCount += 1;
          return {
            from,
            to,
            rate: 0.92,
            date: "2026-03-25",
            cached: exchangeLookupCount > 1,
          };
        },
      },
      jwtSecret: "test-secret",
      jsonParser: (_request, _response, next) => next(),
    });

    const response = await inject(exchangeApp, {
      method: "GET",
      url: "/api/exchange-rate?from=USD&to=EUR",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.from).toBe("USD");
    expect(response.body.data.to).toBe("EUR");
    expect(response.body.data.rate).toBe(0.92);
    expect(response.body.data.date).toBe("2026-03-25");
  });

  it("stores and reuses the monthly MMK rate for new MMK transactions", async () => {
    const mmkRepository = createInMemoryBudgetRepository();
    const mmkExchangeRateService = createMmkAwareExchangeRateService(mmkRepository);
    const mmkApp = createApp({
      budgetRepository: mmkRepository,
      insightsService: createInsightsService({
        budgetRepository: mmkRepository,
        exchangeRateService: mmkExchangeRateService,
      }),
      exchangeRateService: mmkExchangeRateService,
      jwtSecret: "test-secret",
      jsonParser: (_request, _response, next) => next(),
    });

    const registerAlex = await inject(mmkApp, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        incomeCurrencyCode: "USD",
        salaryPaymentMethod: "card",
      },
    });
    const registerSam = await inject(mmkApp, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 3900,
        incomeCurrencyCode: "USD",
        salaryPaymentMethod: "card",
      },
    });

    const alexToken = registerAlex.body.data.accessToken;
    const samToken = registerSam.body.data.accessToken;
    await connectUsersByInvite({
      app: mmkApp,
      inviterToken: alexToken,
      recipientToken: samToken,
      partnerUserId: registerSam.body.data.user.id,
    });

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const setRateResponse = await inject(mmkApp, {
      method: "PUT",
      url: "/api/mmk-rate",
      headers: {
        authorization: `Bearer ${alexToken}`,
      },
      body: {
        year,
        month,
        rateSource: "custom",
        rate: 4500,
      },
    });

    expect(setRateResponse.status).toBe(200);
    expect(setRateResponse.body.data.rate.rate).toBe(4500);

    const createTransactionResponse = await inject(mmkApp, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alexToken}`,
      },
      body: {
        amount: 450000,
        currencyCode: "MMK",
        displayCurrencyCode: "USD",
        description: "Rent",
        category: "Housing",
        type: "recurring",
        paymentMethod: "card",
        date: recentIsoDate(0),
      },
    });

    expect(createTransactionResponse.status).toBe(201);
    expect(createTransactionResponse.body.data.transaction.exchangeRateUsed).toBe(4500);
    expect(createTransactionResponse.body.data.transaction.exchangeRateSource).toBe("custom");
    expect(createTransactionResponse.body.data.transaction.conversionAnchorCurrencyCode).toBe(
      "USD",
    );
    expect(createTransactionResponse.body.data.transaction.conversionAnchorAmount).toBe(100);

    await inject(mmkApp, {
      method: "PUT",
      url: "/api/mmk-rate",
      headers: {
        authorization: `Bearer ${alexToken}`,
      },
      body: {
        year,
        month,
        rateSource: "kbz",
        rate: 5000,
      },
    });

    const transactionsResponse = await inject(mmkApp, {
      method: "GET",
      url: "/api/transactions?displayCurrency=USD",
      headers: {
        authorization: `Bearer ${alexToken}`,
      },
    });

    expect(transactionsResponse.status).toBe(200);
    expect(transactionsResponse.body.data.transactions[0].displayAmount).toBe(100);
    expect(transactionsResponse.body.data.transactions[0].exchangeRateUsed).toBe(4500);
    expect(transactionsResponse.body.data.transactions[0].exchangeRateSource).toBe("custom");
  });

  it("fetches and saves the KBZ monthly MMK rate automatically", async () => {
    const mmkRepository = createInMemoryBudgetRepository();
    const mmkExchangeRateService = createMmkAwareExchangeRateService(mmkRepository);
    const mmkApp = createApp({
      budgetRepository: mmkRepository,
      insightsService: createInsightsService({
        budgetRepository: mmkRepository,
        exchangeRateService: mmkExchangeRateService,
      }),
      exchangeRateService: mmkExchangeRateService,
      jwtSecret: "test-secret",
      jsonParser: (_request, _response, next) => next(),
    });

    const registerAlex = await inject(mmkApp, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex2@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        incomeCurrencyCode: "USD",
        salaryPaymentMethod: "card",
      },
    });
    const registerSam = await inject(mmkApp, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam2@example.com",
        password: "supersecret",
        monthlySalary: 3900,
        incomeCurrencyCode: "USD",
        salaryPaymentMethod: "card",
      },
    });

    await connectUsersByInvite({
      app: mmkApp,
      inviterToken: registerAlex.body.data.accessToken,
      recipientToken: registerSam.body.data.accessToken,
      partnerUserId: registerSam.body.data.user.id,
    });

    const now = new Date();
    const response = await inject(mmkApp, {
      method: "PUT",
      url: "/api/mmk-rate",
      headers: {
        authorization: `Bearer ${registerAlex.body.data.accessToken}`,
      },
      body: {
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        rateSource: "kbz",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.rate.rateSource).toBe("kbz");
    expect(response.body.data.rate.rate).toBe(4800);
  });

  it("builds personalized fallback coach insights from real couple spending data", () => {
    const insights = createFallbackInsights({
      displayCurrencyCode: "USD",
      period: { days: 30 },
      fairSplit: [
        { userId: 1, name: "Alex", sharePct: 60 },
        { userId: 2, name: "Sam", sharePct: 40 },
      ],
      summary: {
        totalSpent: 900,
        cashSharePct: 22,
        cardSharePct: 78,
        oneTimeSpent: 420,
        recurringSpent: 300,
      },
      topCategories: [
        { category: "Dining", amount: 260, sharePct: 28.9 },
        { category: "Shopping", amount: 200, sharePct: 22.2 },
      ],
      users: [
        {
          id: 1,
          name: "Alex",
          spending: {
            totalSpent: 620,
            cashSpent: 70,
            cardSpent: 550,
            categories: [{ category: "Dining", amount: 220, sharePct: 24.4 }],
          },
        },
        {
          id: 2,
          name: "Sam",
          spending: {
            totalSpent: 280,
            cashSpent: 130,
            cardSpent: 150,
            categories: [{ category: "Shopping", amount: 120, sharePct: 13.3 }],
          },
        },
      ],
      transactions: [
        {
          id: 1,
          type: "one-time",
          description: "Weekend shopping spree",
          category: "Shopping",
          amount: 240,
          displayAmount: 240,
        },
        {
          id: 2,
          type: "one-time",
          description: "Dinner out",
          category: "Dining",
          amount: 120,
          displayAmount: 120,
        },
        {
          id: 3,
          type: "recurring",
          description: "Netflix",
          category: "Streaming",
          amount: 40,
          displayAmount: 40,
        },
      ],
    });

    expect(insights.overview).toContain("Dining");
    expect(insights.tips).toHaveLength(3);
    expect(insights.tips.some((tip) => tip.title.includes("Alex"))).toBe(true);
    expect(
      insights.tips.some((tip) =>
        ["dining", "shopping"].some((term) => tip.action.toLowerCase().includes(term)),
      ),
    ).toBe(true);
    expect(
      insights.tips.some((tip) => tip.reason.toLowerCase().includes("stress")),
    ).toBe(true);
  });

  it("prioritizes the couple questionnaire in fallback coach insights", () => {
    const insights = createFallbackInsights(
      {
        displayCurrencyCode: "USD",
        period: { days: 30 },
        fairSplit: [
          { userId: 1, name: "Alex", sharePct: 60 },
          { userId: 2, name: "Sam", sharePct: 40 },
        ],
        summary: {
          totalSpent: 500,
          cashSharePct: 30,
          cardSharePct: 70,
          oneTimeSpent: 180,
          recurringSpent: 220,
        },
        topCategories: [{ category: "Dining", amount: 160, sharePct: 32 }],
        users: [],
        transactions: [
          {
            id: 1,
            type: "one-time",
            description: "Dinner out",
            category: "Dining",
            amount: 80,
            displayAmount: 80,
          },
        ],
      },
      {
        completed: true,
        primaryGoal: "Build an emergency fund",
        goalHorizon: "In the next 6 months",
        biggestMoneyStress: "Unexpected expenses",
        hardestCategory: "Dining",
        conflictTrigger: "Surprise purchases",
        coachingFocus: "Help us save consistently",
      },
    );

    expect(insights.tips[0].title).toContain("Coach priority");
    expect(insights.tips[0].action).toContain("emergency fund");
    expect(insights.tips[0].reason.toLowerCase()).toContain("unexpected expenses");
  });

  it("converts mixed-currency income and expenses into the requested display currency", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 1000,
        incomeCurrencyCode: "USD",
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 1000,
        incomeCurrencyCode: "EUR",
        salaryPaymentMethod: "card",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const transactionResponse = await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 100,
        currencyCode: "EUR",
        description: "Trip snacks",
        category: "Dining",
        type: "one-time",
        paymentMethod: "card",
        date: recentIsoDate(1),
      },
    });

    expect(transactionResponse.status).toBe(201);

    const summaryResponse = await inject(app, {
      method: "GET",
      url: "/api/summary?displayCurrency=USD",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.displayCurrencyCode).toBe("USD");
    expect(summaryResponse.body.data.householdIncome).toBe(3000);
    expect(summaryResponse.body.data.totalExpenses).toBe(200);

    const transactionsResponse = await inject(app, {
      method: "GET",
      url: "/api/transactions?displayCurrency=USD",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(transactionsResponse.status).toBe(200);
    expect(transactionsResponse.body.data.transactions[0].amount).toBe(100);
    expect(transactionsResponse.body.data.transactions[0].currencyCode).toBe("EUR");
    expect(transactionsResponse.body.data.transactions[0].displayAmount).toBe(200);
  });

  it("stores a couple coach profile and exposes it in auth responses", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "card",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const saveProfileResponse = await inject(app, {
      method: "PUT",
      url: "/api/coach-profile",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        primaryGoal: "Build an emergency fund",
        goalHorizon: "In the next 6 months",
        biggestMoneyStress: "Unexpected expenses",
        hardestCategory: "Dining",
        conflictTrigger: "Surprise purchases",
        coachingFocus: "Help us save consistently",
        notes: "We spend more when work is stressful.",
      },
    });

    expect(saveProfileResponse.status).toBe(200);
    expect(saveProfileResponse.body.data.profile.completed).toBe(true);

    const meResponse = await inject(app, {
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${sam.body.data.accessToken}`,
      },
    });

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.coachProfile.primaryGoal).toBe("Build an emergency fund");
    expect(meResponse.body.data.coachProfile.completed).toBe(true);

    const coachProfileResponse = await inject(app, {
      method: "GET",
      url: "/api/coach-profile",
      headers: {
        authorization: `Bearer ${sam.body.data.accessToken}`,
      },
    });

    expect(coachProfileResponse.status).toBe(200);
    expect(coachProfileResponse.body.data.profile.hardestCategory).toBe("Dining");
  });

  it("creates a couple, adds an expense, and returns a dashboard", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    const token = alex.body.data.accessToken;
    const partnerUserId = sam.body.data.user.id;

    const connection = await connectUsersByInvite({
      app,
      inviterToken: token,
      recipientToken: sam.body.data.accessToken,
      partnerUserId,
    });

    expect(connection.inviteResponse.status).toBe(201);
    expect(connection.acceptResponse.status).toBe(200);
    expect(connection.acceptResponse.body.data.couple.userTwo.email).toBe("sam@example.com");

    const transactionResponse = await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        amount: 1200,
        description: "March rent",
        category: "Housing",
        type: "recurring",
        paymentMethod: "card",
        date: recentIsoDate(1),
      },
    });

    expect(transactionResponse.status).toBe(201);
    expect(transactionResponse.body.data.transaction.userId).toBe(
      alex.body.data.user.id,
    );
    expect(transactionResponse.body.data.transaction.description).toBe("March rent");

    const dashboardResponse = await inject(app, {
      method: "GET",
      url: "/api/dashboard",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data.dashboard.summary.totalSpent).toBe(1200);
    expect(dashboardResponse.body.data.partner.email).toBe("sam@example.com");
  });

  it("updates and deletes a logged expense for the owning user", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const createResponse = await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 48.75,
        description: "Lunch",
        category: "Dining",
        type: "one-time",
        paymentMethod: "card",
        date: recentIsoDate(),
      },
    });

    const transactionId = createResponse.body.data.transaction.id;

    const updateResponse = await inject(app, {
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 62.5,
        description: "Groceries top-up",
        category: "Groceries",
        type: "one-time",
        paymentMethod: "cash",
        date: recentIsoDate(),
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.transaction.amount).toBe(62.5);
    expect(updateResponse.body.data.transaction.category).toBe("Groceries");
    expect(updateResponse.body.data.transaction.paymentMethod).toBe("cash");

    const deleteResponse = await inject(app, {
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.transaction.id).toBe(transactionId);

    const transactionsResponse = await inject(app, {
      method: "GET",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(transactionsResponse.status).toBe(200);
    expect(transactionsResponse.body.data.transactions).toHaveLength(0);
  });

  it("adds partner activity notifications for expense changes", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const jamie = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Jamie",
        email: "jamie@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: jamie.body.data.accessToken,
      partnerUserId: jamie.body.data.user.id,
    });

    const createResponse = await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 45,
        description: "Weekly groceries",
        category: "Groceries",
        type: "one-time",
        paymentMethod: "card",
        date: recentIsoDate(),
      },
    });

    const transactionId = createResponse.body.data.transaction.id;

    const updateResponse = await inject(app, {
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 55,
        description: "Weekly groceries",
        category: "Groceries",
        type: "one-time",
        paymentMethod: "card",
        date: recentIsoDate(),
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.previousTransaction.amount).toBe(45);

    const deleteResponse = await inject(app, {
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(deleteResponse.status).toBe(200);

    const notificationsResponse = await inject(app, {
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${jamie.body.data.accessToken}`,
      },
    });

    expect(notificationsResponse.status).toBe(200);
    expect(notificationsResponse.body.data.activity).toHaveLength(3);
    expect(notificationsResponse.body.data.activity[0].type).toBe("expense_deleted");
    expect(notificationsResponse.body.data.activity[1].type).toBe("expense_edited");
    expect(notificationsResponse.body.data.activity[2].type).toBe("expense_added");
    expect(notificationsResponse.body.data.activity[2].body).toContain("Alex added");
    expect(notificationsResponse.body.data.activity[1].body).toContain("$45.00");
    expect(notificationsResponse.body.data.activity[1].body).toContain("$55.00");
    expect(notificationsResponse.body.data.activity[0].body).toContain("deleted");
  });

  it("accepts partnerUserId when it arrives as a numeric string and sends an invite", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    const inviteResponse = await inject(app, {
      method: "POST",
      url: "/api/couples",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        partnerUserId: String(sam.body.data.user.id),
      },
    });

    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body.data.invite.recipient.id).toBe(sam.body.data.user.id);
  });

  it("creates an invite by partner email and links only after acceptance", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    const response = await inject(app, {
      method: "POST",
      url: "/api/couples/link",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        partnerEmail: "sam@example.com",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.invite.sender.email).toBe("alex@example.com");
    expect(response.body.data.invite.recipient.email).toBe("sam@example.com");

    const notificationsResponse = await inject(app, {
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${sam.body.data.accessToken}`,
      },
    });

    expect(notificationsResponse.status).toBe(200);
    expect(notificationsResponse.body.data.incoming).toHaveLength(1);

    const acceptResponse = await inject(app, {
      method: "POST",
      url: `/api/couples/invites/${notificationsResponse.body.data.incoming[0].id}/respond`,
      headers: {
        authorization: `Bearer ${sam.body.data.accessToken}`,
      },
      body: {
        action: "accept",
      },
    });

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data.couple.userOne.email).toBe("alex@example.com");
    expect(acceptResponse.body.data.couple.userTwo.email).toBe("sam@example.com");
  });

  it("returns a current-month summary with total expenses and remaining budget", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 250,
        description: "Groceries run",
        category: "Groceries",
        type: "one-time",
        paymentMethod: "card",
        date: recentIsoDate(0),
      },
    });

    const summaryResponse = await inject(app, {
      method: "GET",
      url: "/api/summary",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.householdIncome).toBe(7000);
    expect(summaryResponse.body.data.totalExpenses).toBe(250);
    expect(summaryResponse.body.data.remainingBudget).toBe(6750);
    expect(summaryResponse.body.data.cashIncome).toBe(2800);
    expect(summaryResponse.body.data.cardIncome).toBe(4200);
    expect(summaryResponse.body.data.cashRemaining).toBe(2800);
    expect(summaryResponse.body.data.cardRemaining).toBe(3950);
    expect(summaryResponse.body.data.daysRemainingInMonth).toBeGreaterThan(0);
    expect(summaryResponse.body.data.comfortableDailySpend).toBeGreaterThan(0);
  });

  it("updates the authenticated user's income mix and returns split-aware summary totals", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        salaryCashAmount: 1260,
        salaryCardAmount: 2940,
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        salaryCashAmount: 1400,
        salaryCardAmount: 1400,
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const updateResponse = await inject(app, {
      method: "PATCH",
      url: "/api/profile/income",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        salaryCashAmount: 2000,
        salaryCardAmount: 3000,
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.user.monthlySalary).toBe(5000);
    expect(updateResponse.body.data.user.salaryCashAmount).toBe(2000);
    expect(updateResponse.body.data.user.salaryCardAmount).toBe(3000);
    expect(updateResponse.body.data.user.salaryCashAllocationPct).toBe(40);
    expect(updateResponse.body.data.user.salaryCardAllocationPct).toBe(60);

    const summaryResponse = await inject(app, {
      method: "GET",
      url: "/api/summary",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.householdIncome).toBe(7800);
    expect(summaryResponse.body.data.cashIncome).toBe(3400);
    expect(summaryResponse.body.data.cardIncome).toBe(4400);
  });

  it("returns a friendly message when there are zero transactions", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const insightsResponse = await inject(app, {
      method: "GET",
      url: "/api/insights",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(insightsResponse.status).toBe(200);
    expect(insightsResponse.body.data.tips).toHaveLength(1);
    expect(insightsResponse.body.data.tips[0].action).toContain(
      "Add your first expense to see AI coaching!",
    );
  });

  it("returns a safe tips payload when OpenAI is unavailable", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    const token = alex.body.data.accessToken;

    await connectUsersByInvite({
      app,
      inviterToken: token,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        amount: 200,
        description: "Coffee run",
        category: "Dining",
        type: "one-time",
        paymentMethod: "cash",
        date: recentIsoDate(0),
      },
    });

    const insightsResponse = await inject(app, {
      method: "GET",
      url: "/api/insights",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(insightsResponse.status).toBe(200);
    expect(insightsResponse.body.data.insights.provider).toBe("heuristic-fallback");
    expect(insightsResponse.body.data.insights.tips).toHaveLength(3);
    expect(insightsResponse.body.data.tips).toHaveLength(3);
    expect(insightsResponse.body.data.insights.overview).toContain("Dining");
    expect(insightsResponse.body.data.snapshot.fairSplit[0].sharePct).toBe(60);
    expect(insightsResponse.body.data.snapshot.fairSplit[1].sharePct).toBe(40);
  });

  it("keeps recurring housing costs out of the three headline tips", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 1600,
        description: "Monthly rent",
        category: "Housing",
        type: "recurring",
        paymentMethod: "card",
        date: recentIsoDate(0),
      },
    });

    const insightsResponse = await inject(app, {
      method: "GET",
      url: "/api/insights",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(insightsResponse.status).toBe(200);
    expect(
      insightsResponse.body.data.insights.tips.some((tip) =>
        /housing|rent/i.test(`${tip.title} ${tip.action}`),
      ),
    ).toBe(false);
    expect(insightsResponse.body.data.insights.tips).toHaveLength(3);
  });

  it("accepts transaction amount when it arrives as a numeric string", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const transactionResponse = await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: "48.75",
        description: "Lunch",
        category: "Dining",
        type: "one-time",
        paymentMethod: "card",
        date: recentIsoDate(0),
      },
    });

    expect(transactionResponse.status).toBe(201);
    expect(transactionResponse.body.data.transaction.amount).toBe(48.75);
  });

  it("sends a password reset link and accepts the new password", async () => {
    await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const forgotResponse = await inject(app, {
      method: "POST",
      url: "/api/auth/forgot-password",
      body: {
        email: "alex@example.com",
      },
    });

    expect(forgotResponse.status).toBe(200);
    expect(sentResetEmails).toHaveLength(1);
    const resetUrl = new URL(sentResetEmails[0].resetUrl);
    const token = new URLSearchParams(resetUrl.hash.replace(/^#\/reset-password\?/, "")).get("token");

    expect(token).toBeTruthy();

    const resetResponse = await inject(app, {
      method: "POST",
      url: "/api/auth/reset-password",
      body: {
        token,
        password: "newsecret123",
      },
    });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data.accessToken).toBeTruthy();

    const loginResponse = await inject(app, {
      method: "POST",
      url: "/api/auth/login",
      body: {
        email: "alex@example.com",
        password: "newsecret123",
      },
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.email).toBe("alex@example.com");
  });

  it("uses the configured income window and returns upcoming income/payment events", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
        incomeDayOfMonth: 15,
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
        incomeDayOfMonth: 20,
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 89,
        description: "Netflix",
        category: "Streaming",
        type: "recurring",
        paymentMethod: "card",
        date: recentIsoDate(5),
      },
    });

    const summaryResponse = await inject(app, {
      method: "GET",
      url: "/api/summary",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.period.incomeAnchorDay).toBe(15);
    expect(summaryResponse.body.data.upcomingEvents.length).toBeGreaterThan(0);
    expect(
      summaryResponse.body.data.upcomingEvents.some((event) => event.kind === "income"),
    ).toBe(true);
  });

  it("logs savings entries and returns window savings progress", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
        monthlySavingsTarget: 300,
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
        monthlySavingsTarget: 200,
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const goalResponse = await inject(app, {
      method: "POST",
      url: "/api/savings/goal",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        title: "Emergency fund",
        targetAmount: 5000,
        targetDate: "2026-12-31",
      },
    });

    expect(goalResponse.status).toBe(200);
    expect(goalResponse.body.data.goal.title).toBe("Emergency fund");
    expect(goalResponse.body.data.goal.targetAmount).toBe(5000);

    const saveResponse = await inject(app, {
      method: "POST",
      url: "/api/savings",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 125,
        note: "Emergency fund transfer",
        date: recentIsoDate(0),
      },
    });

    expect(saveResponse.status).toBe(201);
    expect(saveResponse.body.data.entry.amount).toBe(125);

    const summaryResponse = await inject(app, {
      method: "GET",
      url: "/api/savings",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.householdSavingsTarget).toBe(500);
    expect(summaryResponse.body.data.totalSavedThisWindow).toBe(125);
    expect(summaryResponse.body.data.allTimeSaved).toBe(125);
    expect(summaryResponse.body.data.longTermGoal.title).toBe("Emergency fund");
    expect(summaryResponse.body.data.longTermGoal.targetAmount).toBe(5000);
    expect(summaryResponse.body.data.longTermGoal.totalSaved).toBe(125);
    expect(summaryResponse.body.data.longTermGoal.remainingAmount).toBe(4875);
    expect(summaryResponse.body.data.entries[0].note).toBe("Emergency fund transfer");
  });

  it("supports multiple savings goals with per-goal progress and edits", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
        monthlySavingsTarget: 300,
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
        monthlySavingsTarget: 200,
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const emergencyGoalResponse = await inject(app, {
      method: "POST",
      url: "/api/savings/goal",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        title: "Emergency fund",
        targetAmount: 5000,
        targetDate: "2026-12-31",
      },
    });

    const travelGoalResponse = await inject(app, {
      method: "POST",
      url: "/api/savings/goal",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        title: "Travel",
        targetAmount: 2000,
        targetDate: "2026-08-15",
      },
    });

    const emergencyGoalId = emergencyGoalResponse.body.data.goal.id;
    const travelGoalId = travelGoalResponse.body.data.goal.id;

    const saveResponse = await inject(app, {
      method: "POST",
      url: "/api/savings",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 300,
        savingsGoalId: travelGoalId,
        note: "Trip fund transfer",
        date: recentIsoDate(0),
      },
    });

    expect(saveResponse.status).toBe(201);

    const updateGoalResponse = await inject(app, {
      method: "PATCH",
      url: `/api/savings/goal/${travelGoalId}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        title: "Italy trip",
        targetAmount: 2500,
        targetDate: "2026-09-01",
      },
    });

    expect(updateGoalResponse.status).toBe(200);
    expect(updateGoalResponse.body.data.goal.title).toBe("Italy trip");

    const summaryResponse = await inject(app, {
      method: "GET",
      url: "/api/savings",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.goals).toHaveLength(2);
    const emergencyGoal = summaryResponse.body.data.goals.find((goal) => goal.id === emergencyGoalId);
    const italyGoal = summaryResponse.body.data.goals.find((goal) => goal.id === travelGoalId);
    expect(emergencyGoal.totalSaved).toBe(0);
    expect(italyGoal.totalSaved).toBe(300);
    expect(italyGoal.remainingAmount).toBe(2200);
    expect(summaryResponse.body.data.entries[0].savingsGoalId).toBe(travelGoalId);
    expect(summaryResponse.body.data.entries[0].savingsGoalTitle).toBe("Italy trip");

    const deleteGoalResponse = await inject(app, {
      method: "DELETE",
      url: `/api/savings/goal/${emergencyGoalId}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(deleteGoalResponse.status).toBe(200);

    const afterDeleteResponse = await inject(app, {
      method: "GET",
      url: "/api/savings",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(afterDeleteResponse.status).toBe(200);
    expect(afterDeleteResponse.body.data.goals).toHaveLength(1);
    expect(afterDeleteResponse.body.data.goals[0].title).toBe("Italy trip");
  });

  it("filters transactions and summary by calendar month", async () => {
    const alex = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Alex",
        email: "alex@example.com",
        password: "supersecret",
        monthlySalary: 4200,
        salaryPaymentMethod: "card",
      },
    });

    const sam = await inject(app, {
      method: "POST",
      url: "/api/auth/register",
      body: {
        name: "Sam",
        email: "sam@example.com",
        password: "supersecret",
        monthlySalary: 2800,
        salaryPaymentMethod: "cash",
      },
    });

    await connectUsersByInvite({
      app,
      inviterToken: alex.body.data.accessToken,
      recipientToken: sam.body.data.accessToken,
      partnerUserId: sam.body.data.user.id,
    });

    const previousMonthDate = isoDateForMonthOffset(-1, 12);
    const currentMonthDate = isoDateForMonthOffset(0, 12);
    const previousMonthKey = previousMonthDate.slice(0, 7);

    await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 90,
        description: "Last month dinner",
        category: "Dining",
        type: "one-time",
        paymentMethod: "card",
        date: previousMonthDate,
      },
    });

    await inject(app, {
      method: "POST",
      url: "/api/transactions",
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
      body: {
        amount: 40,
        description: "This month coffee",
        category: "Dining",
        type: "one-time",
        paymentMethod: "cash",
        date: currentMonthDate,
      },
    });

    const transactionsResponse = await inject(app, {
      method: "GET",
      url: `/api/transactions?month=${previousMonthKey}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(transactionsResponse.status).toBe(200);
    expect(transactionsResponse.body.data.transactions).toHaveLength(1);
    expect(transactionsResponse.body.data.transactions[0].description).toBe("Last month dinner");

    const summaryResponse = await inject(app, {
      method: "GET",
      url: `/api/summary?month=${previousMonthKey}`,
      headers: {
        authorization: `Bearer ${alex.body.data.accessToken}`,
      },
    });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totalExpenses).toBe(90);
    expect(summaryResponse.body.data.period.monthKey).toBe(previousMonthKey);
    expect(summaryResponse.body.data.period.mode).toBe("calendar-month");
  });
});
