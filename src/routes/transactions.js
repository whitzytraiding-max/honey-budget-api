/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import express from "express";
import { HttpError, asyncHandler, sendData } from "../lib/http.js";
import {
  resolveCurrencyCode,
  convertTransactionWithSnapshot,
  createCurrencyConverter,
  roundCurrency,
} from "../services/currencyConversionService.js";
import { MMK_CURRENCY_CODE } from "../services/exchangeRateService.js";
import { buildBudgetSnapshot, buildBudgetSnapshotForUsers } from "../services/dashboardService.js";
import { normalizeTransactionPayload, validateYearMonth, roundRate } from "../lib/parsers.js";
import {
  sanitizeUser,
  getPartner,
  isMmkInvolved,
  resolveDisplayCurrencyCode,
  getCalendarMonthWindow,
} from "../lib/helpers.js";
import {
  buildMmkTransactionSnapshot,
  materializeRecurringBills,
  resolvePartnerUser,
  buildMonthlySummary,
  createPartnerExpenseNotification,
} from "../lib/builders.js";

export function createTransactionRoutes({ budgetRepository, exchangeRateService, requireAuth }) {
  const router = express.Router();

  router.get(
    "/api/dashboard",
    requireAuth,
    asyncHandler(async (request, response) => {
      const days = Number(request.query.days ?? 30);
      const displayCurrency = request.query.displayCurrency?.trim();
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        const partnerUser = null;
        const snapshot = await buildBudgetSnapshotForUsers({
          budgetRepository,
          exchangeRateService,
          currentUser: request.user,
          partnerUser,
          days: Number.isFinite(days) && days > 0 ? days : 30,
          displayCurrency,
        });
        return sendData(response, 200, {
          couple: null,
          currentUser: sanitizeUser(request.user),
          partner: null,
          dashboard: snapshot,
        });
      }

      try {
        await materializeRecurringBills({
          budgetRepository,
          exchangeRateService,
          couple,
          throughDate: new Date().toISOString().slice(0, 10),
        });
      } catch (error) {
        console.warn("[/api/dashboard] materializeRecurringBills failed, continuing:", error.message);
      }

      const snapshot = await buildBudgetSnapshot({
        budgetRepository,
        exchangeRateService,
        coupleId: couple.id,
        days: Number.isFinite(days) && days > 0 ? days : 30,
        displayCurrency,
      });

      sendData(response, 200, {
        couple,
        currentUser: sanitizeUser(request.user),
        partner: getPartner(couple, request.user.id),
        dashboard: snapshot,
      });
    }),
  );

  router.get(
    "/api/summary",
    requireAuth,
    asyncHandler(async (request, response) => {
      const month = request.query.month?.trim();
      const displayCurrency = request.query.displayCurrency?.trim();
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const partnerUser = await resolvePartnerUser({
        budgetRepository,
        user: request.user,
      });

      try {
        await materializeRecurringBills({
          budgetRepository,
          exchangeRateService,
          couple,
          throughDate: new Date().toISOString().slice(0, 10),
        });
      } catch (error) {
        console.warn("[/api/summary] materializeRecurringBills failed, continuing:", error.message);
      }

      const summary = await buildMonthlySummary({
        budgetRepository,
        exchangeRateService,
        currentUser: request.user,
        partnerUser,
        month: month || null,
        displayCurrency,
      });

      sendData(response, 200, summary);
    }),
  );

  router.post(
    "/api/transactions",
    requireAuth,
    asyncHandler(async (request, response) => {
      const couple = await budgetRepository.getCoupleForUser(request.user.id);
      const normalizedTransaction = normalizeTransactionPayload(request.body);

      // Resolve which user this expense is logged under (self or partner)
      let targetUserId = request.user.id;
      const requestedLogAsUserId = request.body?.logAsUserId
        ? Number(request.body.logAsUserId)
        : null;
      if (requestedLogAsUserId && requestedLogAsUserId !== request.user.id) {
        const partner = getPartner(couple, request.user.id);
        if (!partner || partner.id !== requestedLogAsUserId) {
          throw new HttpError(403, "FORBIDDEN", "You can only log expenses for yourself or your partner.");
        }
        targetUserId = requestedLogAsUserId;
      }

      const sourceCurrencyCode =
        normalizedTransaction.currencyCode ??
        resolveCurrencyCode(request.user.incomeCurrencyCode || "USD");
      const displayCurrencyCode = resolveDisplayCurrencyCode({
        requestedDisplayCurrency: request.body?.displayCurrencyCode,
        currentUser: request.user,
      });
      const exchangeSnapshot = await buildMmkTransactionSnapshot({
        exchangeRateService,
        coupleId: couple?.id ?? null,
        amount: normalizedTransaction.amount,
        sourceCurrencyCode,
        targetCurrencyCode: displayCurrencyCode,
        transactionDate: normalizedTransaction.date,
      });

      const transaction = await budgetRepository.addTransaction({
        userId: targetUserId,
        ...normalizedTransaction,
        currencyCode: sourceCurrencyCode,
        ...exchangeSnapshot,
      });
      const notification = await createPartnerExpenseNotification({
        budgetRepository,
        actor: request.user,
        transaction,
      });

      sendData(response, 201, {
        transaction,
        coupleId: couple?.id ?? null,
        notification,
      });
    }),
  );

  router.patch(
    "/api/transactions/:transactionId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const transactionId = Number.parseInt(request.params.transactionId, 10);

      if (!Number.isInteger(transactionId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "transactionId must be an integer.");
      }

      const normalizedTransaction = normalizeTransactionPayload(request.body);
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (!couple) {
        throw new HttpError(
          409,
          "COUPLE_REQUIRED",
          "Link a couple before editing shared expenses.",
        );
      }

      const sourceCurrencyCode =
        normalizedTransaction.currencyCode ??
        resolveCurrencyCode(request.user.incomeCurrencyCode || "USD");
      const displayCurrencyCode = resolveDisplayCurrencyCode({
        requestedDisplayCurrency: request.body?.displayCurrencyCode,
        currentUser: request.user,
      });
      const existingTransaction = await budgetRepository.getUserOwnedTransaction({
        transactionId,
        userId: request.user.id,
      });

      if (!existingTransaction) {
        throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
      }

      let exchangeSnapshot = null;
      const canReuseExistingMmkSnapshot =
        existingTransaction.currencyCode === sourceCurrencyCode &&
        existingTransaction.conversionAnchorCurrencyCode === "USD" &&
        Number.isFinite(Number(existingTransaction.conversionAnchorAmount)) &&
        Number.isFinite(Number(existingTransaction.exchangeRateUsed)) &&
        Number(existingTransaction.amount) > 0;

      if (canReuseExistingMmkSnapshot && isMmkInvolved(sourceCurrencyCode, displayCurrencyCode)) {
        const anchorPerUnit =
          Number(existingTransaction.conversionAnchorAmount) /
          Number(existingTransaction.amount);
        const anchorAmount = roundCurrency(normalizedTransaction.amount * anchorPerUnit);
        const convertedAmount =
          displayCurrencyCode === "USD"
            ? anchorAmount
            : displayCurrencyCode === MMK_CURRENCY_CODE
              ? roundCurrency(anchorAmount * Number(existingTransaction.exchangeRateUsed))
              : roundCurrency(
                  anchorAmount *
                    Number(
                      (
                        await exchangeRateService.getRate({
                          from: "USD",
                          to: displayCurrencyCode,
                          coupleId: couple.id,
                          date: normalizedTransaction.date,
                        })
                      ).rate ?? 1,
                    ),
                );

        exchangeSnapshot = {
          convertedAmount,
          convertedCurrencyCode: displayCurrencyCode,
          conversionAnchorAmount: anchorAmount,
          conversionAnchorCurrencyCode: "USD",
          exchangeRateUsed: roundRate(existingTransaction.exchangeRateUsed),
          exchangeRateSource: existingTransaction.exchangeRateSource ?? "custom",
        };
      } else {
        exchangeSnapshot = await buildMmkTransactionSnapshot({
          exchangeRateService,
          coupleId: couple.id,
          amount: normalizedTransaction.amount,
          sourceCurrencyCode,
          targetCurrencyCode: displayCurrencyCode,
          transactionDate: normalizedTransaction.date,
        });
      }

      const result = await budgetRepository.updateUserTransaction({
        transactionId,
        userId: request.user.id,
        ...normalizedTransaction,
        currencyCode: sourceCurrencyCode,
        ...exchangeSnapshot,
      });
      const notification = await createPartnerExpenseNotification({
        budgetRepository,
        actor: request.user,
        transaction: result.transaction,
        previousTransaction: result.previousTransaction,
      });

      sendData(response, 200, {
        transaction: result.transaction,
        previousTransaction: result.previousTransaction,
        notification,
      });
    }),
  );

  router.delete(
    "/api/transactions/:transactionId",
    requireAuth,
    asyncHandler(async (request, response) => {
      const transactionId = Number.parseInt(request.params.transactionId, 10);

      if (!Number.isInteger(transactionId)) {
        throw new HttpError(400, "VALIDATION_ERROR", "transactionId must be an integer.");
      }

      const transaction = await budgetRepository.deleteUserTransaction({
        transactionId,
        userId: request.user.id,
      });
      const notification = await createPartnerExpenseNotification({
        budgetRepository,
        actor: request.user,
        transaction: null,
        previousTransaction: transaction,
      });

      sendData(response, 200, { transaction, notification });
    }),
  );

  router.get(
    "/api/transactions",
    requireAuth,
    asyncHandler(async (request, response) => {
      const days = Number(request.query.days ?? 30);
      const month = request.query.month?.trim();
      const displayCurrency = resolveDisplayCurrencyCode({
        requestedDisplayCurrency: request.query.displayCurrency?.trim(),
        currentUser: request.user,
      });
      const couple = await budgetRepository.getCoupleForUser(request.user.id);

      if (month && !validateYearMonth(month)) {
        throw new HttpError(400, "VALIDATION_ERROR", "month must use YYYY-MM.");
      }

      if (couple) {
        try {
          await materializeRecurringBills({
            budgetRepository,
            exchangeRateService,
            couple,
            throughDate: new Date().toISOString().slice(0, 10),
          });
        } catch (error) {
          console.warn("[/api/transactions] materializeRecurringBills failed, continuing:", error.message);
        }
      }

      const monthWindow = month ? getCalendarMonthWindow(month) : null;
      const resolvedDays = Number.isFinite(days) && days > 0 ? days : 30;
      const transactions = couple
        ? await budgetRepository.listCoupleTransactions({
            coupleId: couple.id,
            days: resolvedDays,
            fromDate: monthWindow?.from,
            toDate: monthWindow?.to,
          })
        : await budgetRepository.listTransactionsForUserIds({
            userIds: [request.user.id],
            days: resolvedDays,
            fromDate: monthWindow?.from,
            toDate: monthWindow?.to,
          });
      const converter = await createCurrencyConverter({
        exchangeRateService,
        displayCurrency,
        coupleId: couple?.id ?? null,
        date: monthWindow?.from ?? new Date().toISOString().slice(0, 10),
        sourceCurrencies: transactions.map((transaction) => transaction.currencyCode),
      });

      sendData(
        response,
        200,
        {
          displayCurrencyCode: displayCurrency,
          transactions: transactions.map((transaction) => ({
            ...transaction,
            displayAmount: convertTransactionWithSnapshot(transaction, converter),
            displayCurrencyCode: displayCurrency,
          })),
        },
        { count: transactions.length },
      );
    }),
  );

  return router;
}
