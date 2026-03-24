import { Clock3, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getRemainingTone } from "../../lib/format.js";
import { ProgressBar } from "../ui.jsx";

function HomePage({ summaryData, dashboard, dashboardBusy }) {
  const { t } = useLanguage();
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
      <section className="rounded-[1.5rem] border border-white/70 bg-white/88 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
        <div className="rounded-[1.4rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-4 py-5 text-white sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-xs">
            {t("home.remaining")}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            {currency(remainingBudget)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs ${summaryTone.badge}`}
            >
              {t("shell.totalHouseholdIncome")}
            </div>
            <p className="text-lg font-semibold text-white/90 sm:text-xl">
              {currency(householdIncome)}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/72">
            {summaryData
              ? `${currency(summaryData.totalExpenses)} spent in ${summaryData.period.label}.`
              : "Calculating your current budget window."}
          </p>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${summaryTone.bar}`}
            style={{ width: `${summaryData?.remainingPct ?? 0}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {miniStats.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="rounded-[1.2rem] border border-slate-100 bg-slate-50/90 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs">
                    {item.label}
                  </p>
                  <span className={`inline-flex rounded-full p-1.5 ${item.tone.badge}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className={`mt-3 text-xl font-semibold ${item.tone.text}`}>{item.value}</p>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-white/70 bg-white/82 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-lg font-semibold sm:text-2xl">{t("home.incomeFairSplit")}</h2>
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
