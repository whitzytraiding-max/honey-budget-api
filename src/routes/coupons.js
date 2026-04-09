/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";

export function createCouponRoutes({ budgetRepository, requireAuth }) {
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

  // POST /api/coupons/redeem — authenticated user redeems a code
  router.post(
    "/api/coupons/redeem",
    requireAuth,
    asyncHandler(async (request, response) => {
      const raw = (request.body.code || "").trim().toUpperCase();
      if (!raw) throw new HttpError(400, "MISSING_CODE", "Code is required.");

      const coupon = await budgetRepository.findCouponByCode(raw);
      if (!coupon || !coupon.isActive) {
        throw new HttpError(404, "INVALID_CODE", "Code not found or no longer active.");
      }
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        throw new HttpError(400, "CODE_EXHAUSTED", "This code has no uses remaining.");
      }

      const alreadyRedeemed = await budgetRepository.findCouponRedemption(
        request.user.id,
        coupon.id,
      );
      if (alreadyRedeemed) {
        throw new HttpError(400, "ALREADY_REDEEMED", "You have already used this code.");
      }

      const expiresAt =
        coupon.type === "permanent"
          ? null
          : new Date(Date.now() + coupon.durationDays * 24 * 60 * 60 * 1000);

      await budgetRepository.redeemCoupon({
        userId: request.user.id,
        couponId: coupon.id,
        expiresAt,
      });

      sendData(response, 200, {
        type: coupon.type,
        durationDays: coupon.durationDays,
        expiresAt,
        message:
          coupon.type === "permanent"
            ? "You now have permanent Pro access."
            : `You now have Pro access for ${coupon.durationDays} days.`,
      });
    }),
  );

  // GET /api/admin/coupons — list all coupon codes
  router.get(
    "/api/admin/coupons",
    requireAdmin,
    asyncHandler(async (_request, response) => {
      const coupons = await budgetRepository.listCoupons();
      sendData(response, 200, { coupons });
    }),
  );

  // POST /api/admin/coupons — create a new coupon code
  router.post(
    "/api/admin/coupons",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const { code, type, durationDays, maxUses, note } = request.body;

      if (!code || typeof code !== "string") {
        throw new HttpError(400, "MISSING_CODE", "code is required.");
      }
      if (type !== "permanent" && type !== "days") {
        throw new HttpError(400, "INVALID_TYPE", "type must be 'permanent' or 'days'.");
      }
      if (type === "days" && (!durationDays || durationDays < 1)) {
        throw new HttpError(400, "INVALID_DURATION", "durationDays must be >= 1 for type 'days'.");
      }

      const coupon = await budgetRepository.createCoupon({
        code: code.trim().toUpperCase(),
        type,
        durationDays: type === "days" ? Number(durationDays) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        note: note || null,
      });

      sendData(response, 201, { coupon });
    }),
  );

  // DELETE /api/admin/coupons/:code — deactivate a code
  router.delete(
    "/api/admin/coupons/:code",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const code = request.params.code.toUpperCase();
      await budgetRepository.deactivateCoupon(code);
      sendData(response, 200, { ok: true });
    }),
  );

  return router;
}
