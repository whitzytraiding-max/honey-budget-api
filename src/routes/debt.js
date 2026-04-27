/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import { parseMoney, validateIsoDate } from "../lib/parsers.js";
import { resolveCurrencyCode } from "../services/currencyConversionService.js";

export function createDebtRoutes({ budgetRepository, requireAuth }) {
  const router = express.Router();

  // List all debts for the current user (includes partner's debts if in a couple)
  router.get(
    "/api/debts",
    requireAuth,
    asyncHandler(async (request, response) => {
      const debts = await budgetRepository.listDebtsForUser(request.user.id);
      sendData(response, 200, { debts });
    }),
  );

  // Create a new debt
  router.post(
    "/api/debts",
    requireAuth,
    asyncHandler(async (request, response) => {
      const title = String(request.body?.title ?? "").trim();
      const originalAmount = parseMoney(request.body?.originalAmount);
      const currencyCode = resolveCurrencyCode(request.body?.currencyCode || request.user.incomeCurrencyCode || "USD");
      const minimumPayment = request.body?.minimumPayment != null ? parseMoney(request.body.minimumPayment) : null;
      const paymentMethod = String(request.body?.paymentMethod ?? "card");

      if (!title) throw new HttpError(400, "VALIDATION_ERROR", "title is required.");
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "originalAmount must be a positive number.");
      }

      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const debt = await budgetRepository.createDebt({
        userId: request.user.id,
        coupleId: couple?.id ?? null,
        title,
        originalAmount,
        currencyCode,
        minimumPayment,
        paymentMethod,
      });

      sendData(response, 201, { debt });
    }),
  );

  // Update a debt (title, minimumPayment, paymentMethod only — amount is immutable)
  router.patch(
    "/api/debts/:id",
    requireAuth,
    asyncHandler(async (request, response) => {
      const debtId = Number(request.params.id);
      if (!Number.isInteger(debtId)) throw new HttpError(400, "VALIDATION_ERROR", "Invalid debt id.");

      const updates = {};
      if (request.body?.title !== undefined) updates.title = String(request.body.title).trim();
      if (request.body?.minimumPayment !== undefined) {
        updates.minimumPayment = request.body.minimumPayment !== null ? parseMoney(request.body.minimumPayment) : null;
      }
      if (request.body?.paymentMethod !== undefined) updates.paymentMethod = String(request.body.paymentMethod);

      if (updates.title !== undefined && !updates.title) {
        throw new HttpError(400, "VALIDATION_ERROR", "title cannot be empty.");
      }

      const debt = await budgetRepository.updateDebt({ debtId, userId: request.user.id, ...updates });
      if (!debt) throw new HttpError(404, "DEBT_NOT_FOUND", "Debt not found.");

      sendData(response, 200, { debt });
    }),
  );

  // Delete a debt and all its payments
  router.delete(
    "/api/debts/:id",
    requireAuth,
    asyncHandler(async (request, response) => {
      const debtId = Number(request.params.id);
      if (!Number.isInteger(debtId)) throw new HttpError(400, "VALIDATION_ERROR", "Invalid debt id.");

      const deleted = await budgetRepository.deleteDebt({ debtId, userId: request.user.id });
      if (!deleted) throw new HttpError(404, "DEBT_NOT_FOUND", "Debt not found.");

      sendData(response, 200, { ok: true });
    }),
  );

  // Log a debt payment — creates an expense transaction AND a debt payment entry
  router.post(
    "/api/debts/:id/payment",
    requireAuth,
    asyncHandler(async (request, response) => {
      const debtId = Number(request.params.id);
      if (!Number.isInteger(debtId)) throw new HttpError(400, "VALIDATION_ERROR", "Invalid debt id.");

      const amount = parseMoney(request.body?.amount);
      const date = validateIsoDate(request.body?.date);
      const note = String(request.body?.note ?? "").trim();
      const currencyCode = resolveCurrencyCode(request.body?.currencyCode || request.user.incomeCurrencyCode || "USD");
      const paymentMethod = String(request.body?.paymentMethod ?? "card");

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number.");
      }
      if (!date) throw new HttpError(400, "VALIDATION_ERROR", "date is required (YYYY-MM-DD).");

      // Verify debt is accessible by this user
      const debts = await budgetRepository.listDebtsForUser(request.user.id);
      const debt = debts.find((d) => d.id === debtId);
      if (!debt) throw new HttpError(404, "DEBT_NOT_FOUND", "Debt not found.");

      // Create the expense transaction so it deducts from the budget
      const transaction = await budgetRepository.addTransaction({
        userId: request.user.id,
        amount,
        currencyCode,
        description: `Debt payment: ${debt.title}`,
        category: "Debt",
        type: "one-time",
        paymentMethod,
        date,
      });

      // Create the debt payment entry (linked to the transaction)
      const result = await budgetRepository.createDebtPayment({
        debtId,
        userId: request.user.id,
        amount,
        currencyCode,
        note: note || `Payment toward ${debt.title}`,
        date,
        transactionId: transaction.id,
      });

      if (!result) throw new HttpError(404, "DEBT_NOT_FOUND", "Debt not found.");

      sendData(response, 201, { debt: result.debt, payment: result.payment, transaction });
    }),
  );

  // Delete a debt payment — also deletes the linked expense transaction
  router.delete(
    "/api/debts/:id/payment/:paymentId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const paymentId = Number(request.params.paymentId);
      if (!Number.isInteger(paymentId)) throw new HttpError(400, "VALIDATION_ERROR", "Invalid payment id.");

      const transactionId = await budgetRepository.deleteDebtPayment({
        paymentId,
        userId: request.user.id,
      });

      if (transactionId === null) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment not found.");

      // Delete the linked transaction so it's removed from budget totals
      if (transactionId) {
        await budgetRepository.deleteUserTransaction({
          transactionId,
          userId: request.user.id,
        });
      }

      sendData(response, 200, { ok: true });
    }),
  );

  return router;
}
