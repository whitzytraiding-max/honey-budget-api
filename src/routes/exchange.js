/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { validateCurrencyCode, parseYearMonthInput, parseMoney, roundRate } from "../lib/parsers.js";

export function createExchangeRoutes({ budgetRepository, exchangeRateService, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/exchange-rate",
    asyncHandler(async (request, response) => {
      const from = String(request.query.from ?? "").trim().toUpperCase();
      const to = String(request.query.to ?? "").trim().toUpperCase();

      if (!validateCurrencyCode(from) || !validateCurrencyCode(to)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "from and to must be ISO 4217 currency codes.",
        );
      }

      const rate = await exchangeRateService.getRate({ from, to });
      sendData(response, 200, rate);
    }),
  );

  router.get(
    "/api/mmk-rate",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before setting a shared MMK rate.",
        );
      }

      const now = new Date();
      const { year, month } = parseYearMonthInput(
        request.query.year ?? now.getUTCFullYear(),
        request.query.month ?? now.getUTCMonth() + 1,
      );
      const rate = await budgetRepository.getCoupleMmkMonthlyRate({
        coupleId: couple.id,
        year,
        month,
      });

      sendData(response, 200, { year, month, rate });
    }),
  );

  router.put(
    "/api/mmk-rate",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before setting a shared MMK rate.",
        );
      }

      const { year, month } = parseYearMonthInput(
        request.body?.year,
        request.body?.month,
      );
      const rateSource = String(request.body?.rateSource ?? "").trim().toLowerCase();

      if (rateSource !== "kbz" && rateSource !== "custom") {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "rateSource must be 'kbz' or 'custom'.",
        );
      }

      let resolvedRate = null;

      if (rateSource === "kbz") {
        const kbzRate = await exchangeRateService.getKbzMmkRate();
        resolvedRate = roundRate(kbzRate.rate);
      } else {
        resolvedRate = parseMoney(request.body?.rate);
      }

      if (!Number.isFinite(resolvedRate) || resolvedRate <= 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "rate must be a positive number.",
        );
      }

      const savedRate = await budgetRepository.upsertCoupleMmkMonthlyRate({
        coupleId: couple.id,
        year,
        month,
        rateSource,
        rate: resolvedRate,
      });

      sendData(response, 200, { rate: savedRate });
    }),
  );

  return router;
}
