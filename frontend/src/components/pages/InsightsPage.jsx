import { useEffect, useState } from "react";
import { Brain, TrendingUp, Wallet } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";

const CALC_STEPS = [
  "Pulling your transaction history…",
  "Analysing cash vs. card habits…",
  "Reviewing your top spending categories…",
  "Comparing this month to last month…",
  "Calculating your fair bill split…",
  "Identifying savings opportunities…",
  "Building your personalised coaching tips…",
];

function InsightsLoader() {
  const [stepIndex, setStepIndex] = useState(0);
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((i) => (i + 1) % CALC_STEPS.length);
    }, 1800);
    const dotTimer = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 500);
    return () => {
      clearInterval(stepTimer);
      clearInterval(dotTimer);
    };
  }, []);

  // Progress bar: cycles through steps, shows fake linear fill
  const progress = Math.round(((stepIndex + 1) / CALC_STEPS.length) * 100);

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      {/* Animated brain */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-ping rounded-full bg-sky-200/40" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-blue-200 shadow-lg">
          <Brain className="h-8 w-8 text-[#17385d]" />
        </div>
      </div>

      {/* Status message */}
      <div className="min-h-[2.5rem]">
        <p className="text-sm font-medium text-slate-700">
          {CALC_STEPS[stepIndex].replace("…", "")}{".".repeat(dots)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="hb-progress-track h-2 overflow-hidden rounded-full shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Your AI coach is reviewing your finances
        </p>
      </div>

      {/* Shimmer cards */}
      <div className="w-full space-y-3 pt-2">
        {[1, 2].map((i) => (
          <div key={i} className="hb-panel-soft animate-pulse rounded-3xl px-4 py-5">
            <div className="h-3.5 w-2/5 rounded-full bg-slate-200" />
            <div className="mt-3 h-3 w-full rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-3/5 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

const INSIGHT_EMOJIS = ["🌿", "💳", "✨"];

function InsightsPage({ insightsBusy, insights, dashboard }) {
  const { t } = useLanguage();
  const summary = dashboard?.summary;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="hb-panel-multi rounded-[2rem] border border-sky-200/70 p-6 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] sm:p-8">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-[#17385d]" />
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{t("insights.title")}</h2>
            <p className="text-sm text-slate-700">{t("insights.subtitle")}</p>
          </div>
        </div>

        <div className="mt-6">
          {insightsBusy || !insights ? (
            <InsightsLoader />
          ) : (
            <>
              <p className="hb-surface-strong rounded-3xl px-4 py-3 text-sm leading-6 text-slate-700">
                {insights.overview}
              </p>
              <ul className="mt-5 space-y-3">
                {insights.tips.map((tip, index) => (
                  <li
                    key={tip.title}
                    className="hb-panel-soft rounded-3xl px-4 py-4 text-sm text-slate-700 shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {INSIGHT_EMOJIS[index] || "💡"} {tip.title}
                    </p>
                    <p className="mt-1 leading-6">{tip.action}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {tip.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <div className="space-y-6">
        <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-[#245188]" />
            <div>
              <h2 className="text-2xl font-semibold">{t("insights.mix")}</h2>
              <p className="text-sm text-slate-600">{t("insights.mixSubtitle")}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="hb-panel-soft rounded-3xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.cash")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currency(summary?.cashSpent ?? 0)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {summary?.cashSharePct ?? 0}{t("insights.recentSpendPct")}
              </p>
            </div>
            <div className="hb-panel-mint rounded-3xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.card")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currency(summary?.cardSpent ?? 0)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {summary?.cardSharePct ?? 0}{t("insights.recentSpendPct")}
              </p>
            </div>
            <div className="hb-panel-soft rounded-3xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.recurring")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currency(summary?.recurringSpent ?? 0)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{t("insights.fixedMonthly")}</p>
            </div>
            <div className="hb-panel-soft rounded-3xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.oneTime")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currency(summary?.oneTimeSpent ?? 0)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{t("insights.flexibleSpend")}</p>
            </div>
          </div>
        </section>

        <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-[#16995a]" />
            <div>
              <h2 className="text-2xl font-semibold">{t("insights.topCategories")}</h2>
              <p className="text-sm text-slate-600">{t("insights.categoriesSubtitle")}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {dashboard?.topCategories?.length ? (
              dashboard.topCategories.map((category) => (
                <div
                  key={category.category}
                  className="hb-panel-soft flex items-center justify-between rounded-3xl px-4 py-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{category.category}</p>
                    <p className="text-sm text-slate-500">
                      {category.sharePct}{t("insights.totalSpendPct")}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(category.amount)}
                  </p>
                </div>
              ))
            ) : (
              <div className="hb-panel-soft rounded-3xl px-4 py-6 text-sm text-slate-500">
                {t("insights.categoryEmpty")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default InsightsPage;
