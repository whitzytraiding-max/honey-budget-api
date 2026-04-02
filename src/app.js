/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { createAuthService, createRequireAuth } from "./lib/auth.js";
import { HttpError, asyncHandler, sendData } from "./lib/http.js";
import { buildBudgetSnapshot } from "./services/dashboardService.js";
import { createExchangeRateService } from "./services/exchangeRateService.js";
import {
  convertTransactionWithSnapshot,
  createCurrencyConverter,
  resolveCurrencyCode,
  roundCurrency,
} from "./services/currencyConversionService.js";
import { MMK_CURRENCY_CODE } from "./services/exchangeRateService.js";

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

function validateCurrencyCode(value) {
  return /^[A-Z]{3}$/.test(String(value ?? "").trim().toUpperCase());
}

function roundRate(value) {
  return Number(Number(value ?? 0).toFixed(6));
}

function isMmkInvolved(...codes) {
  return codes.some((code) => resolveCurrencyCode(code) === MMK_CURRENCY_CODE);
}

function parseYearMonthInput(yearValue, monthValue) {
  const year = Number.parseInt(String(yearValue ?? "").trim(), 10);
  const month = Number.parseInt(String(monthValue ?? "").trim(), 10);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, "VALIDATION_ERROR", "year must be a valid 4-digit year.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new HttpError(400, "VALIDATION_ERROR", "month must be between 1 and 12.");
  }

  return { year, month };
}

function resolveMonthPartsFromIsoDate(isoDate) {
  return {
    year: Number(isoDate.slice(0, 4)),
    month: Number(isoDate.slice(5, 7)),
  };
}

async function buildMmkTransactionSnapshot({
  exchangeRateService,
  coupleId,
  amount,
  sourceCurrencyCode,
  targetCurrencyCode,
  transactionDate,
}) {
  const normalizedSourceCurrency = resolveCurrencyCode(sourceCurrencyCode);
  const normalizedTargetCurrency = resolveCurrencyCode(targetCurrencyCode);

  if (!isMmkInvolved(normalizedSourceCurrency, normalizedTargetCurrency)) {
    return {
      convertedAmount: null,
      convertedCurrencyCode: null,
      conversionAnchorAmount: null,
      conversionAnchorCurrencyCode: null,
      exchangeRateUsed: null,
      exchangeRateSource: null,
    };
  }

  try {
    const usdToMmkRate = await exchangeRateService.getRate({
      from: "USD",
      to: MMK_CURRENCY_CODE,
      coupleId,
      date: transactionDate,
      requireMmkMonthly: true,
    });
    const sourceToUsdRate =
      normalizedSourceCurrency === "USD"
        ? { rate: 1 }
        : await exchangeRateService.getRate({
            from: normalizedSourceCurrency,
            to: "USD",
            coupleId,
            date: transactionDate,
            requireMmkMonthly: true,
          });
    const anchorAmount = roundCurrency(Number(amount) * Number(sourceToUsdRate.rate ?? 1));
    const usdToTargetRate =
      normalizedTargetCurrency === "USD"
        ? { rate: 1 }
        : await exchangeRateService.getRate({
            from: "USD",
            to: normalizedTargetCurrency,
            coupleId,
            date: transactionDate,
            requireMmkMonthly: true,
          });
    const convertedAmount = roundCurrency(anchorAmount * Number(usdToTargetRate.rate ?? 1));

    return {
      convertedAmount,
      convertedCurrencyCode: normalizedTargetCurrency,
      conversionAnchorAmount: anchorAmount,
      conversionAnchorCurrencyCode: "USD",
      exchangeRateUsed: roundRate(Number(usdToMmkRate.rate ?? 0)),
      exchangeRateSource: String(usdToMmkRate.source ?? "custom"),
    };
  } catch (error) {
    if (error?.code === "MMK_MONTHLY_RATE_REQUIRED") {
      throw new HttpError(
        409,
        "MMK_MONTHLY_RATE_REQUIRED",
        "Set a monthly MMK exchange rate before saving MMK-related transactions.",
      );
    }

    throw error;
  }
}

function normalizeCoachProfilePayload(payload) {
  const primaryGoal = String(payload?.primaryGoal ?? "").trim();
  const goalHorizon = String(payload?.goalHorizon ?? "").trim();
  const biggestMoneyStress = String(payload?.biggestMoneyStress ?? "").trim();
  const hardestCategory = String(payload?.hardestCategory ?? "").trim();
  const conflictTrigger = String(payload?.conflictTrigger ?? "").trim();
  const coachingFocus = String(payload?.coachingFocus ?? "").trim();
  const notes = String(payload?.notes ?? "").trim();

  if (!primaryGoal) {
    throw new HttpError(400, "VALIDATION_ERROR", "primaryGoal is required.");
  }

  if (!goalHorizon) {
    throw new HttpError(400, "VALIDATION_ERROR", "goalHorizon is required.");
  }

  if (!biggestMoneyStress) {
    throw new HttpError(400, "VALIDATION_ERROR", "biggestMoneyStress is required.");
  }

  if (!hardestCategory) {
    throw new HttpError(400, "VALIDATION_ERROR", "hardestCategory is required.");
  }

  if (!conflictTrigger) {
    throw new HttpError(400, "VALIDATION_ERROR", "conflictTrigger is required.");
  }

  if (!coachingFocus) {
    throw new HttpError(400, "VALIDATION_ERROR", "coachingFocus is required.");
  }

  if (notes.length > 500) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "notes must be 500 characters or fewer.",
    );
  }

  return {
    primaryGoal,
    goalHorizon,
    biggestMoneyStress,
    hardestCategory,
    conflictTrigger,
    coachingFocus,
    notes,
  };
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function normalizeRecurringBillPayload(payload, currentUser) {
  const title = String(payload?.title ?? "").trim();
  const amount = parseMoney(payload?.amount);
  const category = String(payload?.category ?? "").trim();
  const paymentMethod = parsePaymentMethod(payload?.paymentMethod);
  const dayOfMonth = parseDayOfMonth(payload?.dayOfMonth);
  const notes = String(payload?.notes ?? "").trim();
  const currencyCode = resolveCurrencyCode(
    payload?.currencyCode || currentUser?.incomeCurrencyCode || "USD",
  );
  const startDate = String(payload?.startDate ?? "").trim();
  const endDate = String(payload?.endDate ?? "").trim();
  const isActive = parseBoolean(payload?.isActive, true);
  const autoCreate = parseBoolean(payload?.autoCreate, true);

  if (!title) {
    throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
  }

  if (!category) {
    throw new HttpError(400, "VALIDATION_ERROR", "category is required.");
  }

  if (!paymentMethod) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "paymentMethod must be 'cash' or 'card'.",
    );
  }

  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "dayOfMonth must be between 1 and 28.",
    );
  }

  if (!validateIsoDate(startDate)) {
    throw new HttpError(400, "VALIDATION_ERROR", "startDate must use YYYY-MM-DD.");
  }

  if (endDate && !validateIsoDate(endDate)) {
    throw new HttpError(400, "VALIDATION_ERROR", "endDate must use YYYY-MM-DD.");
  }

  if (endDate && endDate < startDate) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "endDate must be on or after startDate.",
    );
  }

  return {
    title,
    amount,
    category,
    paymentMethod,
    dayOfMonth,
    notes,
    currencyCode,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null,
    isActive,
    autoCreate,
  };
}

