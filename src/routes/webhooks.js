/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { prisma } from "../lib/prisma.js";

const ACTIVATE_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]);
const DEACTIVATE_EVENTS = new Set(["EXPIRATION", "BILLING_ISSUE"]);

export function createWebhookRoutes() {
  const router = express.Router();
  const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || "";

  router.post("/api/webhooks/revenuecat", async (req, res) => {
    const auth = req.headers.authorization || "";
    if (WEBHOOK_SECRET && auth !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { event } = req.body || {};
    if (!event?.type) return res.status(200).json({ ok: true });

    const { type, app_user_id, expiration_at_ms } = event;
    const userId = Number.parseInt(app_user_id, 10);
    if (!userId || Number.isNaN(userId)) return res.status(200).json({ ok: true });

    try {
      if (ACTIVATE_EVENTS.has(type)) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "pro",
            subscriptionExpiresAt: expiration_at_ms ? new Date(expiration_at_ms) : null,
            subscriptionProvider: "revenuecat_ios",
          },
        });
      } else if (DEACTIVATE_EVENTS.has(type)) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "free",
            subscriptionExpiresAt: null,
          },
        });
      }
      // CANCELLATION — user stays pro until expiry, no action needed
    } catch {
      // User not found or DB error — still return 200 so RevenueCat doesn't retry indefinitely
    }

    return res.status(200).json({ ok: true });
  });

  return router;
}
