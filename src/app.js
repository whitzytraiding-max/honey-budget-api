/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { createAuthService, createRequireAuth } from "./lib/auth.js";
import { HttpError, sendData } from "./lib/http.js";
import { createExchangeRateService } from "./services/exchangeRateService.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createExchangeRoutes } from "./routes/exchange.js";
import { createUserRoutes } from "./routes/user.js";
import { createCoupleRoutes } from "./routes/couples.js";
import { createTransactionRoutes } from "./routes/transactions.js";
import { createSavingsRoutes } from "./routes/savings.js";
import { createRecurringRoutes } from "./routes/recurring.js";
import { createHouseholdRoutes } from "./routes/household.js";
import { createInsightsRoutes } from "./routes/insights.js";
import { createPlannerRoutes } from "./routes/planner.js";
import { createPushDeviceRoutes } from "./routes/pushDevices.js";
import { createCouponRoutes } from "./routes/coupons.js";
import { createCoachChatRoutes } from "./routes/coachChat.js";
import { createBudgetPlannerRoutes } from "./routes/budgetPlanner.js";
import { createWebhookRoutes } from "./routes/webhooks.js";
import { createDebtRoutes } from "./routes/debt.js";

function createApp({
  app = express(),
  budgetRepository,
  insightsService,
  budgetPlannerService = null,
  exchangeRateService = null,
  emailService = null,
  resetPasswordUrlBase = process.env.RESET_PASSWORD_URL_BASE || process.env.APP_BASE_URL || "",
  jwtSecret = process.env.JWT_SECRET || "",
  jsonParser = express.json(),
}) {
  const isProduction = process.env.NODE_ENV === "production";
  const effectiveResetPasswordUrlBase =
    resetPasswordUrlBase || (!isProduction ? "http://localhost:5173" : "");
  const effectiveJwtSecret =
    jwtSecret || (!isProduction ? "development-secret-change-me" : "");

  if (isProduction && !effectiveResetPasswordUrlBase) {
    throw new Error(
      "RESET_PASSWORD_URL_BASE or APP_BASE_URL is required in production.",
    );
  }

  if (isProduction && !effectiveJwtSecret) {
    throw new Error("JWT_SECRET is required in production.");
  }

  const resolvedExchangeRateService =
    exchangeRateService ?? createExchangeRateService({ budgetRepository });
  const authService = createAuthService({ jwtSecret: effectiveJwtSecret });
  const requireAuth = createRequireAuth({ authService, budgetRepository });

  if (jsonParser) {
    app.use(jsonParser);
  }

  app.get("/health", async (_request, response) => {
    try {
      await budgetRepository.healthCheck();
    } catch {
      // DB reconnecting — still return 200 so UptimeRobot doesn't alert,
      // but the attempt itself warms the connection for the next real request.
    }
    sendData(response, 200, { status: "ok" });
  });

  const ctx = {
    budgetRepository,
    insightsService,
    exchangeRateService: resolvedExchangeRateService,
    emailService,
    authService,
    requireAuth,
    effectiveResetPasswordUrlBase,
  };

  app.use("/", createAuthRoutes(ctx));
  app.use("/", createExchangeRoutes(ctx));
  app.use("/", createUserRoutes(ctx));
  app.use("/", createCoupleRoutes(ctx));
  app.use("/", createTransactionRoutes(ctx));
  app.use("/", createSavingsRoutes(ctx));
  app.use("/", createRecurringRoutes(ctx));
  app.use("/", createHouseholdRoutes(ctx));
  app.use("/", createInsightsRoutes(ctx));
  app.use("/", createPlannerRoutes(ctx));
  app.use("/", createPushDeviceRoutes(ctx));
  app.use("/", createCouponRoutes(ctx));
  app.use("/", createCoachChatRoutes(ctx));
  app.use("/", createBudgetPlannerRoutes({ budgetRepository, budgetPlannerService, requireAuth }));
  app.use("/", createDebtRoutes(ctx));
  app.use("/", createWebhookRoutes());

  // Catch-all 404 — prevents silent hangs on unmatched routes
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  });

  return app;
}

export { createApp };
