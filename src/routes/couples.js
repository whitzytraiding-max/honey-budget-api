/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";

export function createCoupleRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  router.post(
    "/api/couples",
    requireAuth,
    asyncHandler(async (request, response) => {
      const rawPartnerUserId = request.body?.partnerUserId;
      const partnerUserId =
        typeof rawPartnerUserId === "string"
          ? Number.parseInt(rawPartnerUserId.trim(), 10)
          : rawPartnerUserId;

      if (!Number.isInteger(partnerUserId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "partnerUserId must be an integer.");
      }

      if (partnerUserId === request.user.id) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "You cannot create a couple with yourself.",
        );
      }

      const partner = await budgetRepository.getUserById(partnerUserId);
      if (!partner) {
        throw new HttpError(404, "USER_NOT_FOUND", "Partner user not found.");
      }

      const invite = await budgetRepository.linkCoupleByPartnerEmail({
        userId: request.user.id,
        partnerEmail: partner.email,
      });

      sendData(response, 201, {
        invite,
        message: "Invite sent. Your partner needs to accept it before you are linked.",
      });
    }),
  );

  router.post(
    "/api/couples/link",
    requireAuth,
    asyncHandler(async (request, response) => {
      const partnerEmail = request.body?.partnerEmail;

      if (!partnerEmail) {
        throw new HttpError(400, "VALIDATION_ERROR", "partnerEmail is required.");
      }

      const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();

      if (normalizedPartnerEmail === request.user.email) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "You cannot link yourself as your partner.",
        );
      }

      const invite = await budgetRepository.linkCoupleByPartnerEmail({
        userId: request.user.id,
        partnerEmail: normalizedPartnerEmail,
      });

      sendData(response, 201, {
        invite,
        message: "Invite sent. Your partner needs to accept it before you are linked.",
      });
    }),
  );

  router.post(
    "/api/couples/invites/:inviteId/respond",
    requireAuth,
    asyncHandler(async (request, response) => {
      const inviteId = Number.parseInt(request.params.inviteId, 10);
      const action = String(request.body?.action ?? "").trim().toLowerCase();

      if (!Number.isInteger(inviteId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "inviteId must be an integer.");
      }

      if (action !== "accept" && action !== "decline") {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "action must be 'accept' or 'decline'.",
        );
      }

      const result = await budgetRepository.respondToCoupleInvite({
        inviteId,
        userId: request.user.id,
        action,
      });

      sendData(response, 200, result);
    }),
  );

  router.get(
    "/api/notifications",
    requireAuth,
    asyncHandler(async (request, response) => {
      const [inviteNotifications, activityNotifications] = await Promise.all([
        budgetRepository.listPendingCoupleInvitesForUser(request.user.id),
        budgetRepository.listActivityNotificationsForUser(request.user.id),
      ]);

      sendData(response, 200, {
        ...inviteNotifications,
        activity: activityNotifications,
      });
    }),
  );

  return router;
}
