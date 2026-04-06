/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { resolveCurrencyCode } from "../services/currencyConversionService.js";
import {
  parseMoney,
  parseDayOfMonth,
  resolveIncomeAllocation,
  normalizeCoachProfilePayload,
} from "../lib/parsers.js";
import { sanitizeUser, getPartner, buildSetupChecklist } from "../lib/helpers.js";

export function createUserRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/auth/me",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const coachProfile = couple
        ? await budgetRepository.getCoupleCoachProfile(couple.id)
        : await budgetRepository.getUserCoachProfile(request.user.id);
      const partnerUser = couple ? getPartner(couple, request.user.id) : null;
      const [inviteNotifications, activityNotifications] = await Promise.all([
        budgetRepository.listPendingCoupleInvitesForUser(request.user.id),
        budgetRepository.listActivityNotificationsForUser(request.user.id),
      ]);
      const [recurringBills, goals] = couple
        ? await Promise.all([
            budgetRepository.listRecurringBillsForCouple(couple.id),
            budgetRepository.listSavingsGoalsForCouple(couple.id),
          ])
        : [[], await budgetRepository.listSavingsGoalsForUser(request.user.id)];

      const now = new Date();
      const userIsPro =
        request.user.subscriptionStatus === "pro" &&
        (!request.user.subscriptionExpiresAt || new Date(request.user.subscriptionExpiresAt) > now);
      const partnerIsPro = partnerUser
        ? partnerUser.subscriptionStatus === "pro" &&
          (!partnerUser.subscriptionExpiresAt || new Date(partnerUser.subscriptionExpiresAt) > now)
        : false;
      const isPro = userIsPro || partnerIsPro;

      sendData(response, 200, {
        user: sanitizeUser(request.user),
        isPro,
        couple,
        coachProfile,
        setupChecklist: buildSetupChecklist({
          currentUser: request.user,
          partnerUser,
          coachProfile,
          recurringBills,
          goals,
        }),
        notifications: {
          ...inviteNotifications,
          activity: activityNotifications,
        },
      });
    }),
  );

  router.get(
    "/api/coach-profile",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const profile = couple
        ? await budgetRepository.getCoupleCoachProfile(couple.id)
        : await budgetRepository.getUserCoachProfile(request.user.id);
      sendData(response, 200, { profile });
    }),
  );

  router.put(
    "/api/coach-profile",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const profile = couple
        ? await budgetRepository.upsertCoupleCoachProfile({
            coupleId: couple.id,
            ...normalizeCoachProfilePayload(request.body),
          })
        : await budgetRepository.upsertUserCoachProfile({
            userId: request.user.id,
            ...normalizeCoachProfilePayload(request.body),
          });
      sendData(response, 200, { profile });
    }),
  );

  router.patch(
    "/api/profile/income",
    requireAuth,
    asyncHandler(async (request, response) => {
      const {
        monthlySalary,
        incomeCurrencyCode,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
        incomeDayOfMonth,
        monthlySavingsTarget,
      } = request.body;

      const incomeAllocation = resolveIncomeAllocation({
        monthlySalary,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
      });
      if (incomeAllocation.error) {
        throw new HttpError(400, "VALIDATION_ERROR", incomeAllocation.error);
      }

      const normalizedIncomeDay = parseDayOfMonth(incomeDayOfMonth);
      if (
        normalizedIncomeDay !== null &&
        (normalizedIncomeDay < 1 || normalizedIncomeDay > 28)
      ) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "incomeDayOfMonth must be between 1 and 28.",
        );
      }

      const normalizedSavingsTarget = parseMoney(monthlySavingsTarget);
      if (normalizedSavingsTarget !== null && normalizedSavingsTarget < 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "monthlySavingsTarget must be zero or greater.",
        );
      }

      const user = await budgetRepository.updateUserIncomeProfile({
        userId: request.user.id,
        monthlySalary: incomeAllocation.monthlySalary ?? Number(monthlySalary),
        incomeCurrencyCode: resolveCurrencyCode(
          incomeCurrencyCode || request.user.incomeCurrencyCode || "USD",
        ),
        salaryPaymentMethod: incomeAllocation.salaryPaymentMethod,
        salaryCashAmount: incomeAllocation.salaryCashAmount,
        salaryCardAmount: incomeAllocation.salaryCardAmount,
        salaryCashAllocationPct: incomeAllocation.salaryCashAllocationPct,
        salaryCardAllocationPct: incomeAllocation.salaryCardAllocationPct,
        incomeDayOfMonth: normalizedIncomeDay ?? undefined,
        monthlySavingsTarget: normalizedSavingsTarget ?? undefined,
      });

      sendData(response, 200, { user });
    }),
  );

  return router;
}
