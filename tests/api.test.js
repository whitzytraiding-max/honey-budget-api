import { EventEmitter } from "node:events";
import httpMocks from "node-mocks-http";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createInsightsService } from "../src/services/insightsService.js";

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

function createInMemoryBudgetRepository() {
  let userId = 1;
  let coupleId = 1;
  let transactionId = 1;
  let savingsEntryId = 1;
  let passwordResetTokenId = 1;
  let coupleInviteId = 1;
  const users = [];
  const couples = [];
  const transactions = [];
  const savingsEntries = [];
  const passwordResetTokens = [];
  const coupleInvites = [];

  function sanitizeUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      monthlySalary: user.monthlySalary,
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
      incomeDayOfMonth = 1,
      monthlySavingsTarget = 0,
    }) {
      const user = {
        id: userId++,
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

    async addTransaction({ userId, amount, category, type, paymentMethod, date }) {
      const owner = users.find((user) => user.id === userId);
      const transaction = {
        id: transactionId++,
        userId,
        userName: owner?.name,
        amount,
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
      const user = users.find((entry) => entry.id === userId);
      user.monthlySalary = monthlySalary;
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

    async addSavingsEntry({ userId, amount, note, date }) {
      const owner = users.find((user) => user.id === userId);
      const entry = {
        id: savingsEntryId++,
        userId,
        userName: owner?.name,
        amount,
        note,
        date,
        createdAt: new Date().toISOString(),
      };
      savingsEntries.push(entry);
      return entry;
    },

    async listSavingsEntriesForUserIds({ userIds, days = 365 }) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      return savingsEntries
        .filter((entry) => userIds.includes(entry.userId) && entry.date >= cutoff)
        .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
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
    const insightsService = createInsightsService({
      budgetRepository: repository,
      openaiClient: null,
    });

    app = createApp({
      budgetRepository: repository,
      insightsService,
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
    expect(insightsResponse.body.data.insights.overview).toContain(
      "AI tips temporarily unavailable",
    );
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
    expect(summaryResponse.body.data.entries[0].note).toBe("Emergency fund transfer");
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
