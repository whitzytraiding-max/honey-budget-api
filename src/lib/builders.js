/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { HttpError } from "./http.js";
import {
  resolveCurrencyCode,
  roundCurrency,
  convertTransactionWithSnapshot,
  createCurrencyConverter,
} from "../services/currencyConversionService.js";
import { MMK_CURRENCY_CODE } from "../services/exchangeRateService.js";
import { buildBudgetSnapshot } from "../services/dashboardService.js";
import { roundRate } from "./parsers.js";
import { sendPushToUser } from "../services/pushNotificationService.js";
import {
  isMmkInvolved,
  getPartner,
  formatNotificationMoney,
  getCalendarMonthWindow,
  getBudgetWindowForUsers,
  resolveDisplayCurrencyCode,
  buildUpcomingEvents,
  buildGoalMilestones,
  buildSuggestedMonthlyContribution,
  getMonthSpan,
  buildOccurrenceDate,
  buildRecurringBillStatus,
  buildSetupChecklist,
  buildConflictRiskAreas,
  buildTalkPrompts,
} from "./helpers.js";

export async function buildMmkTransactionSnapshot({
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

export async function materializeRecurringBills({
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

export async function resolvePartnerUser({ budgetRepository, user }) {
  const partnerUserId = Number(user.partnerId);

  if (partnerUserId) {
    const partner = await budgetRepository.getUserById(partnerUserId);
    if (partner) {
      return partner;
    }
  }

  const couple = await budgetRepository.getCoupleForUser(user.id);
  if (!couple) {
    return null;
  }

  return getPartner(couple, user.id);
}

export async function buildMonthlySummary({
  budgetRepository,
  exchangeRateService,
  currentUser,
  partnerUser,
  month = null,
  displayCurrency = null,
}) {
  const activeUsers = [currentUser, partnerUser].filter(Boolean);
  const budgetWindow = month
    ? getCalendarMonthWindow(month)
    : getBudgetWindowForUsers(activeUsers);

  if (!budgetWindow) {
    throw new HttpError(400, "VALIDATION_ERROR", "month must use YYYY-MM.");
  }

  const { from, to, end, days, daysRemaining, label, anchorDay } = budgetWindow;
  const transactions = await budgetRepository.listTransactionsForUserIds({
    userIds: activeUsers.map((user) => user.id),
    days: Math.max(days, 120),
    fromDate: from,
    toDate: to,
  });
  const resolvedDisplayCurrency = resolveDisplayCurrencyCode({
    requestedDisplayCurrency: displayCurrency,
    currentUser,
    partnerUser,
  });
  const couple = partnerUser
    ? await budgetRepository.getCoupleForUser(currentUser.id)
    : null;
  const converter = await createCurrencyConverter({
    exchangeRateService,
    displayCurrency: resolvedDisplayCurrency,
    coupleId: couple?.id ?? null,
    date: from,
    sourceCurrencies: [
      ...activeUsers.map((user) => user.incomeCurrencyCode),
      ...transactions.map((transaction) => transaction.currencyCode),
    ],
  });
  const monthlyTransactions = transactions.filter(
    (transaction) => transaction.date >= from && transaction.date <= to,
  );
  const householdIncome = activeUsers.reduce((sum, user) => {
    return sum + converter.convert(user.monthlySalary ?? 0, user.incomeCurrencyCode);
  }, 0);
  const cashIncome = activeUsers.reduce((sum, user) => {
    return sum + converter.convert(user.salaryCashAmount ?? 0, user.incomeCurrencyCode);
  }, 0);
  const cardIncome = activeUsers.reduce((sum, user) => {
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

export async function buildSavingsSummary({
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
  const goals = couple
    ? await budgetRepository.listSavingsGoalsForCouple(couple.id)
    : await budgetRepository.listSavingsGoalsForUser(currentUser.id);
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

export async function buildPlannerData({
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

export async function createPartnerExpenseNotification({
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

  const notification = await budgetRepository.createActivityNotification({
    recipientId: partner.id,
    actorId: actor.id,
    type,
    title,
    body,
  });

  sendPushToUser({ budgetRepository, userId: partner.id, title, body }).catch(() => {});

  return notification;
}
