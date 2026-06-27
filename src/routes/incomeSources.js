/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { resolveCurrencyCode } from "../services/currencyConversionService.js";
import { parseMoney } from "../lib/parsers.js";

function normalizePaymentMethod(value) {
  return value === "cash" ? "cash" : "card";
}

function parseSourcePayload(request) {
  const label = String(request.body?.label ?? "").trim();
  const amount = parseMoney(request.body?.amount);
  const currencyCode = resolveCurrencyCode(
    request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
  );
  const paymentMethod = normalizePaymentMethod(request.body?.paymentMethod);

  if (!label) {
    throw new HttpError(400, "VALIDATION_ERROR", "label is required.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "amount must be greater than 0.");
  }

  return { label, amount, currencyCode, paymentMethod };
}

export function createIncomeSourceRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/income-sources",
    requireAuth,
    asyncHandler(async (request, response) => {
      const incomeSources = await budgetRepository.listIncomeSourcesForUser(request.user.id);
      sendData(response, 200, { incomeSources });
    }),
  );

  router.post(
    "/api/income-sources",
    requireAuth,
    asyncHandler(async (request, response) => {
      const payload = parseSourcePayload(request);
      const incomeSource = await budgetRepository.createIncomeSourceForUser({
        userId: request.user.id,
        ...payload,
      });
      sendData(response, 201, { incomeSource });
    }),
  );

  router.patch(
    "/api/income-sources/:id",
    requireAuth,
    asyncHandler(async (request, response) => {
      const sourceId = Number.parseInt(request.params.id, 10);
      if (!Number.isInteger(sourceId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid income source id.");
      }
      const payload = parseSourcePayload(request);
      const incomeSource = await budgetRepository.updateIncomeSourceForUser({
        sourceId,
        userId: request.user.id,
        ...payload,
      });
      sendData(response, 200, { incomeSource });
    }),
  );

  router.delete(
    "/api/income-sources/:id",
    requireAuth,
    asyncHandler(async (request, response) => {
      const sourceId = Number.parseInt(request.params.id, 10);
      if (!Number.isInteger(sourceId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid income source id.");
      }
      await budgetRepository.deleteIncomeSourceForUser({ sourceId, userId: request.user.id });
      sendData(response, 200, { ok: true });
    }),
  );

  return router;
}
