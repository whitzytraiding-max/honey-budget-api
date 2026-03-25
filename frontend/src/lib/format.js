const SUPPORTED_CURRENCIES = [
  { value: "USD" },
  { value: "EUR" },
  { value: "GBP" },
  { value: "CAD" },
  { value: "AUD" },
  { value: "MMK" },
];

let activeCurrency = "USD";
let activeBaseCurrency = "USD";
let activeLocale = "en-US";
let activeExchangeRate = 1;

function normalizeLocale(locale) {
  if (!locale) {
    return "en-US";
  }

  if (locale === "en") {
    return "en-US";
  }

  if (locale === "es") {
    return "es-ES";
  }

  return locale;
}

function setFormatPreferences({ currency: nextCurrency, locale: nextLocale } = {}) {
  if (nextCurrency) {
    activeCurrency = nextCurrency;
  }

  if (nextLocale) {
    activeLocale = normalizeLocale(nextLocale);
  }
}

function setCurrencyConversionPreferences({
  displayCurrency,
  baseCurrency,
  locale,
  exchangeRate,
} = {}) {
  if (displayCurrency) {
    activeCurrency = displayCurrency;
  }

  if (baseCurrency) {
    activeBaseCurrency = baseCurrency;
  }

  if (locale) {
    activeLocale = normalizeLocale(locale);
  }

  if (typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0) {
    activeExchangeRate = exchangeRate;
  }
}

function currency(value) {
  const numericValue = Number(value ?? 0);
  const convertedValue =
    activeBaseCurrency === activeCurrency ? numericValue : numericValue * activeExchangeRate;

  return new Intl.NumberFormat(activeLocale, {
    style: "currency",
    currency: activeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(convertedValue);
}

function formatShortDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(activeLocale, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getRemainingTone(remainingBudget, householdIncome) {
  const ratio = householdIncome > 0 ? remainingBudget / householdIncome : 0;

  if (ratio > 0.5) {
    return {
      text: "text-emerald-700",
      bar: "from-emerald-400 via-teal-300 to-cyan-300",
      badge: "bg-emerald-100 text-emerald-800",
    };
  }

  if (ratio >= 0.1) {
    return {
      text: "text-amber-600",
      bar: "from-amber-400 via-orange-300 to-yellow-200",
      badge: "bg-amber-100 text-amber-800",
    };
  }

  return {
    text: "text-rose-600",
    bar: "from-rose-500 via-orange-400 to-amber-200",
    badge: "bg-rose-100 text-rose-700",
  };
}

function getCurrencyOptions(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames([normalizedLocale], { type: "currency" })
      : null;

  return SUPPORTED_CURRENCIES.map((entry) => {
    const name = displayNames?.of(entry.value) ?? entry.value;
    return {
      value: entry.value,
      label: `${name} (${entry.value})`,
    };
  });
}

export {
  SUPPORTED_CURRENCIES,
  currency,
  formatShortDate,
  getCurrencyOptions,
  getRemainingTone,
  setCurrencyConversionPreferences,
  setFormatPreferences,
};
