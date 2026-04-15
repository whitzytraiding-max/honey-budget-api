/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { createPrismaBudgetRepository } from "./repositories/prismaBudgetRepository.js";
import { createEmailService } from "./services/emailService.js";
import { createExchangeRateService } from "./services/exchangeRateService.js";
import { createInsightsService, createOpenAIClient, createAnthropicClient, createGeminiClient } from "./services/insightsService.js";
import { createBudgetPlannerService } from "./services/budgetPlannerService.js";

const isProduction = process.env.NODE_ENV === "production";
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4000);
const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost",
  "https://localhost",
];
// Always allowed — these origins can only come from our own Capacitor app
const capacitorOrigins = [
  "capacitor://localhost",
  "https://localhost",
];
const configuredCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (isProduction && configuredCorsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS is required in production.");
}

const allowedCorsOrigins = new Set(
  isProduction
    ? [...configuredCorsOrigins, ...capacitorOrigins]
    : [...configuredCorsOrigins, ...defaultCorsOrigins, ...capacitorOrigins],
);
const jwtSecret = process.env.JWT_SECRET || "";
const resetPasswordUrlBase =
  process.env.RESET_PASSWORD_URL_BASE || process.env.APP_BASE_URL || "";

if (isProduction && !jwtSecret) {
  throw new Error("JWT_SECRET is required in production.");
}

if (isProduction && !resetPasswordUrlBase) {
  throw new Error(
    "RESET_PASSWORD_URL_BASE or APP_BASE_URL is required in production.",
  );
}

const budgetRepository = createPrismaBudgetRepository({ prisma });
const emailService = createEmailService();
const exchangeRateService = createExchangeRateService({ budgetRepository });
const geminiClient = createGeminiClient();
const insightsService = createInsightsService({
  budgetRepository,
  exchangeRateService,
  geminiClient,
  anthropicClient: createAnthropicClient(),
  openaiClient: createOpenAIClient(),
});
const budgetPlannerService = createBudgetPlannerService();

function isPrivateNetworkOrigin(origin) {
  if (!origin) {
    return false;
  }

  try {
    const { protocol, hostname } = new URL(origin);

    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return true;
    }

    if (hostname.startsWith("192.168.")) {
      return true;
    }

    if (hostname.startsWith("10.")) {
      return true;
    }

    const match = hostname.match(/^172\.(\d{1,2})\./);
    if (match) {
      const secondOctet = Number(match[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

const serverApp = express();
if (isProduction) {
  serverApp.set("trust proxy", 1);
}

serverApp.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
serverApp.use((request, response, next) => {
  response.setHeader("X-Product-Name", "Honey Budget");
  response.setHeader("X-Code-Owner", "Whitzy");
  response.setHeader("X-Whitzy-Signature", "whitzy:honey-budget:2026");

  const origin = request.headers.origin;

  if (
    origin &&
    (allowedCorsOrigins.has(origin) ||
      (!isProduction && isPrivateNetworkOrigin(origin)))
  ) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});
serverApp.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
serverApp.use(express.json({ limit: "10mb" }));
const app = createApp({
  app: serverApp,
  budgetRepository,
  insightsService,
  budgetPlannerService,
  exchangeRateService,
  emailService,
  resetPasswordUrlBase: resetPasswordUrlBase || "http://localhost:5173",
  jwtSecret: jwtSecret || "development-secret-change-me",
  jsonParser: null,
});

app.listen(port, host, () => {
  console.log(`Honey Budget API listening on http://${host}:${port}`);
});
