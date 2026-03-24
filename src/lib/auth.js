/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { HttpError } from "./http.js";

function createAuthService({ jwtSecret, jwtExpiresIn = "7d" }) {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required.");
  }

  return {
    async hashPassword(password) {
      return bcrypt.hash(password, 10);
    },
    async verifyPassword(password, passwordHash) {
      return bcrypt.compare(password, passwordHash);
    },
    createPasswordResetToken() {
      return crypto.randomBytes(32).toString("hex");
    },
    hashPasswordResetToken(token) {
      return crypto.createHash("sha256").update(token).digest("hex");
    },
    signAccessToken(user) {
      return jwt.sign(
        {
          sub: String(user.id),
          email: user.email,
        },
        jwtSecret,
        { expiresIn: jwtExpiresIn },
      );
    },
    verifyAccessToken(token) {
      return jwt.verify(token, jwtSecret);
    },
  };
}

function createRequireAuth({ authService, budgetRepository }) {
  return async function requireAuth(request, _response, next) {
    try {
      const authorization = request.headers.authorization;

      if (!authorization?.startsWith("Bearer ")) {
        throw new HttpError(401, "UNAUTHORIZED", "Missing bearer token.");
      }

      const token = authorization.slice("Bearer ".length).trim();
      const payload = authService.verifyAccessToken(token);
      const user = await budgetRepository.getUserById(Number(payload.sub));

      if (!user) {
        throw new HttpError(401, "UNAUTHORIZED", "Authenticated user no longer exists.");
      }

      request.auth = {
        token,
        userId: user.id,
      };
      request.user = user;
      next();
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }

      next(new HttpError(401, "UNAUTHORIZED", "Invalid or expired token."));
    }
  };
}

export { createAuthService, createRequireAuth };
