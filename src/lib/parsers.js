/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { HttpError } from "./http.js";
import { resolveCurrencyCode } from "../services/currencyConversionService.js";

export function parsePaymentMethod(value) {
  return value === "cash" || value === "card" ? value : null;
}

export function parseAllocationPercentage(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "string" ? Number.parseInt(value.trim(), 10) : Number(value);

  return Number.isInteger(numericValue) ? numericValue : null;
}

export function parseMoney(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "string" ? Number.parseFloat(value.trim()) : Number(value);

  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null;
}

export function parseDayOfMonth(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "string" ? Number.parseInt(value.trim(), 10) : Number(value);

  return Number.isInteger(numericValue) ? numericValue : null;
}

export function parseExpenseType(value) {
  return value === "recurring" || value === "one-time" ? value : null;
}

export function parseBoolean(value, defaultValue = false) {
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

export function validateIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateYearMonth(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function validateCurrencyCode(value) {
  return /^[A-Z]{3}$/.test(String(value ?? "").trim().toUpperCase());
}

export function roundRate(value) {
  return Number(Number(value ?? 0).toFixed(6));
}

export function resolveMonthPartsFromIsoDate(isoDate) {
  return {
    year: Number(isoDate.slice(0, 4)),
    month: Number(isoDate.slice(5, 7)),
  };
}

export function parseYearMonthInput(yearValue, monthValue) {
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

export function resolveIncomeAllocation({
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

export function normalizeCoachProfilePayload(payload) {
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

export function normalizeRecurringBillPayload(payload, currentUser) {
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

export function normalizeHouseholdRulePayload(payload, currentUser) {
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

export function normalizeTransactionPayload(payload) {
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
