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
    tips: tips.slice(0, 2),
  };
}

const FRESH_TTL_MS = 12 * 60 * 60 * 1000;  // serve from cache if < 12h old
const STALE_TTL_MS = 48 * 60 * 60 * 1000;  // background-refresh if 12-48h old; re-fetch if older

function createInsightsService({
  budgetRepository,
  exchangeRateService,
  openaiClient,
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
}) {
  // In-memory layer for same-process requests (avoids repeated DB reads)
  const memCache = new Map();

  async function fetchDbCache(coupleId) {
    if (!coupleId) return null;
    try {
      const row = await budgetRepository.getInsightsCache(coupleId);
      if (!row) return null;
      return { value: JSON.parse(row.json), cachedAt: new Date(row.cachedAt).getTime() };
    } catch {
      return null;
    }
  }

  async function saveCache(coupleId, cacheKey, value) {
    memCache.set(cacheKey, { value, cachedAt: Date.now() });
    if (coupleId) {
      try {
        await budgetRepository.setInsightsCache(coupleId, JSON.stringify(value));
      } catch (err) {
        console.error("Failed to persist insights cache:", err);
      }
    }
  }

  async function getAiInsights({
      coupleId = null,
      currentUser = null,
      partnerUser = null,
      days = 30,
      displayCurrency = null,
      coachProfile = null,
      trendMonths = [],
      snapshot: prebuiltSnapshot = null,
    }) {
      const cacheKey = `${coupleId ?? currentUser?.id}:${displayCurrency ?? "default"}`;
      const now = Date.now();

      // 1. Check in-memory cache first (fastest)
      const mem = memCache.get(cacheKey);
      if (mem && now - mem.cachedAt < FRESH_TTL_MS) return mem.value;

      // 2. Check DB cache (survives server restarts)
      const db = mem ?? await fetchDbCache(coupleId);
      if (db && now - db.cachedAt < FRESH_TTL_MS) {
        memCache.set(cacheKey, db);
        return db.value;
      }
      // 3. Stale-while-revalidate: if cache is stale (12-48h), return it now and refresh in background
      if (db && now - db.cachedAt < STALE_TTL_MS) {
        memCache.set(cacheKey, db);
        // Kick off background refresh without blocking the response
        setImmediate(() => {
          // Clear mem cache entry so the background call actually fetches fresh data
          memCache.delete(cacheKey);
          getAiInsights({ coupleId, currentUser, partnerUser, days, displayCurrency, coachProfile, trendMonths, snapshot: prebuiltSnapshot })
            .catch(() => {});
        });
        return db.value;
      }

      const snapshot = prebuiltSnapshot ??
        (currentUser && partnerUser
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
            }));

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

        const topTransactions = [...snapshot.transactions]
          .sort((a, b) => (b.displayAmount ?? b.amount ?? 0) - (a.displayAmount ?? a.amount ?? 0))
          .slice(0, 25)
          .map(({ description, category, type, displayAmount, amount, paymentMethod }) => ({
            description, category, type, amount: displayAmount ?? amount, paymentMethod,
          }));

        const promptPayload = {
          period: snapshot.period,
          summary: { ...snapshot.summary, cashSpent: cashTotal, cardSpent: cardTotal },
          topCategories: snapshot.topCategories,
          fairSplit: snapshot.fairSplit,
          users: snapshot.users?.map(({ id, name, spending }) => ({ id, name, spending })),
          transactions: topTransactions,
          coachProfile,
          trendMonths: trendSummary,
          behaviorFlags: buildBehaviorFlags(snapshot),
          displayCurrencyCode: snapshot.displayCurrencyCode,
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
            "Return exactly two coaching insights.",
            "Insight 1 (daily): A single, immediately actionable tip for this week based on current spending patterns. Title it starting with 'This week:'. Make it specific and usable today.",
            "Insight 2 (monthly): A reflective insight comparing this month to last month's data (use trendMonths if available). Celebrate a win or flag a worsening trend. Title it starting with 'This month:'. Give one concrete rule to carry into the rest of the month.",
            "Each insight must be specific, personal, and grounded in real data from the snapshot.",
            "At least one insight must directly reference the cash versus card spending mix or a specific named category.",
            "Do not tell users to slow down on fixed essential recurring costs like rent, housing, mortgage, insurance, utilities, taxes, or childcare unless the data shows those are unusually variable.",
            "If coachProfile is present, tie at least one tip directly to the stated goal, stress point, or hardest spending category.",
            "Use a supportive, calm, specific tone. No generic filler like 'save more' or 'make a budget'.",
            "Include a fair recurring-bill split recommendation based on income.",
            "The overview should read like a short coach summary of what matters most right now.",
            trendSummary.length
              ? `You have ${trendSummary.length} prior month(s) of trend data in trendMonths. Use this for the monthly insight to compare patterns month-over-month.`
              : "No prior month trend data is available — base the monthly insight on current month patterns only.",
          ].filter(Boolean).join(" "),
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Couples budget snapshot:\n${JSON.stringify(promptPayload)}`,
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
                    minItems: 2,
                    maxItems: 2,
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
        await saveCache(coupleId, cacheKey, result);
        return result;
      } catch (error) {
        console.error("OpenAI insights failed:", error);
        const fallback = {
          snapshot,
          insights: createFallbackInsights(snapshot, coachProfile),
        };
        // Cache fallback too so repeated errors don't keep hammering OpenAI
        await saveCache(coupleId, cacheKey, fallback);
        return fallback;
      }
    }

  return { getAiInsights };
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey || apiKey === "your_openai_api_key") {
    return null;
  }

  return new OpenAI({ apiKey });
}

export { createInsightsService, createOpenAIClient, createFallbackInsights };
