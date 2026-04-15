/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { resolvePartnerUser } from "../lib/builders.js";
import { buildBudgetSnapshotForUsers } from "../services/dashboardService.js";

export function createCoachChatRoutes({
  budgetRepository,
  exchangeRateService,
  insightsService,
  requireAuth,
}) {
  const router = express.Router();

  router.post(
    "/api/coach/chat",
    requireAuth,
    asyncHandler(async (request, response) => {
      const { message, conversationHistory = [], displayCurrency } = request.body ?? {};

      if (!message || typeof message !== "string" || !message.trim()) {
        throw new HttpError(400, "MESSAGE_REQUIRED", "message is required.");
      }
      if (message.trim().length > 1000) {
        throw new HttpError(400, "MESSAGE_TOO_LONG", "Message must be 1000 characters or less.");
      }
      if (!Array.isArray(conversationHistory)) {
        throw new HttpError(400, "INVALID_HISTORY", "conversationHistory must be an array.");
      }
      // Safety: cap history to last 20 turns to avoid token bloat
      const history = conversationHistory.slice(-20);

      const [partnerUser, couple] = await Promise.all([
        resolvePartnerUser({ budgetRepository, user: request.user }),
        budgetRepository.getCoupleForUser(request.user.id),
      ]);

      let coachProfile = null;
      let savingsGoals = [];
      let bills = [];

      if (couple) {
        [coachProfile, savingsGoals, bills] = await Promise.all([
          budgetRepository.getCoupleCoachProfile(couple.id),
          budgetRepository.listSavingsGoalsForCouple(couple.id).catch(() => []),
          budgetRepository.listRecurringBillsForCouple(couple.id).catch(() => []),
        ]);
      } else {
        savingsGoals = await budgetRepository.listSavingsGoalsForUser(request.user.id).catch(() => []);
      }

      const snapshot = await buildBudgetSnapshotForUsers({
        budgetRepository,
        exchangeRateService,
        currentUser: request.user,
        partnerUser,
        days: 30,
        displayCurrency: displayCurrency?.trim() || null,
      });

      const today = new Date().toISOString().split("T")[0];
      const currency = request.user.incomeCurrencyCode || displayCurrency?.trim() || "USD";

      // Tool execution — called by insightsService when AI uses a tool
      async function onToolCall(toolName, input) {
        if (toolName === "update_income") {
          await budgetRepository.updateUserIncomeProfile({
            userId: request.user.id,
            monthlySalary: Number(input.amount),
            incomeCurrencyCode: request.user.incomeCurrencyCode,
            salaryPaymentMethod: request.user.salaryPaymentMethod,
            salaryCashAmount: request.user.salaryCashAmount,
            salaryCardAmount: request.user.salaryCardAmount,
            salaryCashAllocationPct: request.user.salaryCashAllocationPct,
            salaryCardAllocationPct: request.user.salaryCardAllocationPct,
            incomeDayOfMonth: request.user.incomeDayOfMonth,
            monthlySavingsTarget: request.user.monthlySavingsTarget,
          });
          return { success: true };
        }

        if (toolName === "log_expense") {
          await budgetRepository.addTransaction({
            userId: request.user.id,
            description: String(input.description),
            amount: Number(input.amount),
            currencyCode: currency,
            category: String(input.category),
            type: "one-time",
            paymentMethod: input.payment_method || "card",
            date: today,
          });
          return { success: true };
        }

        if (toolName === "update_bill") {
          const bill = bills.find((b) => b.id === input.bill_id);
          if (!bill) return { success: false, error: "Bill not found" };
          await budgetRepository.updateRecurringBill({
            recurringBillId: bill.id,
            coupleId: couple?.id,
            title: bill.title,
            amount: Number(input.new_amount),
            currencyCode: bill.currencyCode || currency,
            category: bill.category,
            paymentMethod: bill.paymentMethod,
            dayOfMonth: bill.dayOfMonth,
            notes: bill.notes || "",
            isActive: bill.isActive ?? true,
            autoCreate: bill.autoCreate ?? true,
            startDate: bill.startDate,
            endDate: bill.endDate || null,
          });
          return { success: true };
        }

        if (toolName === "add_bill") {
          await budgetRepository.createRecurringBill({
            coupleId: couple?.id ?? null,
            userId: request.user.id,
            title: String(input.title),
            amount: Number(input.amount),
            currencyCode: currency,
            category: String(input.category),
            paymentMethod: input.payment_method || "card",
            dayOfMonth: 1,
            notes: "",
            isActive: true,
            autoCreate: true,
            startDate: today,
            endDate: null,
          });
          return { success: true };
        }

        return { success: false, error: `Unknown tool: ${toolName}` };
      }

      const { reply, actions, newHistory } = await insightsService.chatWithTools({
        message: message.trim(),
        conversationHistory: history,
        snapshot,
        coachProfile,
        savingsGoals,
        currentUser: request.user,
        partnerUser,
        bills,
        onToolCall,
      });

      sendData(response, 200, { reply, actions, history: newHistory });
    }),
  );

  return router;
}
