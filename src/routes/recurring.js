/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { normalizeRecurringBillPayload } from "../lib/parsers.js";

export function createRecurringRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/recurring-bills",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before opening recurring bills.",
        );
      }

      const bills = await budgetRepository.listRecurringBillsForCouple(couple.id);
      sendData(response, 200, { bills });
    }),
  );

  router.post(
    "/api/recurring-bills",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before adding recurring bills.",
        );
      }

      const payload = normalizeRecurringBillPayload(request.body, request.user);
      const bill = await budgetRepository.createRecurringBill({
        coupleId: couple.id,
        userId: request.user.id,
        ...payload,
      });

      sendData(response, 201, { bill });
    }),
  );

  router.patch(
    "/api/recurring-bills/:billId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const recurringBillId = Number.parseInt(request.params.billId, 10);

      if (!Number.isInteger(recurringBillId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "billId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before editing recurring bills.",
        );
      }

      const payload = normalizeRecurringBillPayload(request.body, request.user);
      const bill = await budgetRepository.updateRecurringBill({
        recurringBillId,
        coupleId: couple.id,
        ...payload,
      });

      sendData(response, 200, { bill });
    }),
  );

  router.delete(
    "/api/recurring-bills/:billId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const recurringBillId = Number.parseInt(request.params.billId, 10);

      if (!Number.isInteger(recurringBillId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "billId must be an integer.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before deleting recurring bills.",
        );
      }

      const bill = await budgetRepository.deleteRecurringBill({
        recurringBillId,
        coupleId: couple.id,
      });

      sendData(response, 200, { bill });
    }),
  );

  return router;
}
