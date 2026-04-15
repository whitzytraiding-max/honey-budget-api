/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { resolvePartnerUser } from "../lib/builders.js";

export function createBudgetPlannerRoutes({ budgetRepository, budgetPlannerService, requireAuth }) {
  const router = express.Router();

  // Parse uploaded spreadsheet — accepts base64-encoded file as JSON body
  router.post(
    "/api/budget-planner/parse",
    requireAuth,
    asyncHandler(async (request, response) => {
      const { data, mimeType, filename } = request.body ?? {};
      console.log("[budget-planner] parse called, filename:", filename, "mimeType:", mimeType, "dataLen:", data?.length);

      if (!data) {
        throw new HttpError(400, "FILE_REQUIRED", "Please upload a spreadsheet file.");
      }

      const MAX_BYTES = 5 * 1024 * 1024;
      let buffer;
      try {
        buffer = Buffer.from(data, "base64");
      } catch {
        throw new HttpError(400, "INVALID_FILE", "Could not decode file data.");
      }
      if (buffer.length > MAX_BYTES) {
        throw new HttpError(400, "FILE_TOO_LARGE", "File must be 5 MB or smaller.");
      }

      const ext = String(filename ?? "").split(".").pop()?.toLowerCase();
      const allowed = ["csv", "xlsx", "xls"];
      if (!allowed.includes(ext)) {
        throw new HttpError(400, "INVALID_FILE_TYPE", "Only CSV and Excel files are supported.");
      }

      try {
        const { parsedPlan, questions, extractedText } = budgetPlannerService.parseSpreadsheet(buffer, mimeType ?? "");
        console.log("[budget-planner] parse OK, months:", parsedPlan?.months?.length);
        sendData(response, 200, { parsedPlan, questions, extractedText });
      } catch (err) {
        console.error("Budget planner parse error:", err?.message ?? err);
        throw new HttpError(500, "PARSE_FAILED", err?.message ?? "Failed to analyse the spreadsheet.");
      }
    }),
  );

  // Refine plan after user answers clarifying questions
  router.post(
    "/api/budget-planner/refine",
    requireAuth,
    asyncHandler(async (request, response) => {
      const { extractedText, parsedPlan, answers } = request.body ?? {};

      if (!extractedText || !parsedPlan) {
        throw new HttpError(400, "INVALID_INPUT", "extractedText and parsedPlan are required.");
      }

      const refined = await budgetPlannerService.refineWithAnswers({
        extractedText,
        parsedPlan,
        answers: answers || "No additional information provided.",
      });

      sendData(response, 200, { parsedPlan: refined });
    }),
  );

  // Save confirmed plan to DB
  router.post(
    "/api/budget-planner/save",
    requireAuth,
    asyncHandler(async (request, response) => {
      const { parsedPlan } = request.body ?? {};
      if (!parsedPlan || !parsedPlan.name || !parsedPlan.startMonth || !parsedPlan.months?.length) {
        throw new HttpError(400, "INVALID_PLAN", "Invalid plan data.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      const plan = await budgetRepository.createBudgetPlan({
        userId: request.user.id,
        coupleId: couple?.id ?? null,
        name: String(parsedPlan.name),
        startMonth: String(parsedPlan.startMonth),
        endMonth: String(parsedPlan.endMonth),
        planJson: JSON.stringify(parsedPlan),
        goalAmount: parsedPlan.goalAmount ?? null,
        goalCurrency: parsedPlan.currency ?? request.user.incomeCurrencyCode ?? "USD",
      });

      sendData(response, 201, { plan });
    }),
  );

  // List plans + compute roadmap actuals
  router.get(
    "/api/budget-planner",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const plans = await budgetRepository.listBudgetPlans({
        userId: request.user.id,
        coupleId: couple?.id ?? null,
      });

      if (!plans.length) {
        return sendData(response, 200, { plans: [] });
      }

      // For the most recent plan, compute actuals per month
      const activePlan = plans[0];
      const parsedPlan = JSON.parse(activePlan.planJson);
      const roadmap = await buildRoadmap({ budgetRepository, userId: request.user.id, parsedPlan });

      sendData(response, 200, { plans: plans.map((p) => ({ ...p, planJson: undefined })), activePlan: { ...activePlan, parsedPlan, roadmap } });
    }),
  );

  // Delete a plan
  router.delete(
    "/api/budget-planner/:id",
    requireAuth,
    asyncHandler(async (request, response) => {
      const planId = Number(request.params.id);
      if (!planId) throw new HttpError(400, "INVALID_ID", "Invalid plan ID.");
      await budgetRepository.deleteBudgetPlan({ planId, userId: request.user.id });
      sendData(response, 200, { ok: true });
    }),
  );

  return router;
}

async function buildRoadmap({ budgetRepository, userId, parsedPlan }) {
  const roadmap = [];

  for (const monthPlan of parsedPlan.months) {
    const [year, month] = monthPlan.month.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    let transactions = [];
    try {
      transactions = await budgetRepository.listTransactionsForUserIds({ userIds: [userId], fromDate: startDate, toDate: endDate });
    } catch {
      // no-op — actuals just won't appear for this month
    }

    const actualByCategory = {};
    let actualTotal = 0;
    for (const tx of transactions) {
      const cat = tx.category ?? "Other";
      actualByCategory[cat] = (actualByCategory[cat] ?? 0) + Number(tx.amount ?? 0);
      actualTotal += Number(tx.amount ?? 0);
    }

    const actualSavings = Math.max(0, monthPlan.income - actualTotal);
    const isCurrentMonth = (() => {
      const now = new Date();
      return now.getFullYear() === year && now.getMonth() + 1 === month;
    })();
    const isPast = new Date(year, month - 1, 1) < new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    roadmap.push({
      month: monthPlan.month,
      planned: {
        income: monthPlan.income,
        totalExpenses: monthPlan.totalExpenses,
        savings: monthPlan.plannedSavings,
        categories: monthPlan.categories,
      },
      actual: isPast || isCurrentMonth ? {
        totalExpenses: actualTotal,
        savings: actualSavings,
        categories: Object.entries(actualByCategory).map(([name, amount]) => ({ name, amount })),
      } : null,
      status: isPast || isCurrentMonth
        ? actualSavings >= monthPlan.plannedSavings ? "on-track" : "behind"
        : "upcoming",
    });
  }

  // Cumulative savings progress toward goal
  const goalAmount = Number(parsedPlan.goalAmount ?? 0);
  let cumulativePlanned = 0;
  let cumulativeActual = 0;
  for (const m of roadmap) {
    cumulativePlanned += m.planned.savings;
    if (m.actual !== null) cumulativeActual += m.actual.savings;
    m.cumulativePlannedSavings = cumulativePlanned;
    m.cumulativeActualSavings = cumulativeActual;
    if (goalAmount > 0) {
      m.goalProgressPct = Math.round((cumulativeActual / goalAmount) * 100);
    }
  }

  return roadmap;
}
