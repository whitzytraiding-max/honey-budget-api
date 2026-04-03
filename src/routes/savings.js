/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { resolveCurrencyCode } from "../services/currencyConversionService.js";
import { parseMoney, validateIsoDate } from "../lib/parsers.js";
import { resolvePartnerUser, buildSavingsSummary } from "../lib/builders.js";

export function createSavingsRoutes({ budgetRepository, exchangeRateService, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/savings",
    requireAuth,
    asyncHandler(async (request, response) => {
      let partnerUser = null;

      try {
        partnerUser = await resolvePartnerUser({
          budgetRepository,
          user: request.user,
        });
      } catch (error) {
        if (!(error instanceof HttpError && error.code === "COUPLE_NOT_FOUND")) {
          throw error;
        }
      }

      const savings = await buildSavingsSummary({
        budgetRepository,
        exchangeRateService,
        currentUser: request.user,
        partnerUser,
        displayCurrency: request.query.displayCurrency?.trim(),
      });

      sendData(response, 200, savings);
    }),
  );

  router.post(
    "/api/savings/goal",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const title = String(request.body?.title ?? "").trim();
      const targetAmount = parseMoney(request.body?.targetAmount);
      const targetDate = request.body?.targetDate?.trim?.() || null;
      const currencyCode = resolveCurrencyCode(
        request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
      );

      if (!couple || !partnerUser) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before setting a shared savings goal.",
        );
      }

      if (!title) {
        throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
      }

      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "targetAmount must be a positive number.",
        );
      }

      if (targetDate && !validateIsoDate(targetDate)) {
        throw new HttpError(400, "VALIDATION_ERROR", "targetDate must use YYYY-MM-DD.");
      }

      const goal = await budgetRepository.createSavingsGoalForCouple({
        coupleId: couple.id,
        title,
        targetAmount,
        currencyCode,
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : null,
      });

      sendData(response, 200, { goal });
    }),
  );

  router.patch(
    "/api/savings/goal/:goalId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const goalId = Number.parseInt(request.params.goalId, 10);
      const title = String(request.body?.title ?? "").trim();
      const targetAmount = parseMoney(request.body?.targetAmount);
      const targetDate = request.body?.targetDate?.trim?.() || null;
      const currencyCode = resolveCurrencyCode(
        request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
      );

      if (!Number.isInteger(goalId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "goalId must be an integer.");
      }

      if (!couple || !partnerUser) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before editing a shared savings goal.",
        );
      }

      if (!title) {
        throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
      }

      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "targetAmount must be a positive number.",
        );
      }

      if (targetDate && !validateIsoDate(targetDate)) {
        throw new HttpError(400, "VALIDATION_ERROR", "targetDate must use YYYY-MM-DD.");
      }

      const goal = await budgetRepository.updateSavingsGoalForCouple({
        goalId,
        coupleId: couple.id,
        title,
        targetAmount,
        currencyCode,
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : null,
      });

      sendData(response, 200, { goal });
    }),
  );

  router.delete(
    "/api/savings/goal/:goalId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const goalId = Number.parseInt(request.params.goalId, 10);

      if (!Number.isInteger(goalId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "goalId must be an integer.");
      }

      if (!couple || !partnerUser) {
        throw new HttpError(
          404,
          "COUPLE_NOT_FOUND",
          "Link both partners before removing a shared savings goal.",
        );
      }

      const goal = await budgetRepository.deleteSavingsGoalForCouple({
        goalId,
        coupleId: couple.id,
      });

      sendData(response, 200, { goal });
    }),
  );

  router.post(
    "/api/savings",
    requireAuth,
    asyncHandler(async (request, response) => {
      const amount = Number(request.body?.amount);
      const note = request.body?.note?.trim();
      const date = request.body?.date;
      const currencyCode = resolveCurrencyCode(
        request.body?.currencyCode || request.user.incomeCurrencyCode || "USD",
      );
      const rawSavingsGoalId = request.body?.savingsGoalId;
      const savingsGoalId =
        rawSavingsGoalId === undefined || rawSavingsGoalId === null || rawSavingsGoalId === ""
          ? null
          : Number.parseInt(String(rawSavingsGoalId), 10);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
      }

      if (!note) {
        throw new HttpError(400, "VALIDATION_ERROR", "note is required.");
      }

      if (!validateIsoDate(date)) {
        throw new HttpError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD.");
      }

      if (savingsGoalId !== null) {
        if (!Number.isInteger(savingsGoalId)) {
          throw new HttpError(
            400,
            "VALIDATION_ERROR",
            "savingsGoalId must be an integer when provided.",
          );
        }

        const couple = await budgetRepository.getCoupleForUser(request.user.id);
        if (!couple) {
          throw new HttpError(
            404,
            "COUPLE_NOT_FOUND",
            "Link both partners before assigning savings to a shared goal.",
          );
        }

        const goals = await budgetRepository.listSavingsGoalsForCouple(couple.id);
        if (!goals.some((goal) => goal.id === savingsGoalId)) {
          throw new HttpError(
            404,
            "SAVINGS_GOAL_NOT_FOUND",
            "Selected savings goal was not found for this couple.",
          );
        }
      }

      let resolvedSavingsGoalId = savingsGoalId;
      if (resolvedSavingsGoalId === null) {
        const couple = await budgetRepository.getCoupleForUser(request.user.id);
        if (couple) {
          const goals = await budgetRepository.listSavingsGoalsForCouple(couple.id);
          if (goals.length === 1) {
            resolvedSavingsGoalId = goals[0].id;
          }
        }
      }

      const entry = await budgetRepository.addSavingsEntry({
        userId: request.user.id,
        savingsGoalId: resolvedSavingsGoalId,
        amount,
        currencyCode,
        note,
        date,
      });

      sendData(response, 201, { entry });
    }),
  );

  return router;
}
