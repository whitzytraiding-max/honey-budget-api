/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

export function buildStaticInsightsResponse(currentUser, partnerUser) {
  const users = [currentUser, partnerUser].filter(Boolean);
  const totalSalary = users.reduce((sum, u) => sum + Number(u?.monthlySalary ?? 0), 0);
  const recurringBillSplit = users.map((u) => ({
    userId: Number(u.id),
    name: u.name,
    sharePct: users.length === 2
      ? Number((totalSalary > 0 ? (Number(u.monthlySalary ?? 0) / totalSalary) * 100 : 50).toFixed(1))
      : 100,
  }));

  const insights = {
    provider: "route-fallback",
    overview: "AI tips temporarily unavailable, so the app returned static budgeting guidance.",
    fairSplit: {
      explanation: recurringBillSplit.length === 2
        ? `${recurringBillSplit[0].name} should cover ${recurringBillSplit[0].sharePct}% of recurring bills and ${recurringBillSplit[1].name} should cover ${recurringBillSplit[1].sharePct}% based on salary.`
        : "Link both partners to compute a salary-based recurring bill split.",
      recurringBillSplit,
    },
    tips: [
      {
        title: "Pay recurring bills first",
        action: "Move each partner's recurring-bill share into a joint bills bucket on payday before day-to-day spending starts.",
        reason: "Covering fixed costs first lowers the chance that discretionary spending eats into essentials.",
      },
      {
        title: "Review card charges weekly",
        action: "Set one 10-minute weekly check-in to review card transactions together and cancel one low-value charge this month.",
        reason: "A short recurring review catches subscriptions and impulse spending before they compound.",
      },
      {
        title: "Give cash a weekly limit",
        action: "Set a simple weekly cash cap for dining, snacks, and small impulse buys, then stop once that limit is used.",
        reason: "Cash purchases are harder to spot in hindsight, so a cap helps prevent quiet budget leakage.",
      },
    ],
  };

  return { snapshot: null, insights, tips: insights.tips };
}

export function buildConflictRiskAreas({ summary, dashboard, recurringBills, rules }) {
  const risks = [];

  if (Number(summary?.remainingPct ?? 0) < 35) {
    risks.push({
      key: "remaining-tight",
      title: "Remaining budget is getting tight",
      body: `Only ${summary.remainingPct}% of this budget window is left, so small spending choices are more likely to create stress right now.`,
      tone: "amber",
    });
  }

  if (Number(dashboard?.summary?.cashSharePct ?? 0) >= 45) {
    risks.push({
      key: "cash-visibility",
      title: "A lot of spending is happening in cash",
      body: "Cash-heavy months are harder for both partners to review in real time, which can make the budget feel less shared.",
      tone: "sky",
    });
  }

  if ((recurringBills ?? []).some((b) => b.warning)) {
    risks.push({
      key: "upcoming-bill-pressure",
      title: "An upcoming bill is larger than the remaining buffer",
      body: "Check the next due bills together so neither of you gets surprised by a big auto-created expense landing late in the month.",
      tone: "rose",
    });
  }

  if (!(rules ?? []).length) {
    risks.push({
      key: "missing-rules",
      title: "You still do not have shared spending rules",
      body: "A simple rule like a check-in threshold or a weekly dining cap reduces friction before it starts.",
      tone: "mint",
    });
  }

  return risks.slice(0, 4);
}

export function buildTalkPrompts({ recurringBills, rules, coachProfile, summary }) {
  const prompts = [];
  const nextBill = recurringBills.find((b) => b.nextDueDate);

  if (nextBill) {
    prompts.push(`Check who is covering ${nextBill.title} on ${nextBill.nextDueDate} so it does not feel like a surprise.`);
  }

  if (!(rules ?? []).length) {
    prompts.push("Agree on one money rule this week, like checking in before anything over a set amount.");
  }

  if (coachProfile?.conflictTrigger) {
    prompts.push(`Your coach setup says tension starts around "${coachProfile.conflictTrigger}". Use that as the first thing to talk through when the budget feels tight.`);
  }

  if (Number(summary?.comfortableDailySpend ?? 0) > 0) {
    prompts.push(`If you want the month to feel calmer, try treating ${summary.comfortableDailySpend} per day as the shared flex-spend ceiling until the next income date.`);
  }

  return prompts.slice(0, 4);
}
