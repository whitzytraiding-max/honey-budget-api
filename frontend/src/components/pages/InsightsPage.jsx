import { useEffect, useRef, useState } from "react";
import { Brain, Send, Sparkles, TrendingUp, Wallet } from "lucide-react";
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

const INSIGHT_EMOJIS = ["🌿", "💳", "🎯"];

const CHAT_SUGGESTIONS = [
  "How do we cut our food spending?",
  "Are we on track with our savings goal?",
  "Why is our remaining budget low this month?",
  "Which of us is spending more right now?",
];

function CoachChat({ onSendMessage }) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setReply(null);
    setError(null);
    try {
      const result = await onSendMessage(text);
      setReply(result);
      setMessage("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <div>
          <h2 className="text-2xl font-semibold">Ask your coach</h2>
          <p className="text-sm text-slate-600">Ask anything about your finances and get a personalised answer.</p>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {CHAT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="hb-panel-soft rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
            onClick={() => { setMessage(s); inputRef.current?.focus(); }}
          >
            {s}
          </button>
        ))}
      </div>

      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          placeholder="e.g. How do we save faster?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={busy || !message.trim()}
          className="flex shrink-0 items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-white transition hover:bg-sky-700 disabled:opacity-40"
          aria-label="Send"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      {/* Reply */}
      {reply && (
        <div className="mt-4 rounded-3xl border border-sky-100 bg-sky-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Coach reply</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{reply}</p>
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm text-rose-600">{error}</p>
      )}
    </section>
  );
}

function InsightsPage({ insightsBusy, insights, dashboard, onChatMessage }) {
  const { t } = useLanguage();
  const summary = dashboard?.summary;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

      {/* Left column: coach insights + chat */}
      <div className="space-y-6">
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

                {/* Win of the month */}
                {insights.win && (
                  <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                      ✅ {insights.win.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">{insights.win.body}</p>
                  </div>
                )}

                <ul className="mt-4 space-y-3">
                  {insights.tips.map((tip, index) => (
                    <li
                      key={tip.title}
                      className="hb-panel-soft rounded-3xl px-4 py-4 text-sm text-slate-700 shadow-sm"
                    >
                      <p className="font-semibold text-slate-900">
                        {INSIGHT_EMOJIS[index] || "💡"} {tip.title}
                      </p>
                      <p className="mt-1 leading-6">{tip.action}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {onChatMessage && <CoachChat onSendMessage={onChatMessage} />}
      </div>

      {/* Right column: spending stats + top categories */}
      <div className="space-y-6">
        <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-[#245188]" />
            <div>
              <h2 className="text-xl font-semibold">{t("insights.mix")}</h2>
              <p className="text-sm text-slate-600">{t("insights.mixSubtitle")}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="hb-panel-soft rounded-2xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.cash")}
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900">
                {currency(summary?.cashSpent ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary?.cashSharePct ?? 0}{t("insights.recentSpendPct")}
              </p>
            </div>
            <div className="hb-panel-mint rounded-2xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.card")}
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900">
                {currency(summary?.cardSpent ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary?.cardSharePct ?? 0}{t("insights.recentSpendPct")}
              </p>
            </div>
            <div className="hb-panel-soft rounded-2xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.recurring")}
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900">
                {currency(summary?.recurringSpent ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{t("insights.fixedMonthly")}</p>
            </div>
            <div className="hb-panel-soft rounded-2xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("insights.oneTime")}
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900">
                {currency(summary?.oneTimeSpent ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{t("insights.flexibleSpend")}</p>
            </div>
          </div>
        </section>

        <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-[#16995a]" />
            <div>
              <h2 className="text-xl font-semibold">{t("insights.topCategories")}</h2>
              <p className="text-sm text-slate-600">{t("insights.categoriesSubtitle")}</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {dashboard?.topCategories?.length ? (
              dashboard.topCategories.map((category) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between rounded-2xl px-3.5 py-3 odd:bg-slate-50/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{category.category}</p>
                    <p className="text-xs text-slate-500">
                      {category.sharePct}{t("insights.totalSpendPct")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {currency(category.amount)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl px-4 py-6 text-sm text-slate-500">
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
