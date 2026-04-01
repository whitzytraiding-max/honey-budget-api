import { Brain, TrendingUp, Wallet } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";
import { InsightSkeleton } from "../ui.jsx";

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
            <InsightSkeleton />
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
