import OpenAI from "openai";
import { buildBudgetSnapshot, buildBudgetSnapshotForUsers } from "./dashboardService.js";

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

const FIXED_ESSENTIAL_CATEGORIES = new Set([
  "housing",
  "rent",
  "mortgage",
  "insurance",
  "utilities",
  "phone & internet",
  "taxes",
  "childcare",
]);

function isFixedEssentialCategory(category) {
  return FIXED_ESSENTIAL_CATEGORIES.has(String(category ?? "").trim().toLowerCase());
}

function buildBehaviorFlags(snapshot) {
  const topCategory = snapshot.topCategories[0] ?? null;
  const topSpender = [...snapshot.users]
    .sort(
      (left, right) =>
        (right.spending?.totalSpent ?? 0) - (left.spending?.totalSpent ?? 0),
    )[0] ?? null;
  const totalSpent = Number(snapshot.summary.totalSpent ?? 0);
  const topSpenderSharePct =
    totalSpent > 0 && topSpender
      ? Number(
          (((topSpender.spending?.totalSpent ?? 0) / totalSpent) * 100).toFixed(1),
        )
      : 0;
  const biggestOneTime = [...snapshot.transactions]
    .filter((transaction) => transaction.type === "one-time")
    .sort((left, right) => right.amount - left.amount)[0] ?? null;
  const recurringCategories = snapshot.transactions
    .filter((transaction) => transaction.type === "recurring")
    .reduce((totals, transaction) => {
      totals[transaction.category] = roundCurrency(
        (totals[transaction.category] ?? 0) + transaction.amount,
      );
      return totals;
    }, {});

  return {
    topCategory,
    topSpender: topSpender
      ? {
          id: topSpender.id,
          name: topSpender.name,
          totalSpent: roundCurrency(topSpender.spending?.totalSpent ?? 0),
          cashSpent: roundCurrency(topSpender.spending?.cashSpent ?? 0),
          cardSpent: roundCurrency(topSpender.spending?.cardSpent ?? 0),
          topCategories: topSpender.spending?.categories ?? [],
          sharePct: topSpenderSharePct,
        }
      : null,
    biggestOneTime,
    recurringCategories: Object.entries(recurringCategories)
      .sort((left, right) => right[1] - left[1])
      .map(([category, amount]) => ({ category, amount })),
  };
}

function createSafeInsights(message, snapshot, provider = "service-fallback") {
  return {
    provider,
    overview: message,
    fairSplit: {
      explanation:
        snapshot?.fairSplit?.length === 2
          ? `${snapshot.fairSplit[0].name} should cover ${snapshot.fairSplit[0].sharePct}% of recurring bills and ${snapshot.fairSplit[1].name} should cover ${snapshot.fairSplit[1].sharePct}% based on monthly income.`
          : "Link both partners to compute a fair split.",
      recurringBillSplit: snapshot?.fairSplit ?? [],
    },
    tips: [
      {
        title: "Budget note",
        action: message,
        reason: "The app returned a safe fallback response instead of failing.",
      },
    ],
  };
}

function createEmptyInsights(snapshot) {
  return {
    provider: "empty-state",
    overview: "Add your first expense to see AI coaching!",
    fairSplit: {
      explanation:
        snapshot?.fairSplit?.length === 2
          ? `${snapshot.fairSplit[0].name} should cover ${snapshot.fairSplit[0].sharePct}% of recurring bills and ${snapshot.fairSplit[1].name} should cover ${snapshot.fairSplit[1].sharePct}% based on monthly income.`
          : "Link both partners to compute a fair split.",
      recurringBillSplit: snapshot?.fairSplit ?? [],
    },
    tips: [
      {
        title: "Start with one expense",
        action: "Add your first expense to see AI coaching!",
        reason: "The app needs at least one recent transaction before it can analyze spending patterns.",
      },
    ],
  };
}

