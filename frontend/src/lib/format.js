function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatShortDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
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

export { currency, formatShortDate, getRemainingTone };
