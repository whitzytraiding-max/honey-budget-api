/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_API_BASE_URL = "https://api.frankfurter.app/latest";

function normalizeCurrencyCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isCurrencyCode(value) {
  return /^[A-Z]{3}$/.test(value);
}

function createExchangeRateService({
  fetchImpl = globalThis.fetch,
  apiBaseUrl = process.env.EXCHANGE_RATE_API_BASE_URL || DEFAULT_API_BASE_URL,
  ttlMs = Number(process.env.EXCHANGE_RATE_TTL_MS ?? DEFAULT_TTL_MS),
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for exchange rate lookups.");
  }

  const cache = new Map();

  async function getRate({ from, to }) {
    const normalizedFrom = normalizeCurrencyCode(from);
    const normalizedTo = normalizeCurrencyCode(to);

    if (!isCurrencyCode(normalizedFrom) || !isCurrencyCode(normalizedTo)) {
      throw new Error("Exchange rates require ISO 4217 currency codes.");
    }

    if (normalizedFrom === normalizedTo) {
      return {
        from: normalizedFrom,
        to: normalizedTo,
        rate: 1,
        date: new Date(now()).toISOString().slice(0, 10),
        cached: true,
      };
    }

    const cacheKey = `${normalizedFrom}:${normalizedTo}`;
    const cachedEntry = cache.get(cacheKey);
    const currentTime = now();

    if (cachedEntry && currentTime - cachedEntry.cachedAt < ttlMs) {
      return {
        ...cachedEntry.value,
        cached: true,
      };
    }

    const response = await fetchImpl(
      `${apiBaseUrl}?from=${normalizedFrom}&to=${normalizedTo}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Exchange rate lookup failed with status ${response.status}.`);
    }

    const data = await response.json();
    const numericRate = Number(data?.rates?.[normalizedTo] ?? 0);

    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      throw new Error("Exchange rate response did not include a valid rate.");
    }

    const value = {
      from: normalizedFrom,
      to: normalizedTo,
      rate: numericRate,
      date: data?.date ?? new Date(currentTime).toISOString().slice(0, 10),
    };

    cache.set(cacheKey, {
      cachedAt: currentTime,
      value,
    });

    return {
      ...value,
      cached: false,
    };
  }

  return {
    getRate,
  };
}

export { createExchangeRateService };
