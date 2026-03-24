import { HttpError } from "../lib/http.js";

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

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

async function buildBudgetSnapshot({ budgetRepository, coupleId, days = 30 }) {
  const couple = await budgetRepository.getCoupleById(coupleId);

  if (!couple) {
    throw new HttpError(404, "COUPLE_NOT_FOUND", "Couple not found.");
  }

  const transactions = await budgetRepository.listCoupleTransactions({ coupleId, days });
  const users = [couple.userOne, couple.userTwo];
  const totalSalary = users.reduce((sum, user) => sum + user.monthlySalary, 0);
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const methodTotals = { cash: 0, card: 0 };
  const typeTotals = { recurring: 0, "one-time": 0 };
  const categoryTotals = {};
  const userTotals = {};
  const userCategoryTotals = {};

  for (const transaction of transactions) {
    methodTotals[transaction.paymentMethod] += transaction.amount;
    typeTotals[transaction.type] += transaction.amount;
    incrementBucket(categoryTotals, transaction.category, transaction.amount);

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
      userTotals[transaction.userId].totalSpent + transaction.amount,
    );
    userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] = roundCurrency(
      userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] + transaction.amount,
    );
    incrementBucket(
      userCategoryTotals[transaction.userId],
      transaction.category,
      transaction.amount,
    );
  }

  const fairSplit = users.map((user) => ({
    userId: user.id,
    name: user.name,
    monthlySalary: roundCurrency(user.monthlySalary),
    sharePct: totalSalary === 0 ? 50 : roundPercent((user.monthlySalary / totalSalary) * 100),
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
      monthlySalary: roundCurrency(user.monthlySalary),
      salaryPaymentMethod: user.salaryPaymentMethod,
      salaryCashAmount: roundCurrency(user.salaryCashAmount ?? 0),
      salaryCardAmount: roundCurrency(user.salaryCardAmount ?? user.monthlySalary ?? 0),
      spending: normalizeUserSpending(user, userTotals, userCategoryTotals, totalSpent),
    })),
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
    recentTransactions: transactions.slice(0, 20),
    transactions,
  };
}

async function buildBudgetSnapshotForUsers({
  budgetRepository,
  currentUser,
  partnerUser,
  days = 30,
}) {
  if (!currentUser || !partnerUser) {
    throw new HttpError(404, "COUPLE_NOT_FOUND", "Linked partner not found.");
  }

  const transactions = await budgetRepository.listTransactionsForUserIds({
    userIds: [currentUser.id, partnerUser.id],
    days,
  });
  const users = [currentUser, partnerUser];
  const totalSalary = users.reduce((sum, user) => sum + user.monthlySalary, 0);
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const methodTotals = { cash: 0, card: 0 };
  const typeTotals = { recurring: 0, "one-time": 0 };
  const categoryTotals = {};
  const userTotals = {};
  const userCategoryTotals = {};

  for (const transaction of transactions) {
    methodTotals[transaction.paymentMethod] += transaction.amount;
    typeTotals[transaction.type] += transaction.amount;
    incrementBucket(categoryTotals, transaction.category, transaction.amount);

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
      userTotals[transaction.userId].totalSpent + transaction.amount,
    );
    userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] = roundCurrency(
      userTotals[transaction.userId][`${transaction.paymentMethod}Spent`] + transaction.amount,
    );
    incrementBucket(
      userCategoryTotals[transaction.userId],
      transaction.category,
      transaction.amount,
    );
  }

  const fairSplit = users.map((user) => ({
    userId: user.id,
    name: user.name,
    monthlySalary: roundCurrency(user.monthlySalary),
    sharePct: totalSalary === 0 ? 50 : roundPercent((user.monthlySalary / totalSalary) * 100),
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
      monthlySalary: roundCurrency(user.monthlySalary),
      salaryPaymentMethod: user.salaryPaymentMethod,
      salaryCashAmount: roundCurrency(user.salaryCashAmount ?? 0),
      salaryCardAmount: roundCurrency(user.salaryCardAmount ?? user.monthlySalary ?? 0),
      spending: normalizeUserSpending(user, userTotals, userCategoryTotals, totalSpent),
    })),
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
    recentTransactions: transactions.slice(0, 20),
    transactions,
  };
}

export { buildBudgetSnapshot, buildBudgetSnapshotForUsers };
