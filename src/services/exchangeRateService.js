/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_API_BASE_URL = "https://api.frankfurter.app/latest";
const DEFAULT_KBZ_RATES_URL = "https://www.kbzbank.com/en/";
const DEFAULT_CURRENCY_CODE = "USD";
const MMK_CURRENCY_CODE = "MMK";

function normalizeCurrencyCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isCurrencyCode(value) {
  return /^[A-Z]{3}$/.test(value);
}

function toMonthParts(value, now) {
  if (!value) {
    const currentDate = new Date(now());
    return {
      year: currentDate.getUTCFullYear(),
      month: currentDate.getUTCMonth() + 1,
    };
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return {
      year: Number(value.slice(0, 4)),
      month: Number(value.slice(5, 7)),
    };
  }

  const parsedDate = new Date(value);
  return {
    year: parsedDate.getUTCFullYear(),
    month: parsedDate.getUTCMonth() + 1,
  };
}

function createExchangeRateService({
  fetchImpl = globalThis.fetch,
  budgetRepository = null,
  apiBaseUrl = process.env.EXCHANGE_RATE_API_BASE_URL || DEFAULT_API_BASE_URL,
  kbzRatesUrl = process.env.KBZ_RATES_URL || DEFAULT_KBZ_RATES_URL,
  ttlMs = Number(process.env.EXCHANGE_RATE_TTL_MS ?? DEFAULT_TTL_MS),
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for exchange rate lookups.");
  }

  const cache = new Map();

  async function getKbzMmkRate() {
    const cacheKey = "KBZ:USD:MMK:WORKER_REMITTANCE";
    const cachedEntry = cache.get(cacheKey);
    const currentTime = now();

    if (cachedEntry && currentTime - cachedEntry.cachedAt < ttlMs) {
      return {
        ...cachedEntry.value,
        cached: true,
      };
    }

    const response = await fetchImpl(kbzRatesUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`KBZ rate lookup failed with status ${response.status}.`);
    }

    const html = await response.text();
    const rateMatch = html.match(
      /Worker\s+Remittance\s+Rate\s*:?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
    );

    if (!rateMatch) {
      throw new Error("KBZ rate lookup did not include a Worker Remittance Rate.");
    }

    const numericRate = Number(String(rateMatch[1]).replace(/,/g, ""));
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      throw new Error("KBZ Worker Remittance Rate was not a valid number.");
    }

    const dateMatch = html.match(
      /Worker\s+Remittance\s+Rate\s*:?.*?([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})/is,
    );

    const value = {
      from: "USD",
      to: MMK_CURRENCY_CODE,
      rate: numericRate,
      date: dateMatch?.[1] ?? new Date(currentTime).toISOString().slice(0, 10),
      source: "kbz",
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

  async function getLiveRate({ from, to }) {
    const normalizedFrom = normalizeCurrencyCode(from);
    const normalizedTo = normalizeCurrencyCode(to);
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

  async function getMonthlyMmkRate({ coupleId, date, requireConfigured = false }) {
    if (!budgetRepository?.getCoupleMmkMonthlyRate || !coupleId) {
      if (requireConfigured) {
        const error = new Error("Monthly MMK rate is required.");
        error.code = "MMK_MONTHLY_RATE_REQUIRED";
        throw error;
      }

      return null;
    }

    const { year, month } = toMonthParts(date, now);
    const monthlyRate = await budgetRepository.getCoupleMmkMonthlyRate({
      coupleId,
      year,
      month,
    });

    if (monthlyRate) {
      return monthlyRate;
    }

    const fallbackRate = await budgetRepository.getMostRecentCoupleMmkRate({ coupleId });

    if (fallbackRate) {
      return fallbackRate;
    }

    if (requireConfigured) {
      const error = new Error("Set a monthly MMK exchange rate before using MMK.");
      error.code = "MMK_MONTHLY_RATE_REQUIRED";
      throw error;
    }

    return null;
  }

  async function getRate({
    from,
    to,
    coupleId = null,
    date = null,
    requireMmkMonthly = false,
  }) {
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
        source: "identity",
      };
    }

    const mmkInvolved =
      normalizedFrom === MMK_CURRENCY_CODE || normalizedTo === MMK_CURRENCY_CODE;

    if (mmkInvolved) {
      const monthlyRate = await getMonthlyMmkRate({
        coupleId,
        date,
        requireConfigured: requireMmkMonthly,
      });

      if (monthlyRate) {
        let rate = 1;

        if (normalizedFrom === "USD" && normalizedTo === MMK_CURRENCY_CODE) {
          rate = Number(monthlyRate.rate);
        } else if (normalizedFrom === MMK_CURRENCY_CODE && normalizedTo === "USD") {
          rate = 1 / Number(monthlyRate.rate);
        } else if (normalizedFrom === MMK_CURRENCY_CODE) {
          const usdToTarget =
            normalizedTo === "USD"
              ? { rate: 1 }
              : await getLiveRate({ from: "USD", to: normalizedTo });
          rate = (1 / Number(monthlyRate.rate)) * Number(usdToTarget.rate);
        } else if (normalizedTo === MMK_CURRENCY_CODE) {
          const fromToUsd =
            normalizedFrom === "USD"
              ? { rate: 1 }
              : await getLiveRate({ from: normalizedFrom, to: "USD" });
          rate = Number(fromToUsd.rate) * Number(monthlyRate.rate);
        }

        return {
          from: normalizedFrom,
          to: normalizedTo,
          rate,
          date: `${monthlyRate.year}-${String(monthlyRate.month).padStart(2, "0")}-01`,
          cached: true,
          source: monthlyRate.rateSource,
          mmkMonthly: true,
        };
      }
    }

    const liveRate = await getLiveRate({ from: normalizedFrom, to: normalizedTo });
    return {
      ...liveRate,
      source: "live",
      mmkMonthly: false,
    };
  }

  return {
    getKbzMmkRate,
    getRate,
    getMonthlyMmkRate,
  };
}

export {
  DEFAULT_CURRENCY_CODE,
  MMK_CURRENCY_CODE,
  createExchangeRateService,
  isCurrencyCode,
  normalizeCurrencyCode,
};
