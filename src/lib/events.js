/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { clampIncomeDay, createUtcDate, addMonthsUtc, formatUtcDate } from "./date.js";

export function buildIncomeEvents(users, fromDate, limit) {
  const events = [];
  for (const user of users.filter(Boolean)) {
    const day = clampIncomeDay(user.incomeDayOfMonth ?? 1);
    let cursor = createUtcDate(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), day);
    if (cursor.getTime() < fromDate.getTime()) cursor = addMonthsUtc(cursor, 1);
    for (let i = 0; i < 2; i += 1) {
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
  for (const tx of transactions) {
    if (tx.type !== "recurring") continue;
    const key = `${tx.userId}:${tx.description}:${tx.category}:${tx.amount}:${tx.paymentMethod}`;
    const existing = recurringMap.get(key);
    if (!existing || existing.date < tx.date) recurringMap.set(key, tx);
  }
  const events = [];
  for (const tx of recurringMap.values()) {
    const day = clampIncomeDay(Number(tx.date.slice(8, 10)));
    let cursor = createUtcDate(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), day);
    if (cursor.getTime() < fromDate.getTime()) cursor = addMonthsUtc(cursor, 1);
    events.push({
      kind: "expense",
      userId: tx.userId,
      userName: tx.userName,
      label: tx.description,
      amount: Number(tx.amount ?? 0),
      currencyCode: tx.currencyCode ?? "USD",
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      date: formatUtcDate(cursor),
    });
  }
  return events;
}

export function buildUpcomingEvents({ currentUser, partnerUser, transactions }) {
  const users = [currentUser, partnerUser].filter(Boolean);
  const today = new Date();
  const fromDate = createUtcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const all = [
    ...buildIncomeEvents(users, fromDate, 6),
    ...buildRecurringPaymentEvents(transactions, fromDate),
  ];
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)).slice(0, 8);
}
