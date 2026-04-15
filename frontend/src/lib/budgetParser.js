/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 *
 * Client-side spreadsheet parser — runs entirely in the browser.
 * Ported from src/services/budgetPlannerService.js so no file upload is needed.
 */
import * as XLSX from "xlsx";

const INCOME_KEYWORDS = ["income", "salary", "revenue", "earnings", "pay", "wage", "inflow", "total income", "gross"];
const GOAL_KEYWORDS = ["goal", "target", "savings goal", "save", "saving", "end balance", "final", "objective"];
const SKIP_KEYWORDS = ["total", "subtotal", "sum", "balance", "net", "profit", "loss", "surplus", "deficit"];

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const CATEGORY_NORMALISE = [
  [/housing|rent|mortgage/i, "Housing"],
  [/food|dining|restaurant|groceries|grocery|meal/i, "Food & Dining"],
  [/transport|car|fuel|petrol|gas|uber|taxi|bus|train|travel/i, "Transport"],
  [/utilities|electricity|water|internet|phone|mobile|utility/i, "Utilities"],
  [/entertainment|fun|leisure|hobby|sport|gym|netflix|spotify|streaming/i, "Entertainment"],
  [/shopping|clothes|clothing|fashion|retail/i, "Shopping"],
  [/health|medical|doctor|pharmacy|insurance health/i, "Health"],
  [/insurance/i, "Insurance"],
  [/subscriptions?|subscription/i, "Subscriptions"],
  [/childcare|child|kids|school|education/i, "Childcare"],
  [/debt|loan|credit|repayment/i, "Debt"],
];

function normaliseCategory(name) {
  const s = String(name ?? "").trim();
  for (const [re, cat] of CATEGORY_NORMALISE) {
    if (re.test(s)) return cat;
  }
  return s || "Other";
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : Math.abs(n);
}

function detectMonth(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  const monthMatch = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[\s\-\/]?(\d{2,4})?/i);
  if (monthMatch) {
    const monthNum = MONTH_NAMES[monthMatch[1].toLowerCase().slice(0, 3)] ?? null;
    if (!monthNum) return null;
    const yearStr = monthMatch[2];
    if (yearStr) {
      const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
      return { year, month: monthNum };
    }
    return monthNum;
  }
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})/);
  if (isoMatch) return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  const numMatch = s.match(/^(\d{1,2})[-\/](\d{4})/);
  if (numMatch) return { year: Number(numMatch[2]), month: Number(numMatch[1]) };
  return null;
}

function isMonthHeader(val) {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  if (s in MONTH_NAMES) return true;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[\s\-\/]?\d{2,4}$/i.test(s)) return true;
  if (/^\d{4}[-\/]\d{1,2}$/.test(s)) return true;
  if (/^\d{1,2}[-\/]\d{4}$/.test(s)) return true;
  return false;
}

