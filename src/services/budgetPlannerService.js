/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import * as XLSX from "xlsx";

// Keywords used to identify row/column types
const INCOME_KEYWORDS = ["income", "salary", "revenue", "earnings", "pay", "wage", "inflow", "total income", "gross"];
// Explicit savings contributions (per-month amounts being set aside)
const SAVINGS_KEYWORDS = ["saving", "save"];
// Overall goal/target amount (not per-month contribution)
const GOAL_KEYWORDS = ["goal", "target", "end balance", "objective"];
// Summary/calculated rows/columns — skip these entirely
const SKIP_KEYWORDS = ["total", "subtotal", "sum", "balance", "net", "profit", "loss", "surplus", "deficit", "remaining", "leftover"];

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
  // "Jan 2026", "January 2026", "Jan", "January"
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
  // Plain "jan", "january"
  if (s in MONTH_NAMES) return true;
  // "Jan 2026", "January 2026", "jan-2026", "jan/2026"
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[\s\-\/]?\d{2,4}$/i.test(s)) return true;
  // "2026-01", "2026/01"
  if (/^\d{4}[-\/]\d{1,2}$/.test(s)) return true;
  // "01/2026", "01-2026"
  if (/^\d{1,2}[-\/]\d{4}$/.test(s)) return true;
  return false;
}

