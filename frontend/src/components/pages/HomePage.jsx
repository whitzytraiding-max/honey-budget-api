/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Lightbulb } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";

// Categorical palette — distinct, reads on both light and dark surfaces.
const CAT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f97316"];

// ─── Spending donut (this month, by category) ────────────────────────────────
function SpendingDonut({ data, total }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 150, height: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--hb-text-muted)" }}>Spent</span>
        <span className="text-base font-bold" style={{ color: "var(--hb-text)" }}>{currency(total)}</span>
      </div>
    </div>
  );
}


function HomePage({
  summaryData,
  dashboard,
  dashboardBusy,
  coachProfile,
  soloMode = false,
  couple = null,
  setupChecklist = [],
  savingsData = null,
  onNavigate,
  onNavigateToCoach,
  onNavigateToSetup,
  onSendMessage,
  theme = "system",
}) {
  const { t } = useLanguage();

  const setupRemaining = setupChecklist.filter((item) => !item.completed).length;
  const householdIncome = Number(summaryData?.householdIncome ?? 0);
  const totalSpent = Number(summaryData?.totalExpenses ?? 0);
  const remainingBudget = Number(summaryData?.remainingBudget ?? 0);
  const remainingPct = Number(summaryData?.remainingPct ?? 50);

  const numberColor = useMemo(() => {
    if (householdIncome === 0) return "var(--hb-accent)";
    if (remainingBudget < 0 || remainingPct <= 15) return "var(--hb-bad)";
    if (remainingPct <= 50) return "var(--hb-accent)";
    return "var(--hb-good)";
  }, [householdIncome, remainingBudget, remainingPct]);

  const barColor = remainingPct <= 15 ? "var(--hb-bad)" : remainingPct <= 50 ? "var(--hb-accent)" : "var(--hb-good)";

  // Theme tokens — drive every theme (see styles.css)
  const sectionBg = "var(--hb-surface)";
  const sectionBorder = "1px solid var(--hb-border)";
  const heroBg = "var(--hb-surface)";
  const heroBorder = "1px solid var(--hb-border)";
  const heroInnerBg = "var(--hb-surface-soft)";
  const heroInnerShadow = "inset 0 1px 0 rgba(255,255,255,0.06)";
  const kickerColor = "var(--hb-text-soft)";
  const periodColor = "var(--hb-text-muted)";
  const barLabelColor = "var(--hb-text-soft)";
  const trackBg = "var(--hb-track)";
  const emptyTextColor = "var(--hb-text-soft)";
  const splitLabelColor = "var(--hb-text-soft)";
  const setupKickerColor = "var(--hb-text-soft)";
  const setupHeadingColor = "var(--hb-text)";

  // Simple-dashboard summaries
  const savingsGoals = savingsData?.goals ?? [];
  const topGoal = savingsGoals.find((g) => (g.progressPct ?? 0) < 100) ?? savingsGoals[0] ?? null;
  const allTimeSaved = Number(savingsData?.allTimeSaved ?? 0);
  const hasSavings = Boolean(savingsData) && (allTimeSaved > 0 || savingsGoals.length > 0);
  const recentTx = (dashboard?.transactions ?? []).slice(0, 3);

  // Spending-by-category donut (this month)
  const topCategories = dashboard?.topCategories ?? [];
  const catData = useMemo(
    () =>
      topCategories
        .slice(0, 6)
        .map((cat, i) => ({ name: cat.category, value: Number(cat.amount) || 0, color: CAT_COLORS[i % CAT_COLORS.length] }))
        .filter((d) => d.value > 0),
    [topCategories],
  );

  // A small, instant insight tip derived from the month's numbers (no AI call)
  const homeTip = useMemo(() => {
    if (totalSpent === 0) return null;
    if (remainingBudget < 0) return "You've gone over budget this month — a good moment to pause new spending.";
    if (remainingPct <= 15) return "You're close to the edge for the month. Keep the next few days light.";
    const top = catData[0];
    if (top && totalSpent > 0) {
      const pct = Math.round((top.value / totalSpent) * 100);
      if (pct >= 35) return `${top.name} is your biggest spend this month — ${currency(top.value)} (${pct}% of spending).`;
    }
    if (remainingPct >= 60) return `Nicely on track — ${currency(remainingBudget)} still free this month.`;
    return top ? `Most goes to ${top.name} so far (${currency(top.value)}).` : null;
  }, [totalSpent, remainingBudget, remainingPct, catData]);

  return (
    <div className="space-y-4">

      {/* Setup prompt */}
      {setupRemaining > 0 ? (
        <section
          className="rounded-[1.35rem] p-4"
          style={{ background: sectionBg, border: sectionBorder }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: setupKickerColor }}>
                {soloMode ? t("setup.personalLabel") : t("setup.householdLabel")}
              </p>
              <h2 className="mt-1 text-lg font-semibold" style={{ color: setupHeadingColor }}>
                {setupRemaining} step{setupRemaining === 1 ? "" : "s"} remaining
              </h2>
            </div>
            <button
              className="shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
              style={{ background: "var(--hb-accent)", color: "var(--hb-accent-contrast)" }}
              onClick={onNavigateToSetup}
              type="button"
            >
              {t("setup.openChecklist")}
            </button>
          </div>
        </section>
      ) : null}

      {/* Budget hero */}
      <section
        className="rounded-[1.35rem] p-4 sm:p-6"
        style={{ background: heroBg, border: heroBorder }}
      >
        {/* Primary stat — budget remaining */}
        <div
          className="rounded-[1.1rem] px-4 py-5"
          style={{ background: heroInnerBg, boxShadow: heroInnerShadow }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: kickerColor }}>
            Left to spend
          </p>
          <p className="mt-1 text-[2.6rem] font-bold leading-none tracking-tight" style={{ color: numberColor }}>
            {currency(remainingBudget)}
          </p>
          <p className="mt-1 text-sm" style={{ color: periodColor }}>
            {summaryData?.period?.label ?? "This month"}
          </p>

          {householdIncome > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1" style={{ color: barLabelColor }}>
                  <span>Spent</span>
                  <span>{currency(totalSpent)} of {currency(householdIncome)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, remainingPct)}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* No expenses state */}
        {totalSpent === 0 && !dashboardBusy && (
          <div className="mt-4 text-center py-6">
            <p className="text-sm" style={{ color: emptyTextColor }}>
              No expenses yet!<br />Start adding to see your spending here.
            </p>
            <span className="mt-2 block text-2xl">🐾</span>
          </div>
        )}

        {/* Per-person split */}
        {dashboard && !dashboardBusy && dashboard.fairSplit?.length > 0 && (
          <div className="mt-4 space-y-2">
            {dashboard.fairSplit.map((person) => {
              const user = dashboard.users?.find((u) => u.id === person.userId);
              const salary = user?.monthlySalary || person.monthlySalary || 0;
              return (
                <div key={person.userId}>
                  <div className="flex justify-between text-xs mb-1" style={{ color: splitLabelColor }}>
                    <span className="font-medium">{person.name}</span>
                    <span>{currency(salary)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, person.sharePct)}%`,
                        background: "var(--hb-good)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Where it went — spending by category */}
      {catData.length > 0 && (
        <section className="rounded-[1.35rem] p-4" style={{ background: sectionBg, border: sectionBorder }}>
          <div className="flex items-center justify-between">
            <p className="hb-kicker">Where it went</p>
            <button type="button" onClick={() => onNavigate?.("insights")} className="text-xs font-semibold" style={{ color: "var(--hb-accent-text)" }}>
              Insights →
            </button>
          </div>
          <div className="mt-2 flex items-center gap-4">
            <SpendingDonut data={catData} total={totalSpent} />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {catData.slice(0, 5).map((cat) => {
                const pct = totalSpent > 0 ? Math.round((cat.value / totalSpent) * 100) : 0;
                return (
                  <li key={cat.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat.color }} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--hb-text)" }}>{cat.name}</span>
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--hb-text-muted)" }}>{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {homeTip && (
            <div
              className="mt-3 flex items-start gap-2.5 rounded-[1rem] px-3.5 py-2.5"
              style={{ background: "var(--hb-accent-soft-bg)", border: "1px solid var(--hb-accent-line)" }}
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--hb-accent-text)" }} />
              <p className="text-sm leading-5" style={{ color: "var(--hb-text)" }}>{homeTip}</p>
            </div>
          )}
        </section>
      )}

      {/* Savings summary */}
      {hasSavings && (
        <section className="rounded-[1.35rem] p-4" style={{ background: sectionBg, border: sectionBorder }}>
          <div className="flex items-center justify-between">
            <p className="hb-kicker">Savings</p>
            <button type="button" onClick={() => onNavigate?.("savings")} className="text-xs font-semibold" style={{ color: "var(--hb-accent-text)" }}>
              See all →
            </button>
          </div>
          <p className="mt-1.5 text-2xl font-bold" style={{ color: "var(--hb-good-text)" }}>{currency(allTimeSaved)}</p>
          <p className="text-xs" style={{ color: periodColor }}>saved so far</p>
          {topGoal ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs" style={{ color: barLabelColor }}>
                <span className="font-medium">{topGoal.title}</span>
                <span>{currency(topGoal.totalSaved)} of {currency(topGoal.targetAmount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: trackBg }}>
                <div className="hb-progress-fill h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, topGoal.progressPct ?? 0)}%` }} />
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => onNavigate?.("savings")} className="mt-3 rounded-xl px-3 py-2 text-sm font-semibold transition" style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)", border: "1px solid var(--hb-accent-line)" }}>
              Set a savings goal →
            </button>
          )}
        </section>
      )}

      {/* Recent expenses */}
      {recentTx.length > 0 && (
        <section className="rounded-[1.35rem] p-4" style={{ background: sectionBg, border: sectionBorder }}>
          <div className="flex items-center justify-between">
            <p className="hb-kicker">Recent</p>
            <button type="button" onClick={() => onNavigate?.("expenses")} className="text-xs font-semibold" style={{ color: "var(--hb-accent-text)" }}>
              See all →
            </button>
          </div>
          <ul className="mt-2 space-y-2.5">
            {recentTx.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--hb-text)" }}>{tx.description}</p>
                  <p className="text-xs" style={{ color: periodColor }}>{tx.category}{tx.date ? ` · ${tx.date}` : ""}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold" style={{ color: "var(--hb-text)" }}>
                  {currency(tx.displayAmount ?? tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

export default HomePage;
