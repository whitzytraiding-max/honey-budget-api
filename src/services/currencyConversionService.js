import {
  DEFAULT_CURRENCY_CODE,
  MMK_CURRENCY_CODE,
  isCurrencyCode,
  normalizeCurrencyCode,
} from "./exchangeRateService.js";

function roundCurrency(value) {
  return Number(Number(value ?? 0).toFixed(2));
}

function resolveCurrencyCode(value, fallback = DEFAULT_CURRENCY_CODE) {
  const normalizedValue = normalizeCurrencyCode(value);
  if (isCurrencyCode(normalizedValue)) {
    return normalizedValue;
  }

  const normalizedFallback = normalizeCurrencyCode(fallback);
  return isCurrencyCode(normalizedFallback) ? normalizedFallback : DEFAULT_CURRENCY_CODE;
}

async function createCurrencyConverter({
  exchangeRateService,
  displayCurrency,
  sourceCurrencies = [],
  coupleId = null,
  date = null,
}) {
  const targetCurrency = resolveCurrencyCode(displayCurrency);
  const uniqueSources = [...new Set(sourceCurrencies.map((entry) => resolveCurrencyCode(entry)))];
  const rates = new Map([[targetCurrency, 1]]);

  await Promise.all(
    uniqueSources
      .filter((sourceCurrency) => sourceCurrency !== targetCurrency)
      .map(async (sourceCurrency) => {
        const rate = await exchangeRateService.getRate({
          from: sourceCurrency,
          to: targetCurrency,
          coupleId,
          date,
        });
        rates.set(sourceCurrency, Number(rate.rate ?? 1));
      }),
  );

  return {
    displayCurrencyCode: targetCurrency,
    convert(amount, sourceCurrency) {
      const normalizedSource = resolveCurrencyCode(sourceCurrency);
      const numericAmount = Number(amount ?? 0);

      if (!Number.isFinite(numericAmount)) {
        return 0;
      }

      return roundCurrency(numericAmount * Number(rates.get(normalizedSource) ?? 1));
    },
    rateFor(sourceCurrency) {
      return Number(rates.get(resolveCurrencyCode(sourceCurrency)) ?? 1);
    },
  };
}

function convertTransactionWithSnapshot(transaction, converter) {
  if (
    transaction?.conversionAnchorCurrencyCode === "USD" &&
    Number.isFinite(Number(transaction?.conversionAnchorAmount)) &&
    Number.isFinite(Number(transaction?.exchangeRateUsed))
  ) {
    const anchorAmount = Number(transaction.conversionAnchorAmount);

    if (
      transaction.convertedCurrencyCode &&
      transaction.convertedCurrencyCode === converter.displayCurrencyCode &&
      Number.isFinite(Number(transaction.convertedAmount))
    ) {
      return roundCurrency(transaction.convertedAmount);
    }

    if (converter.displayCurrencyCode === "USD") {
      return roundCurrency(anchorAmount);
    }

    if (converter.displayCurrencyCode === MMK_CURRENCY_CODE) {
      return roundCurrency(anchorAmount * Number(transaction.exchangeRateUsed));
    }

    return roundCurrency(anchorAmount * converter.rateFor("USD"));
  }

  return converter.convert(transaction?.amount ?? 0, transaction?.currencyCode);
}

export { convertTransactionWithSnapshot, createCurrencyConverter, resolveCurrencyCode, roundCurrency };
