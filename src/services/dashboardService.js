import { HttpError } from "../lib/http.js";
import { createCurrencyConverter, roundCurrency } from "./currencyConversionService.js";

function roundPercent(value) {
  return Number(Number(value).toFixed(1));
}

function incrementBucket(target, key, amount) {
  target[key] = roundCurrency((target[key] ?? 0) + amount);
}

function normalizeUserSpending(user, userTotals, userCategoryTotals, totalSpent) {
  const categories = Object.entries(userCategoryTotals[user.id] ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([category, amount]) => ({
      category,
      amount: roundCurrency(amount),
      sharePct: totalSpent === 0 ? 0 : roundPercent((amount / totalSpent) * 100),
    }));

  return {
    totalSpent: 0,
    cashSpent: 0,
    cardSpent: 0,
    categories,
    ...(userTotals[user.id] ?? {}),
  };
}

async function buildBudgetSnapshot({
  budgetRepository,
  exchangeRateService,
  coupleId,
  days = 30,
  displayCurrency = null,
}) {
  const couple = await budgetRepository.getCoupleById(coupleId);

  if (!couple) {
    throw new HttpError(404, "COUPLE_NOT_FOUND", "Couple not found.");
  }

  const transactions = await budgetRepository.listCoupleTransactions({ coupleId, days });
  const users = [couple.userOne, couple.userTwo];
  const resolvedDisplayCurrency = displayCurrency || users[0]?.incomeCurrencyCode || "USD";
  const converter = await createCurrencyConverter({
    exchangeRateService,
    displayCurrency: resolvedDisplayCurrency,
    sourceCurrencies: [
      ...users.map((user) => user.incomeCurrencyCode),
      ...transactions.map((transaction) => transaction.currencyCode),
    ],
  });
  const totalSalary = users.reduce(
    (sum, user) => sum + converter.convert(user.monthlySalary, user.incomeCurrencyCode),
    0,
  );
  const totalSpent = transactions.reduce(
    (sum, tx) => sum + converter.convert(tx.amount, tx.currencyCode),
    0,
  );
  const methodTotals = { cash: 0, card: 0 };
  const typeTotals = { recurring: 0, "one-time": 0 };
  const categoryTotals = {};
  const userTotals = {};
  const userCategoryTotals = {};

  for (const transaction of transactions) {
    const convertedAmount = converter.convert(transaction.amount, transaction.currencyCode);
    methodTotals[transaction.paymentMethod] += convertedAmount;
    typeTotals[transaction.type] += convertedAmount;
    incrementBucket(categoryTotals, transaction.category, convertedAmount);

    if (!userTotals[transaction.userId]) {
      userTotals[transaction.userId] = {
        totalSpent: 0,
        cashSpent: 0,
        cardSpent: 0,
      };
    }
    if (!userCategoryTotals[transaction.userId]) {
      userCategoryTotals[transaction.userId] = {};
    }

    userTotals[transaction.userId].totalSpent = roundCurrency(
      userTotals[transaction.userId].totalSpent + convertedAmount,
    );
    userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] = roundCurrency(
      userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] + convertedAmount,
    );
    incrementBucket(
      userCategoryTotals[transaction.userId],
      transaction.category,
      convertedAmount,
    );
  }

  const fairSplit = users.map((user) => ({
    userId: user.id,
    name: user.name,
    monthlySalary: converter.convert(user.monthlySalary, user.incomeCurrencyCode),
    sharePct:
      totalSalary === 0
        ? 50
        : roundPercent(
            (converter.convert(user.monthlySalary, user.incomeCurrencyCode) / totalSalary) * 100,
          ),
  }));

  return {
    coupleId,
    period: {
      days,
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      incomeCurrencyCode: user.incomeCurrencyCode ?? "USD",
      monthlySalary: converter.convert(user.monthlySalary, user.incomeCurrencyCode),
      originalMonthlySalary: roundCurrency(user.monthlySalary),
      salaryPaymentMethod: user.salaryPaymentMethod,
      incomeDayOfMonth: Number(user.incomeDayOfMonth ?? 1),
      salaryCashAmount: converter.convert(user.salaryCashAmount ?? 0, user.incomeCurrencyCode),
      salaryCardAmount: converter.convert(
        user.salaryCardAmount ?? user.monthlySalary ?? 0,
        user.incomeCurrencyCode,
      ),
      originalSalaryCashAmount: roundCurrency(user.salaryCashAmount ?? 0),
      originalSalaryCardAmount: roundCurrency(user.salaryCardAmount ?? user.monthlySalary ?? 0),
      spending: normalizeUserSpending(user, userTotals, userCategoryTotals, totalSpent),
    })),
    displayCurrencyCode: converter.displayCurrencyCode,
    fairSplit,
    summary: {
      totalSpent: roundCurrency(totalSpent),
      recurringSpent: roundCurrency(typeTotals.recurring),
      oneTimeSpent: roundCurrency(typeTotals["one-time"]),
      cashSpent: roundCurrency(methodTotals.cash),
      cardSpent: roundCurrency(methodTotals.card),
      cashSharePct: totalSpent === 0 ? 0 : roundPercent((methodTotals.cash / totalSpent) * 100),
      cardSharePct: totalSpent === 0 ? 0 : roundPercent((methodTotals.card / totalSpent) * 100),
    },
    topCategories: Object.entries(categoryTotals)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount: roundCurrency(amount),
        sharePct: totalSpent === 0 ? 0 : roundPercent((amount / totalSpent) * 100),
      })),
    recentTransactions: transactions.slice(0, 20).map((transaction) => ({
      ...transaction,
      displayAmount: converter.convert(transaction.amount, transaction.currencyCode),
      displayCurrencyCode: converter.displayCurrencyCode,
    })),
    transactions: transactions.map((transaction) => ({
      ...transaction,
      displayAmount: converter.convert(transaction.amount, transaction.currencyCode),
      displayCurrencyCode: converter.displayCurrencyCode,
    })),
  };
}