function normalizeHouseholdRulePayload(payload, currentUser) {
  const title = String(payload?.title ?? "").trim();
  const details = String(payload?.details ?? "").trim();
  const thresholdAmount = parseMoney(payload?.thresholdAmount);
  const currencyCode =
    thresholdAmount !== null
      ? resolveCurrencyCode(payload?.currencyCode || currentUser?.incomeCurrencyCode || "USD")
      : null;
  const isActive = parseBoolean(payload?.isActive, true);

  if (!title) {
    throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
  }

  if (!details) {
    throw new HttpError(400, "VALIDATION_ERROR", "details is required.");
  }

  if (thresholdAmount !== null && thresholdAmount <= 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "thresholdAmount must be greater than zero when provided.",
    );
  }

  return {
    title,
    details,
    thresholdAmount,
    currencyCode,
    isActive,
  };
}

function getMonthSpan(startIsoDate, endIsoDate) {
  const months = [];
  const startYear = Number(startIsoDate.slice(0, 4));
  const startMonth = Number(startIsoDate.slice(5, 7));
  const endYear = Number(endIsoDate.slice(0, 4));
  const endMonth = Number(endIsoDate.slice(5, 7));

  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function buildOccurrenceDate(year, month, dayOfMonth) {
  const day = String(Math.max(1, Math.min(28, Number(dayOfMonth) || 1))).padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${day}`;
}

function computeNextRecurringDate({ recurringBill, todayIsoDate }) {
  const today = todayIsoDate ?? new Date().toISOString().slice(0, 10);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const billStart = recurringBill.startDate;

  const candidates = [
    buildOccurrenceDate(todayYear, todayMonth, recurringBill.dayOfMonth),
    todayMonth === 12
      ? buildOccurrenceDate(todayYear + 1, 1, recurringBill.dayOfMonth)
      : buildOccurrenceDate(todayYear, todayMonth + 1, recurringBill.dayOfMonth),
  ];

  return (
    candidates.find((candidate) => {
      if (candidate < billStart) {
        return false;
      }

      if (recurringBill.endDate && candidate > recurringBill.endDate) {
        return false;
      }

      return candidate >= today;
    }) ?? null
  );
}

async function materializeRecurringBills({
  budgetRepository,
  exchangeRateService,
  couple,
  throughDate,
}) {
  if (!couple) {
    return [];
  }

  const bills = await budgetRepository.listRecurringBillsForCouple(couple.id);
  const createdTransactions = [];
  const todayIsoDate = new Date().toISOString().slice(0, 10);
  const effectiveThroughDate = throughDate || todayIsoDate;

  for (const recurringBill of bills) {
    if (!recurringBill.isActive || !recurringBill.autoCreate) {
      continue;
    }

    const startIsoDate = recurringBill.startDate;
    const endIsoDate = recurringBill.endDate && recurringBill.endDate < effectiveThroughDate
      ? recurringBill.endDate
      : effectiveThroughDate;

    if (!startIsoDate || startIsoDate > endIsoDate) {
      continue;
    }

    const monthSpan = getMonthSpan(startIsoDate, endIsoDate);
    for (const monthPart of monthSpan) {
      const occurrenceDate = buildOccurrenceDate(
        monthPart.year,
        monthPart.month,
        recurringBill.dayOfMonth,
      );

      if (occurrenceDate < startIsoDate || occurrenceDate > endIsoDate) {
        continue;
      }

      const existing = await budgetRepository.getMaterializedRecurringBillTransaction({
        recurringBillId: recurringBill.id,
        userId: recurringBill.userId,
        date: occurrenceDate,
      });

      if (existing) {
        continue;
      }

      const exchangeSnapshot = await buildMmkTransactionSnapshot({
        exchangeRateService,
        coupleId: couple.id,
        amount: recurringBill.amount,
        sourceCurrencyCode: recurringBill.currencyCode,
        targetCurrencyCode: recurringBill.currencyCode,
        transactionDate: occurrenceDate,
      });

      const transaction = await budgetRepository.addTransaction({
        userId: recurringBill.userId,
        recurringBillId: recurringBill.id,
        autoCreated: true,
        amount: recurringBill.amount,
        currencyCode: recurringBill.currencyCode,
        description: recurringBill.title,
        category: recurringBill.category,
        type: "recurring",
        paymentMethod: recurringBill.paymentMethod,
        date: occurrenceDate,
        ...exchangeSnapshot,
      });

      createdTransactions.push(transaction);
    }
  }

  return createdTransactions;
}

function buildSetupChecklist({
  currentUser,
  partnerUser,
  coachProfile,
  recurringBills,
  goals,
}) {
  return [
    {
      key: "partner",
      title: "Link your partner",
      description: "Connect both accounts so the app can act like one shared household.",
      completed: Boolean(partnerUser),
      route: "settings",
    },
    {
      key: "income",
      title: "Set both income profiles",
      description: "Make sure income, split, and income day are saved for both partners.",
      completed: Boolean(
        currentUser?.monthlySalary > 0 &&
          partnerUser?.monthlySalary > 0 &&
          currentUser?.incomeDayOfMonth &&
          partnerUser?.incomeDayOfMonth,
      ),
      route: "settings",
    },
    {
      key: "bills",
      title: "Add your recurring bills",
      description: "Rent, subscriptions, and utilities should auto-fill each month.",
      completed: recurringBills.length > 0,
      route: "planner",
    },
    {
      key: "goals",
      title: "Create your first savings goal",
      description: "Give the coach and planner something concrete to aim toward.",
      completed: goals.length > 0,
      route: "savings",
    },
    {
      key: "coach",
      title: "Finish the couples coach questionnaire",
      description: "Tell Honey Budget where you want help and where tension usually starts.",
      completed: Boolean(coachProfile?.completed),
      route: "coach",
    },
  ];
}

function buildGoalMilestones(goal) {
  const progressPct = Number(goal.progressPct ?? 0);
  const milestones = [25, 50, 75, 100].map((milestone) => ({
    value: milestone,
    reached: progressPct >= milestone,
  }));

  const nextMilestone = milestones.find((milestone) => !milestone.reached) ?? null;
  return {
    milestones,
    nextMilestone: nextMilestone?.value ?? null,
  };
}

function buildSuggestedMonthlyContribution(goal) {
  if (!goal?.targetDate || !Number.isFinite(Number(goal.remainingAmount))) {
    return 0;
  }

  const today = new Date();
  const targetDate = new Date(`${goal.targetDate}T00:00:00.000Z`);
  const monthDiff =
    (targetDate.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (targetDate.getUTCMonth() - today.getUTCMonth()) +
    1;
  const remainingMonths = Math.max(1, monthDiff);
  return roundCurrency(Number(goal.remainingAmount) / remainingMonths);
}

function buildRecurringBillStatus({ recurringBill, summary, converter }) {
  const nextDueDate = computeNextRecurringDate({
    recurringBill,
    todayIsoDate: new Date().toISOString().slice(0, 10),
  });
  const displayAmount = roundCurrency(
    converter.convert(recurringBill.amount ?? 0, recurringBill.currencyCode),
  );
  const dueSoon =
    nextDueDate &&
    Math.floor(
      (new Date(`${nextDueDate}T00:00:00.000Z`).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    ) <= 7;

  return {
    ...recurringBill,
    nextDueDate,
    dueSoon: Boolean(dueSoon),
    displayAmount,
    displayCurrencyCode: converter.displayCurrencyCode,
    warning:
      summary.remainingBudget < displayAmount
        ? "This bill is larger than the budget currently left in this window."
        : null,
  };
}

function buildConflictRiskAreas({ summary, dashboard, recurringBills, rules }) {
  const risks = [];

  if (Number(summary?.remainingPct ?? 0) < 35) {
    risks.push({
      key: "remaining-tight",
      title: "Remaining budget is getting tight",
      body: `Only ${summary.remainingPct}% of this budget window is left, so small spending choices are more likely to create stress right now.`,
      tone: "amber",
    });
  }

  if (Number(dashboard?.summary?.cashSharePct ?? 0) >= 45) {
    risks.push({
      key: "cash-visibility",
      title: "A lot of spending is happening in cash",
      body: "Cash-heavy months are harder for both partners to review in real time, which can make the budget feel less shared.",
      tone: "sky",
    });
  }

  if ((recurringBills ?? []).some((bill) => bill.warning)) {
    risks.push({
      key: "upcoming-bill-pressure",
      title: "An upcoming bill is larger than the remaining buffer",
      body: "Check the next due bills together so neither of you gets surprised by a big auto-created expense landing late in the month.",
      tone: "rose",
    });
  }

  if (!(rules ?? []).length) {
    risks.push({
      key: "missing-rules",
      title: "You still do not have shared spending rules",
      body: "A simple rule like a check-in threshold or a weekly dining cap reduces friction before it starts.",
      tone: "mint",
    });
  }

  return risks.slice(0, 4);
}

function buildTalkPrompts({ recurringBills, rules, coachProfile, summary }) {
  const prompts = [];
  const nextBill = recurringBills.find((bill) => bill.nextDueDate);

  if (nextBill) {
    prompts.push(
      `Check who is covering ${nextBill.title} on ${nextBill.nextDueDate} so it does not feel like a surprise.`,
    );
  }

  if (!(rules ?? []).length) {
    prompts.push(
      "Agree on one money rule this week, like checking in before anything over a set amount.",
    );
  }

  if (coachProfile?.conflictTrigger) {
    prompts.push(
      `Your coach setup says tension starts around "${coachProfile.conflictTrigger}". Use that as the first thing to talk through when the budget feels tight.`,
    );
  }

  if (Number(summary?.comfortableDailySpend ?? 0) > 0) {
    prompts.push(
      `If you want the month to feel calmer, try treating ${summary.comfortableDailySpend} per day as the shared flex-spend ceiling until the next income date.`,
    );
  }

  return prompts.slice(0, 4);
}

async function buildPlannerData({
  budgetRepository,
  exchangeRateService,
  currentUser,
  partnerUser,
  coachProfile,
  displayCurrency = null,
}) {
  const couple = await budgetRepository.getCoupleForUser(currentUser.id);

  if (!couple || !partnerUser) {
    throw new HttpError(
      404,
      "COUPLE_NOT_FOUND",
      "Link both partners before opening the planner.",
    );
  }

  await materializeRecurringBills({
    budgetRepository,
    exchangeRateService,
    couple,
    throughDate: new Date().toISOString().slice(0, 10),
  });

  const [summary, dashboard, recurringBills, rules, goals] = await Promise.all([
    buildMonthlySummary({
      budgetRepository,
      exchangeRateService,
      currentUser,
      partnerUser,
      displayCurrency,
    }),
    buildBudgetSnapshot({
      budgetRepository,
      exchangeRateService,
      coupleId: couple.id,
      displayCurrency,
      days: 30,
    }),
    budgetRepository.listRecurringBillsForCouple(couple.id),
    budgetRepository.listHouseholdRulesForCouple(couple.id),
    budgetRepository.listSavingsGoalsForCouple(couple.id),
  ]);

  const converter = await createCurrencyConverter({
    exchangeRateService,
    displayCurrency: summary.displayCurrencyCode,
    coupleId: couple.id,
    date: summary.period.from,
    sourceCurrencies: recurringBills.map((bill) => bill.currencyCode),
  });

  const recurringBillStatuses = recurringBills.map((bill) =>
    buildRecurringBillStatus({
      recurringBill: bill,
      summary,
      converter,
    }),
  );
  const upcomingBills = recurringBillStatuses
    .filter((bill) => bill.nextDueDate)
    .sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate))
    .slice(0, 8);
  const setupChecklist = buildSetupChecklist({
    currentUser,
    partnerUser,
    coachProfile,
    recurringBills,
    goals,
  });

  return {
    displayCurrencyCode: summary.displayCurrencyCode,
    setupChecklist,
    recurringBills: recurringBillStatuses,
    upcomingBills,
    householdRules: rules,
    pushReadiness: {
      enabled: false,
      body: "Push-notification groundwork is now in place, but device registration and native delivery still need the Capacitor push step next.",
    },
    conflictCenter: {
      upcomingBills: upcomingBills.slice(0, 5),
      sharedRules: rules.filter((rule) => rule.isActive),
      riskAreas: buildConflictRiskAreas({
        summary,
        dashboard,
        recurringBills: recurringBillStatuses,
        rules,
      }),
      prompts: buildTalkPrompts({
        recurringBills: recurringBillStatuses,
        rules,
        coachProfile,
        summary,
      }),
    },
  };
}

function normalizeTransactionPayload(payload) {
  const {
    amount,
    currencyCode,
    description,
    category,
    type,
    paymentMethod,
    payment_method,
    date,
  } = payload;

  const numericAmount =
    typeof amount === "string" ? Number.parseFloat(amount.trim()) : Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
  }

  if (!category?.trim()) {
    throw new HttpError(400, "VALIDATION_ERROR", "category is required.");
  }

  const normalizedCategory = category.trim();
  const normalizedDescription = description?.trim() || `${normalizedCategory} expense`;
  const normalizedCurrencyCode = currencyCode?.trim?.()
    ? String(currencyCode).trim().toUpperCase()
    : null;

  if (normalizedCurrencyCode && !validateCurrencyCode(normalizedCurrencyCode)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "currencyCode must be a valid ISO 4217 currency code.",
    );
  }

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

  return {
    amount: Number(numericAmount.toFixed(2)),
    currencyCode: normalizedCurrencyCode,
    description: normalizedDescription,
    category: normalizedCategory,
    type: normalizedType,
    paymentMethod: normalizedPaymentMethod,
    date,
  };
}

function sanitizeUser(user) {
  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        monthlySalary: Number(user.monthlySalary ?? 0),
        incomeCurrencyCode: user.incomeCurrencyCode ?? "USD",
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

function resolveDisplayCurrencyCode({ requestedDisplayCurrency, currentUser, partnerUser }) {
  if (requestedDisplayCurrency && validateCurrencyCode(requestedDisplayCurrency)) {
    return String(requestedDisplayCurrency).trim().toUpperCase();
  }

  return resolveCurrencyCode(
    currentUser?.incomeCurrencyCode || partnerUser?.incomeCurrencyCode || "USD",
  );
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatNotificationMoney(amount, currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: resolveCurrencyCode(currencyCode || "USD"),
    maximumFractionDigits: 2,
  }).format(Number(amount ?? 0));
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
        currencyCode: user.incomeCurrencyCode ?? "USD",
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
      currencyCode: transaction.currencyCode ?? "USD",
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

async function buildMonthlySummary({
  budgetRepository,
  exchangeRateService,
  currentUser,
  partnerUser,
  month = null,
  displayCurrency = null,
}) {
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
  const resolvedDisplayCurrency = resolveDisplayCurrencyCode({
    requestedDisplayCurrency: displayCurrency,
    currentUser,
    partnerUser,
  });
  const couple =
    currentUser && partnerUser
      ? await budgetRepository.getCoupleForUser(currentUser.id)
      : null;
  const converter = await createCurrencyConverter({
    exchangeRateService,
    displayCurrency: resolvedDisplayCurrency,
    coupleId: couple?.id ?? null,
    date: from,
    sourceCurrencies: [
      currentUser.incomeCurrencyCode,
      partnerUser.incomeCurrencyCode,
      ...transactions.map((transaction) => transaction.currencyCode),
    ],
  });
  const monthlyTransactions = transactions.filter(
    (transaction) => transaction.date >= from && transaction.date <= to,
  );
  const householdIncome = [currentUser, partnerUser].reduce((sum, user) => {
    return sum + converter.convert(user.monthlySalary ?? 0, user.incomeCurrencyCode);
  }, 0);
  const cashIncome = [currentUser, partnerUser].reduce((sum, user) => {
    return sum + converter.convert(user.salaryCashAmount ?? 0, user.incomeCurrencyCode);
  }, 0);
  const cardIncome = [currentUser, partnerUser].reduce((sum, user) => {
    return sum + converter.convert(user.salaryCardAmount ?? 0, user.incomeCurrencyCode);
  }, 0);
  const totalExpenses = monthlyTransactions.reduce(
    (sum, transaction) => sum + convertTransactionWithSnapshot(transaction, converter),
    0,
  );
  const cashSpent = monthlyTransactions.reduce((sum, transaction) => {
    return (
      sum +
      (transaction.paymentMethod === "cash"
        ? convertTransactionWithSnapshot(transaction, converter)
        : 0)
    );
  }, 0);
  const cardSpent = monthlyTransactions.reduce((sum, transaction) => {
    return (
      sum +
      (transaction.paymentMethod === "card"
        ? convertTransactionWithSnapshot(transaction, converter)
        : 0)
    );
  }, 0);
  const remainingBudget = roundCurrency(householdIncome - totalExpenses);
  const cashRemaining = roundCurrency(cashIncome - cashSpent);
  const cardRemaining = roundCurrency(cardIncome - cardSpent);
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
  }).map((event) => ({
    ...event,
    sourceCurrencyCode: event.currencyCode ?? currentUser.incomeCurrencyCode,
    amount: converter.convert(event.amount ?? 0, event.currencyCode ?? currentUser.incomeCurrencyCode),
    displayCurrencyCode: converter.displayCurrencyCode,
  }));

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
    displayCurrencyCode: converter.displayCurrencyCode,
    householdIncome: roundCurrency(householdIncome),
    cashIncome: roundCurrency(cashIncome),
    cardIncome: roundCurrency(cardIncome),
    totalExpenses: roundCurrency(totalExpenses),
    cashSpent: roundCurrency(cashSpent),
    cardSpent: roundCurrency(cardSpent),
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

async function buildSavingsSummary({
  budgetRepository,
  exchangeRateService,
  currentUser,
  partnerUser,
  displayCurrency = null,
}) {
  const users = [currentUser, partnerUser].filter(Boolean);
  const budgetWindow = getBudgetWindowForUsers(users);
  const couple =
    partnerUser && currentUser
      ? await budgetRepository.getCoupleForUser(currentUser.id)
      : null;
  const goals = couple ? await budgetRepository.listSavingsGoalsForCouple(couple.id) : [];
  const entries = await budgetRepository.listSavingsEntriesForUserIds({
    userIds: users.map((user) => user.id),
    days: 3650,
  });
  const resolvedDisplayCurrency = resolveDisplayCurrencyCode({
    requestedDisplayCurrency: displayCurrency,
    currentUser,
    partnerUser,
  });
  const converter = await createCurrencyConverter({
    exchangeRateService,
    displayCurrency: resolvedDisplayCurrency,
    coupleId: couple?.id ?? null,
    date: budgetWindow.from,
    sourceCurrencies: [
      ...users.map((user) => user.incomeCurrencyCode),
      ...entries.map((entry) => entry.currencyCode),
      ...goals.map((goal) => goal.currencyCode),
    ],
  });
  const currentWindowEntries = entries.filter(
    (entry) => entry.date >= budgetWindow.from && entry.date <= budgetWindow.to,
  );
  const totalSaved = currentWindowEntries.reduce(
    (sum, entry) => sum + converter.convert(entry.amount ?? 0, entry.currencyCode),
    0,
  );
  const householdTarget = users.reduce(
    (sum, user) => sum + converter.convert(user.monthlySavingsTarget ?? 0, user.incomeCurrencyCode),
    0,
  );
  const allTimeSaved = entries.reduce(
    (sum, entry) => sum + converter.convert(entry.amount ?? 0, entry.currencyCode),
    0,
  );
  const remainingToGoal = Math.max(0, roundCurrency(householdTarget - totalSaved));
  const targetProgressPct =
    householdTarget > 0
      ? Number(Math.min(100, ((totalSaved / householdTarget) * 100)).toFixed(1))
      : 0;
  const suggestedDailySave =
    budgetWindow.daysRemaining > 0
      ? Number((remainingToGoal / budgetWindow.daysRemaining).toFixed(2))
      : 0;
  const goalsWithProgress = goals.map((goal) => {
    const convertedTargetAmount = converter.convert(goal.targetAmount ?? 0, goal.currencyCode);
    const totalSavedForGoal = entries
      .filter((entry) => Number(entry.savingsGoalId) === Number(goal.id))
      .reduce(
        (sum, entry) => sum + converter.convert(entry.amount ?? 0, entry.currencyCode),
        0,
      );
    const progressPct =
      convertedTargetAmount > 0
        ? Number(Math.min(100, (totalSavedForGoal / convertedTargetAmount) * 100).toFixed(1))
        : 0;
    const remainingAmount = Math.max(0, roundCurrency(convertedTargetAmount - totalSavedForGoal));
    const milestoneData = buildGoalMilestones({ progressPct });

    return {
      ...goal,
      targetAmount: convertedTargetAmount,
      totalSaved: roundCurrency(totalSavedForGoal),
      remainingAmount,
      progressPct,
      suggestedMonthlyContribution: buildSuggestedMonthlyContribution({
        ...goal,
        remainingAmount,
      }),
      ...milestoneData,
    };
  });

  return {
    period: budgetWindow,
    displayCurrencyCode: converter.displayCurrencyCode,
    householdSavingsTarget: roundCurrency(householdTarget),
    totalSavedThisWindow: roundCurrency(totalSaved),
    allTimeSaved: roundCurrency(allTimeSaved),
    remainingToGoal,
    targetProgressPct,
    suggestedDailySave,
    goals: goalsWithProgress,
    longTermGoal: goalsWithProgress[0] ?? null,
    entries: entries.slice(0, 20).map((entry) => ({
      ...entry,
      displayAmount: converter.convert(entry.amount ?? 0, entry.currencyCode),
      displayCurrencyCode: converter.displayCurrencyCode,
    })),
    users: users.map((user) => ({
      userId: user.id,
      name: user.name,
      incomeCurrencyCode: user.incomeCurrencyCode,
      monthlySavingsTarget: converter.convert(
        user.monthlySavingsTarget ?? 0,
        user.incomeCurrencyCode,
      ),
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

async function createPartnerExpenseNotification({
  budgetRepository,
  actor,
  transaction,
  previousTransaction = null,
}) {
  const couple = await budgetRepository.getCoupleForUser(actor.id);
  if (!couple) {
    return null;
  }

  const partner = getPartner(couple, actor.id);
  if (!partner) {
    return null;
  }

  let type = "expense_added";
  let title = `${actor.name} added an expense`;
  let body = transaction
    ? `${actor.name} added ${formatNotificationMoney(
        transaction.amount,
        transaction.currencyCode,
      )} for ${transaction.category.toLowerCase()}.`
    : "";

  if (previousTransaction && transaction) {
    type = "expense_edited";
    title = `${actor.name} edited an expense`;
    body = `${actor.name} edited ${transaction.category.toLowerCase()} from ${formatNotificationMoney(
      previousTransaction.amount,
      previousTransaction.currencyCode,
    )} to ${formatNotificationMoney(transaction.amount, transaction.currencyCode)}.`;
  }

  if (previousTransaction && !transaction) {
    type = "expense_deleted";
    title = `${actor.name} deleted an expense`;
    body = `${actor.name} deleted ${formatNotificationMoney(
      previousTransaction.amount,
      previousTransaction.currencyCode,
    )} from ${previousTransaction.category.toLowerCase()}.`;
  }

  return budgetRepository.createActivityNotification({
    recipientId: partner.id,
    actorId: actor.id,
    type,
    title,
    body,
  });
}

function createApp({
  app = express(),
  budgetRepository,
  insightsService,
  exchangeRateService = null,
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

  const resolvedExchangeRateService =
    exchangeRateService ?? createExchangeRateService({ budgetRepository });
  const authService = createAuthService({ jwtSecret: effectiveJwtSecret });
  const requireAuth = createRequireAuth({ authService, budgetRepository });

  if (jsonParser) {
    app.use(jsonParser);
  }

  app.get("/health", (_request, response) => {
    sendData(response, 200, { status: "ok" });
  });

  app.get(
    "/api/exchange-rate",
    asyncHandler(async (request, response) => {
      const from = String(request.query.from ?? "")
        .trim()
        .toUpperCase();
      const to = String(request.query.to ?? "")
        .trim()
        .toUpperCase();

      if (!validateCurrencyCode(from) || !validateCurrencyCode(to)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "from and to must be ISO 4217 currency codes.",
        );
      }

      const rate = await resolvedExchangeRateService.getRate({ from, to });
      sendData(response, 200, rate);
    }),
  );

  app.get(
    "/api/mmk-rate",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before setting a shared MMK rate.",
        );
      }

      const now = new Date();
      const { year, month } = parseYearMonthInput(
        request.query.year ?? now.getUTCFullYear(),
        request.query.month ?? now.getUTCMonth() + 1,
      );
      const rate = await budgetRepository.getCoupleMmkMonthlyRate({
        coupleId: couple.id,
        year,
        month,
      });

      sendData(response, 200, {
        year,
        month,
        rate,
      });
    }),
  );

  app.put(
    "/api/mmk-rate",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before setting a shared MMK rate.",
        );
      }

      const { year, month } = parseYearMonthInput(
        request.body?.year,
        request.body?.month,
      );
      const rateSource = String(request.body?.rateSource ?? "")
        .trim()
        .toLowerCase();

      if (rateSource !== "kbz" && rateSource !== "custom") {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "rateSource must be 'kbz' or 'custom'.",
        );
      }

      let resolvedRate = null;

      if (rateSource === "kbz") {
        const kbzRate = await resolvedExchangeRateService.getKbzMmkRate();
        resolvedRate = roundRate(kbzRate.rate);
      } else {
        resolvedRate = parseMoney(request.body?.rate);
      }

      if (!Number.isFinite(resolvedRate) || resolvedRate <= 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "rate must be a positive number.",
        );
      }

      const savedRate = await budgetRepository.upsertCoupleMmkMonthlyRate({
        coupleId: couple.id,
        year,
        month,
        rateSource,
        rate: resolvedRate,
      });

      sendData(response, 200, { rate: savedRate });
    }),
  );

  app.post(
    "/api/auth/register",
    asyncHandler(async (request, response) => {
      const {
        name,
        email,
        password,
        monthlySalary,
        incomeCurrencyCode,
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
      const normalizedIncomeCurrencyCode = resolveCurrencyCode(incomeCurrencyCode || "USD");
      const existingUser = await budgetRepository.getUserAuthByEmail(normalizedEmail);
      if (existingUser) {
        throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");
      }

      const passwordHash = await authService.hashPassword(password);
      let user;

      try {
        user = await budgetRepository.createUser({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          monthlySalary: incomeAllocation.monthlySalary ?? normalizedMonthlySalary,
          incomeCurrencyCode: normalizedIncomeCurrencyCode,
          salaryPaymentMethod: incomeAllocation.salaryPaymentMethod,
          salaryCashAmount: incomeAllocation.salaryCashAmount,
          salaryCardAmount: incomeAllocation.salaryCardAmount,
          salaryCashAllocationPct: incomeAllocation.salaryCashAllocationPct,
          salaryCardAllocationPct: incomeAllocation.salaryCardAllocationPct,
          incomeDayOfMonth: normalizedIncomeDay,
          monthlySavingsTarget: normalizedSavingsTarget,
        });
      } catch (error) {
        const duplicateTargets = Array.isArray(error?.meta?.target)
          ? error.meta.target
          : [String(error?.meta?.target ?? "")];

        if (error?.code === "P2002" && duplicateTargets.some((target) => target.includes("email"))) {
          throw new HttpError(
            409,
            "EMAIL_TAKEN",
            "An account with this email already exists.",
          );
        }

        throw error;
      }

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
      const coachProfile = couple
        ? await budgetRepository.getCoupleCoachProfile(couple.id)
        : null;
      const partnerUser = couple ? getPartner(couple, request.user.id) : null;
      const [inviteNotifications, activityNotifications] = await Promise.all([
        budgetRepository.listPendingCoupleInvitesForUser(request.user.id),
        budgetRepository.listActivityNotificationsForUser(request.user.id),
      ]);
      const [recurringBills, goals] = couple
        ? await Promise.all([
            budgetRepository.listRecurringBillsForCouple(couple.id),
            budgetRepository.listSavingsGoalsForCouple(couple.id),
          ])
        : [[], []];

      sendData(response, 200, {
        user: sanitizeUser(request.user),
        couple,
        coachProfile,
        setupChecklist: buildSetupChecklist({
          currentUser: request.user,
          partnerUser,
          coachProfile,
          recurringBills,
          goals,
        }),
        notifications: {
          ...inviteNotifications,
          activity: activityNotifications,
        },
      });
    }),
  );

  app.get(
    "/api/coach-profile",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before opening the coach setup.",
        );
      }

      const profile = await budgetRepository.getCoupleCoachProfile(couple.id);
      sendData(response, 200, { profile });
    }),
  );

  app.put(
    "/api/coach-profile",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before saving the coach setup.",
        );
      }

      const profile = await budgetRepository.upsertCoupleCoachProfile({
        coupleId: couple.id,
        ...normalizeCoachProfilePayload(request.body),
      });

      sendData(response, 200, { profile });
    }),
  );

  app.patch(
    "/api/profile/income",
    requireAuth,
    asyncHandler(async (request, response) => {
      const {
        monthlySalary,
        incomeCurrencyCode,
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
        incomeCurrencyCode: resolveCurrencyCode(
          incomeCurrencyCode || request.user.incomeCurrencyCode || "USD",
        ),
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

      const invite = await budgetRepository.linkCoupleByPartnerEmail({
        userId: request.user.id,
        partnerEmail: partner.email,
      });

      sendData(response, 201, {
        invite,
        message: "Invite sent. Your partner needs to accept it before you are linked.",
      });
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

      const invite = await budgetRepository.linkCoupleByPartnerEmail({
        userId: request.user.id,
        partnerEmail: normalizedPartnerEmail,
      });

      sendData(response, 201, {
        invite,
        message: "Invite sent. Your partner needs to accept it before you are linked.",
      });
    }),
  );

  app.get(
    "/api/notifications",
    requireAuth,
    asyncHandler(async (request, response) => {
      const [inviteNotifications, activityNotifications] = await Promise.all([
        budgetRepository.listPendingCoupleInvitesForUser(request.user.id),
        budgetRepository.listActivityNotificationsForUser(request.user.id),
      ]);

      sendData(response, 200, {
        ...inviteNotifications,
        activity: activityNotifications,
      });
    }),
  );

  app.post(
    "/api/couples/invites/:inviteId/respond",
    requireAuth,
    asyncHandler(async (request, response) => {
      const inviteId = Number.parseInt(request.params.inviteId, 10);
      const action = String(request.body?.action ?? "").trim().toLowerCase();

      if (!Number.isInteger(inviteId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "inviteId must be an integer.");
      }

      if (action !== "accept" && action !== "decline") {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "action must be 'accept' or 'decline'.",
        );
      }

      const result = await budgetRepository.respondToCoupleInvite({
        inviteId,
        userId: request.user.id,
        action,
      });

      sendData(response, 200, result);
    }),
  );

  app.get(
    "/api/dashboard",
    requireAuth,
    asyncHandler(async (request, response) => {
      const days = Number(request.query.days ?? 30);
      const displayCurrency = request.query.displayCurrency?.trim();
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "The authenticated user is not linked to a couple yet.",
        );
      }

      await materializeRecurringBills({
        budgetRepository,
        exchangeRateService: resolvedExchangeRateService,
        couple,
        throughDate: new Date().toISOString().slice(0, 10),
      });

      const snapshot = await buildBudgetSnapshot({
        budgetRepository,
        exchangeRateService: resolvedExchangeRateService,
        coupleId: couple.id,
        days: Number.isFinite(days) && days > 0 ? days : 30,
        displayCurrency,
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
      const displayCurrency = request.query.displayCurrency?.trim();
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });

      await materializeRecurringBills({
        budgetRepository,
        exchangeRateService: resolvedExchangeRateService,
        couple,
        throughDate: new Date().toISOString().slice(0, 10),
      });

      const summary = await buildMonthlySummary({
        budgetRepository,
        exchangeRateService: resolvedExchangeRateService,
        currentUser: request.user,
        partnerUser,
        month: month || null,
        displayCurrency,
      });

      sendData(response, 200, summary);
    }),
  );

  app.post(
    "/api/transactions",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      if (!couple) {
        throw new HttpError(
          409,
          "COUPLE_REQUIRED",
          "Link a couple before adding shared expenses.",
        );
      }

      const normalizedTransaction = normalizeTransactionPayload(request.body);
      const sourceCurrencyCode =
        normalizedTransaction.currencyCode ??
        resolveCurrencyCode(request.user.incomeCurrencyCode || "USD");
      const displayCurrencyCode = resolveDisplayCurrencyCode({
        requestedDisplayCurrency: request.body?.displayCurrencyCode,
        currentUser: request.user,
      });
      const exchangeSnapshot = await buildMmkTransactionSnapshot({
        exchangeRateService: resolvedExchangeRateService,
        coupleId: couple.id,
        amount: normalizedTransaction.amount,
        sourceCurrencyCode,
        targetCurrencyCode: displayCurrencyCode,
        transactionDate: normalizedTransaction.date,
      });

      const transaction = await budgetRepository.addTransaction({
        userId: request.user.id,
        ...normalizedTransaction,
        currencyCode: sourceCurrencyCode,
        ...exchangeSnapshot,
      });
      const notification = await createPartnerExpenseNotification({
        budgetRepository,
        actor: request.user,
        transaction,
      });

      sendData(response, 201, {
        transaction,
        coupleId: couple.id,
        notification,
      });
    }),
  );

  app.patch(
    "/api/transactions/:transactionId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const transactionId = Number.parseInt(request.params.transactionId, 10);

      if (!Number.isInteger(transactionId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "transactionId must be an integer.");
      }

      const normalizedTransaction = normalizeTransactionPayload(request.body);
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          409,
          "COUPLE_REQUIRED",
          "Link a couple before editing shared expenses.",
        );
      }

      const sourceCurrencyCode =
        normalizedTransaction.currencyCode ??
        resolveCurrencyCode(request.user.incomeCurrencyCode || "USD");
      const displayCurrencyCode = resolveDisplayCurrencyCode({
        requestedDisplayCurrency: request.body?.displayCurrencyCode,
        currentUser: request.user,
      });
      const existingTransaction = await budgetRepository.getUserOwnedTransaction({
        transactionId,
        userId: request.user.id,
      });

      if (!existingTransaction) {
        throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
      }

      let exchangeSnapshot = null;
      const canReuseExistingMmkSnapshot =
        existingTransaction.currencyCode === sourceCurrencyCode &&
        existingTransaction.conversionAnchorCurrencyCode === "USD" &&
        Number.isFinite(Number(existingTransaction.conversionAnchorAmount)) &&
        Number.isFinite(Number(existingTransaction.exchangeRateUsed)) &&
        Number(existingTransaction.amount) > 0;

      if (canReuseExistingMmkSnapshot && isMmkInvolved(sourceCurrencyCode, displayCurrencyCode)) {
        const anchorPerUnit =
          Number(existingTransaction.conversionAnchorAmount) /
          Number(existingTransaction.amount);
        const anchorAmount = roundCurrency(normalizedTransaction.amount * anchorPerUnit);
        const convertedAmount =
          displayCurrencyCode === "USD"
            ? anchorAmount
            : displayCurrencyCode === MMK_CURRENCY_CODE
              ? roundCurrency(anchorAmount * Number(existingTransaction.exchangeRateUsed))
              : roundCurrency(
                  anchorAmount *
                    Number(
                      (
                        await resolvedExchangeRateService.getRate({
                          from: "USD",
                          to: displayCurrencyCode,
                          coupleId: couple.id,
                          date: normalizedTransaction.date,
                        })
                      ).rate ?? 1,
                    ),
                );

        exchangeSnapshot = {
          convertedAmount,
          convertedCurrencyCode: displayCurrencyCode,
          conversionAnchorAmount: anchorAmount,
          conversionAnchorCurrencyCode: "USD",
          exchangeRateUsed: roundRate(existingTransaction.exchangeRateUsed),
          exchangeRateSource: existingTransaction.exchangeRateSource ?? "custom",
        };
      } else {
        exchangeSnapshot = await buildMmkTransactionSnapshot({
          exchangeRateService: resolvedExchangeRateService,
          coupleId: couple.id,
          amount: normalizedTransaction.amount,
          sourceCurrencyCode,
          targetCurrencyCode: displayCurrencyCode,
          transactionDate: normalizedTransaction.date,
        });
      }

      const result = await budgetRepository.updateUserTransaction({
        transactionId,
        userId: request.user.id,
        ...normalizedTransaction,
        currencyCode: sourceCurrencyCode,
        ...exchangeSnapshot,
      });
      const notification = await createPartnerExpenseNotification({
        budgetRepository,
        actor: request.user,
        transaction: result.transaction,
        previousTransaction: result.previousTransaction,
      });

      sendData(response, 200, {
        transaction: result.transaction,
        previousTransaction: result.previousTransaction,
        notification,
      });
    }),
  );

  app.delete(
    "/api/transactions/:transactionId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const transactionId = Number.parseInt(request.params.transactionId, 10);

      if (!Number.isInteger(transactionId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "transactionId must be an integer.");
      }

      const transaction = await budgetRepository.deleteUserTransaction({
        transactionId,
        userId: request.user.id,
      });
      const notification = await createPartnerExpenseNotification({
        budgetRepository,
        actor: request.user,
        transaction: null,
        previousTransaction: transaction,
      });

      sendData(response, 200, { transaction, notification });
    }),
  );

  app.get(
    "/api/transactions",
    requireAuth,
    asyncHandler(async (request, response) => {
      const days = Number(request.query.days ?? 30);
      const month = request.query.month?.trim();
      const displayCurrency = resolveDisplayCurrencyCode({
        requestedDisplayCurrency: request.query.displayCurrency?.trim(),
        currentUser: request.user,
      });
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

      await materializeRecurringBills({
        budgetRepository,
        exchangeRateService: resolvedExchangeRateService,
        couple,
        throughDate: new Date().toISOString().slice(0, 10),
      });

      const monthWindow = month ? getCalendarMonthWindow(month) : null;
      const transactions = await budgetRepository.listCoupleTransactions({
        coupleId: couple.id,
        days: Number.isFinite(days) && days > 0 ? days : 30,
        fromDate: monthWindow?.from,
        toDate: monthWindow?.to,
      });
      const converter = await createCurrencyConverter({
        exchangeRateService: resolvedExchangeRateService,
        displayCurrency,
        coupleId: couple.id,
        date: monthWindow?.from ?? new Date().toISOString().slice(0, 10),
        sourceCurrencies: transactions.map((transaction) => transaction.currencyCode),
      });

      sendData(
        response,
        200,
        {
          displayCurrencyCode: displayCurrency,
          transactions: transactions.map((transaction) => ({
            ...transaction,
            displayAmount: convertTransactionWithSnapshot(transaction, converter),
            displayCurrencyCode: displayCurrency,
          })),
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
      let coachProfile = null;

      try {
        const days = Number(request.query.days ?? 30);
        const displayCurrency = request.query.displayCurrency?.trim();
        partnerUser = await resolvePartnerUser({
          budgetRepository,
          user: request.user,
        });
        const couple = await budgetRepository.getCoupleForUser(request.user.id);
        await materializeRecurringBills({
          budgetRepository,
          exchangeRateService: resolvedExchangeRateService,
          couple,
          throughDate: new Date().toISOString().slice(0, 10),
        });
        coachProfile = couple
          ? await budgetRepository.getCoupleCoachProfile(couple.id)
          : null;

        const result = await insightsService.getAiInsights({
          currentUser: request.user,
          partnerUser,
          days: Number.isFinite(days) && days > 0 ? days : 30,
          displayCurrency,
          coachProfile,
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
        exchangeRateService: resolvedExchangeRateService,
        currentUser: request.user,
        partnerUser,
        displayCurrency: request.query.displayCurrency?.trim(),
      });

      sendData(response, 200, savings);
    }),
  );

  app.post(
    "/api/savings/goal",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const title = String(request.body?.title ?? "").trim();
      const targetAmount = parseMoney(request.body?.targetAmount);
      const targetDate = request.body?.targetDate?.trim?.() || null;
      const currencyCode = resolveCurrencyCode(
        request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
      );

      if (!couple || !partnerUser) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before setting a shared savings goal.",
        );
      }

      if (!title) {
        throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
      }

      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "targetAmount must be a positive number.",
        );
      }

      if (targetDate && !validateIsoDate(targetDate)) {
        throw new HttpError(400, "VALIDATION_ERROR", "targetDate must use YYYY-MM-DD.");
      }

      const goal = await budgetRepository.createSavingsGoalForCouple({
        coupleId: couple.id,
        title,
        targetAmount,
        currencyCode,
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : null,
      });

      sendData(response, 200, { goal });
    }),
  );

  app.patch(
    "/api/savings/goal/:goalId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const goalId = Number.parseInt(request.params.goalId, 10);
      const title = String(request.body?.title ?? "").trim();
      const targetAmount = parseMoney(request.body?.targetAmount);
      const targetDate = request.body?.targetDate?.trim?.() || null;
      const currencyCode = resolveCurrencyCode(
        request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
      );

      if (!Number.isInteger(goalId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "goalId must be an integer.");
      }

      if (!couple || !partnerUser) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before editing a shared savings goal.",
        );
      }

      if (!title) {
        throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
      }

      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "targetAmount must be a positive number.",
        );
      }

      if (targetDate && !validateIsoDate(targetDate)) {
        throw new HttpError(400, "VALIDATION_ERROR", "targetDate must use YYYY-MM-DD.");
      }

      const goal = await budgetRepository.updateSavingsGoalForCouple({
        goalId,
        coupleId: couple.id,
        title,
        targetAmount,
        currencyCode,
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : null,
      });

      sendData(response, 200, { goal });
    }),
  );

  app.delete(
    "/api/savings/goal/:goalId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const goalId = Number.parseInt(request.params.goalId, 10);

      if (!Number.isInteger(goalId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "goalId must be an integer.");
      }

      if (!couple || !partnerUser) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before removing a shared savings goal.",
        );
      }

      const goal = await budgetRepository.deleteSavingsGoalForCouple({
        goalId,
        coupleId: couple.id,
      });

      sendData(response, 200, { goal });
    }),
  );

  app.post(
    "/api/savings",
    requireAuth,
    asyncHandler(async (request, response) => {
      const amount = Number(request.body?.amount);
      const note = request.body?.note?.trim();
      const date = request.body?.date;
      const currencyCode = resolveCurrencyCode(
        request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
      );
      const rawSavingsGoalId = request.body?.savingsGoalId;
      const savingsGoalId =
        rawSavingsGoalId === undefined || rawSavingsGoalId === null || rawSavingsGoalId === ""
          ? null
          : Number.parseInt(String(rawSavingsGoalId), 10);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
      }

      if (!note) {
        throw new HttpError(400, "VALIDATION_ERROR", "note is required.");
      }

      if (!validateIsoDate(date)) {
        throw new HttpError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD.");
      }

      if (savingsGoalId !== null) {
        if (!Number.isInteger(savingsGoalId)) {
          throw new HttpError(
            400,
            "VALIDATION_ERROR",
            "savingsGoalId must be an integer when provided.",
          );
        }

        const couple = await budgetRepository.getCoupleForUser(request.user.id);
        if (!couple) {
          throw new HttpError(
            404,
            "COUPLE_NOT_FOUND",
            "Link both partners before assigning savings to a shared goal.",
          );
        }

        const goals = await budgetRepository.listSavingsGoalsForCouple(couple.id);
        if (!goals.some((goal) => goal.id === savingsGoalId)) {
          throw new HttpError(
            404,
            "SAVINGS_GOAL_NOT_FOUND",
            "Selected savings goal was not found for this couple.",
          );
        }
      }

      let resolvedSavingsGoalId = savingsGoalId;
      if (resolvedSavingsGoalId === null) {
        const couple = await budgetRepository.getCoupleForUser(request.user.id);
        if (couple) {
          const goals = await budgetRepository.listSavingsGoalsForCouple(couple.id);
          if (goals.length === 1) {
            resolvedSavingsGoalId = goals[0].id;
          }
        }
      }

      const entry = await budgetRepository.addSavingsEntry({
        userId: request.user.id,
        savingsGoalId: resolvedSavingsGoalId,
        amount,
        currencyCode,
        note,
        date,
      });

      sendData(response, 201, { entry });
    }),
  );

  app.get(
    "/api/recurring-bills",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before opening recurring bills.",
        );
      }

      const bills = await budgetRepository.listRecurringBillsForCouple(couple.id);
      sendData(response, 200, { bills });
    }),
  );

  app.post(
    "/api/recurring-bills",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before adding recurring bills.",
        );
      }

      const payload = normalizeRecurringBillPayload(request.body, request.user);
      const bill = await budgetRepository.createRecurringBill({
        coupleId: couple.id,
        userId: request.user.id,
        ...payload,
      });

      sendData(response, 201, { bill });
    }),
  );

  app.patch(
    "/api/recurring-bills/:billId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const recurringBillId = Number.parseInt(request.params.billId, 10);

      if (!Number.isInteger(recurringBillId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "billId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before editing recurring bills.",
        );
      }

      const payload = normalizeRecurringBillPayload(request.body, request.user);
      const bill = await budgetRepository.updateRecurringBill({
        recurringBillId,
        coupleId: couple.id,
        ...payload,
      });

      sendData(response, 200, { bill });
    }),
  );

  app.delete(
    "/api/recurring-bills/:billId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const recurringBillId = Number.parseInt(request.params.billId, 10);

      if (!Number.isInteger(recurringBillId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "billId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before deleting recurring bills.",
        );
      }

      const bill = await budgetRepository.deleteRecurringBill({
        recurringBillId,
        coupleId: couple.id,
      });

      sendData(response, 200, { bill });
    }),
  );

  app.get(
    "/api/household-rules",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before opening household rules.",
        );
      }

      const rules = await budgetRepository.listHouseholdRulesForCouple(couple.id);
      sendData(response, 200, { rules });
    }),
  );

  app.post(
    "/api/household-rules",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before adding household rules.",
        );
      }

      const payload = normalizeHouseholdRulePayload(request.body, request.user);
      const rule = await budgetRepository.createHouseholdRule({
        coupleId: couple.id,
        ...payload,
      });

      sendData(response, 201, { rule });
    }),
  );

  app.patch(
    "/api/household-rules/:ruleId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const ruleId = Number.parseInt(request.params.ruleId, 10);

      if (!Number.isInteger(ruleId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "ruleId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before editing household rules.",
        );
      }

      const payload = normalizeHouseholdRulePayload(request.body, request.user);
      const rule = await budgetRepository.updateHouseholdRule({
        ruleId,
        coupleId: couple.id,
        ...payload,
      });

      sendData(response, 200, { rule });
    }),
  );

  app.delete(
    "/api/household-rules/:ruleId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const ruleId = Number.parseInt(request.params.ruleId, 10);

      if (!Number.isInteger(ruleId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "ruleId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before deleting household rules.",
        );
      }

      const rule = await budgetRepository.deleteHouseholdRule({
        ruleId,
        coupleId: couple.id,
      });

      sendData(response, 200, { rule });
    }),
  );

  app.get(
    "/api/push-devices",
    requireAuth,
    asyncHandler(async (request, response) => {
      const devices = await budgetRepository.listPushDevicesForUser(request.user.id);
      sendData(response, 200, { devices });
    }),
  );

  app.post(
    "/api/push-devices",
    requireAuth,
    asyncHandler(async (request, response) => {
      const platform = String(request.body?.platform ?? "").trim().toLowerCase();
      const token = String(request.body?.token ?? "").trim();
      const enabled = parseBoolean(request.body?.enabled, true);

      if (!platform) {
        throw new HttpError(400, "VALIDATION_ERROR", "platform is required.");
      }

      if (!token) {
        throw new HttpError(400, "VALIDATION_ERROR", "token is required.");
      }

      const device = await budgetRepository.registerPushDevice({
        userId: request.user.id,
        platform,
        token,
        enabled,
      });

      sendData(response, 201, { device });
    }),
  );

  app.get(
    "/api/planner",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const coachProfile = couple
        ? await budgetRepository.getCoupleCoachProfile(couple.id)
        : null;
      const planner = await buildPlannerData({
        budgetRepository,
        exchangeRateService: resolvedExchangeRateService,
        currentUser: request.user,
        partnerUser,
        coachProfile,
        displayCurrency: request.query.displayCurrency?.trim(),
      });

      sendData(response, 200, planner);
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
