import { Clock3, ReceiptText, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getRemainingTone } from "../../lib/format.js";
import { ActionButton, ProgressBar } from "../ui.jsx";

function HomePage({
  summaryData,
  dashboard,
  dashboardBusy,
  coachProfile,
  setupChecklist = [],
  onNavigateToCoach,
  onNavigateToSetup,
}) {
  const { t } = useLanguage();
  const setupRemaining = setupChecklist.filter((item) => !item.completed).length;
  const householdIncome = Number(summaryData?.householdIncome ?? 0);
  const remainingBudget = Number(summaryData?.remainingBudget ?? 0);
  const summaryTone = getRemainingTone(remainingBudget, householdIncome);
  const cashTone = getRemainingTone(
    Number(summaryData?.cashRemaining ?? 0),
    Number(summaryData?.cashIncome ?? 0),
  );
  const cardTone = getRemainingTone(
    Number(summaryData?.cardRemaining ?? 0),
    Number(summaryData?.cardIncome ?? 0),
  );
  const miniStats = [
    {
      key: "cash",
      label: "Cash left",
      value: currency(summaryData?.cashRemaining ?? 0),
      detail: `${currency(summaryData?.cashSpent ?? 0)} used`,
      tone: cashTone,
      icon: ReceiptText,
    },
    {
      key: "card",
      label: "Card left",
      value: currency(summaryData?.cardRemaining ?? 0),
      detail: `${currency(summaryData?.cardSpent ?? 0)} used`,
      tone: cardTone,
      icon: Wallet,
    },
    {
      key: "daily",
      label: t("home.comfortableDailySpend"),
      value: currency(summaryData?.comfortableDailySpend ?? 0),
      detail: `${summaryData?.daysRemainingInMonth ?? 0} days left`,
      tone: {
        text: "text-slate-900",
        badge: "bg-slate-100 text-slate-700",
      },
      icon: Clock3,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {setupRemaining > 0 ? (
        <section className="hb-panel-soft rounded-[1.5rem] border border-sky-100/80 p-4 shadow-[0_18px_50px_-28px_rgba(21,50,65,0.28)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex rounded-full bg-white/90 p-2 text-sky-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="hb-kicker">Household setup</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-2xl">
                  Finish the shared setup
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                  {setupRemaining} step{setupRemaining === 1 ? "" : "s"} still need attention.
                  Add recurring bills, savings goals, and your coach answers so the app can act
                  more like a shared planner and less like a blank tracker.
                </p>
              </div>
            </div>
            <ActionButton className="sm:w-auto sm:min-w-[220px]" onClick={onNavigateToSetup} type="button">
              Open setup checklist
            </ActionButton>
          </div>
        </section>
      ) : null}

      {!coachProfile?.completed ? (
        <section className="hb-panel-highlight rounded-[1.5rem] border border-amber-200/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex rounded-full bg-white/90 p-2 text-amber-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="hb-kicker">Couples finance coach</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-2xl">{t("coach.homeTitle")}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{t("coach.homeBody")}</p>
              </div>
            </div>
            <ActionButton className="sm:w-auto sm:min-w-[220px]" onClick={onNavigateToCoach} type="button">
              {t("coach.openQuestionnaire")}
            </ActionButton>
          </div>
        </section>
      ) : null}

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:p-6">
        <div className="hb-hero-panel rounded-[1.4rem] px-4 py-5 text-white sm:px-6 sm:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-xs">
            {t("home.remaining")}
          </p>
          <p className="hb-stat-emphasis mt-2 text-3xl font-semibold tracking-tight sm:text-6xl">
            {currency(remainingBudget)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              className="hb-brand-pill inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
            >
              {t("shell.totalHouseholdIncome")}
            </div>
            <p className="text-lg font-semibold text-white/90 sm:text-xl">
              {currency(householdIncome)}
            </p>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
            {summaryData
              ? `${currency(summaryData.totalExpenses)} spent in ${summaryData.period.label}.`
              : "Calculating your current budget window."}
          </p>
        </div>

        <div className="hb-progress-track mt-4 h-3 overflow-hidden rounded-full shadow-inner">
          <div
            className={`hb-progress-fill h-full rounded-full bg-gradient-to-r transition-all duration-500 ${summaryTone.bar}`}
            style={{ width: `${summaryData?.remainingPct ?? 0}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {miniStats.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="hb-panel-soft rounded-[1.2rem] border border-sky-100/70 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="hb-kicker">
                    {item.label}
                  </p>
                  <span className={`inline-flex rounded-full p-1.5 ${item.tone.badge}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className={`hb-stat-emphasis mt-3 text-2xl font-semibold ${item.tone.text}`}>{item.value}</p>
                <p className="mt-2 text-xs text-slate-500 sm:text-sm">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="hb-kicker">Shared balance</p>
              <h2 className="mt-1 text-lg font-semibold sm:text-2xl">{t("home.incomeFairSplit")}</h2>
              <p className="text-sm text-slate-600">Shared bill ratios stay synced with the saved income mix.</p>
            </div>
          </div>

          {dashboardBusy || !dashboard ? (
            <div className="mt-4 grid gap-3">
              <div className="h-24 animate-pulse rounded-[1.35rem] bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[1.35rem] bg-slate-100" />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {dashboard.fairSplit.map((person, index) => {
                const user = dashboard.users.find((entry) => entry.id === person.userId);
                return (
                  <ProgressBar
                    key={person.userId}
                    label={person.name}
                    percentage={person.sharePct}
                    salary={user?.monthlySalary || person.monthlySalary}
                    cashAmount={user?.salaryCashAmount ?? 0}
                    cardAmount={user?.salaryCardAmount ?? user?.monthlySalary ?? 0}
                    tone={index === 0 ? "mint" : "sky"}
                  />
                );
              })}
            </div>
          )}
      </section>
    </div>
  );
}

export default HomePage;
