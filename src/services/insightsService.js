import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  anthropicClient,
  geminiClient,
  groqClient,
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropicModel = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
  geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
  groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
}) {
  // Prefer Gemini > Groq > Anthropic > OpenAI
  const useGemini = Boolean(geminiClient);
  const useGroq = !useGemini && Boolean(groqClient);
  const useAnthropic = !useGemini && !useGroq && Boolean(anthropicClient);
  const useAI = useGemini || useGroq || useAnthropic || Boolean(openaiClient);
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
      savingsGoals = [],
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

      if (!useAI) {
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

        const savingsGoalsSummary = savingsGoals.map((g) => ({
          title: g.title,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          targetDate: g.targetDate,
          progressPct: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
        }));

        const promptPayload = {
          period: snapshot.period,
          summary: { ...snapshot.summary, cashSpent: cashTotal, cardSpent: cardTotal },
          topCategories: snapshot.topCategories,
          fairSplit: snapshot.fairSplit,
          users: snapshot.users?.map(({ id, name, spending }) => ({ id, name, spending })),
          transactions: topTransactions,
          coachProfile,
          savingsGoals: savingsGoalsSummary,
          trendMonths: trendSummary,
          behaviorFlags: buildBehaviorFlags(snapshot),
          displayCurrencyCode: snapshot.displayCurrencyCode,
        };

        const systemPrompt = [
          "You are Honey Budget's personal Couples Finance Coach.",
          "Use only the data provided — never invent numbers.",
          "Write like a supportive, direct money coach for a real couple. Specific, warm, never generic.",
          "Base every insight on real categories, patterns, totals, and partner behaviour visible in the data.",
          "If coachProfile is present, tie advice directly to the stated goal, pay schedule, budget target, debt, and hardest category.",
          "If savingsGoals are present, reference progress toward them — celebrate milestones or flag if they are falling behind.",
          "Return exactly three coaching tips and one win.",
          "Tip 1 (this week): One immediately actionable thing they can do today. Title starts with 'This week:'.",
          "Tip 2 (this month): Compare this month to trendMonths if available — flag a worsening trend or give a rule to carry into the rest of the month. Title starts with 'This month:'.",
          "Tip 3 (goal focus): One tip tied directly to their stated primary goal or a savings goal. If totalDebtAmount is set, make this about debt payoff strategy. Title starts with 'Your goal:'.",
          "Win: Something they genuinely did well this period — a category that improved, a goal making progress, lower cash spending, etc. Must be specific to their data. Title starts with 'Win:'.",
          "Each tip must name a real category, amount, or person from the data. No filler.",
          "Do not criticise fixed essential costs (rent, mortgage, insurance, utilities, childcare, taxes).",
          "Use a calm, specific, encouraging tone. Never say 'make a budget' or 'spend less' without specifics.",
          "Include a fair recurring-bill split based on income.",
          "The overview should be 2-3 sentences: what the data shows, what matters most right now.",
          trendSummary.length
            ? `You have ${trendSummary.length} prior month(s) of trend data. Use it for Tip 2 to compare month-over-month.`
            : "No prior month data — base Tip 2 on current month patterns only.",
          'Respond with only a JSON object matching this exact shape: {"overview":"...","fairSplit":{"explanation":"...","recurringBillSplit":[{"userId":1,"name":"...","sharePct":50},{"userId":2,"name":"...","sharePct":50}]},"tips":[{"title":"...","action":"...","reason":"..."},{"title":"...","action":"...","reason":"..."},{"title":"...","action":"...","reason":"..."}],"win":{"title":"...","body":"..."}}',
        ].filter(Boolean).join(" ");

        let rawJson;
        if (useGemini) {
          const gModel = geminiClient.getGenerativeModel({
            model: geminiModel,
            systemInstruction: systemPrompt,
          });
          const result = await gModel.generateContent(`Couples budget snapshot:\n${JSON.stringify(promptPayload)}`);
          rawJson = result.response.text() ?? "";
        } else if (useAnthropic) {
          const msg = await anthropicClient.messages.create({
            model: anthropicModel,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: `Couples budget snapshot:\n${JSON.stringify(promptPayload)}` }],
          });
          rawJson = msg.content[0]?.text ?? "";
        } else {
          const msg = await openaiClient.responses.create({
            model,
            instructions: systemPrompt,
            input: [{ role: "user", content: [{ type: "input_text", text: `Couples budget snapshot:\n${JSON.stringify(promptPayload)}` }] }],
            text: { format: { type: "text" } },
          });
          rawJson = msg.output_text ?? "";
        }

        // Extract JSON from the response (handle potential markdown fences)
        const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in AI response");

        const result = {
          snapshot,
          insights: {
            provider: useGemini ? "gemini" : useAnthropic ? "anthropic" : "openai",
            ...JSON.parse(jsonMatch[0]),
          },
        };
        await saveCache(coupleId, cacheKey, result);
        return result;
      } catch (error) {
        console.error("AI insights failed:", error?.message ?? error);
        const fallback = {
          snapshot,
          insights: createFallbackInsights(snapshot, coachProfile),
        };
        await saveCache(coupleId, cacheKey, fallback);
        return fallback;
      }
    }

  const CHAT_TOOLS = [
    {
      name: "update_income",
      description: "Update the current user's monthly salary/income amount. Use when the user says they got a raise, their pay changed, or they want to update their income.",
      input_schema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "New monthly income as a JSON number (not a string). Example: 5200" },
          note: { type: "string", description: "Brief confirmation note, e.g. 'Monthly income updated to $5,200'" },
        },
        required: ["amount", "note"],
      },
    },
    {
      name: "log_expense",
      description: "Log a new one-time expense transaction. Use when the user mentions a purchase or expense.",
      input_schema: {
        type: "object",
        properties: {
          description: { type: "string", description: "What the expense was for, e.g. 'Groceries'" },
          amount: { type: "number", description: "Amount spent as a JSON number (not a string). Example: 200" },
          category: { type: "string", description: "One of: Dining, Groceries, Shopping, Transport, Entertainment, Health, Subscriptions, Debt Payment, Other" },
          payment_method: { type: "string", enum: ["cash", "card"], description: "How it was paid" },
          note: { type: "string", description: "Confirmation note, e.g. 'Logged $200 for Groceries'" },
        },
        required: ["description", "amount", "category", "payment_method", "note"],
      },
    },
    {
      name: "update_bill",
      description: "Update the amount of an existing recurring bill.",
      input_schema: {
        type: "object",
        properties: {
          bill_id: { type: "number", description: "The numeric ID of the bill from the bills list. Example: 3" },
          bill_name: { type: "string", description: "Name of the bill" },
          new_amount: { type: "number", description: "New monthly amount as a JSON number. Example: 1200" },
          note: { type: "string", description: "Confirmation note, e.g. 'Rent updated to $1,200/month'" },
        },
        required: ["bill_id", "bill_name", "new_amount", "note"],
      },
    },
    {
      name: "add_bill",
      description: "Add a new recurring monthly bill.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Name of the bill, e.g. 'Netflix'" },
          amount: { type: "number", description: "Monthly amount as a JSON number. Example: 18" },
          category: { type: "string", description: "One of: Housing, Utilities, Transport, Insurance, Subscriptions, Health, Childcare, Other" },
          payment_method: { type: "string", enum: ["cash", "card"], description: "How it is usually paid" },
          note: { type: "string", description: "Confirmation note, e.g. 'Added Netflix at $18/month'" },
        },
        required: ["title", "amount", "category", "payment_method", "note"],
      },
    },
  ];

  async function chatWithTools({
    message,
    conversationHistory = [],
    snapshot,
    coachProfile,
    savingsGoals = [],
    currentUser,
    partnerUser,
    bills = [],
    onToolCall,
  }) {
    const cashTotal = Number(snapshot.summary.cashSpent ?? 0);
    const cardTotal = Number(snapshot.summary.cardSpent ?? 0);
    const topTransactions = [...snapshot.transactions]
      .sort((a, b) => (b.displayAmount ?? b.amount ?? 0) - (a.displayAmount ?? a.amount ?? 0))
      .slice(0, 15)
      .map(({ description, category, type, displayAmount, amount, paymentMethod }) => ({
        description, category, type, amount: displayAmount ?? amount, paymentMethod,
      }));

    const currency = currentUser?.incomeCurrencyCode || snapshot.displayCurrencyCode || "USD";
    function fmt(n) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n ?? 0));
    }

    const income = Number(snapshot.summary?.totalIncome ?? currentUser?.monthlySalary ?? 0);
    const totalSpent = Number(snapshot.summary?.totalSpent ?? 0);
    const savingsRate = income > 0 ? Math.round(((income - totalSpent) / income) * 100) : 0;
    const surplus = income - totalSpent;

    // Build a human-readable financial brief so the AI reasons from clear numbers, not raw JSON
    const financialBrief = [
      `=== CLIENT FINANCIAL BRIEF ===`,
      `Client: ${currentUser?.name ?? "User"}${partnerUser ? ` + ${partnerUser.name}` : ""}`,
      `Period: ${snapshot.period?.from ?? "this month"} to ${snapshot.period?.to ?? "now"}`,
      `Currency: ${currency}`,
      ``,
      `=== INCOME & SPENDING ===`,
      `Monthly income: ${fmt(income)}`,
      `Total spent this period: ${fmt(totalSpent)}`,
      `Surplus (income minus spending): ${fmt(surplus)}`,
      `Savings rate: ${savingsRate}% ${savingsRate < 10 ? "(LOW — needs attention)" : savingsRate < 20 ? "(fair — can improve)" : "(healthy)"}`,
      `Cash spending: ${fmt(cashTotal)} | Card spending: ${fmt(cardTotal)}`,
      snapshot.topCategories?.length
        ? `\nTop spending categories:\n${snapshot.topCategories.map((c) => `  - ${c.category}: ${fmt(c.amount)} (${c.sharePct}% of total)`).join("\n")}`
        : "",
      ``,
      `=== RECENT TRANSACTIONS (top 15 by amount) ===`,
      topTransactions.length
        ? topTransactions.map((t) => `  - ${t.description} | ${t.category} | ${fmt(t.amount)} | ${t.paymentMethod}`).join("\n")
        : "  No transactions recorded yet.",
      ``,
      `=== RECURRING BILLS ===`,
      bills.length
        ? bills.map((b) => `  - [ID:${b.id}] ${b.title} | ${b.category} | ${fmt(b.amount)}`).join("\n")
        : "  No recurring bills set up.",
      ``,
      `=== SAVINGS GOALS ===`,
      savingsGoals.length
        ? savingsGoals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
            return `  - ${g.title}: ${fmt(g.currentAmount)} of ${fmt(g.targetAmount)} (${pct}%)${g.targetDate ? ` | target date: ${g.targetDate}` : ""}`;
          }).join("\n")
        : "  No savings goals set.",
      ``,
      coachProfile ? [
        `=== CLIENT COACHING PROFILE ===`,
        coachProfile.primaryGoal ? `  Primary goal: ${coachProfile.primaryGoal}` : "",
        coachProfile.goalHorizon ? `  Timeline: ${coachProfile.goalHorizon}` : "",
        coachProfile.biggestMoneyStress ? `  Biggest stress: ${coachProfile.biggestMoneyStress}` : "",
        coachProfile.hardestCategory ? `  Hardest category to control: ${coachProfile.hardestCategory}` : "",
        coachProfile.conflictTrigger ? `  Main money conflict/trigger: ${coachProfile.conflictTrigger}` : "",
        coachProfile.coachingFocus ? `  Coaching focus: ${coachProfile.coachingFocus}` : "",
        coachProfile.monthlyBudgetTarget ? `  Monthly budget target: ${fmt(coachProfile.monthlyBudgetTarget)}` : "",
        coachProfile.paySchedule ? `  Pay schedule: ${coachProfile.paySchedule}` : "",
        coachProfile.personalAllowance ? `  Personal allowance per person: ${fmt(coachProfile.personalAllowance)}` : "",
        coachProfile.totalDebtAmount ? `  Total debt to pay off: ${fmt(coachProfile.totalDebtAmount)}` : "",
        coachProfile.notes ? `  Additional notes: ${coachProfile.notes}` : "",
      ].filter(Boolean).join("\n") : "  No coaching profile — give general advice based on spending data.",
      partnerUser ? `\n  Partner: ${partnerUser.name}` : "",
      snapshot.fairSplit?.length >= 2
        ? `\n  Fair bill split (by income): ${snapshot.fairSplit.map((u) => `${u.name} ${u.sharePct}%`).join(" / ")}`
        : "",
    ].filter((l) => l !== undefined).join("\n");

    const systemPrompt = `You are Alex, a Certified Financial Planner (CFP) and personal finance coach inside Honey Budget.

ROLE & APPROACH:
You give the kind of clear, specific, honest advice a great financial adviser gives in a private session — not generic tips from a blog. You know the client's real numbers and you use them. You're warm and human but direct: you don't sugarcoat problems, but you never shame or lecture either.

You use a proven financial planning framework when advising:
1. CASH FLOW CLARITY — Is income covering expenses? What's the savings rate?
2. EMERGENCY BUFFER — Do they have 3–6 months of expenses saved?
3. DEBT STRATEGY — High-interest debt first (avalanche method) or smallest balance (snowball) depending on psychology.
4. SAVINGS GOALS — Are they on track? Is the monthly contribution realistic?
5. SPENDING LEAKS — Which categories are out of proportion to income? (Rule of thumb: housing <30%, food <15%, transport <15% of income.)
6. INCOME GROWTH — Is there room to increase income, not just cut spending?

HOW TO RESPOND:
- Always use real numbers from the financial brief. Never make up figures.
- Address the client by name (${currentUser?.name ?? "there"}).
- If they have a coaching profile, tie advice to their stated goal, timeline, and hardest category.
- Give specific, actionable steps — not vague suggestions.
- For complex questions, use a short structure: situation → problem → specific action → expected outcome.
- For simple questions, answer in 2–4 sentences with the key number they need.
- If you spot a financial health issue they didn't ask about (e.g. savings rate below 10%, no emergency fund, debt not being paid down), mention it briefly at the end — not in a preachy way, just flag it.
- If both partners are present, consider the relationship dynamic. Never assign blame. Frame as "you two" not "you" or "they."

USING TOOLS:
When a client tells you about a financial change, USE THE TOOL — don't just acknowledge it.
- "I got a raise to $X" → call update_income immediately
- "I spent $X on Y" → call log_expense immediately
- "Our Netflix went up to $X" → find the bill ID from the brief and call update_bill
- "We signed up for a new gym" → call add_bill immediately
After using a tool, confirm what you did in one sentence, then give one piece of follow-up advice based on their updated picture.

DO NOT:
- Recommend specific investment products, stocks, or platforms (not a licensed adviser)
- Make up data or estimate numbers not in the brief
- Give generic advice like "make a budget" or "spend less" without specifics
- Repeat the same advice twice in a conversation unless the client asks again
- Refuse to respond to greetings, casual messages, or "test" — just reply naturally and briefly

CURRENT CLIENT FINANCIAL BRIEF:
${financialBrief}`;

    // Minimal context object kept for heuristicChat fallback only
    const context = {
      period: snapshot.period,
      summary: { ...snapshot.summary, cashSpent: cashTotal, cardSpent: cardTotal },
      topCategories: snapshot.topCategories,
      fairSplit: snapshot.fairSplit,
      users: snapshot.users?.map(({ id, name, spending }) => ({ id, name, spending })),
      transactions: topTransactions,
      coachProfile,
      savingsGoals: savingsGoals.map((g) => ({
        title: g.title, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
        targetDate: g.targetDate,
        progressPct: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
      })),
      bills: bills.map(({ id, title, amount, category, currencyCode }) => ({ id, title, amount, category, currencyCode })),
      currentUserName: currentUser?.name ?? "You",
      partnerName: partnerUser?.name ?? null,
      displayCurrencyCode: snapshot.displayCurrencyCode,
    };

    // Build messages array: history + new user message
    const messages = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // For chat: prefer Groq (free, reliable) over Gemini, even if both keys are set
    const useChatGroq = Boolean(groqClient);
    const useChatGemini = !useChatGroq && Boolean(geminiClient);
    const useChatAnthropic = !useChatGroq && !useChatGemini && Boolean(anthropicClient);
    const hasChat = useChatGroq || useChatGemini || useChatAnthropic || Boolean(openaiClient);

    console.log(`[coach] groq=${useChatGroq} gemini=${useChatGemini} anthropic=${useChatAnthropic}`);

    if (!hasChat) {
      console.log("[coach] no AI client — using heuristic fallback");
      return {
        reply: heuristicChat(message, context),
        actions: [],
        newHistory: [...messages, { role: "assistant", content: [{ type: "text", text: heuristicChat(message, context) }] }],
      };
    }

    try {
      if (useChatGroq) {
        console.log(`[coach] calling Groq model: ${groqModel}`);
        // Groq uses OpenAI-compatible chat completions with tool use
        const groqTools = CHAT_TOOLS.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        }));

        const groqMessages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : m.content?.[0]?.text ?? "",
          })),
          { role: "user", content: message },
        ];

        const firstResponse = await groqClient.chat.completions.create({
          model: groqModel,
          messages: groqMessages,
          tools: groqTools,
          tool_choice: "auto",
          max_tokens: 1024,
        });

        const choice = firstResponse.choices[0];
        const actions = [];

        if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
          const toolCallMsgs = [{ role: "assistant", content: choice.message.content ?? "", tool_calls: choice.message.tool_calls }];
          const toolResultMsgs = [];

          for (const tc of choice.message.tool_calls) {
            let toolInput;
            try { toolInput = JSON.parse(tc.function.arguments); } catch { toolInput = {}; }
            // Coerce numeric fields in case model returns strings despite schema
            for (const f of ["amount", "new_amount", "bill_id"]) {
              if (toolInput[f] !== undefined) toolInput[f] = Number(toolInput[f]);
            }
            try {
              const result = await onToolCall(tc.function.name, toolInput);
              actions.push({ tool: tc.function.name, note: toolInput.note, success: result.success });
              toolResultMsgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
            } catch (err) {
              actions.push({ tool: tc.function.name, note: toolInput.note, success: false, error: err.message });
              toolResultMsgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, error: err.message }) });
            }
          }

          const finalResponse = await groqClient.chat.completions.create({
            model: groqModel,
            messages: [...groqMessages, ...toolCallMsgs, ...toolResultMsgs],
            max_tokens: 512,
          });

          const replyText = finalResponse.choices[0]?.message?.content?.trim() ?? "Done — I've updated your finances.";
          const newHistory = [
            ...conversationHistory,
            { role: "user", content: message },
            { role: "assistant", content: [{ type: "text", text: replyText }] },
          ];
          return { reply: replyText, actions, newHistory };
        }

        const replyText = choice.message?.content?.trim() ?? "I couldn't generate a response. Please try again.";
        const newHistory = [
          ...conversationHistory,
          { role: "user", content: message },
          { role: "assistant", content: [{ type: "text", text: replyText }] },
        ];
        return { reply: replyText, actions: [], newHistory };

      } else if (useChatGemini) {
        console.log(`[coach] calling Gemini model: ${geminiModel}`);
        const geminiTools = [{
          functionDeclarations: CHAT_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          })),
        }];

        const gModel = geminiClient.getGenerativeModel({
          model: geminiModel,
          systemInstruction: systemPrompt,
          tools: geminiTools,
        });

        const geminiHistory = [];
        for (const msg of conversationHistory) {
          if (msg.role === "user") {
            const text = typeof msg.content === "string" ? msg.content : msg.content?.[0]?.text ?? "";
            geminiHistory.push({ role: "user", parts: [{ text }] });
          } else if (msg.role === "assistant") {
            const text = typeof msg.content === "string" ? msg.content : msg.content?.find?.((b) => b.type === "text")?.text ?? msg.content?.[0]?.text ?? "";
            geminiHistory.push({ role: "model", parts: [{ text }] });
          }
        }

        const chat = gModel.startChat({ history: geminiHistory });
        const firstResult = await chat.sendMessage(message);
        const firstResponse = firstResult.response;

        const gemActions = [];
        const functionCalls = firstResponse.functionCalls?.() ?? [];

        if (functionCalls.length > 0) {
          const functionResponses = [];
          for (const fc of functionCalls) {
            try {
              const result = await onToolCall(fc.name, fc.args);
              gemActions.push({ tool: fc.name, note: fc.args.note, success: result.success });
              functionResponses.push({ functionResponse: { name: fc.name, response: result } });
            } catch (err) {
              gemActions.push({ tool: fc.name, note: fc.args.note, success: false, error: err.message });
              functionResponses.push({ functionResponse: { name: fc.name, response: { success: false, error: err.message } } });
            }
          }
          const finalResult = await chat.sendMessage(functionResponses);
          const gemReply = finalResult.response.text()?.trim() ?? "Done — I've updated your finances.";
          const gemHistory = [...conversationHistory, { role: "user", content: message }, { role: "assistant", content: [{ type: "text", text: gemReply }] }];
          return { reply: gemReply, actions: gemActions, newHistory: gemHistory };
        }

        const gemReply = firstResponse.text()?.trim() ?? "I couldn't generate a response. Please try again.";
        const gemHistory = [...conversationHistory, { role: "user", content: message }, { role: "assistant", content: [{ type: "text", text: gemReply }] }];
        return { reply: gemReply, actions: [], newHistory: gemHistory };

      } else {
        // Anthropic path
        const firstResponse = await anthropicClient.messages.create({
          model: anthropicModel,
          max_tokens: 2048,
          system: systemPrompt,
          tools: CHAT_TOOLS,
          messages,
        });

        const actions = [];

        if (firstResponse.stop_reason === "tool_use") {
          const toolUseBlocks = firstResponse.content.filter((b) => b.type === "tool_use");
          const toolResults = [];

          for (const toolUse of toolUseBlocks) {
            try {
              const result = await onToolCall(toolUse.name, toolUse.input);
              actions.push({ tool: toolUse.name, note: toolUse.input.note, success: result.success });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              });
            } catch (err) {
              actions.push({ tool: toolUse.name, note: toolUse.input.note, success: false, error: err.message });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                is_error: true,
                content: err.message,
              });
            }
          }

          const continuedMessages = [
            ...messages,
            { role: "assistant", content: firstResponse.content },
            { role: "user", content: toolResults },
          ];

          const finalResponse = await anthropicClient.messages.create({
            model: anthropicModel,
            max_tokens: 512,
            system: systemPrompt,
            tools: CHAT_TOOLS,
            messages: continuedMessages,
          });

          const replyText = finalResponse.content.find((b) => b.type === "text")?.text?.trim()
            ?? "Done — I've updated your finances.";

          const newHistory = [
            ...continuedMessages,
            { role: "assistant", content: finalResponse.content },
          ];

          return { reply: replyText, actions, newHistory };
        }

        const replyText = firstResponse.content.find((b) => b.type === "text")?.text?.trim()
          ?? "I couldn't generate a response. Please try again.";

        const newHistory = [
          ...messages,
          { role: "assistant", content: firstResponse.content },
        ];

        return { reply: replyText, actions: [], newHistory };
      }
    } catch (error) {
      const errMsg = error?.message ?? String(error);
      console.error("[coach] chatWithTools FAILED:", error?.status ?? "", errMsg);
      const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("Too Many Requests");
      const reply = isQuota
        ? "I'm temporarily unavailable — the AI service has hit its usage limit for today. This resets automatically, or you can enable billing on Google AI Studio for uninterrupted access. Try again in a little while."
        : `I hit a technical issue: ${errMsg}. Please try again in a moment.`;
      return {
        reply,
        actions: [],
        newHistory: [...messages, { role: "assistant", content: [{ type: "text", text: reply }] }],
      };
    }
  }

  return { getAiInsights, chatWithTools };
}

