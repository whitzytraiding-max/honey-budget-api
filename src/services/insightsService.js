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

function firstFlexibleCategory(categories = []) {
  return categories.find((entry) => !isFixedEssentialCategory(entry?.category)) ?? null;
}

function formatMoney(amount, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));
}

function buildCoachProfileTip(snapshot, coachProfile) {
  if (!coachProfile?.completed) {
    return null;
  }

  const hardestCategory = String(coachProfile.hardestCategory ?? "").trim();
  const normalizedCategory = hardestCategory.toLowerCase();
  const fixedCategory = isFixedEssentialCategory(normalizedCategory);
  const goalText = String(coachProfile.primaryGoal ?? "your shared goal").trim();
  const stressText = String(
    coachProfile.biggestMoneyStress ?? "keeping spending predictable",
  ).trim();
  const conflictText = String(
    coachProfile.conflictTrigger ?? "surprise spending",
  ).trim();
  const focusText = String(
    coachProfile.coachingFocus ?? "staying more consistent",
  ).trim();

  return {
    title: `Coach priority: ${focusText}`,
    action: fixedCategory
      ? `Treat ${normalizedCategory} as a planned bill first: ring-fence it as soon as income lands, then use the remaining money to make progress toward ${goalText.toLowerCase()}.`
      : `Put a short two-week rule around ${normalizedCategory}: cap it, check in before extra purchases, and move any amount you save straight toward ${goalText.toLowerCase()}.`,
    reason: `You told Honey Budget that ${stressText.toLowerCase()} is stressful, ${hardestCategory.toLowerCase()} is hard to stay disciplined with, and ${conflictText.toLowerCase()} tends to create friction, so this is the most useful place to start.`,
  };
}