async function buildBudgetSnapshotForUsers({
  budgetRepository,
  exchangeRateService,
  currentUser,
  partnerUser,
  days = 30,
  displayCurrency = null,
}) {
  if (!currentUser || !partnerUser) {
    throw new HttpError(404, "COUPLE_NOT_FOUND", "Linked partner not found.");
  }

  const transactions = await budgetRepository.listTransactionsForUserIds({
    userIds: [currentUser.id, partnerUser.id],
    days,
  });
  const users = [currentUser, partnerUser];
  const resolvedDisplayCurrency = displayCurrency || users[0]?.incomeCurrencyCode || "USD";
  const converter = await createCurrencyConverter({
    exchangeRateService,
    displayCurrency: resolvedDisplayCurrency,
    sourceCurrencies: [
      ...users.map((user) => user.incomeCurrencyCode),
      ...transactions.map((transaction) => transaction.currencyCode),
    ],
  });
  const totalSalary = users.reduce(
    (sum, user) => sum + converter.convert(user.monthlySalary, user.incomeCurrencyCode),
    0,
  );
  const totalSpent = transactions.reduce(
    (sum, tx) => sum + converter.convert(tx.amount, tx.currencyCode),
    0,
  );
  const methodTotals = { cash: 0, card: 0 };
  const typeTotals = { recurring: 0, "one-time": 0 };
  const categoryTotals = {};
  const userTotals = {};
  const userCategoryTotals = {};

  for (const transaction of transactions) {
    const convertedAmount = converter.convert(transaction.amount, transaction.currencyCode);
    methodTotals[transaction.paymentMethod] += convertedAmount;
    typeTotals[transaction.type] += convertedAmount;
    incrementBucket(categoryTotals, transaction.category, convertedAmount);

    if (!userTotals[transaction.userId]) {
      userTotals[transaction.userId] = {
        totalSpent: 0,
        cashSpent: 0,
        cardSpent: 0,
      };
    }
    if (!userCategoryTotals[transaction.userId]) {
      userCategoryTotals[transaction.userId] = {};
    }

    userTotals[transaction.userId].totalSpent = roundCurrency(
      userTotals[transaction.userId].totalSpent + convertedAmount,
    );
    userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] = roundCurrency(
      userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] + convertedAmount,
    );
    incrementBucket(
      userCategoryTotals[transaction.userId],
      transaction.category,
      convertedAmount,
    );
  }

  const fairSplit = users.map((user) => ({
    userId: user.id,
    name: user.name,
    monthlySalary: converter.convert(user.monthlySalary, user.incomeCurrencyCode),
    sharePct:
      totalSalary === 0
        ? 50
        : roundPercent(
            (converter.convert(user.monthlySalary, user.incomeCurrencyCode) / totalSalary) * 100,
          ),
  }));

  return {
    coupleId: null,
    period: {
      days,
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      incomeCurrencyCode: user.incomeCurrencyCode ?? "USD",
      monthlySalary: converter.convert(user.monthlySalary, user.incomeCurrencyCode),
      originalMonthlySalary: roundCurrency(user.monthlySalary),
      salaryPaymentMethod: user.salaryPaymentMethod,
      incomeDayOfMonth: Number(user.incomeDayOfMonth ?? 1),
      salaryCashAmount: converter.convert(user.salaryCashAmount ?? 0, user.incomeCurrencyCode),
      salaryCardAmount: converter.convert(
        user.salaryCardAmount ?? user.monthlySalary ?? 0,
        user.incomeCurrencyCode,
      ),
      originalSalaryCashAmount: roundCurrency(user.salaryCashAmount ?? 0),
      originalSalaryCardAmount: roundCurrency(user.salaryCardAmount ?? user.monthlySalary ?? 0),
      spending: normalizeUserSpending(user, userTotals, userCategoryTotals, totalSpent),
    })),
    displayCurrencyCode: converter.displayCurrencyCode,
    fairSplit,
    summary: {
      totalSpent: roundCurrency(totalSpent),
      recurringSpent: roundCurrency(typeTotals.recurring),
      oneTimeSpent: roundCurrency(typeTotals["one-time"]),
      cashSpent: roundCurrency(methodTotals.cash),
      cardSpent: roundCurrency(methodTotals.card),
      cashSharePct: totalSpent === 0 ? 0 : roundPercent((methodTotals.cash / totalSpent) * 100),
      cardSharePct: totalSpent === 0 ? 0 : roundPercent((methodTotals.card / totalSpent) * 100),
    },
    topCategories: Object.entries(categoryTotals)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount: roundCurrency(amount),
        sharePct: totalSpent === 0 ? 0 : roundPercent((amount / totalSpent) * 100),
      })),
    recentTransactions: transactions.slice(0, 20).map((transaction) => ({
      ...transaction,
      displayAmount: converter.convert(transaction.amount, transaction.currencyCode),
      displayCurrencyCode: converter.displayCurrencyCode,
    })),
    transactions: transactions.map((transaction) => ({
      ...transaction,
      displayAmount: converter.convert(transaction.amount, transaction.currencyCode),
      displayCurrencyCode: converter.displayCurrencyCode,
    })),
  };
}

export { buildBudgetSnapshot, buildBudgetSnapshotForUsers };
