/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { buildStaticInsightsResponse } from "../lib/helpers.js";
import { resolvePartnerUser, materializeRecurringBills } from "../lib/builders.js";
import { buildBudgetSnapshotForUsers } from "../services/dashboardService.js";

export function createInsightsRoutes({
  budgetRepository,
  exchangeRateService,
  insightsService,
  requireAuth,
}) {
  const router = express.Router();

  router.get(
    "/api/insights",
    requireAuth,
    asyncHandler(async (request, response) => {
      let partnerUser = null;
      let coachProfile = null;

      try {
        const days = Number(request.query.days ?? 30);
        const displayCurrency = request.query.displayCurrency?.trim();
        partnerUser = await resolvePartnerUser({
          budgetRepository,
          user: request.user,
        });
        const couple = await budgetRepository.getCoupleForUser(request.user.id);
        await materializeRecurringBills({
          budgetRepository,
          exchangeRateService,
          couple,
          throughDate: new Date().toISOString().slice(0, 10),
        });
        coachProfile = couple
          ? await budgetRepository.getCoupleCoachProfile(couple.id)
          : null;

        const resolvedDays = Number.isFinite(days) && days > 0 ? days : 30;

        const now = new Date();
        const trendMonths = partnerUser
          ? await Promise.all(
              [1, 2].map(async (offset) => {
                const y = now.getUTCMonth() - offset < 0
                  ? now.getUTCFullYear() - 1
                  : now.getUTCFullYear();
                const m = ((now.getUTCMonth() - offset) + 12) % 12;
                const from = new Date(Date.UTC(y, m, 1));
                const to = new Date(Date.UTC(y, m + 1, 0));
                const label = from.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
                const fromDate = from.toISOString().slice(0, 10);
                const toDate = to.toISOString().slice(0, 10);
                try {
                  const snap = await buildBudgetSnapshotForUsers({
                    budgetRepository,
                    exchangeRateService,
                    currentUser: request.user,
                    partnerUser,
                    displayCurrency,
                    fromDate,
                    toDate,
                  });
                  return { label, ...snap };
                } catch {
                  return { label };
                }
              }),
            )
          : [];

        const result = await insightsService.getAiInsights({
          currentUser: request.user,
          partnerUser,
          days: resolvedDays,
          displayCurrency,
          coachProfile,
          trendMonths,
        });

        sendData(response, 200, {
          ...result,
          tips: result.insights.tips,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        console.error("Insights route failed:", error);

        const fallbackResponse = buildStaticInsightsResponse(request.user, partnerUser);
        sendData(response, 200, fallbackResponse);
      }
    }),
  );

  return router;
}
