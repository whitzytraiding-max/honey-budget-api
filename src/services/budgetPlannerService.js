/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import * as XLSX from "xlsx";

const PARSE_SYSTEM_PROMPT = `You are a financial data analyst helping import a budget spreadsheet into Honey Budget.

Your job:
1. Read the raw spreadsheet data provided.
2. Extract: income amounts, expense categories + amounts, any savings goal, the time period covered (months).
3. Return a structured JSON plan AND a short list of clarifying questions if anything is ambiguous.

Rules:
- If months are columns (e.g. Jan, Feb...), extract each month's data separately.
- If only one set of figures exists, treat it as the monthly average and repeat it across the period.
- Guess category names from row labels — normalize to: Housing, Food & Dining, Transport, Utilities, Entertainment, Shopping, Health, Savings, Subscriptions, Insurance, Childcare, Debt, Other.
- If a savings goal or end target is visible (e.g. "Save $10,000 by Dec"), extract it.
- Never invent numbers. If something is unclear, add it to questions.

Respond ONLY with this JSON shape (no markdown, no extra text):
{
  "parsedPlan": {
    "name": "string — a short descriptive name",
    "startMonth": "YYYY-MM",
    "endMonth": "YYYY-MM",
    "currency": "3-letter code e.g. USD",
    "goalAmount": number or null,
    "goalDescription": "string or null",
    "months": [
      {
        "month": "YYYY-MM",
        "income": number,
        "categories": [{ "name": "string", "amount": number }],
        "totalExpenses": number,
        "plannedSavings": number
      }
    ]
  },
  "questions": ["string", "string"] // empty array if nothing is unclear
}`;

const REFINE_SYSTEM_PROMPT = `You are a financial data analyst. The user has answered clarifying questions about their budget spreadsheet.
Update the parsedPlan JSON to incorporate their answers.
Respond ONLY with the updated parsedPlan JSON (same shape, no markdown, no extra text).`;

export function createBudgetPlannerService({ geminiClient, geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite" }) {
  if (!geminiClient) {
    return {
      parseSpreadsheet: async () => { throw new Error("AI not configured"); },
      refineWithAnswers: async () => { throw new Error("AI not configured"); },
    };
  }

  async function parseSpreadsheet(fileBuffer, mimeType) {
    // Convert spreadsheet to text representation
    const extractedText = extractSpreadsheetText(fileBuffer, mimeType);

    const model = geminiClient.getGenerativeModel({
      model: geminiModel,
      systemInstruction: PARSE_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(
      `Spreadsheet data:\n${extractedText}`
    );
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini returned no valid JSON");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      parsedPlan: parsed.parsedPlan,
      questions: parsed.questions ?? [],
      extractedText,
    };
  }

  async function refineWithAnswers({ extractedText, parsedPlan, answers }) {
    const model = geminiClient.getGenerativeModel({
      model: geminiModel,
      systemInstruction: REFINE_SYSTEM_PROMPT,
    });

    const prompt = [
      `Original spreadsheet data:\n${extractedText}`,
      `\nCurrent parsed plan:\n${JSON.stringify(parsedPlan)}`,
      `\nUser answers to clarifying questions:\n${answers}`,
    ].join("\n");

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini returned no valid JSON");

    return JSON.parse(jsonMatch[0]);
  }

  return { parseSpreadsheet, refineWithAnswers };
}

function extractSpreadsheetText(buffer, mimeType) {
  try {
    // CSV — pass through as text
    if (mimeType === "text/csv" || mimeType === "application/csv") {
      return buffer.toString("utf-8");
    }

    // Excel (xlsx, xls, etc.)
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { skipHidden: true });
      if (csv.trim()) {
        lines.push(`=== Sheet: ${sheetName} ===`);
        lines.push(csv);
      }
    }

    return lines.join("\n");
  } catch {
    // Last resort: try reading as text
    return buffer.toString("utf-8");
  }
}
