/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

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
