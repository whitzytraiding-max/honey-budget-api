/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { resolveCurrencyCode, roundCurrency } from "../services/currencyConversionService.js";
import { MMK_CURRENCY_CODE } from "../services/exchangeRateService.js";
import { validateCurrencyCode, roundRate } from "./parsers.js";

export function sanitizeUser(user) {
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
        subscriptionStatus: user.subscriptionStatus ?? "free",
        subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
        subscriptionProvider: user.subscriptionProvider ?? null,
        createdAt: user.createdAt,
      }
    : null;
}

export function getPartner(couple, userId) {
  return couple.userOne.id === userId ? couple.userTwo : couple.userOne;
}

export function isMmkInvolved(...codes) {
  return codes.some((code) => resolveCurrencyCode(code) === MMK_CURRENCY_CODE);
}

export function resolveDisplayCurrencyCode({ requestedDisplayCurrency, currentUser, partnerUser }) {
  if (requestedDisplayCurrency && validateCurrencyCode(requestedDisplayCurrency)) {
    return String(requestedDisplayCurrency).trim().toUpperCase();
  }

  return resolveCurrencyCode(
    currentUser?.incomeCurrencyCode || partnerUser?.incomeCurrencyCode || "USD",
  );
}

export function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function formatNotificationMoney(amount, currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: resolveCurrencyCode(currencyCode || "USD"),
    maximumFractionDigits: 2,
  }).format(Number(amount ?? 0));
}

export function createUtcDate(year, monthIndex, dayOfMonth) {
  return new Date(Date.UTC(year, monthIndex, dayOfMonth));
}

export function addMonthsUtc(date, months) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    date.getUTCDate(),
  );
}

export function clampIncomeDay(day) {
  const numericDay = Number(day);
  if (!Number.isInteger(numericDay)) {
    return 1;
  }

  return Math.max(1, Math.min(28, numericDay));
}

export function getCurrentMonthWindow() {
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

export function getBudgetWindowForUsers(users) {
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

export function getCalendarMonthWindow(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
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

export function buildIncomeEvents(users, fromDate, limit) {
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

export function buildRecurringPaymentEvents(transactions, fromDate) {
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

export function buildUpcomingEvents({ currentUser, partnerUser, transactions }) {
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

export function buildGoalMilestones(goal) {
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

export function buildSuggestedMonthlyContribution(goal) {
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

export function buildStaticInsightsResponse(currentUser, partnerUser) {
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

export function getMonthSpan(startIsoDate, endIsoDate) {
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

export function buildOccurrenceDate(year, month, dayOfMonth) {
  const day = String(Math.max(1, Math.min(28, Number(dayOfMonth) || 1))).padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${day}`;
}

export function computeNextRecurringDate({ recurringBill, todayIsoDate }) {
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

export function buildSetupChecklist({
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

export function buildRecurringBillStatus({ recurringBill, summary, converter }) {
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

export function buildConflictRiskAreas({ summary, dashboard, recurringBills, rules }) {
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

export function buildTalkPrompts({ recurringBills, rules, coachProfile, summary }) {
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
