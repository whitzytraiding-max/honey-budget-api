/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getRemainingTone } from "../../lib/format.js";
import { MoneyCat } from "../MoneyCat.jsx";
import { ActionButton, ProgressBar } from "../ui.jsx";

const CAT_HINTS = [
  "How are we tracking this month?",
  "Log $12 coffee this morning",
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
  const [bubble, setBubble] = useState(null);   // { text, actions }
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [rawHistory, setRawHistory] = useState([]);
  const recognitionRef = useRef(null);
  const capturedRef = useRef("");
  const releasedRef = useRef(false);

  async function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setBubble(null);
    try {
      const result = await onSendMessage(trimmed, rawHistory);
      setRawHistory(result.history ?? []);
      setBubble({ text: result.reply, actions: result.actions ?? [] });
    } catch (err) {
      const msg = err.message || "";
      setError(
        msg.toLowerCase().includes("fetch")
          ? "Can't reach the server — check your connection."
          : msg || "Something went wrong. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice not supported in this browser. Try Chrome.");
      return;
    }

    // Pre-warm mic permission — on iOS, SpeechRecognition.start() fires not-allowed
    // even after the user grants permission unless getUserMedia has already resolved first.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        const isStandalone =
          window.navigator.standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;
        if (isStandalone) {
          setError("Tap to open: iOS Settings → Honey Budget → enable Microphone, then come back and try again.");
        } else {
          setError("Microphone access denied. Tap the lock icon in your browser's address bar to allow microphone access.");
        }
        return;
      }
    }

    capturedRef.current = "";
    releasedRef.current = false;
    setRecording(true);
    setError(null);

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onresult = (e) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) capturedRef.current = (capturedRef.current + " " + final).trim();
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      recognitionRef.current = null;
      setRecording(false);
      setError("Recording stopped. Tap to try again.");
    };

    rec.onend = () => {
      const wasReleased = releasedRef.current;
      const captured = capturedRef.current;
      recognitionRef.current = null;
      setRecording(false);
      if (wasReleased && captured) {
        sendText(captured);
      }
    };

    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setRecording(false);
      setError("Couldn't start recording. Tap to try again.");
    }
  }

  function stopRecording() {
    releasedRef.current = true;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    setRecording(false);
    rec?.stop();
  }

  function handleCatTap() {
    if (busy) return;
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const isIdle = !bubble && !busy && !error && !recording;

  return (
    <div className="pt-4">
      <div className="flex flex-col items-center gap-0">

        {/* Speech bubble — sits above the cat with a downward tail */}
        <div className="relative w-full max-w-xs mx-auto mb-1">
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
              error
                ? "bg-rose-50 border border-rose-200 text-rose-600"
                : "bg-white/95 border border-slate-100 text-slate-700"
            }`}
          >
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "300ms" }} />
              </span>
            ) : recording ? (
              <span className="flex items-center gap-2 font-medium text-amber-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                Listening… tap me again to send
              </span>
            ) : error ? (
              error
            ) : bubble ? (
              <>
                {bubble.text}
                {bubble.actions?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bubble.actions.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200"
                      >
                        ✓ {ACTION_LABELS[a.tool] ?? a.tool}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Idle hint */
              <span className="text-slate-500">
                <span className="font-semibold text-slate-700">Tap me to chat!</span> Try saying:{" "}
                {CAT_HINTS.map((h, i) => (
                  <span key={h}>
                    <button
                      type="button"
                      onClick={() => sendText(h)}
                      className="text-amber-600 font-medium hover:underline focus:outline-none"
                    >
                      "{h}"
                    </button>
                    {i < CAT_HINTS.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            )}
          </div>
          {/* Bubble tail */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-[10px] w-0 h-0"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: error ? "11px solid #fecaca" : "11px solid #e2e8f0",
            }}
          />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-[8px] w-0 h-0"
            style={{
              borderLeft: "9px solid transparent",
              borderRight: "9px solid transparent",
              borderTop: error ? "10px solid #fff1f2" : "10px solid #fffffff2",
            }}
          />
        </div>

        {/* Cat */}
        <button
          type="button"
          onClick={handleCatTap}
          disabled={busy}
          className={`relative mt-3 cursor-pointer select-none transition-transform active:scale-95 disabled:opacity-60 ${recording ? "drop-shadow-[0_0_24px_rgba(251,191,36,0.9)]" : "hover:drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]"}`}
          style={{ background: "none", border: "none", padding: 0, WebkitTouchCallout: "none" }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {recording && (
            <span className="absolute inset-0 -m-4 animate-ping rounded-full bg-amber-400/25 pointer-events-none" />
          )}
          <MoneyCat remainingPct={remainingPct} size={148} />
        </button>

        <p className="mt-1 text-[11px] font-medium text-white/40 tracking-wide text-center">
          {busy ? "Thinking…" : isIdle ? "Tap to speak" : ""}
        </p>

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

        <div className="hb-progress-track mt-4 h-3 overflow-hidden rounded-full shadow-inner">
          <div
            className={`hb-progress-fill h-full rounded-full bg-gradient-to-r transition-all duration-500 ${summaryTone.bar}`}
            style={{ width: `${remainingPct}%` }}
          />
        </div>

        {onSendMessage && (
          <CatChat onSendMessage={onSendMessage} remainingPct={remainingPct} />
        )}

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

    </div>
  );
}

export default HomePage;
