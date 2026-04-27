/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { roundCurrency } from "../services/currencyConversionService.js";
import { computeNextRecurringDate } from "./date.js";

export function buildRecurringBillStatus({ recurringBill, summary, converter }) {
  const nextDueDate = computeNextRecurringDate({
    recurringBill,
    todayIsoDate: new Date().toISOString().slice(0, 10),
  });
  const displayAmount = roundCurrency(converter.convert(recurringBill.amount ?? 0, recurringBill.currencyCode));
  const dueSoon = nextDueDate && Math.floor((new Date(`${nextDueDate}T00:00:00.000Z`) - Date.now()) / 864e5) <= 7;

  return {
    ...recurringBill,
    nextDueDate,
    dueSoon: Boolean(dueSoon),
    displayAmount,
    displayCurrencyCode: converter.displayCurrencyCode,
    warning: summary.remainingBudget < displayAmount
      ? "This bill is larger than the budget currently left in this window."
      : null,
  };
}