function yyyyMm(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isSavingsLabel(ll) {
  // Per-month savings contributions — but NOT if the label also indicates an overall goal/target
  const isGoal = GOAL_KEYWORDS.some((k) => ll.includes(k));
  return !isGoal && SAVINGS_KEYWORDS.some((k) => ll.includes(k));
}

function isSkipLabel(ll) {
  return SKIP_KEYWORDS.some((k) => ll === k);
}

function parseGrid(buffer, mimeType) {
  try {
    let workbook;
    if (mimeType === "text/csv" || mimeType === "application/csv" || String(buffer).includes(",")) {
      workbook = XLSX.read(buffer.toString("utf-8"), { type: "string" });
    } else {
      workbook = XLSX.read(buffer, { type: "buffer" });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  } catch {
    return [];
  }
}

export function createBudgetPlannerService({
  geminiClient = null,
  geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
} = {}) {
  function parseSpreadsheet(fileBuffer, mimeType) {
    const grid = parseGrid(fileBuffer, mimeType);
    if (!grid.length) throw new Error("Could not read the spreadsheet. Please check the file format.");

    // Remove fully empty rows
    const rows = grid.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

    // Detect orientation: months as column headers (row 0) or row labels (col 0)
    const firstRow = rows[0] ?? [];
    const firstColVals = rows.map((r) => r[0]);

    const monthsInRow0 = firstRow.slice(1).filter(isMonthHeader).length;
    const monthsInCol0 = firstColVals.slice(1).filter(isMonthHeader).length;

    let parsedPlan;

    if (monthsInRow0 >= 2) {
      parsedPlan = parseMonthsAsColumns(rows);
    } else if (monthsInCol0 >= 2) {
      parsedPlan = parseMonthsAsRows(rows);
    } else {
      parsedPlan = parseSinglePeriod(rows);
    }

    return { parsedPlan, questions: [], extractedText: "" };
  }

  // ── GEMINI: ANALYSE ──────────────────────────────────────────────────────────
  // Called when client-side parser has low confidence (e.g. income = 0).
  // Sends column headers + sample rows to Gemini, returns clarifying questions.
  async function analyseWithGemini({ rawHeaders, sampleRows, parsedPlan }) {
    if (!geminiClient) return { questions: [], looksGood: true };

    const allMonths = parsedPlan.months ?? [];
    const totalIncome = allMonths.reduce((s, m) => s + (m.income || 0), 0);
    const totalSavings = allMonths.reduce((s, m) => s + (m.plannedSavings || 0), 0);
    const uniqueCats = [...new Set(allMonths.flatMap((m) => m.categories.map((c) => c.name)))];
    const monthCount = allMonths.length;

    const issues = [];
    if (totalIncome === 0) issues.push("income column not detected");
    if (totalSavings === 0) issues.push("savings amounts not detected");

    const headerStr = (rawHeaders ?? []).map((h, i) => `[${i}] "${h}"`).join("  ");
    const sampleStr = (sampleRows ?? []).slice(0, 4).map((row, ri) =>
      `  Row ${ri + 1}: ${JSON.stringify(row)}`
    ).join("\n");

    const avgIncome = monthCount ? (totalIncome / monthCount).toFixed(0) : 0;
    const avgSavings = monthCount ? (totalSavings / monthCount).toFixed(0) : 0;

    const prompt = `You are a financial spreadsheet analyst. A user uploaded a budget spreadsheet that was automatically parsed.

SPREADSHEET HEADERS: ${headerStr}
SAMPLE DATA (first few rows):
${sampleStr}

PARSE RESULT:
- Monthly income: $${avgIncome}${totalIncome === 0 ? " (FAILED TO DETECT)" : ""}
- Monthly planned savings: $${avgSavings}${totalSavings === 0 ? " (FAILED TO DETECT)" : ""}
- Expense categories found: ${uniqueCats.join(", ") || "none"}
- Months in plan: ${monthCount}
${issues.length ? "PROBLEMS: " + issues.join(", ") : ""}

Your task: decide if the parse result is correct or if clarification is needed.

If everything looks correct (income > 0 and meaningful categories found), return:
{"questions":[],"looksGood":true}

If something is wrong or ambiguous, ask 1–3 short friendly questions. Reference actual column names from the spreadsheet. Be specific. Examples:
- "We couldn't identify your income column. Which column contains your monthly take-home pay?"
- "Is 'House savings' ($600/month) money you set aside each month, or a regular expense like a mortgage?"
- "We spotted 'Book georgia', 'Book Japan' — are these travel bookings? We can group them as Travel if you like."

Return ONLY valid JSON — no markdown, no extra text:
{"questions":["Q1","Q2"],"looksGood":false}`;

    try {
      const model = geminiClient.getGenerativeModel({ model: geminiModel });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { questions: [], looksGood: true };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
        looksGood: Boolean(parsed.looksGood),
      };
    } catch (err) {
      console.error("[budget-planner] Gemini analyse error:", err?.message);
      return { questions: [], looksGood: true }; // fail open — don't block the user
    }
  }

  // ── GEMINI: REFINE ────────────────────────────────────────────────────────────
  // Called after user answers Gemini's clarifying questions.
  // Returns a corrected parsedPlan with the right income/savings/categories.
  async function refineWithAnswers({ rawHeaders, sampleRows, parsedPlan, answers }) {
    if (!geminiClient) return parsedPlan;

    const headerStr = (rawHeaders ?? []).map((h, i) => `[${i}] "${h}"`).join("  ");
    const sampleStr = (sampleRows ?? []).slice(0, 4).map((row, ri) =>
      `  Row ${ri + 1}: ${JSON.stringify(row)}`
    ).join("\n");

    const prompt = `You are a financial data expert. A user uploaded a budget spreadsheet and answered clarifying questions about it.

SPREADSHEET HEADERS: ${headerStr}
SAMPLE DATA:
${sampleStr}

CURRENT PARSED PLAN (may have errors — fix it based on the user's answers):
${JSON.stringify(parsedPlan, null, 2)}

USER'S ANSWERS:
${answers}

Produce a corrected parsedPlan. Use the user's answers to fix income, savings, and categories. Keep all months but correct the numbers.

Required JSON structure (return ONLY this JSON, no markdown, no explanation):
{
  "name": string,
  "startMonth": "YYYY-MM",
  "endMonth": "YYYY-MM",
  "currency": "USD",
  "goalAmount": number | null,
  "goalDescription": string | null,
  "months": [
    {
      "month": "YYYY-MM",
      "income": number,
      "categories": [{"name": string, "amount": number}],
      "totalExpenses": number,
      "plannedSavings": number
    }
  ]
}`;

    try {
      const model = geminiClient.getGenerativeModel({ model: geminiModel });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return parsedPlan;
      const refined = JSON.parse(jsonMatch[0]);
      if (!refined.months?.length || !refined.startMonth || !refined.endMonth) return parsedPlan;
      return refined;
    } catch (err) {
      console.error("[budget-planner] Gemini refine error:", err?.message);
      return parsedPlan; // fail gracefully
    }
  }

  return { parseSpreadsheet, analyseWithGemini, refineWithAnswers };
}

// ── MONTHS AS COLUMNS ─────────────────────────────────────────────────────────
// Row 0: label | Jan | Feb | Mar ...
// Row n: Category | 500 | 600 | 450 ...
function parseMonthsAsColumns(rows) {
  const headerRow = rows[0];
  const currentYear = new Date().getFullYear();

  // Build month index: colIndex → { year, month }
  const monthCols = [];
  for (let c = 1; c < headerRow.length; c++) {
    const m = detectMonth(headerRow[c]);
    if (!m) continue;
    if (typeof m === "object") {
      monthCols.push({ col: c, year: m.year, month: m.month });
    } else {
      // month number only — assign year by sequence
      const prev = monthCols[monthCols.length - 1];
      let year = currentYear;
      if (prev) {
        year = m < prev.month ? prev.year + 1 : prev.year;
      }
      monthCols.push({ col: c, year, month: m });
    }
  }

  if (!monthCols.length) return parseSinglePeriod(rows);

  // Init month buckets
  const months = monthCols.map(({ year, month }) => ({
    month: yyyyMm(year, month),
    income: 0,
    categories: [],
    totalExpenses: 0,
    plannedSavings: 0,
  }));

  let goalAmount = null;
  let goalDescription = null;
  let hasExplicitSavings = false;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const label = String(row[0] ?? "").trim();
    if (!label) continue;

    const ll = label.toLowerCase();
    const isIncome = INCOME_KEYWORDS.some((k) => ll.includes(k));
    const isSavings = isSavingsLabel(ll);
    const isGoal = !isSavings && GOAL_KEYWORDS.some((k) => ll.includes(k));
    const isSkip = isSkipLabel(ll);

    if ((isSkip || isGoal) && !isIncome) {
      if (isGoal) {
        const val = toNum(row[monthCols[monthCols.length - 1]?.col]);
        if (val !== null) goalAmount = val;
        goalDescription = label;
      }
      continue;
    }

    if (isSavings) {
      // Explicit per-month savings contributions
      hasExplicitSavings = true;
      for (let i = 0; i < monthCols.length; i++) {
        const val = toNum(row[monthCols[i].col]);
        if (val !== null && val > 0) months[i].plannedSavings += val;
      }
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

  // Compute savings
  for (const m of months) {
    if (!hasExplicitSavings) {
      m.plannedSavings = Math.max(0, m.income - m.totalExpenses);
    }
    // Deduplicate merged categories
    const merged = {};
    for (const c of m.categories) {
      merged[c.name] = (merged[c.name] ?? 0) + c.amount;
    }
    m.categories = Object.entries(merged).map(([n, a]) => ({ name: n, amount: a }));
  }

  // Derive goal from total planned savings if not found
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

// ── MONTHS AS ROWS ─────────────────────────────────────────────────────────
// Col 0: Jan/Feb/... | Col 1: Income | Col 2: Housing | Col 3: Food ...
function parseMonthsAsRows(rows) {
  const headerRow = rows[0] ?? [];
  const currentYear = new Date().getFullYear();

  // Build colMap: colIndex → { type: "income"|"savings"|"category", label }
  const colMap = {};
  for (let c = 1; c < headerRow.length; c++) {
    const label = String(headerRow[c] ?? "").trim();
    if (!label) continue;
    const ll = label.toLowerCase();
    if (INCOME_KEYWORDS.some((k) => ll.includes(k))) {
      colMap[c] = { type: "income", label };
    } else if (isSavingsLabel(ll)) {
      // e.g. "Savings", "House savings", "Save for house" — per-month contributions
      colMap[c] = { type: "savings", label };
    } else if (isSkipLabel(ll)) {
      // e.g. "Remaining", "Total" summary columns — skip
    } else {
      colMap[c] = { type: "category", label: normaliseCategory(label) };
    }
  }

  const hasSavingsCols = Object.values(colMap).some((v) => v.type === "savings");
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
      } else if (info.type === "savings") {
        bucket.plannedSavings += val;
      } else {
        bucket.categories.push({ name: info.label, amount: val });
        bucket.totalExpenses += val;
      }
    }

    // If no explicit savings columns, derive from income minus expenses
    if (!hasSavingsCols) {
      bucket.plannedSavings = Math.max(0, bucket.income - bucket.totalExpenses);
    }
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

// ── SINGLE PERIOD (no months detected) ──────────────────────────────────────
// Two-column: Label | Amount
// Repeat across 12 months from current month
function parseSinglePeriod(rows) {
  const now = new Date();
  let income = 0;
  let plannedSavings = 0;
  let hasExplicitSavings = false;
  const categories = [];
  let goalAmount = null;
  let goalDescription = null;

  for (const row of rows) {
    const label = String(row[0] ?? "").trim();
    if (!label) continue;
    const ll = label.toLowerCase();

    // Find first numeric value in the row
    let val = null;
    for (let c = 1; c < row.length; c++) {
      val = toNum(row[c]);
      if (val !== null && val > 0) break;
    }
    if (val === null) continue;

    if (GOAL_KEYWORDS.some((k) => ll.includes(k)) && !isSavingsLabel(ll)) {
      goalAmount = val; goalDescription = label; continue;
    }
    if (isSkipLabel(ll)) continue;
    if (INCOME_KEYWORDS.some((k) => ll.includes(k))) {
      income += val;
    } else if (isSavingsLabel(ll)) {
      plannedSavings += val;
      hasExplicitSavings = true;
    } else {
      categories.push({ name: normaliseCategory(label), amount: val });
    }
  }

  const totalExpenses = categories.reduce((s, c) => s + c.amount, 0);
  const monthSavings = hasExplicitSavings ? plannedSavings : Math.max(0, income - totalExpenses);
  if (!goalAmount && monthSavings > 0) goalAmount = Math.round(monthSavings * 12);

  // Build 12 months from now
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      month: yyyyMm(d.getFullYear(), d.getMonth() + 1),
      income,
      categories: categories.map((c) => ({ ...c })),
      totalExpenses,
      plannedSavings: monthSavings,
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
