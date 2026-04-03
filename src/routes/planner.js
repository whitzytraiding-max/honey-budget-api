/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { asyncHandler, sendData } from "../lib/http.js";
import { resolvePartnerUser, buildPlannerData } from "../lib/builders.js";

export function createPlannerRoutes({ budgetRepository, exchangeRateService, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/planner",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const coachProfile = couple
        ? await budgetRepository.getCoupleCoachProfile(couple.id)
        : null;
      const planner = await buildPlannerData({
        budgetRepository,
        exchangeRateService,
        currentUser: request.user,
        partnerUser,
        coachProfile,
        displayCurrency: request.query.displayCurrency?.trim(),
      });

      sendData(response, 200, planner);
    }),
  );

  return router;
}
