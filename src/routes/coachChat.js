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
      const { message, displayCurrency } = request.body ?? {};
      if (!message || typeof message !== "string" || !message.trim()) {
        throw new HttpError(400, "MESSAGE_REQUIRED", "message is required.");
      }
      if (message.trim().length > 500) {
        throw new HttpError(400, "MESSAGE_TOO_LONG", "Message must be 500 characters or less.");
      }

      const [partnerUser, couple] = await Promise.all([
        resolvePartnerUser({ budgetRepository, user: request.user }),
        budgetRepository.getCoupleForUser(request.user.id),
      ]);

      let coachProfile = null;
      let savingsGoals = [];
      if (couple) {
        [coachProfile, savingsGoals] = await Promise.all([
          budgetRepository.getCoupleCoachProfile(couple.id),
          budgetRepository.listSavingsGoalsForCouple(couple.id).catch(() => []),
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

      const reply = await insightsService.chat({
        message: message.trim(),
        snapshot,
        coachProfile,
        savingsGoals,
        currentUser: request.user,
        partnerUser,
      });

      sendData(response, 200, { reply });
    }),
  );

  return router;
}