function yyyyMm(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseGrid(arrayBuffer, mimeType, filename) {
  try {
    let workbook;
    const ext = String(filename ?? "").split(".").pop()?.toLowerCase();
    if (mimeType === "text/csv" || mimeType === "application/csv" || ext === "csv") {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      workbook = XLSX.read(text, { type: "string" });
    } else {
      workbook = XLSX.read(arrayBuffer, { type: "array" });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  } catch {
    return [];
  }
}

function parseMonthsAsColumns(rows) {
  const headerRow = rows[0];
  const currentYear = new Date().getFullYear();

  const monthCols = [];
  for (let c = 1; c < headerRow.length; c++) {
    const m = detectMonth(headerRow[c]);
    if (!m) continue;
    if (typeof m === "object") {
      monthCols.push({ col: c, year: m.year, month: m.month });
    } else {
      const prev = monthCols[monthCols.length - 1];
      let year = currentYear;
      if (prev) {
        year = m < prev.month ? prev.year + 1 : prev.year;
      }
      monthCols.push({ col: c, year, month: m });
    }
  }

  if (!monthCols.length) return parseSinglePeriod(rows);

  const months = monthCols.map(({ year, month }) => ({
    month: yyyyMm(year, month),
    income: 0,
    categories: [],
    totalExpenses: 0,
    plannedSavings: 0,
  }));

  let goalAmount = null;
  let goalDescription = null;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const label = String(row[0] ?? "").trim();
    if (!label) continue;

    const labelLower = label.toLowerCase();
    const isIncome = INCOME_KEYWORDS.some((k) => labelLower.includes(k));
    const isGoal = GOAL_KEYWORDS.some((k) => labelLower.includes(k));
    const isSkip = SKIP_KEYWORDS.some((k) => labelLower === k);

    if (isSkip && !isIncome) continue;

    if (isGoal) {
      const val = toNum(row[monthCols[monthCols.length - 1]?.col]);
      if (val !== null) goalAmount = val;
      goalDescription = label;
      continue;
    }

    for (let i = 0; i < monthCols.length; i++) {
      const val = toNum(row[monthCols[i].col]);
      if (val === null || val === 0) continue;
      if (isIncome) {
        months[i].income += val;
      } else {
        months[i].categories.push({ name: normaliseCategory(label), amount: val });
        months[i].totalExpenses += val;
      }
    }
  }

  for (const m of months) {
    m.plannedSavings = Math.max(0, m.income - m.totalExpenses);
    const merged = {};
    for (const c of m.categories) {
      merged[c.name] = (merged[c.name] ?? 0) + c.amount;
    }
    m.categories = Object.entries(merged).map(([n, a]) => ({ name: n, amount: a }));
  }

  if (!goalAmount && months.length) {
    const total = months.reduce((s, m) => s + m.plannedSavings, 0);
    if (total > 0) goalAmount = Math.round(total);
  }

  return {
    name: "Budget Plan",
    startMonth: months[0].month,
    endMonth: months[months.length - 1].month,
    currency: "USD",
    goalAmount,
    goalDescription,
    months,
  };
}

function parseMonthsAsRows(rows) {
  const headerRow = rows[0] ?? [];
  const currentYear = new Date().getFullYear();

  const colMap = {};
  for (let c = 1; c < headerRow.length; c++) {
    const label = String(headerRow[c] ?? "").trim();
    if (!label) continue;
    const ll = label.toLowerCase();
    if (INCOME_KEYWORDS.some((k) => ll.includes(k))) {
      colMap[c] = { type: "income", label };
    } else if (!SKIP_KEYWORDS.some((k) => ll === k)) {
      colMap[c] = { type: "category", label: normaliseCategory(label) };
    }
  }

  const months = [];
  let goalAmount = null;
  let goalDescription = null;
  let prevMonth = null, prevYear = currentYear;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const m = detectMonth(row[0]);
    if (!m) continue;

    let year = prevYear, month;
    if (typeof m === "object") { year = m.year; month = m.month; }
    else {
      month = m;
      if (prevMonth && month < prevMonth) year = prevYear + 1;
    }
    prevMonth = month; prevYear = year;

    const bucket = { month: yyyyMm(year, month), income: 0, categories: [], totalExpenses: 0, plannedSavings: 0 };

    for (const [ci, info] of Object.entries(colMap)) {
      const val = toNum(row[Number(ci)]);
      if (val === null || val === 0) continue;
      if (info.type === "income") {
        bucket.income += val;
      } else {
        bucket.categories.push({ name: info.label, amount: val });
        bucket.totalExpenses += val;
      }
    }

    bucket.plannedSavings = Math.max(0, bucket.income - bucket.totalExpenses);
    months.push(bucket);
  }

  if (!months.length) return parseSinglePeriod(rows);

  if (!goalAmount) {
    const total = months.reduce((s, m) => s + m.plannedSavings, 0);
    if (total > 0) goalAmount = Math.round(total);
  }

  return {
    name: "Budget Plan",
    startMonth: months[0].month,
    endMonth: months[months.length - 1].month,
    currency: "USD",
    goalAmount,
    goalDescription,
    months,
  };
}

function parseSinglePeriod(rows) {
  const now = new Date();
  let income = 0;
  const categories = [];
  let goalAmount = null;
  let goalDescription = null;

  for (const row of rows) {
    const label = String(row[0] ?? "").trim();
    if (!label) continue;
    const labelLower = label.toLowerCase();

    let val = null;
    for (let c = 1; c < row.length; c++) {
      val = toNum(row[c]);
      if (val !== null && val > 0) break;
    }
    if (val === null) continue;

    if (GOAL_KEYWORDS.some((k) => labelLower.includes(k))) {
      goalAmount = val; goalDescription = label; continue;
    }
    if (SKIP_KEYWORDS.some((k) => labelLower === k)) continue;
    if (INCOME_KEYWORDS.some((k) => labelLower.includes(k))) {
      income += val;
    } else {
      categories.push({ name: normaliseCategory(label), amount: val });
    }
  }

  const totalExpenses = categories.reduce((s, c) => s + c.amount, 0);
  const plannedSavings = Math.max(0, income - totalExpenses);
  if (!goalAmount && plannedSavings > 0) goalAmount = Math.round(plannedSavings * 12);

  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      month: yyyyMm(d.getFullYear(), d.getMonth() + 1),
      income,
      categories: categories.map((c) => ({ ...c })),
      totalExpenses,
      plannedSavings,
    });
  }

  return {
    name: "Monthly Budget",
    startMonth: months[0].month,
    endMonth: months[11].month,
    currency: "USD",
    goalAmount,
    goalDescription,
    months,
  };
}

/**
 * Parse a spreadsheet ArrayBuffer in the browser.
 * Returns a parsedPlan object identical to what the server returns.
 */
export function parseBudgetSpreadsheet(arrayBuffer, mimeType, filename) {
  const grid = parseGrid(arrayBuffer, mimeType, filename);
  if (!grid.length) throw new Error("Could not read the spreadsheet. Please check the file format.");

  const rows = grid.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  const firstRow = rows[0] ?? [];
  const firstColVals = rows.map((r) => r[0]);

  const monthsInRow0 = firstRow.slice(1).filter(isMonthHeader).length;
  const monthsInCol0 = firstColVals.slice(1).filter(isMonthHeader).length;

  if (monthsInRow0 >= 2) return parseMonthsAsColumns(rows);
  if (monthsInCol0 >= 2) return parseMonthsAsRows(rows);
  return parseSinglePeriod(rows);
}
