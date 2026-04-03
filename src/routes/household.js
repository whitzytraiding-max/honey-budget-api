/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { normalizeHouseholdRulePayload } from "../lib/parsers.js";

export function createHouseholdRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/household-rules",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before opening household rules.",
        );
      }

      const rules = await budgetRepository.listHouseholdRulesForCouple(couple.id);
      sendData(response, 200, { rules });
    }),
  );

  router.post(
    "/api/household-rules",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before adding household rules.",
        );
      }

      const payload = normalizeHouseholdRulePayload(request.body, request.user);
      const rule = await budgetRepository.createHouseholdRule({
        coupleId: couple.id,
        ...payload,
      });

      sendData(response, 201, { rule });
    }),
  );

  router.patch(
    "/api/household-rules/:ruleId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const ruleId = Number.parseInt(request.params.ruleId, 10);

      if (!Number.isInteger(ruleId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "ruleId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before editing household rules.",
        );
      }

      const payload = normalizeHouseholdRulePayload(request.body, request.user);
      const rule = await budgetRepository.updateHouseholdRule({
        ruleId,
        coupleId: couple.id,
        ...payload,
      });

      sendData(response, 200, { rule });
    }),
  );

  router.delete(
    "/api/household-rules/:ruleId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const ruleId = Number.parseInt(request.params.ruleId, 10);

      if (!Number.isInteger(ruleId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "ruleId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before deleting household rules.",
        );
      }

      const rule = await budgetRepository.deleteHouseholdRule({
        ruleId,
        coupleId: couple.id,
      });

      sendData(response, 200, { rule });
    }),
  );

  return router;
}