function heuristicChat(message, context) {
  const q = message.toLowerCase();
  const summary = context.summary ?? {};
  const categories = context.topCategories ?? [];
  const users = context.users ?? [];
  const goals = context.savingsGoals ?? [];
  const fairSplit = context.fairSplit ?? [];
  const currency = context.displayCurrencyCode ?? "USD";

  function fmt(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n ?? 0));
  }

  // "who is spending more"
  if (q.includes("who") && (q.includes("spend") || q.includes("more"))) {
    if (users.length >= 2) {
      const sorted = [...users].sort((a, b) => (b.spending?.totalSpent ?? 0) - (a.spending?.totalSpent ?? 0));
      const top = sorted[0];
      const pct = summary.totalSpent > 0 ? Math.round((top.spending?.totalSpent / summary.totalSpent) * 100) : 0;
      return `${top.name} is driving more of the spending right now — ${fmt(top.spending?.totalSpent)} which is about ${pct}% of your combined total this period.`;
    }
    return "Link your partner to compare individual spending.";
  }

  // "savings goal" / "on track"
  if (q.includes("saving") || q.includes("goal") || q.includes("on track")) {
    if (goals.length) {
      const lines = goals.map((g) => `${g.title}: ${fmt(g.currentAmount)} of ${fmt(g.targetAmount)} (${g.progressPct}%)`);
      return `Here's where your savings goals stand:\n${lines.join("\n")}${goals.some((g) => g.progressPct < 30) ? "\nSome goals need attention — consider moving a small fixed amount across on payday." : "\nYou're making progress — keep the momentum going."}`;
    }
    return "No savings goals set yet. Add one in the Savings section and your coach will track progress here.";
  }

  // "food" / "dining" / "groceries" / "cut"
  if (q.includes("food") || q.includes("dining") || q.includes("grocer") || q.includes("eat") || q.includes("restaurant")) {
    const food = categories.find((c) => /dining|food|grocer|restaurant/i.test(c.category));
    if (food) {
      const cut = fmt(food.amount * 0.2);
      return `${food.category} is at ${fmt(food.amount)} — ${food.sharePct}% of your total spend. Trimming 20% would save about ${cut}. Try a weekly meal-plan and one less takeaway night to get there.`;
    }
    return "No significant food spending recorded yet this period.";
  }

  // "budget low" / "remaining" / "why"
  if (q.includes("budget") || q.includes("remaining") || q.includes("low") || q.includes("why")) {
    const top = categories[0];
    const cashNote = summary.cashSharePct >= 40 ? ` Cash spending is also high at ${summary.cashSharePct}% — that's the hardest to track.` : "";
    if (top) {
      return `Your biggest spend this period is ${top.category} at ${fmt(top.amount)} (${top.sharePct}% of total).${cashNote} That's the clearest place to look first.`;
    }
    return `Total spent this period: ${fmt(summary.totalSpent)}. Add more expenses for a clearer breakdown.`;
  }

  // "split" / "fair" / "bills"
  if (q.includes("split") || q.includes("fair") || q.includes("bill")) {
    if (fairSplit.length >= 2) {
      return `Based on your income, a fair split is: ${fairSplit[0].name} covers ${fairSplit[0].sharePct}% of shared bills and ${fairSplit[1].name} covers ${fairSplit[1].sharePct}%. You can adjust this in Settings if your income changes.`;
    }
    return "Link both partners and save your income amounts to get a personalised fair-split calculation.";
  }

  // "cash" / "card"
  if (q.includes("cash") || q.includes("card")) {
    return `Cash spending is ${fmt(summary.cashSpent)} (${summary.cashSharePct}%) and card spending is ${fmt(summary.cardSpent)} (${summary.cardSharePct}%) this period. ${summary.cashSharePct > 40 ? "High cash use makes it harder to track where money goes — consider moving more to card." : "Good card discipline — keeps your spending visible."}`;
  }

  // "debt"
  if (q.includes("debt") || q.includes("loan") || q.includes("repay")) {
    const debtCat = categories.find((c) => /debt|loan|repay|credit/i.test(c.category));
    if (debtCat) {
      return `You've put ${fmt(debtCat.amount)} toward debt this period. To pay it off faster, try the avalanche method: pay minimums on everything, then throw any extra cash at the highest-interest debt first.`;
    }
    return "No debt payments recorded this period. If you have debt, log it as an expense category so your coach can track it.";
  }

  // generic fallback
  const top = categories[0];
  return `This period you've spent ${fmt(summary.totalSpent)} total — ${fmt(summary.cashSpent)} cash and ${fmt(summary.cardSpent)} by card.${top ? ` Your biggest category is ${top.category} at ${fmt(top.amount)}.` : ""} Ask me something more specific and I'll give you a more targeted answer.`;
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_openai_api_key") return null;
  return new OpenAI({ apiKey });
}

function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  // Groq is OpenAI-compatible — same SDK, different base URL
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
}

function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  // Use default API version (v1beta) — required for function calling / tool use
  return new GoogleGenerativeAI(apiKey);
}

export { createInsightsService, createOpenAIClient, createAnthropicClient, createGeminiClient, createGroqClient, createFallbackInsights };
