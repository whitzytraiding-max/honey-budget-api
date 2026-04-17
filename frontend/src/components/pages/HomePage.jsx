/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getRemainingTone } from "../../lib/format.js";
import { MoneyCat } from "../MoneyCat.jsx";
import { ActionButton, ProgressBar } from "../ui.jsx";

const CAT_SUGGESTIONS = [
  "How are we tracking this month?",
  "Log $12 coffee this morning",
  "How much have we spent on food?",
  "Am I on track with savings?",
  "Add a Netflix bill for $18",
];

const ACTION_LABELS = {
  update_income: "Income updated",
  log_expense: "Expense logged",
  update_bill: "Bill updated",
  add_bill: "Bill added",
};

function CatChat({ onSendMessage, remainingPct }) {
  const [message, setMessage] = useState("");
  const [interim, setInterim] = useState("");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [rawHistory, setRawHistory] = useState([]);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const committedRef = useRef("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy]);

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    committedRef.current = message;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    rec.onstart = () => { setListening(true); setError(null); };
    rec.onresult = (e) => {
      let finalPart = "";
      let interimPart = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalPart += t;
        else interimPart += t;
      }
      if (finalPart) {
        const joined = (committedRef.current + " " + finalPart).trim();
        committedRef.current = joined;
        setMessage(joined);
        setInterim("");
      } else {
        setInterim(interimPart);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech") return;
      setListening(false);
      setInterim("");
      setError("Voice input stopped. Try again.");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      if (committedRef.current) setMessage(committedRef.current);
      inputRef.current?.focus();
    };
    rec.start();
  }, [listening, message]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (listening) recognitionRef.current?.stop();
    setBusy(true);
    setError(null);
    setMessage("");
    setInterim("");
    committedRef.current = "";
    setHistory((h) => [...h, { role: "user", text: trimmed }]);
    try {
      const result = await onSendMessage(trimmed, rawHistory);
      setRawHistory(result.history ?? []);
      setHistory((h) => [...h, { role: "cat", text: result.reply, actions: result.actions ?? [] }]);
    } catch (err) {
      const msg = err.message || "";
      setError(
        msg.toLowerCase().includes("fetch")
          ? "Couldn't reach the server — check your connection."
          : msg || "Something went wrong. Try again."
      );
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

  const lastCatMessage = [...history].reverse().find((m) => m.role === "cat");
  const isEmpty = history.length === 0;

  return (
    <section className="hb-surface-card rounded-[1.35rem] p-4 sm:rounded-[1.5rem] sm:p-6">

      {/* Cat + speech bubble */}
      <div className="relative flex justify-center pt-2 pb-4">
        {/* Speech bubble */}
        <div className="absolute -top-1 left-1/2 w-[calc(100%-40px)] max-w-sm -translate-x-1/2 -translate-y-full">
          {busy ? (
            <div className="rounded-2xl rounded-bl-sm bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-md border border-slate-100">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          ) : lastCatMessage ? (
            <div className="rounded-2xl rounded-bl-sm bg-white/90 px-4 py-3 text-sm leading-6 text-slate-700 shadow-md border border-slate-100">
              {lastCatMessage.text}
              {lastCatMessage.actions?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lastCatMessage.actions.map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200"
                    >
                      ✓ {ACTION_LABELS[a.tool] ?? a.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Cat */}
        <div
          className={`cursor-pointer transition-transform active:scale-95 ${listening ? "drop-shadow-[0_0_16px_rgba(251,191,36,0.7)]" : ""}`}
          onClick={toggleVoice}
          title={listening ? "Tap to stop listening" : "Tap to speak"}
        >
          <MoneyCat remainingPct={remainingPct} size={140} />
        </div>

        {listening && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Listening…
            </span>
          </div>
        )}
      </div>

      <p className="text-center text-xs font-semibold text-slate-400 tracking-wide mb-4">
        Tap the cat to speak · or type below
      </p>

      {/* Suggestion chips — only when empty */}
      {isEmpty && !busy && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {CAT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Message thread (last 6 messages, newest at bottom) */}
      {!isEmpty && (
        <div
          className="mb-4 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {history.slice(-6).map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                  msg.role === "user"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-100 bg-white/80 text-slate-700"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <p className="mb-3 text-center text-xs text-red-500">{error}</p>
      )}

      {/* Input bar */}
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <button
          type="button"
          onClick={toggleVoice}
          title={listening ? "Stop" : "Speak"}
          className="flex shrink-0 items-center justify-center rounded-2xl px-3 py-3 transition"
          style={
            listening
              ? { background: "#ef4444", color: "#fff" }
              : { background: "var(--hb-surface-strong)", color: "var(--hb-ink-soft)" }
          }
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <div className="relative flex-1">
          <input
            ref={inputRef}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--hb-surface-strong)",
              color: "var(--hb-ink)",
              border: "1px solid var(--hb-border)",
            }}
            placeholder={listening ? "Speak now…" : "Ask or log an expense…"}
            value={message}
            onChange={(e) => { setMessage(e.target.value); committedRef.current = e.target.value; }}
            disabled={busy}
            maxLength={1000}
          />
          {listening && interim && (
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm" style={{ color: "var(--hb-ink-soft)" }}>
              <span className="invisible">{message}</span>
              {message ? " " : ""}{interim}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || (!message.trim() && !interim)}
          className="flex shrink-0 items-center justify-center rounded-2xl px-4 py-3 text-white transition disabled:opacity-40"
          style={{ background: "#0284c7" }}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
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
  onNavigateToCoach,
  onNavigateToSetup,
  onSendMessage,
}) {
  const { t } = useLanguage();
  const setupRemaining = setupChecklist.filter((item) => !item.completed).length;
  const householdIncome = Number(summaryData?.householdIncome ?? 0);
  const remainingBudget = Number(summaryData?.remainingBudget ?? 0);
  const remainingPct = Number(summaryData?.remainingPct ?? 50);
  const summaryTone = getRemainingTone(remainingBudget, householdIncome);

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Setup prompt */}
      {setupRemaining > 0 ? (
        <section className="hb-panel-soft rounded-[1.35rem] border border-sky-100/80 p-4 shadow-[0_18px_50px_-28px_rgba(21,50,65,0.28)] sm:rounded-[1.5rem] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex rounded-full bg-white/90 p-2 text-sky-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="hb-kicker">{soloMode ? t("setup.personalLabel") : t("setup.householdLabel")}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-2xl">
                  {soloMode ? t("setup.personalTitle") : t("setup.sharedTitle")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                  {setupRemaining} step{setupRemaining === 1 ? "" : "s"} still need attention.{" "}
                  {soloMode ? t("setup.personalBody") : t("setup.sharedBody")}
                </p>
              </div>
            </div>
            <ActionButton className="sm:w-auto sm:min-w-[220px]" onClick={onNavigateToSetup} type="button">
              {t("setup.openChecklist")}
            </ActionButton>
          </div>
        </section>
      ) : null}

      {/* Budget hero */}
      <section className="hb-surface-card rounded-[1.35rem] p-3.5 sm:rounded-[1.5rem] sm:p-6">
        <div className="hb-hero-panel rounded-[1.2rem] px-4 py-4 text-white sm:rounded-[1.4rem] sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-xs">
                {t("home.remaining")}
              </p>
              <p className="hb-stat-emphasis mt-2 text-[2.35rem] font-semibold tracking-tight sm:text-6xl">
                {currency(remainingBudget)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="hb-brand-pill inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs">
                  {t("shell.totalHouseholdIncome")}
                </div>
                <p className="text-lg font-semibold text-white/90 sm:text-xl">
                  {currency(householdIncome)}
                </p>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                {summaryData
                  ? `${currency(summaryData.totalExpenses)} spent in ${summaryData.period.label}.`
                  : "Calculating your current budget window."}
              </p>
            </div>
          </div>
        </div>

        <div className="hb-progress-track mt-4 h-3 overflow-hidden rounded-full shadow-inner">
          <div
            className={`hb-progress-fill h-full rounded-full bg-gradient-to-r transition-all duration-500 ${summaryTone.bar}`}
            style={{ width: `${remainingPct}%` }}
          />
        </div>

        {/* Income split bars */}
        {dashboard && !dashboardBusy && (
          <div className="mt-4 space-y-3">
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

      {/* Cat advisor chat */}
      {onSendMessage && (
        <CatChat onSendMessage={onSendMessage} remainingPct={remainingPct} />
      )}
    </div>
  );
}

export default HomePage;
