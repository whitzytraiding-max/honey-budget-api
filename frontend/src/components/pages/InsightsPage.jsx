import { useEffect, useRef, useState, useCallback } from "react";
import { Brain, Mic, MicOff, Send, Sparkles, TrendingUp, Wallet } from "lucide-react";
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
  "I got a raise — update my income to $X",
  "Which of us is spending more right now?",
];

const ACTION_LABELS = {
  update_income: "Income updated",
  log_expense: "Expense logged",
  update_bill: "Bill updated",
  add_bill: "Bill added",
};

function CoachChat({ onSendMessage }) {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]); // { role: "user"|"coach", text, actions? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [rawHistory, setRawHistory] = useState([]); // API conversation history
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy]);

  // Voice input
  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setMessage((prev) => (prev ? prev + " " + transcript : transcript));
      inputRef.current?.focus();
    };
    rec.onerror = () => {
      setListening(false);
      setError("Voice input failed. Try again.");
    };
    rec.onend = () => setListening(false);
    rec.start();
  }, [listening]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setMessage("");

    // Optimistically add user bubble
    setHistory((h) => [...h, { role: "user", text: trimmed }]);

    try {
      const result = await onSendMessage(trimmed, rawHistory);
      setRawHistory(result.history ?? []);
      setHistory((h) => [
        ...h,
        { role: "coach", text: result.reply, actions: result.actions ?? [] },
      ]);
    } catch (err) {
      const msg = err.message || "";
      setError(
        msg.toLowerCase().includes("fetch")
          ? "Couldn't reach the coach — check your connection."
          : msg || "Something went wrong. Please try again."
      );
      // Remove the optimistic user bubble on error
      setHistory((h) => h.slice(0, -1));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(message);
  }

  const isEmpty = history.length === 0;

  return (
    <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <div>
          <h2 className="text-2xl font-semibold">Ask your coach</h2>
          <p className="text-sm text-slate-600">
            Your AI financial auditor — ask questions or tell it to update your data.
          </p>
        </div>
      </div>

      {/* Suggestion chips — shown only when chat is empty */}
      {isEmpty && (
        <div className="mt-4 flex flex-wrap gap-2">
          {CHAT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="hb-panel-soft rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
              onClick={() => send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat history */}
      {!isEmpty && (
        <div className="mt-5 flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
          {history.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  msg.role === "user"
                    ? "bg-sky-600 text-white"
                    : "hb-panel-soft text-slate-800"
                }`}
              >
                {msg.text}
              </div>
              {/* Action confirmation badges */}
              {msg.actions?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {msg.actions.map((a, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200"
                    >
                      ✓ {ACTION_LABELS[a.tool] ?? a.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-start">
              <div className="hb-panel-soft flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-slate-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {/* Input bar */}
      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        {/* Voice button */}
        <button
          type="button"
          onClick={toggleVoice}
          title={listening ? "Stop listening" : "Speak your message"}
          className={`flex shrink-0 items-center justify-center rounded-2xl px-3 py-3 transition ${
            listening
              ? "animate-pulse bg-rose-500 text-white"
              : "hb-panel-soft text-slate-500 hover:text-slate-800"
          }`}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <input
          ref={inputRef}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          placeholder={listening ? "Listening…" : "Ask anything or say 'update my income to $X'"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={busy || !message.trim()}
          className="flex shrink-0 items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-white transition hover:bg-sky-700 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
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
