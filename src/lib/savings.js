/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { roundCurrency } from "../services/currencyConversionService.js";

export function buildGoalMilestones(goal) {
  const pct = Number(goal.progressPct ?? 0);
  const milestones = [25, 50, 75, 100].map((v) => ({ value: v, reached: pct >= v }));
  const next = milestones.find((m) => !m.reached) ?? null;
  return { milestones, nextMilestone: next?.value ?? null };
}

export function buildSuggestedMonthlyContribution(goal) {
  if (!goal?.targetDate || !Number.isFinite(Number(goal.remainingAmount))) return 0;
  const today = new Date();
  const target = new Date(`${goal.targetDate}T00:00:00.000Z`);
  const diff = (target.getUTCFullYear() - today.getUTCFullYear()) * 12 + (target.getUTCMonth() - today.getUTCMonth()) + 1;
  return roundCurrency(Number(goal.remainingAmount) / Math.max(1, diff));
}
