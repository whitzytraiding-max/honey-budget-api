export function getTodayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentLocalMonthParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getCurrentMonthKey() {
  const { year, month } = getCurrentLocalMonthParts();
  return `${year}-${String(month).padStart(2, "0")}`;
}
