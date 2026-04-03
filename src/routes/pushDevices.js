/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { parseBoolean } from "../lib/parsers.js";

export function createPushDeviceRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/push-devices",
    requireAuth,
    asyncHandler(async (request, response) => {
      const devices = await budgetRepository.listPushDevicesForUser(request.user.id);
      sendData(response, 200, { devices });
    }),
  );

  router.post(
    "/api/push-devices",
    requireAuth,
    asyncHandler(async (request, response) => {
      const platform = String(request.body?.platform ?? "").trim().toLowerCase();
      const token = String(request.body?.token ?? "").trim();
      const enabled = parseBoolean(request.body?.enabled, true);

      if (!platform) {
        throw new HttpError(400, "VALIDATION_ERROR", "platform is required.");
      }

      if (!token) {
        throw new HttpError(400, "VALIDATION_ERROR", "token is required.");
      }

      const device = await budgetRepository.registerPushDevice({
        userId: request.user.id,
        platform,
        token,
        enabled,
      });

      sendData(response, 201, { device });
    }),
  );

  return router;
}
