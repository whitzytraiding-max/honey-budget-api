/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { resolveCurrencyCode } from "../services/currencyConversionService.js";

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
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate());
}

export function clampIncomeDay(day) {
  const n = Number(day);
  return Number.isInteger(n) ? Math.max(1, Math.min(28, n)) : 1;
}

export function getCurrentMonthWindow() {
  const now = new Date();
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const from = fromDate.toISOString().slice(0, 10);
  const to = toDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  const days = Math.floor((toDate - fromDate) / 864e5) + 1;
  const daysRemaining = Math.floor((endDate - toDate) / 864e5) + 1;
  return { from, to, end, days, daysRemaining };
}

export function getBudgetWindowForUsers(users) {
  const now = new Date();
  const incomeDay = clampIncomeDay(
    Math.min(...users.filter(Boolean).map((u) => clampIncomeDay(u.incomeDayOfMonth ?? 1))),
  );
  const today = createUtcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const anchor = createUtcDate(now.getUTCFullYear(), now.getUTCMonth(), incomeDay);
  const fromDate = today.getUTCDate() >= incomeDay ? anchor : addMonthsUtc(anchor, -1);
  const nextWindowStart = addMonthsUtc(fromDate, 1);
  const endDate = new Date(nextWindowStart.getTime() - 864e5);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return {
    from: formatUtcDate(fromDate),
    to: formatUtcDate(today),
    end: formatUtcDate(endDate),
    anchorDay: incomeDay,
    days: Math.floor((today - fromDate) / 864e5) + 1,
    daysRemaining: Math.floor((endDate - today) / 864e5) + 1,
    label: `${fmt.format(fromDate)} - ${fmt.format(endDate)}`,
  };
}

export function getCalendarMonthWindow(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;
  const fromDate = createUtcDate(year, monthIndex, 1);
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const today = new Date();
  const currentMonthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const toDate = month === currentMonthKey
    ? createUtcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    : endDate;
  return {
    from: formatUtcDate(fromDate),
    to: formatUtcDate(toDate),
    end: formatUtcDate(endDate),
    days: Math.floor((toDate - fromDate) / 864e5) + 1,
    daysRemaining: Math.max(0, Math.floor((endDate - toDate) / 864e5)),
    label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(fromDate),
    monthKey: month,
  };
}

export function getMonthSpan(startIso, endIso) {
  const months = [];
  let year = Number(startIso.slice(0, 4));
  let month = Number(startIso.slice(5, 7));
  const endYear = Number(endIso.slice(0, 4));
  const endMonth = Number(endIso.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
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
  return candidates.find((c) => c >= billStart && c >= today && (!recurringBill.endDate || c <= recurringBill.endDate)) ?? null;
}
