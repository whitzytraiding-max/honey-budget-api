/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { resolveCurrencyCode } from "../services/currencyConversionService.js";
import { MMK_CURRENCY_CODE } from "../services/exchangeRateService.js";
import { validateCurrencyCode } from "./parsers.js";

export function isMmkInvolved(...codes) {
  return codes.some((code) => resolveCurrencyCode(code) === MMK_CURRENCY_CODE);
}

export function resolveDisplayCurrencyCode({ requestedDisplayCurrency, currentUser, partnerUser }) {
  if (requestedDisplayCurrency && validateCurrencyCode(requestedDisplayCurrency)) {
    return String(requestedDisplayCurrency).trim().toUpperCase();
  }
  return resolveCurrencyCode(
    currentUser?.incomeCurrencyCode || partnerUser?.incomeCurrencyCode || "USD",
  );
}
