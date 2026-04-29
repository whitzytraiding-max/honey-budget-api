/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { resolveCurrencyCode } from "../services/currencyConversionService.js";
import {
  parseMoney,
  parseDayOfMonth,
  resolveIncomeAllocation,
} from "../lib/parsers.js";
import { sanitizeUser } from "../lib/helpers.js";

export function createAuthRoutes({
  budgetRepository,
  authService,
  emailService,
  effectiveResetPasswordUrlBase,
}) {
  const router = express.Router();

  router.post(
    "/api/auth/register",
    asyncHandler(async (request, response) => {
      const {
        name,
        email,
        password,
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

      if (!name?.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "name is required.");
      }

      if (!email?.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "email is required.");
      }

      if (!password || password.length < 8) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "password must be at least 8 characters.",
        );
      }

      const normalizedMonthlySalary = parseMoney(monthlySalary);
      const hasIncomeAmounts =
        salaryCashAmount !== undefined || salaryCardAmount !== undefined;

      if (!hasIncomeAmounts && (!Number.isFinite(normalizedMonthlySalary) || normalizedMonthlySalary < 0)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "monthlySalary must be a non-negative number.",
        );
      }

      const incomeAllocation = resolveIncomeAllocation({
        monthlySalary: normalizedMonthlySalary,
        salaryPaymentMethod,
        salaryCashAmount,
        salaryCardAmount,
        salaryCashAllocationPct,
        salaryCardAllocationPct,
      });
      if (incomeAllocation.error) {
        throw new HttpError(400, "VALIDATION_ERROR", incomeAllocation.error);
      }

      const normalizedIncomeDay = parseDayOfMonth(incomeDayOfMonth) ?? 1;
      if (normalizedIncomeDay < 1 || normalizedIncomeDay > 28) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "incomeDayOfMonth must be between 1 and 28.",
        );
      }

      const normalizedSavingsTarget = parseMoney(monthlySavingsTarget) ?? 0;
      if (normalizedSavingsTarget < 0) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "monthlySavingsTarget must be zero or greater.",
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedIncomeCurrencyCode = resolveCurrencyCode(incomeCurrencyCode || "USD");
      const existingUser = await budgetRepository.getUserAuthByEmail(normalizedEmail);
      if (existingUser) {
        throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");
      }

      const passwordHash = await authService.hashPassword(password);
      let user;

      try {
        user = await budgetRepository.createUser({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          monthlySalary: incomeAllocation.monthlySalary ?? normalizedMonthlySalary,
          incomeCurrencyCode: normalizedIncomeCurrencyCode,
          salaryPaymentMethod: incomeAllocation.salaryPaymentMethod,
          salaryCashAmount: incomeAllocation.salaryCashAmount,
          salaryCardAmount: incomeAllocation.salaryCardAmount,
          salaryCashAllocationPct: incomeAllocation.salaryCashAllocationPct,
          salaryCardAllocationPct: incomeAllocation.salaryCardAllocationPct,
          incomeDayOfMonth: normalizedIncomeDay,
          monthlySavingsTarget: normalizedSavingsTarget,
        });
      } catch (error) {
        const duplicateTargets = Array.isArray(error?.meta?.target)
          ? error.meta.target
          : [String(error?.meta?.target ?? "")];

        if (error?.code === "P2002" && duplicateTargets.some((target) => target.includes("email"))) {
          throw new HttpError(
            409,
            "EMAIL_TAKEN",
            "An account with this email already exists.",
          );
        }

        throw error;
      }

      const accessToken = authService.signAccessToken(user);
      sendData(response, 201, {
        user: sanitizeUser(user),
        accessToken,
      });
    }),
  );

  router.post(
    "/api/auth/login",
    asyncHandler(async (request, response) => {
      const { email, password } = request.body;

      if (!email?.trim() || !password) {
        throw new HttpError(400, "VALIDATION_ERROR", "email and password are required.");
      }

      const authUser = await budgetRepository.getUserAuthByEmail(
        email.trim().toLowerCase(),
      );
      if (!authUser) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const passwordMatches = await authService.verifyPassword(
        password,
        authUser.passwordHash,
      );
      if (!passwordMatches) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const user = sanitizeUser(authUser);
      const accessToken = authService.signAccessToken(user);

      sendData(response, 200, {
        user,
        accessToken,
      });
    }),
  );

  router.post(
    "/api/auth/forgot-password",
    asyncHandler(async (request, response) => {
      const email = request.body?.email?.trim()?.toLowerCase();

      if (!email) {
        throw new HttpError(400, "VALIDATION_ERROR", "email is required.");
      }

      const authUser = await budgetRepository.getUserAuthByEmail(email);
      let previewResetUrl = null;

      if (authUser) {
        const rawToken = authService.createPasswordResetToken();
        const tokenHash = authService.hashPasswordResetToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const normalizedBaseUrl = effectiveResetPasswordUrlBase.replace(/\/$/, "");
        const resetUrl = `${normalizedBaseUrl}/#/reset-password?token=${encodeURIComponent(rawToken)}`;

        await budgetRepository.createPasswordResetToken({
          userId: authUser.id,
          tokenHash,
          expiresAt,
        });

        let mailResult;
        if (emailService) {
          try {
            mailResult = await emailService.sendPasswordResetEmail({
              to: authUser.email,
              name: authUser.name,
              resetUrl,
            });
          } catch (emailErr) {
            console.error("[forgot-password] Email send failed:", emailErr?.message ?? emailErr);
            mailResult = { delivered: false, preview: false };
          }
        } else {
          mailResult = { preview: true, resetUrl };
        }

        if (mailResult.preview && process.env.NODE_ENV !== "production") {
          previewResetUrl = mailResult.resetUrl || resetUrl;
        }
      }

      sendData(response, 200, {
        message: "If that email exists, we sent a password reset link.",
        ...(process.env.NODE_ENV !== "production" && previewResetUrl ? { previewResetUrl } : {}),
      });
    }),
  );

  router.post(
    "/api/auth/reset-password",
    asyncHandler(async (request, response) => {
      const token = request.body?.token?.trim();
      const password = request.body?.password;

      if (!token) {
        throw new HttpError(400, "VALIDATION_ERROR", "token is required.");
      }

      if (!password || password.length < 8) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "password must be at least 8 characters.",
        );
      }

      const tokenHash = authService.hashPasswordResetToken(token);
      const resetToken = await budgetRepository.getPasswordResetTokenByHash(tokenHash);

      if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt).getTime() < Date.now()) {
        throw new HttpError(
          400,
          "INVALID_RESET_TOKEN",
          "This password reset link is invalid or has expired.",
        );
      }

      const passwordHash = await authService.hashPassword(password);
      const user = await budgetRepository.resetPasswordWithToken({
        tokenId: resetToken.id,
        userId: resetToken.userId,
        passwordHash,
      });
      const accessToken = authService.signAccessToken(user);

      sendData(response, 200, {
        user,
        accessToken,
      });
    }),
  );

  router.post(
    "/api/auth/apple",
    asyncHandler(async (request, response) => {
      const { identity_token, given_name, family_name } = request.body;
      if (!identity_token) {
        throw new HttpError(400, "VALIDATION_ERROR", "identity_token is required.");
      }

      let payload;
      try {
        const [headerB64] = identity_token.split(".");
        const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());

        const keysRes = await fetch("https://appleid.apple.com/auth/keys");
        if (!keysRes.ok) throw new Error("Failed to fetch Apple JWKS");
        const { keys } = await keysRes.json();

        const jwk = keys.find((k) => k.kid === header.kid);
        if (!jwk) throw new Error("No matching Apple public key");

        const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
        const pem = publicKey.export({ type: "spki", format: "pem" });

        payload = jwt.verify(identity_token, pem, {
          algorithms: ["RS256"],
          issuer: "https://appleid.apple.com",
          audience: "com.whitzy.honeybudget",
        });
      } catch {
        throw new HttpError(401, "INVALID_APPLE_TOKEN", "Invalid Apple identity token.");
      }

      const appleId = payload.sub;
      const email = payload.email || null;
      const name = [given_name, family_name].filter(Boolean).join(" ") || (email ? email.split("@")[0] : "Apple User");

      const user = await budgetRepository.upsertAppleUser({ appleId, name, email });
      const accessToken = authService.signAccessToken(user);
      sendData(response, 200, { user: sanitizeUser(user), accessToken });
    }),
  );

  router.post(
    "/api/auth/google",
    asyncHandler(async (request, response) => {
      const { access_token } = request.body;
      if (!access_token) {
        throw new HttpError(400, "VALIDATION_ERROR", "access_token is required.");
      }

      let googleUser;
      try {
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch user info");
        googleUser = await res.json();
      } catch {
        throw new HttpError(401, "INVALID_GOOGLE_TOKEN", "Invalid Google access token.");
      }

      const { sub: googleId, name, email } = googleUser;
      if (!email) {
        throw new HttpError(400, "VALIDATION_ERROR", "Google account has no email.");
      }

      const user = await budgetRepository.upsertGoogleUser({ googleId, name: name ?? email.split("@")[0], email });
      const accessToken = authService.signAccessToken(user);
      sendData(response, 200, { user: sanitizeUser(user), accessToken });
    }),
  );

  return router;
}