function buildCoachOverview(snapshot, flags, coachProfile = null) {
  const parts = [];
  const displayCurrencyCode = snapshot.displayCurrencyCode || "USD";
  const topFlexibleCategory = firstFlexibleCategory(snapshot.topCategories);

  if (topFlexibleCategory) {
    parts.push(
      `${topFlexibleCategory.category} is the clearest flexible pressure point right now at ${topFlexibleCategory.sharePct}% of recent spend.`,
    );
  }

  if (flags.topSpender && flags.topSpender.sharePct >= 58) {
    parts.push(
      `${flags.topSpender.name} is currently driving more of the discretionary spending, so this is a good month to agree on a shared limit before it turns into tension.`,
    );
  } else if (snapshot.summary.cashSharePct >= 40) {
    parts.push(
      `Cash is still a large share of recent spending at ${snapshot.summary.cashSharePct}%, which makes small leaks easier to miss than card charges.`,
    );
  }

  if (
    flags.biggestOneTime &&
    Number(flags.biggestOneTime.displayAmount ?? flags.biggestOneTime.amount ?? 0) >=
      Math.max(150, snapshot.summary.totalSpent * 0.15)
  ) {
    parts.push(
      `${flags.biggestOneTime.description} was a meaningful one-off hit, so the best savings move is to steady the flexible day-to-day categories around it.`,
    );
  }

  if (!parts.length) {
    parts.push(
      `Your recent spending is fairly balanced, so the biggest win now is tightening one flexible category and agreeing on a simple no-surprises rule for larger purchases.`,
    );
  }

  if (coachProfile?.completed) {
    parts.push(
      `You told Honey Budget that ${String(coachProfile.primaryGoal).toLowerCase()} matters most right now, so the coach is prioritizing advice that supports that goal and eases ${String(coachProfile.biggestMoneyStress).toLowerCase()}.`,
    );
  }

  parts.push(
    `The coach is using your actual transaction history and showing advice in ${displayCurrencyCode} so both of you are looking at the same picture.`,
  );

  return parts.join(" ");
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
    .sort(
      (left, right) =>
        (right.displayAmount ?? right.amount ?? 0) - (left.displayAmount ?? left.amount ?? 0),
    )[0] ?? null;
  const recurringCategories = snapshot.transactions
    .filter((transaction) => transaction.type === "recurring")
    .reduce((totals, transaction) => {
      totals[transaction.category] = roundCurrency(
        (totals[transaction.category] ?? 0) + Number(transaction.displayAmount ?? transaction.amount ?? 0),
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

function createFallbackInsights(snapshot, coachProfile = null) {
  const { topCategory, topSpender, biggestOneTime, recurringCategories } =
    buildBehaviorFlags(snapshot);
  const topRecurringCategory = recurringCategories[0] ?? null;
  const topFlexibleCategory = firstFlexibleCategory(snapshot.topCategories);
  const topFlexibleRecurringCategory = firstFlexibleCategory(recurringCategories);
  const spenderLeadCategory = firstFlexibleCategory(topSpender?.topCategories ?? []);
  const tips = [];
  const displayCurrencyCode = snapshot.displayCurrencyCode || "USD";
  const biggestOneTimeAmount = Number(biggestOneTime?.displayAmount ?? biggestOneTime?.amount ?? 0);

  if (topSpender && topSpender.sharePct >= 60 && spenderLeadCategory) {
    tips.push({
      title: `${topSpender.name}'s ${spenderLeadCategory.category} spend is setting the pace this month`,
      action: `Agree on a short-term cap for ${spenderLeadCategory.category.toLowerCase()} together: let ${topSpender.name} pause new ${spenderLeadCategory.category.toLowerCase()} purchases for 5 days, then restart with a fixed weekly limit you both accept.`,
      reason: `${topSpender.name} drove ${topSpender.sharePct}% of the last ${snapshot.period.days} days of spending, so this is less about blame and more about stopping one person’s category from quietly steering the whole budget.`,
    });
  } else if (snapshot.summary.cashSharePct >= 40) {
    tips.push({
      title: "Cash-heavy spending needs a shared weekly ceiling",
      action:
        "Choose one weekly cash number for dining, transport, and impulse purchases, and stop both partners from topping it up once it is gone.",
      reason: `Cash is ${snapshot.summary.cashSharePct}% of your last ${snapshot.period.days} days of spending, so the risk is not one big mistake, it is lots of small spending neither of you fully sees in real time.`,
    });
  } else {
    tips.push({
      title: "Use a weekly card review to catch silent budget drift",
      action:
        "Set one 15-minute card review each week and remove, downgrade, or pause one low-value charge before the next billing cycle.",
      reason: `Card spending is ${snapshot.summary.cardSharePct}% of your recent total, so the cleanest savings opportunity is usually in charges that feel small but repeat quietly.`,
    });
  }

  if (topFlexibleCategory) {
    const suggestedCutAmount = roundCurrency(topFlexibleCategory.amount * 0.2);
    tips.push({
      title: `${topFlexibleCategory.category} is your clearest savings opportunity`,
      action: `Trim ${topFlexibleCategory.category.toLowerCase()} by about ${formatMoney(suggestedCutAmount, displayCurrencyCode)} over the next two weeks, and move that exact amount into savings the same day so the win is visible.`,
      reason: `${topFlexibleCategory.category} is your largest flexible category at ${topFlexibleCategory.sharePct}% of total spending, which makes it the fastest place to save money without touching essential bills.`,
    });
  } else {
    tips.push({
      title: "Protect the flexible money after bills are covered",
      action:
        "After the essentials clear, give each partner the same fixed weekly personal spending number and agree that anything beyond it waits until next week.",
      reason: "Most of your tracked spend is fixed, so the best lever left is clearer rules for the money that is still changeable.",
    });
  }

  if (biggestOneTime && biggestOneTimeAmount >= Math.max(150, snapshot.summary.totalSpent * 0.2)) {
    tips.push({
      title: "Set a no-surprises rule for bigger one-off spending",
      action: `Make any non-essential purchase over ${formatMoney(roundCurrency(biggestOneTimeAmount / 2), displayCurrencyCode)} a 24-hour pause plus a quick partner check-in before either of you commits.`,
      reason: `${biggestOneTime.description} cost ${formatMoney(biggestOneTimeAmount, displayCurrencyCode)}, so the real win here is reducing surprise purchases that can create stress more than the amount itself.`,
    });
  } else if (snapshot.summary.oneTimeSpent >= snapshot.summary.recurringSpent) {
    tips.push({
      title: "Separate flexible fun money from irregular stress spending",
      action:
        "Create two small sinking funds: one for fun purchases and one for repairs or urgent costs, then put money into both every payday before spending starts.",
      reason: "One-time spending is matching or exceeding recurring bills, which makes the month feel unpredictable and can quickly turn into blame if you are not separating planned fun from real surprises.",
    });
  } else if (topFlexibleRecurringCategory) {
    tips.push({
      title: `${topFlexibleRecurringCategory.category} is the recurring line to clean up first`,
      action: `Review every ${topFlexibleRecurringCategory.category.toLowerCase()} charge together this week and remove, downgrade, or pause at least one item before it renews.`,
      reason: `${topFlexibleRecurringCategory.category} is your heaviest flexible recurring category, so cleaning it up lowers pressure every month instead of only once.`,
    });
  } else {
    tips.push({
      title: "Create one simple rule that reduces money friction",
      action:
        "Once fixed bills are covered, agree on one shared weekly allowance rule and one purchase threshold that always gets discussed first.",
      reason: "Your current data is dominated by fixed expenses, so the best conflict reducer is not another spreadsheet detail, it is a small shared rule both of you can follow consistently.",
    });
  }

  const coachProfileTip = buildCoachProfileTip(snapshot, coachProfile);
  if (coachProfileTip) {
    tips.unshift(coachProfileTip);
  }

  return {
    provider: "heuristic-fallback",
    overview: buildCoachOverview(
      snapshot,
      {
        topCategory,
        topSpender,
        biggestOneTime,
        recurringCategories,
      },
      coachProfile,
    ),
    fairSplit: {
      explanation: `${snapshot.fairSplit[0].name} should cover ${snapshot.fairSplit[0].sharePct}% of recurring bills and ${snapshot.fairSplit[1].name} should cover ${snapshot.fairSplit[1].sharePct}% based on monthly income.`,
      recurringBillSplit: snapshot.fairSplit,
    },
    tips: tips.slice(0, 3),
  };
}

const INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes per couple

function createInsightsService({
  budgetRepository,
  exchangeRateService,
  openaiClient,
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
}) {
  const insightsCache = new Map();

  return {
    async getAiInsights({
      coupleId = null,
      currentUser = null,
      partnerUser = null,
      days = 30,
      displayCurrency = null,
      coachProfile = null,
      trendMonths = [],
    }) {
      const cacheKey = `${coupleId ?? currentUser?.id}:${displayCurrency ?? "default"}`;
      const cached = insightsCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < INSIGHTS_CACHE_TTL_MS) {
        return cached.value;
      }
      const snapshot =
        currentUser && partnerUser
          ? await buildBudgetSnapshotForUsers({
              budgetRepository,
              exchangeRateService,
              currentUser,
              partnerUser,
              days,
              displayCurrency,
            })
          : await buildBudgetSnapshot({
              budgetRepository,
              exchangeRateService,
              coupleId,
              days,
              displayCurrency,
            });

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
          insights: createFallbackInsights(snapshot, coachProfile),
        };
      }

      try {
        const trendSummary = trendMonths.map((m) => ({
          label: m.label,
          totalSpent: m.summary?.totalSpent ?? 0,
          cashSpent: m.summary?.cashSpent ?? 0,
          cardSpent: m.summary?.cardSpent ?? 0,
          topCategories: (m.topCategories ?? []).slice(0, 3),
        }));

        const promptPayload = {
          ...snapshot,
          coachProfile,
          trendMonths: trendSummary,
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
            "You are Honey Budget's Couples Finance Coach.",
            "Use only the provided data.",
            "Act like a supportive money coach for a real couple, not a generic budgeting bot.",
            "Base every insight on real categories, patterns, totals, and partner behavior in the data.",
            "Use the couple's questionnaire answers when they are present so the coaching lines up with their actual goals and weak spots.",
            "Focus on spending habits, savings opportunities, and reducing financial conflict.",
            "Return exactly three actionable coaching insights.",
            "Each insight must be specific, personal, and immediately usable this week.",
            "At least one insight must directly reference the cash versus card spending mix.",
            "At least one insight must mention a real category, purchase pattern, or named person from the data.",
            "If one person is clearly driving spending, say so gently and specifically without shaming them.",
            "Do not tell the couple to 'slow down' on fixed essential recurring costs like rent, housing, mortgage, insurance, utilities, taxes, or childcare unless the data shows those costs are unusually variable or avoidable.",
            "Keep fixed essential recurring bills out of the three headline tips whenever possible.",
            "Reserve the three headline tips for flexible categories, discretionary behavior, one-time purchases, or spending habits the couple can realistically change.",
            "Include at least one insight that lowers conflict by making expectations clearer between partners.",
            "If coachProfile is present, tie at least one tip directly to the stated goal, stress point, or hardest spending category.",
            "Use a supportive, calm, specific tone.",
            "Do not give generic filler like 'save more', 'communicate better', or 'make a budget'.",
            "Include a fair recurring-bill split recommendation based on the two salaries.",
            "The overview should read like a short coach summary of what matters most this month.",
            "Be specific, concise, non-judgmental, and action-oriented.",
            trendSummary.length
              ? `You have ${trendSummary.length} prior month(s) of trend data in trendMonths. Reference month-over-month changes when they reveal a meaningful pattern (e.g. spending rising in a category, or a positive saving trend). Only mention trends that are genuinely notable.`
              : "",
          ].filter(Boolean).join(" "),
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

        const result = {
          snapshot,
          insights: {
            provider: "openai",
            ...JSON.parse(response.output_text),
          },
        };
        insightsCache.set(cacheKey, { value: result, cachedAt: Date.now() });
        return result;
      } catch (error) {
        console.error("OpenAI insights failed:", error);
        return {
          snapshot,
          insights: createFallbackInsights(snapshot, coachProfile),
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