function createFallbackInsights(snapshot) {
  const { topCategory, topSpender, biggestOneTime, recurringCategories } =
    buildBehaviorFlags(snapshot);
  const topRecurringCategory = recurringCategories[0] ?? null;
  const topCategoryIsFixedEssential =
    topCategory &&
    isFixedEssentialCategory(topCategory.category) &&
    topRecurringCategory?.category?.toLowerCase?.() === topCategory.category.toLowerCase();
  const spenderLeadCategory = topSpender?.topCategories?.[0] ?? null;
  const spenderLeadCategoryIsFixedEssential =
    spenderLeadCategory &&
    isFixedEssentialCategory(spenderLeadCategory.category) &&
    topRecurringCategory?.category?.toLowerCase?.() ===
      spenderLeadCategory.category.toLowerCase();
  const tips = [];

  if (topSpender && topSpender.sharePct >= 60 && !spenderLeadCategoryIsFixedEssential) {
    tips.push({
      title: `${topSpender.name} should slow down on ${spenderLeadCategory?.category ?? "discretionary spending"}`,
      action: spenderLeadCategory
        ? `Put a ${spenderLeadCategory.category.toLowerCase()} cooldown in place for ${topSpender.name}: no new ${spenderLeadCategory.category.toLowerCase()} purchases for 5 days, then revisit with a smaller cap.`
        : `Pause non-essential purchases for ${topSpender.name} for the next 5 days and revisit the budget before restarting discretionary spend.`,
      reason: `${topSpender.name} drove ${topSpender.sharePct}% of the last ${snapshot.period.days} days of spending, so one person's habits are shaping the budget more than the household average.`,
    });
  } else if (snapshot.summary.cashSharePct >= 40) {
    tips.push({
      title: "Put a weekly cap on cash-heavy categories",
      action:
        "Set a fixed weekly envelope for dining, transport, and impulse purchases, then stop spending from that envelope once it is empty.",
      reason: `Cash is ${snapshot.summary.cashSharePct}% of your last ${snapshot.period.days} days of spending, so leakage is harder to review than card spend.`,
    });
  } else {
    tips.push({
      title: "Review recurring card charges together",
      action:
        "Run a 15-minute weekly card-charge review and cancel, downgrade, or pause one low-value subscription this month.",
      reason: `Card spending is ${snapshot.summary.cardSharePct}% of your recent total, so recurring charges are the fastest place to trim.`,
    });
  }

  if (topCategory && !topCategoryIsFixedEssential) {
    tips.push({
      title: `Treat ${topCategory.category} as this month’s pressure point`,
      action: `Cut ${topCategory.category} spending by 20% for the next two weeks and move the saved amount into a named goal the same day.`,
      reason: `${topCategory.category} is your largest category at ${topCategory.sharePct}% of total spending, so it is the most effective place to tighten up without touching every category.`,
    });
  } else if (topCategoryIsFixedEssential) {
    tips.push({
      title: `Plan around ${topCategory.category.toLowerCase()} instead of treating it like flexible spend`,
      action: `Keep ${topRecurringCategory.amount} ring-fenced for ${topCategory.category.toLowerCase()} as soon as income lands, then judge the rest of the month on what remains after that fixed bill is covered.`,
      reason: `${topCategory.category} is large, but it appears to be a recurring essential rather than a category you can realistically trim mid-month.`,
    });
  } else {
    tips.push({
      title: "Start a shared surprise-cost fund",
      action:
        "Move a fixed amount from both salaries into a joint emergency bucket on payday before discretionary spending starts.",
      reason: "You do not have enough recent spend history yet, so building a buffer early protects the budget from one-off shocks.",
    });
  }

  if (biggestOneTime && biggestOneTime.amount >= Math.max(150, snapshot.summary.totalSpent * 0.2)) {
    tips.push({
      title: `Put guardrails around large one-off spend like ${biggestOneTime.category}`,
      action: `Any purchase over ${roundCurrency(biggestOneTime.amount / 2)} should wait 24 hours and get a quick partner check-in before you commit.`,
      reason: `${biggestOneTime.description} cost ${biggestOneTime.amount}, which means a single one-time expense is taking an outsized bite out of the monthly plan.`,
    });
  } else if (snapshot.summary.oneTimeSpent >= snapshot.summary.recurringSpent) {
    tips.push({
      title: "Separate fun money from irregular emergencies",
      action:
        "Use two distinct sinking funds: one for lifestyle treats and one for repairs or urgent costs, then fund both every payday.",
      reason: "One-time spending is matching or exceeding recurring bills, which makes cash flow less predictable.",
    });
  } else if (recurringCategories[0]) {
    tips.push({
      title: `Pre-fund ${recurringCategories[0].category.toLowerCase()} before discretionary spend`,
      action: `Set aside ${recurringCategories[0].amount} for ${recurringCategories[0].category.toLowerCase()} as soon as income lands, then budget what remains for flexible spend.`,
      reason: `${recurringCategories[0].category} is your heaviest recurring line item, so covering it first reduces end-of-month pressure.`,
    });
  } else {
    tips.push({
      title: "Pre-fund recurring bills by salary ratio",
      action:
        "Transfer each partner's recurring-bill share into a joint bills account on salary day before either of you start discretionary spending.",
      reason: "Recurring bills are predictable, so paying them first using the fair split removes the biggest monthly pressure point.",
    });
  }

  return {
    provider: "heuristic-fallback",
    overview:
      "AI tips temporarily unavailable, so these savings ideas were generated from built-in budgeting rules.",
    fairSplit: {
      explanation: `${snapshot.fairSplit[0].name} should cover ${snapshot.fairSplit[0].sharePct}% of recurring bills and ${snapshot.fairSplit[1].name} should cover ${snapshot.fairSplit[1].sharePct}% based on monthly income.`,
      recurringBillSplit: snapshot.fairSplit,
    },
    tips: tips.slice(0, 3),
  };
}

