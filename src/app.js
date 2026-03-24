/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { createAuthService, createRequireAuth } from "./lib/auth.js";
import { HttpError, asyncHandler, sendData } from "./lib/http.js";
import { buildBudgetSnapshot } from "./services/dashboardService.js";

function parsePaymentMethod(value) {
  return value === "cash" || value === "card" ? value : null;
}

function parseAllocationPercentage(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "string" ? Number.parseInt(value.trim(), 10) : Number(value);

  return Number.isInteger(numericValue) ? numericValue : null;
}

function parseMoney(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "string" ? Number.parseFloat(value.trim()) : Number(value);

  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null;
}

function parseDayOfMonth(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "string" ? Number.parseInt(value.trim(), 10) : Number(value);

  return Number.isInteger(numericValue) ? numericValue : null;
}

function resolveIncomeAllocation({
  monthlySalary,
  salaryPaymentMethod,
  salaryCashAmount,
  salaryCardAmount,
  salaryCashAllocationPct,
  salaryCardAllocationPct,
}) {
  const normalizedCashAmount = parseMoney(salaryCashAmount);
  const normalizedCardAmount = parseMoney(salaryCardAmount);

  if (normalizedCashAmount !== null || normalizedCardAmount !== null) {
    if (normalizedCashAmount === null || normalizedCardAmount === null) {
      return {
        error: "salaryCashAmount and salaryCardAmount must both be provided.",
      };
    }

    if (normalizedCashAmount < 0 || normalizedCardAmount < 0) {
      return {
        error: "salary cash/card amounts must be zero or greater.",
      };
    }

    const resolvedMonthlySalary = Number(
      (normalizedCashAmount + normalizedCardAmount).toFixed(2),
    );
    const resolvedCashPct =
      resolvedMonthlySalary > 0
        ? Math.round((normalizedCashAmount / resolvedMonthlySalary) * 100)
        : 0;

    return {
      monthlySalary: resolvedMonthlySalary,
      salaryCashAmount: normalizedCashAmount,
      salaryCardAmount: normalizedCardAmount,
      salaryCashAllocationPct: resolvedCashPct,
      salaryCardAllocationPct: resolvedMonthlySalary > 0 ? 100 - resolvedCashPct : 100,
      salaryPaymentMethod:
        normalizedCashAmount > normalizedCardAmount ? "cash" : "card",
    };
  }

  const normalizedCashAllocation = parseAllocationPercentage(salaryCashAllocationPct);
  const normalizedCardAllocation = parseAllocationPercentage(salaryCardAllocationPct);
  const normalizedMonthlySalary = parseMoney(monthlySalary);

  if (normalizedCashAllocation === null && normalizedCardAllocation === null) {
    const normalizedPaymentMethod = parsePaymentMethod(salaryPaymentMethod);
    if (!normalizedPaymentMethod) {
      return {
        error: "Provide a salary cash/card split or a salaryPaymentMethod of 'cash' or 'card'.",
      };
    }

    return normalizedPaymentMethod === "cash"
      ? {
          monthlySalary: normalizedMonthlySalary,
          salaryCashAmount: normalizedMonthlySalary ?? 0,
          salaryCardAmount: 0,
          salaryCashAllocationPct: 100,
          salaryCardAllocationPct: 0,
          salaryPaymentMethod: "cash",
        }
      : {
          monthlySalary: normalizedMonthlySalary,
          salaryCashAmount: 0,
          salaryCardAmount: normalizedMonthlySalary ?? 0,
          salaryCashAllocationPct: 0,
          salaryCardAllocationPct: 100,
          salaryPaymentMethod: "card",
        };
  }

  if (normalizedCashAllocation === null || normalizedCardAllocation === null) {
    return {
      error: "salaryCashAllocationPct and salaryCardAllocationPct must both be provided.",
    };
  }

  if (
    normalizedCashAllocation < 0 ||
    normalizedCashAllocation > 100 ||
    normalizedCardAllocation < 0 ||
    normalizedCardAllocation > 100
  ) {
    return {
      error: "salary cash/card allocation percentages must be between 0 and 100.",
    };
  }

  if (normalizedCashAllocation + normalizedCardAllocation !== 100) {
    return {
      error: "salary cash/card allocation percentages must add up to 100.",
    };
  }

  return {
    monthlySalary: normalizedMonthlySalary,
    salaryCashAmount: Number(
      (((normalizedMonthlySalary ?? 0) * normalizedCashAllocation) / 100).toFixed(2),
    ),
    salaryCardAmount: Number(
      (((normalizedMonthlySalary ?? 0) * normalizedCardAllocation) / 100).toFixed(2),
    ),
    salaryCashAllocationPct: normalizedCashAllocation,
    salaryCardAllocationPct: normalizedCardAllocation,
    salaryPaymentMethod:
      normalizedCashAllocation > normalizedCardAllocation ? "cash" : "card",
  };
}

