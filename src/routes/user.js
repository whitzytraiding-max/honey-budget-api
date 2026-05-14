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
  const adminSecret = process.env.ADMIN_SECRET || "";

  function requireAdmin(request, _response, next) {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!adminSecret || token !== adminSecret) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid admin secret.");
    }
    next();
  }

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
      // Clear insights cache so the next load regenerates with the new profile
      if (couple) {
        budgetRepository.setInsightsCache(couple.id, null).catch(() => {});
      }
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

  router.patch(
    "/api/profile/solo-mode",
    requireAuth,
    asyncHandler(async (request, response) => {
      const { soloMode } = request.body;
      const user = await budgetRepository.updateSoloMode({
        userId: request.user.id,
        soloMode: Boolean(soloMode),
      });
      sendData(response, 200, { user: sanitizeUser(user) });
    }),
  );

  router.delete(
    "/api/auth/account",
    requireAuth,
    asyncHandler(async (request, response) => {
      await budgetRepository.deleteUser(request.user.id);
      sendData(response, 200, { message: "Account deleted." });
    }),
  );

  // Called by the iOS app immediately after RevenueCat confirms a successful purchase.
  // Updates the DB without waiting for the RevenueCat webhook (which may arrive seconds later).
  router.post(
    "/api/subscription/activate",
    requireAuth,
    asyncHandler(async (request, response) => {
      await budgetRepository.activateIAPSubscription(request.user.id);
      sendData(response, 200, { ok: true });
    }),
  );

  // POST /api/admin/grant-pro — manually grant pro to a user by email
  router.post(
    "/api/admin/grant-pro",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const { email } = request.body;
      if (!email) throw new HttpError(400, "MISSING_EMAIL", "email is required.");
      const userId = await budgetRepository.adminGrantPro(email);
      if (!userId) throw new HttpError(404, "NOT_FOUND", "No user with that email.");
      sendData(response, 200, { ok: true, email, status: "pro" });
    }),
  );

  return router;
}