function createInsightsService({
  budgetRepository,
  openaiClient,
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
}) {
  return {
    async getAiInsights({
      coupleId = null,
      currentUser = null,
      partnerUser = null,
      days = 30,
    }) {
      const snapshot =
        currentUser && partnerUser
          ? await buildBudgetSnapshotForUsers({
              budgetRepository,
              currentUser,
              partnerUser,
              days,
            })
          : await buildBudgetSnapshot({ budgetRepository, coupleId, days });

      const cashTotal = Number(snapshot.summary.cashSpent ?? 0);
      const cardTotal = Number(snapshot.summary.cardSpent ?? 0);

      if (!snapshot.transactions.length) {
        return {
          snapshot,
          insights: createEmptyInsights(snapshot),
        };
      }

      if (!openaiClient) {
        return {
          snapshot,
          insights: createFallbackInsights(snapshot),
        };
      }

      try {
        const promptPayload = {
          ...snapshot,
          behaviorFlags: buildBehaviorFlags(snapshot),
          summary: {
            ...snapshot.summary,
            cashSpent: cashTotal,
            cardSpent: cardTotal,
          },
        };

        const response = await openaiClient.responses.create({
          model,
          instructions: [
            "You are a senior fintech budgeting coach for couples.",
            "Use only the provided data.",
            "Be concrete about what they spent money on, who is driving the spending, and whether someone should slow down.",
            "Return exactly three actionable savings tips.",
            "At least one tip must directly reference the cash versus card spending mix.",
            "At least one tip must mention a real category or purchase pattern from the data.",
            "If one person is clearly driving spending, say so directly but without shaming them.",
            "Do not tell the couple to 'slow down' on fixed essential recurring costs like rent, housing, mortgage, insurance, utilities, taxes, or childcare unless the data shows those costs are unusually variable or avoidable.",
            "If a fixed essential category is large, frame it as something to pre-fund, ring-fence, or plan around before discretionary spending begins.",
            "Do not give generic filler like 'save more' or 'make a budget'.",
            "Include a fair recurring-bill split recommendation based on the two salaries.",
            "Be specific, concise, and non-judgmental.",
          ].join(" "),
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Couples budget snapshot:\n${JSON.stringify(promptPayload, null, 2)}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "couples_budget_insights",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  overview: { type: "string" },
                  fairSplit: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      explanation: { type: "string" },
                      recurringBillSplit: {
                        type: "array",
                        minItems: 2,
                        maxItems: 2,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            userId: { type: "integer" },
                            name: { type: "string" },
                            sharePct: { type: "number" },
                          },
                          required: ["userId", "name", "sharePct"],
                        },
                      },
                    },
                    required: ["explanation", "recurringBillSplit"],
                  },
                  tips: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        action: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["title", "action", "reason"],
                    },
                  },
                },
                required: ["overview", "fairSplit", "tips"],
              },
            },
          },
        });

        return {
          snapshot,
          insights: {
            provider: "openai",
            ...JSON.parse(response.output_text),
          },
        };
      } catch (error) {
        console.error("OpenAI insights failed:", error);
        return {
          snapshot,
          insights: createFallbackInsights(snapshot),
        };
      }
    },
  };
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey || apiKey === "your_openai_api_key") {
    return null;
  }

  return new OpenAI({ apiKey });
}

export { createInsightsService, createOpenAIClient, createFallbackInsights };