function parseExpenseType(value) {
  return value === "recurring" || value === "one-time" ? value : null;
}

function validateIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateYearMonth(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

function sanitizeUser(user) {
  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        monthlySalary: Number(user.monthlySalary ?? 0),
        salaryPaymentMethod: user.salaryPaymentMethod,
        salaryCashAmount: Number(user.salaryCashAmount ?? 0),
        salaryCardAmount: Number(user.salaryCardAmount ?? 0),
        salaryCashAllocationPct: Number(user.salaryCashAllocationPct ?? 0),
        salaryCardAllocationPct: Number(user.salaryCardAllocationPct ?? 100),
        incomeDayOfMonth: Number(user.incomeDayOfMonth ?? 1),
        monthlySavingsTarget: Number(user.monthlySavingsTarget ?? 0),
        createdAt: user.createdAt,
      }
    : null;
}

function getPartner(couple, userId) {
  return couple.userOne.id === userId ? couple.userTwo : couple.userOne;
}

function getCurrentMonthWindow() {
  const now = new Date();
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const from = fromDate.toISOString().slice(0, 10);
  const to = toDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  const days =
    Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const daysRemaining =
    Math.floor((endDate.getTime() - toDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return { from, to, end, days, daysRemaining };
}

function clampIncomeDay(day) {
  const numericDay = Number(day);
  if (!Number.isInteger(numericDay)) {
    return 1;
  }

  return Math.max(1, Math.min(28, numericDay));
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function createUtcDate(year, monthIndex, dayOfMonth) {
  return new Date(Date.UTC(year, monthIndex, dayOfMonth));
}

function addMonthsUtc(date, months) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    date.getUTCDate(),
  );
}

function getBudgetWindowForUsers(users) {
  const now = new Date();
  const incomeDay = clampIncomeDay(
    Math.min(...users.filter(Boolean).map((user) => clampIncomeDay(user.incomeDayOfMonth ?? 1))),
  );
  const today = createUtcDate(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const currentMonthAnchor = createUtcDate(now.getUTCFullYear(), now.getUTCMonth(), incomeDay);
  const fromDate = today.getUTCDate() >= incomeDay ? currentMonthAnchor : addMonthsUtc(currentMonthAnchor, -1);
  const nextWindowStart = addMonthsUtc(fromDate, 1);
  const endDate = new Date(nextWindowStart.getTime() - 24 * 60 * 60 * 1000);
  const elapsedDays =
    Math.floor((today.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const daysRemaining =
    Math.floor((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return {
    from: formatUtcDate(fromDate),
    to: formatUtcDate(today),
    end: formatUtcDate(endDate),
    anchorDay: incomeDay,
    days: elapsedDays,
    daysRemaining,
    label: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(fromDate)
      .concat(" - ")
      .concat(
        new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(endDate),
      ),
  };
}

function getCalendarMonthWindow(month) {
  if (!validateYearMonth(month)) {
    return null;
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  const fromDate = createUtcDate(year, monthIndex, 1);
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const today = new Date();
  const currentMonthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const toDate =
    month === currentMonthKey
      ? createUtcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      : endDate;
  const days =
    Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const daysRemaining =
    Math.max(0, Math.floor((endDate.getTime() - toDate.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    from: formatUtcDate(fromDate),
    to: formatUtcDate(toDate),
    end: formatUtcDate(endDate),
    days,
    daysRemaining,
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(fromDate),
    monthKey: month,
  };
}

function buildIncomeEvents(users, fromDate, limit) {
  const events = [];

  for (const user of users.filter(Boolean)) {
    const day = clampIncomeDay(user.incomeDayOfMonth ?? 1);
    let cursor = createUtcDate(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), day);

    if (cursor.getTime() < fromDate.getTime()) {
      cursor = addMonthsUtc(cursor, 1);
    }

    for (let index = 0; index < 2; index += 1) {
      events.push({
        kind: "income",
        userId: user.id,
        userName: user.name,
        label: `${user.name} income`,
        amount: Number(user.monthlySalary ?? 0),
        date: formatUtcDate(cursor),
      });
      cursor = addMonthsUtc(cursor, 1);
    }
  }

  return events.slice(0, limit);
}

function buildRecurringPaymentEvents(transactions, fromDate) {
  const recurringMap = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== "recurring") {
      continue;
    }

    const key = `${transaction.userId}:${transaction.description}:${transaction.category}:${transaction.amount}:${transaction.paymentMethod}`;
    const existing = recurringMap.get(key);

    if (!existing || existing.date < transaction.date) {
      recurringMap.set(key, transaction);
    }
  }

  const events = [];

  for (const transaction of recurringMap.values()) {
    const day = clampIncomeDay(Number(transaction.date.slice(8, 10)));
    let cursor = createUtcDate(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), day);

    if (cursor.getTime() < fromDate.getTime()) {
      cursor = addMonthsUtc(cursor, 1);
    }

    events.push({
      kind: "expense",
      userId: transaction.userId,
      userName: transaction.userName,
      label: transaction.description,
      amount: Number(transaction.amount ?? 0),
      category: transaction.category,
      paymentMethod: transaction.paymentMethod,
      date: formatUtcDate(cursor),
    });
  }

  return events;
}

function buildUpcomingEvents({ currentUser, partnerUser, transactions }) {
  const users = [currentUser, partnerUser].filter(Boolean);
  const today = new Date();
  const fromDate = createUtcDate(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const allEvents = [
    ...buildIncomeEvents(users, fromDate, 6),
    ...buildRecurringPaymentEvents(transactions, fromDate),
  ];

  return allEvents
    .sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind))
    .slice(0, 8);
}

async function resolvePartnerUser({ budgetRepository, user }) {
  const partnerUserId = Number(user.partnerId);

  if (partnerUserId) {
    const partner = await budgetRepository.getUserById(partnerUserId);
    if (partner) {
      return partner;
    }
  }

  const couple = await budgetRepository.getCoupleForUser(user.id);
  if (!couple) {
    throw new HttpError(
      404,
      "COUPLE_NOT_FOUND",
      "The authenticated user is not linked to a couple yet.",
    );
  }

  return getPartner(couple, user.id);
}

async function buildMonthlySummary({ budgetRepository, currentUser, partnerUser, month = null }) {
  const budgetWindow = month
    ? getCalendarMonthWindow(month)
    : getBudgetWindowForUsers([currentUser, partnerUser]);

  if (!budgetWindow) {
    throw new HttpError(400, "VALIDATION_ERROR", "month must use YYYY-MM.");
  }

  const { from, to, end, days, daysRemaining, label, anchorDay } = budgetWindow;
  const transactions = await budgetRepository.listTransactionsForUserIds({
    userIds: [currentUser.id, partnerUser.id],
    days: Math.max(days, 120),
    fromDate: from,
    toDate: to,
  });
  const monthlyTransactions = transactions.filter(
    (transaction) => transaction.date >= from && transaction.date <= to,
  );
  const householdIncome =
    Number(currentUser.monthlySalary ?? 0) + Number(partnerUser.monthlySalary ?? 0);
  const cashIncome = [currentUser, partnerUser].reduce((sum, user) => {
    return sum + Number(user.salaryCashAmount ?? 0);
  }, 0);
  const cardIncome = [currentUser, partnerUser].reduce((sum, user) => {
    return sum + Number(user.salaryCardAmount ?? 0);
  }, 0);
  const totalExpenses = monthlyTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount ?? 0),
    0,
  );
  const cashSpent = monthlyTransactions.reduce((sum, transaction) => {
    return sum + (transaction.paymentMethod === "cash" ? Number(transaction.amount ?? 0) : 0);
  }, 0);
  const cardSpent = monthlyTransactions.reduce((sum, transaction) => {
    return sum + (transaction.paymentMethod === "card" ? Number(transaction.amount ?? 0) : 0);
  }, 0);
  const remainingBudget = Number((householdIncome - totalExpenses).toFixed(2));
  const cashRemaining = Number((cashIncome - cashSpent).toFixed(2));
  const cardRemaining = Number((cardIncome - cardSpent).toFixed(2));
  const remainingPct =
    householdIncome > 0
      ? Number(Math.max(0, Math.min(100, (remainingBudget / householdIncome) * 100)).toFixed(1))
      : 0;
  const cashRemainingPct =
    cashIncome > 0
      ? Number(Math.max(0, Math.min(100, (cashRemaining / cashIncome) * 100)).toFixed(1))
      : 0;
  const cardRemainingPct =
    cardIncome > 0
      ? Number(Math.max(0, Math.min(100, (cardRemaining / cardIncome) * 100)).toFixed(1))
      : 0;
  const comfortableDailySpend =
    daysRemaining > 0
      ? Number((Math.max(0, remainingBudget) / daysRemaining).toFixed(2))
      : 0;
  const upcomingEvents = buildUpcomingEvents({
    currentUser,
    partnerUser,
    transactions,
  });

  return {
    period: {
      from,
      to,
      end,
      label,
      incomeAnchorDay: anchorDay ?? null,
      monthKey: budgetWindow.monthKey ?? null,
      mode: month ? "calendar-month" : "income-window",
    },
    householdIncome: Number(householdIncome.toFixed(2)),
    cashIncome: Number(cashIncome.toFixed(2)),
    cardIncome: Number(cardIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    cashSpent: Number(cashSpent.toFixed(2)),
    cardSpent: Number(cardSpent.toFixed(2)),
    remainingBudget,
    cashRemaining,
    cardRemaining,
    remainingPct,
    cashRemainingPct,
    cardRemainingPct,
    daysRemainingInMonth: daysRemaining,
    comfortableDailySpend,
    transactionCount: monthlyTransactions.length,
    upcomingEvents,
  };
}

async function buildSavingsSummary({ budgetRepository, currentUser, partnerUser }) {
  const users = [currentUser, partnerUser].filter(Boolean);
  const budgetWindow = getBudgetWindowForUsers(users);
  const entries = await budgetRepository.listSavingsEntriesForUserIds({
    userIds: users.map((user) => user.id),
    days: 365,
  });
  const currentWindowEntries = entries.filter(
    (entry) => entry.date >= budgetWindow.from && entry.date <= budgetWindow.to,
  );
  const totalSaved = currentWindowEntries.reduce(
    (sum, entry) => sum + Number(entry.amount ?? 0),
    0,
  );
  const householdTarget = users.reduce(
    (sum, user) => sum + Number(user.monthlySavingsTarget ?? 0),
    0,
  );
  const remainingToGoal = Math.max(0, Number((householdTarget - totalSaved).toFixed(2)));
  const targetProgressPct =
    householdTarget > 0
      ? Number(Math.min(100, ((totalSaved / householdTarget) * 100)).toFixed(1))
      : 0;
  const suggestedDailySave =
    budgetWindow.daysRemaining > 0
      ? Number((remainingToGoal / budgetWindow.daysRemaining).toFixed(2))
      : 0;

  return {
    period: budgetWindow,
    householdSavingsTarget: Number(householdTarget.toFixed(2)),
    totalSavedThisWindow: Number(totalSaved.toFixed(2)),
    remainingToGoal,
    targetProgressPct,
    suggestedDailySave,
    entries: entries.slice(0, 20),
    users: users.map((user) => ({
      userId: user.id,
      name: user.name,
      monthlySavingsTarget: Number(user.monthlySavingsTarget ?? 0),
    })),
  };
}

function buildStaticInsightsResponse(currentUser, partnerUser) {
  const users = [currentUser, partnerUser].filter(Boolean);
  const totalSalary = users.reduce(
    (sum, user) => sum + Number(user?.monthlySalary ?? 0),
    0,
  );
  const recurringBillSplit = users.map((user) => ({
    userId: Number(user.id),
    name: user.name,
    sharePct:
      users.length === 2
        ? Number(
            (
              totalSalary > 0
                ? (Number(user.monthlySalary ?? 0) / totalSalary) * 100
                : 50
            ).toFixed(1),
          )
        : 100,
  }));

  const insights = {
    provider: "route-fallback",
    overview: "AI tips temporarily unavailable, so the app returned static budgeting guidance.",
    fairSplit: {
      explanation:
        recurringBillSplit.length === 2
          ? `${recurringBillSplit[0].name} should cover ${recurringBillSplit[0].sharePct}% of recurring bills and ${recurringBillSplit[1].name} should cover ${recurringBillSplit[1].sharePct}% based on salary.`
          : "Link both partners to compute a salary-based recurring bill split.",
      recurringBillSplit,
    },
    tips: [
      {
        title: "Pay recurring bills first",
        action:
          "Move each partner's recurring-bill share into a joint bills bucket on payday before day-to-day spending starts.",
        reason: "Covering fixed costs first lowers the chance that discretionary spending eats into essentials.",
      },
      {
        title: "Review card charges weekly",
        action:
          "Set one 10-minute weekly check-in to review card transactions together and cancel one low-value charge this month.",
        reason: "A short recurring review catches subscriptions and impulse spending before they compound.",
      },
      {
        title: "Give cash a weekly limit",
        action:
          "Set a simple weekly cash cap for dining, snacks, and small impulse buys, then stop once that limit is used.",
        reason: "Cash purchases are harder to spot in hindsight, so a cap helps prevent quiet budget leakage.",
      },
    ],
  };

  return {
    snapshot: null,
    insights,
    tips: insights.tips,
  };
}

function createApp({
  app = express(),
  budgetRepository,
  insightsService,
  emailService = null,
  resetPasswordUrlBase = process.env.RESET_PASSWORD_URL_BASE || process.env.APP_BASE_URL || "",
  jwtSecret = process.env.JWT_SECRET || "",
  jsonParser = express.json(),
}) {
  const isProduction = process.env.NODE_ENV === "production";
  const effectiveResetPasswordUrlBase =
    resetPasswordUrlBase || (!isProduction ? "http://localhost:5173" : "");
  const effectiveJwtSecret =
    jwtSecret || (!isProduction ? "development-secret-change-me" : "");

  if (isProduction && !effectiveResetPasswordUrlBase) {
    throw new Error(
      "RESET_PASSWORD_URL_BASE or APP_BASE_URL is required in production.",
    );
  }

  if (isProduction && !effectiveJwtSecret) {
    throw new Error("JWT_SECRET is required in production.");
  }

  const authService = createAuthService({ jwtSecret: effectiveJwtSecret });
  const requireAuth = createRequireAuth({ authService, budgetRepository });

  if (jsonParser) {
    app.use(jsonParser);
  }

  app.get("/health", (_request, response) => {
    sendData(response, 200, { status: "ok" });
  });

  app.post(
    "/api/auth/register",
    asyncHandler(async (request, response) => {
      const {
        name,
        email,
        password,
        monthlySalary,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
        incomeDayOfMonth,
        monthlySavingsTarget,
      } = request.body;

      if (!name?.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "name is required.");
      }

      if (!email?.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "email is required.");
      }

      if (!password || password.length < 8) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "password must be at least 8 characters.",
        );
      }

      const normalizedMonthlySalary = parseMoney(monthlySalary);
      const hasIncomeAmounts =
        salaryCashAmount !== undefined || salaryCardAmount !== undefined;

      if (!hasIncomeAmounts && (!Number.isFinite(normalizedMonthlySalary) || normalizedMonthlySalary < 0)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "monthlySalary must be a non-negative number.",
        );
      }

      const incomeAllocation = resolveIncomeAllocation({
        monthlySalary: normalizedMonthlySalary,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
      });
      if (incomeAllocation.error) {
        throw new HttpError(400, "VALIDATION_ERROR", incomeAllocation.error);
      }

      const normalizedIncomeDay = parseDayOfMonth(incomeDayOfMonth) ?? 1;
      if (normalizedIncomeDay < 1 || normalizedIncomeDay > 28) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "incomeDayOfMonth must be between 1 and 28.",
        );
      }

      const normalizedSavingsTarget = parseMoney(monthlySavingsTarget) ?? 0;
      if (normalizedSavingsTarget < 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "monthlySavingsTarget must be zero or greater.",
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await budgetRepository.getUserAuthByEmail(normalizedEmail);
      if (existingUser) {
        throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");
      }

      const passwordHash = await authService.hashPassword(password);
      const user = await budgetRepository.createUser({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        monthlySalary: incomeAllocation.monthlySalary ?? normalizedMonthlySalary,
        salaryPaymentMethod: incomeAllocation.salaryPaymentMethod,
        salaryCashAmount: incomeAllocation.salaryCashAmount,
        salaryCardAmount: incomeAllocation.salaryCardAmount,
        salaryCashAllocationPct: incomeAllocation.salaryCashAllocationPct,
        salaryCardAllocationPct: incomeAllocation.salaryCardAllocationPct,
        incomeDayOfMonth: normalizedIncomeDay,
        monthlySavingsTarget: normalizedSavingsTarget,
      });

      const accessToken = authService.signAccessToken(user);
      sendData(response, 201, {
        user: sanitizeUser(user),
        accessToken,
      });
    }),
  );

  app.post(
    "/api/auth/login",
    asyncHandler(async (request, response) => {
      const { email, password } = request.body;

      if (!email?.trim() || !password) {
        throw new HttpError(400, "VALIDATION_ERROR", "email and password are required.");
      }

      const authUser = await budgetRepository.getUserAuthByEmail(
        email.trim().toLowerCase(),
      );
      if (!authUser) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const passwordMatches = await authService.verifyPassword(
        password,
        authUser.passwordHash,
      );
      if (!passwordMatches) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const user = sanitizeUser(authUser);
      const accessToken = authService.signAccessToken(user);

      sendData(response, 200, {
        user,
        accessToken,
      });
    }),
  );

  app.post(
    "/api/auth/forgot-password",
    asyncHandler(async (request, response) => {
      const email = request.body?.email?.trim()?.toLowerCase();

      if (!email) {
        throw new HttpError(400, "VALIDATION_ERROR", "email is required.");
      }

      const authUser = await budgetRepository.getUserAuthByEmail(email);
      let previewResetUrl = null;

      if (authUser) {
        const rawToken = authService.createPasswordResetToken();
        const tokenHash = authService.hashPasswordResetToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const normalizedBaseUrl = effectiveResetPasswordUrlBase.replace(/\/$/, "");
        const resetUrl = `${normalizedBaseUrl}/#/reset-password?token=${encodeURIComponent(rawToken)}`;

        await budgetRepository.createPasswordResetToken({
          userId: authUser.id,
          tokenHash,
          expiresAt,
        });

        const mailResult = emailService
          ? await emailService.sendPasswordResetEmail({
              to: authUser.email,
              name: authUser.name,
              resetUrl,
            })
          : { preview: true, resetUrl };

        if (mailResult.preview) {
          previewResetUrl = mailResult.resetUrl || resetUrl;
        }
      }

      sendData(response, 200, {
        message:
          "If that email exists, we sent a password reset link.",
        previewResetUrl,
      });
    }),
  );

  app.post(
    "/api/auth/reset-password",
    asyncHandler(async (request, response) => {
      const token = request.body?.token?.trim();
      const password = request.body?.password;

      if (!token) {
        throw new HttpError(400, "VALIDATION_ERROR", "token is required.");
      }

      if (!password || password.length < 8) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "password must be at least 8 characters.",
        );
      }

      const tokenHash = authService.hashPasswordResetToken(token);
      const resetToken = await budgetRepository.getPasswordResetTokenByHash(tokenHash);

      if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt).getTime() < Date.now()) {
        throw new HttpError(
          400,
          "INVALID_RESET_TOKEN",
          "This password reset link is invalid or has expired.",
        );
      }

      const passwordHash = await authService.hashPassword(password);
      const user = await budgetRepository.resetPasswordWithToken({
        tokenId: resetToken.id,
        userId: resetToken.userId,
        passwordHash,
      });
      const accessToken = authService.signAccessToken(user);

      sendData(response, 200, {
        user,
        accessToken,
      });
    }),
  );

  app.get(
    "/api/auth/me",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      sendData(response, 200, {
        user: sanitizeUser(request.user),
        couple,
      });
    }),
  );

  app.patch(
    "/api/profile/income",
    requireAuth,
    asyncHandler(async (request, response) => {
      const {
        monthlySalary,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
        incomeDayOfMonth,
        monthlySavingsTarget,
      } = request.body;

      const incomeAllocation = resolveIncomeAllocation({
        monthlySalary,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
      });
      if (incomeAllocation.error) {
        throw new HttpError(400, "VALIDATION_ERROR", incomeAllocation.error);
      }

      const normalizedIncomeDay = parseDayOfMonth(incomeDayOfMonth);
      if (
        normalizedIncomeDay !== null &&
        (normalizedIncomeDay < 1 || normalizedIncomeDay > 28)
      ) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "incomeDayOfMonth must be between 1 and 28.",
        );
      }

      const normalizedSavingsTarget = parseMoney(monthlySavingsTarget);
      if (normalizedSavingsTarget !== null && normalizedSavingsTarget < 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "monthlySavingsTarget must be zero or greater.",
        );
      }

      const user = await budgetRepository.updateUserIncomeProfile({
        userId: request.user.id,
        monthlySalary: incomeAllocation.monthlySalary ?? Number(monthlySalary),
        salaryPaymentMethod: incomeAllocation.salaryPaymentMethod,
        salaryCashAmount: incomeAllocation.salaryCashAmount,
        salaryCardAmount: incomeAllocation.salaryCardAmount,
        salaryCashAllocationPct: incomeAllocation.salaryCashAllocationPct,
        salaryCardAllocationPct: incomeAllocation.salaryCardAllocationPct,
        incomeDayOfMonth: normalizedIncomeDay ?? undefined,
        monthlySavingsTarget: normalizedSavingsTarget ?? undefined,
      });

      sendData(response, 200, { user });
    }),
  );

  app.post(
    "/api/couples",
    requireAuth,
    asyncHandler(async (request, response) => {
      const rawPartnerUserId = request.body?.partnerUserId;
      const partnerUserId =
        typeof rawPartnerUserId === "string"
          ? Number.parseInt(rawPartnerUserId.trim(), 10)
          : rawPartnerUserId;

      if (!Number.isInteger(partnerUserId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "partnerUserId must be an integer.");
      }

      if (partnerUserId === request.user.id) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "You cannot create a couple with yourself.",
        );
      }

      const partner = await budgetRepository.getUserById(partnerUserId);
      if (!partner) {
        throw new HttpError(404, "USER_NOT_FOUND", "Partner user not found.");
      }

      const currentCouple = await budgetRepository.getCoupleForUser(request.user.id);
      if (currentCouple) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "Current user is already linked to a couple.",
        );
      }

      const partnerCouple = await budgetRepository.getCoupleForUser(partnerUserId);
      if (partnerCouple) {
        throw new HttpError(
          409,
          "COUPLE_EXISTS",
          "Partner user is already linked to a couple.",
        );
      }

      const couple = await budgetRepository.createCouple({
        userOneId: request.user.id,
        userTwoId: partnerUserId,
      });

      sendData(response, 201, { couple });
    }),
  );

  app.post(
    "/api/couples/link",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerEmail = request.body?.partnerEmail;

      if (!partnerEmail) {
        throw new HttpError(400, "VALIDATION_ERROR", "partnerEmail is required.");
      }

      const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();

      if (normalizedPartnerEmail === request.user.email) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "You cannot link yourself as your partner.",
        );
      }

      const couple = await budgetRepository.linkCoupleByPartnerEmail({
        userId: request.user.id,
        partnerEmail: normalizedPartnerEmail,
      });

      sendData(response, 201, { couple });
    }),
  );

  app.get(
    "/api/dashboard",
    requireAuth,
    asyncHandler(async (request, response) => {
      const days = Number(request.query.days ?? 30);
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "The authenticated user is not linked to a couple yet.",
        );
      }

      const snapshot = await buildBudgetSnapshot({
        budgetRepository,
        coupleId: couple.id,
        days: Number.isFinite(days) && days > 0 ? days : 30,
      });

      sendData(response, 200, {
        couple,
        currentUser: sanitizeUser(request.user),
        partner: getPartner(couple, request.user.id),
        dashboard: snapshot,
      });
    }),
  );

  app.get(
    "/api/summary",
    requireAuth,
    asyncHandler(async (request, response) => {
      const month = request.query.month?.trim();
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });

      const summary = await buildMonthlySummary({
        budgetRepository,
        currentUser: request.user,
        partnerUser,
        month: month || null,
      });

      sendData(response, 200, summary);
    }),
  );

  app.post(
    "/api/transactions",
    requireAuth,
    asyncHandler(async (request, response) => {
      const {
        amount,
        description,
        category,
        type,
        paymentMethod,
        payment_method,
        date,
      } = request.body;

      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      if (!couple) {
        throw new HttpError(
          409,
          "COUPLE_REQUIRED",
          "Link a couple before adding shared expenses.",
        );
      }

      request.body.amount = Number(request.body.amount);
      const numericAmount = request.body.amount;

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
      }

      if (!category?.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "category is required.");
      }

      const normalizedCategory = category.trim();
      const normalizedDescription = description?.trim() || `${normalizedCategory} expense`;

      const normalizedType = parseExpenseType(type);
      if (!normalizedType) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "type must be 'recurring' or 'one-time'.",
        );
      }

      const normalizedPaymentMethod = parsePaymentMethod(paymentMethod || payment_method);
      if (!normalizedPaymentMethod) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "paymentMethod must be 'cash' or 'card'.",
        );
      }

      if (!validateIsoDate(date)) {
        throw new HttpError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD.");
      }

      const transaction = await budgetRepository.addTransaction({
        userId: request.user.id,
        amount: numericAmount,
        description: normalizedDescription,
        category: normalizedCategory,
        type: normalizedType,
        paymentMethod: normalizedPaymentMethod,
        date,
      });

      sendData(response, 201, {
        transaction,
        coupleId: couple.id,
      });
    }),
  );

  app.get(
    "/api/transactions",
    requireAuth,
    asyncHandler(async (request, response) => {
      const days = Number(request.query.days ?? 30);
      const month = request.query.month?.trim();
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "The authenticated user is not linked to a couple yet.",
        );
      }

      if (month && !validateYearMonth(month)) {
        throw new HttpError(400, "VALIDATION_ERROR", "month must use YYYY-MM.");
      }

      const monthWindow = month ? getCalendarMonthWindow(month) : null;
      const transactions = await budgetRepository.listCoupleTransactions({
        coupleId: couple.id,
        days: Number.isFinite(days) && days > 0 ? days : 30,
        fromDate: monthWindow?.from,
        toDate: monthWindow?.to,
      });

      sendData(
        response,
        200,
        {
          transactions,
        },
        { count: transactions.length },
      );
    }),
  );

  app.get(
    "/api/insights",
    requireAuth,
    asyncHandler(async (request, response) => {
      let partnerUser = null;

      try {
        const days = Number(request.query.days ?? 30);
        partnerUser = await resolvePartnerUser({
          budgetRepository,
          user: request.user,
        });

        const result = await insightsService.getAiInsights({
          currentUser: request.user,
          partnerUser,
          days: Number.isFinite(days) && days > 0 ? days : 30,
        });

        sendData(response, 200, {
          ...result,
          tips: result.insights.tips,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        console.error("Insights route failed:", error);

        const fallbackResponse = buildStaticInsightsResponse(request.user, partnerUser);
        sendData(response, 200, fallbackResponse);
      }
    }),
  );

  app.get(
    "/api/savings",
    requireAuth,
    asyncHandler(async (request, response) => {
      let partnerUser = null;

      try {
        partnerUser = await resolvePartnerUser({
          budgetRepository,
          user: request.user,
        });
      } catch (error) {
        if (!(error instanceof HttpError && error.code === "COUPLE_NOT_FOUND")) {
          throw error;
        }
      }

      const savings = await buildSavingsSummary({
        budgetRepository,
        currentUser: request.user,
        partnerUser,
      });

      sendData(response, 200, savings);
    }),
  );

  app.post(
    "/api/savings",
    requireAuth,
    asyncHandler(async (request, response) => {
      const amount = Number(request.body?.amount);
      const note = request.body?.note?.trim();
      const date = request.body?.date;

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
      }

      if (!note) {
        throw new HttpError(400, "VALIDATION_ERROR", "note is required.");
      }

      if (!validateIsoDate(date)) {
        throw new HttpError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD.");
      }

      const entry = await budgetRepository.addSavingsEntry({
        userId: request.user.id,
        amount,
        note,
        date,
      });

      sendData(response, 201, { entry });
    }),
  );

  app.use((error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  });

  return app;
}

export { createApp };
