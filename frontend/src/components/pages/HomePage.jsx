/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";
import { MoneyCat } from "../MoneyCat.jsx";
import { hapticLight } from "../../lib/native.js";

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
  const [bubble, setBubble] = useState(null);
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

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        const isStandalone =
          window.navigator.standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;
        if (isStandalone) {
          setError("Go to iOS Settings → Honey Budget → enable Microphone.");
        } else {
          setError("Microphone access denied. Allow it in your browser settings.");
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
      if (wasReleased && captured) sendText(captured);
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
    hapticLight();
    if (recording) stopRecording();
    else startRecording();
  }

  const isIdle = !bubble && !busy && !error && !recording;

  return (
    <div className="flex flex-col items-center gap-0 pt-3">
      {/* Speech bubble */}
      <div className="relative w-full max-w-xs mx-auto mb-1">
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{
            background: error ? "rgba(80, 14, 18, 0.9)" : "rgba(50, 30, 8, 0.9)",
            border: error ? "1px solid rgba(248, 113, 113, 0.35)" : "1px solid rgba(100, 65, 20, 0.4)",
            color: error ? "#fca5a5" : "#f0e0c0",
          }}
        >
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "300ms" }} />
            </span>
          ) : recording ? (
            <span className="flex items-center gap-2 font-medium" style={{ color: "#D4870A" }}>
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
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: "rgba(6, 60, 30, 0.8)", color: "#86efac", border: "1px solid rgba(52, 211, 153, 0.3)" }}
                    >
                      ✓ {ACTION_LABELS[a.tool] ?? a.tool}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span style={{ color: "rgba(240, 210, 160, 0.7)" }}>
              <span className="font-semibold" style={{ color: "#f0e0c0" }}>Tap me to chat!</span>{" "}
              {CAT_HINTS.map((h, i) => (
                <span key={h}>
                  <button
                    type="button"
                    onClick={() => sendText(h)}
                    className="font-medium hover:underline focus:outline-none"
                    style={{ color: "#D4870A" }}
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
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-[10px] w-0 h-0"
          style={{
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: error ? "11px solid rgba(248, 113, 113, 0.35)" : "11px solid rgba(100, 65, 20, 0.4)",
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-[8px] w-0 h-0"
          style={{
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: error ? "10px solid rgba(80, 14, 18, 0.9)" : "10px solid rgba(50, 30, 8, 0.9)",
          }}
        />
      </div>

      {/* Cat */}
      <button
        type="button"
        onClick={handleCatTap}
        disabled={busy}
        className={`relative mt-3 cursor-pointer select-none transition-transform active:scale-95 disabled:opacity-60 ${
          recording ? "drop-shadow-[0_0_24px_rgba(212,135,10,0.9)]" : "hover:drop-shadow-[0_0_12px_rgba(212,135,10,0.4)]"
        }`}
        style={{ background: "none", border: "none", padding: 0, WebkitTouchCallout: "none" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {recording && (
          <span className="absolute inset-0 -m-4 animate-ping rounded-full pointer-events-none" style={{ background: "rgba(212, 135, 10, 0.2)" }} />
        )}
        <MoneyCat remainingPct={remainingPct} size={148} />
      </button>

      <p className="mt-1 text-[11px] font-medium tracking-wide text-center" style={{ color: "rgba(212, 135, 10, 0.35)" }}>
        {busy ? "Thinking…" : isIdle ? "Tap to speak" : ""}
      </p>
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
  const totalSpent = Number(summaryData?.totalExpenses ?? 0);
  const remainingBudget = Number(summaryData?.remainingBudget ?? 0);
  const remainingPct = Number(summaryData?.remainingPct ?? 50);

  return (
    <div className="space-y-4">

      {/* Setup prompt */}
      {setupRemaining > 0 ? (
        <section
          className="rounded-[1.35rem] p-4"
          style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(212, 135, 10, 0.3)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
                {soloMode ? t("setup.personalLabel") : t("setup.householdLabel")}
              </p>
              <h2 className="mt-1 text-lg font-semibold" style={{ color: "#f0e0c0" }}>
                {setupRemaining} step{setupRemaining === 1 ? "" : "s"} remaining
              </h2>
            </div>
            <button
              className="shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
              style={{ background: "#D4870A", color: "#fff" }}
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
        style={{ background: "rgba(38, 24, 8, 0.88)", border: "1px solid rgba(100, 65, 20, 0.4)" }}
      >
        {/* Primary stat */}
        <div
          className="rounded-[1.1rem] px-4 py-5"
          style={{
            background: "linear-gradient(180deg, #3a2208 0%, #2a1808 60%, #1e1208 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "rgba(212, 135, 10, 0.6)" }}>
            Total spent
          </p>
          <p className="mt-1 text-[2.6rem] font-bold leading-none tracking-tight" style={{ color: "#D4870A" }}>
            {currency(totalSpent)}
          </p>
          <p className="mt-1 text-sm" style={{ color: "rgba(212, 135, 10, 0.5)" }}>
            {summaryData?.period?.label ?? "This month"}
          </p>

          {householdIncome > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1" style={{ color: "rgba(212, 135, 10, 0.55)" }}>
                  <span>Budget remaining</span>
                  <span>{currency(remainingBudget)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(50, 28, 6, 0.8)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, 100 - remainingPct)}%`,
                      background: remainingPct < 15 ? "#ef4444" : remainingPct < 50 ? "#D4870A" : "#22b36b",
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
            <p className="text-sm" style={{ color: "rgba(212, 135, 10, 0.55)" }}>
              No expenses yet!<br />Start adding to see your spending here.
            </p>
            <span className="mt-2 block text-2xl">🐾</span>
          </div>
        )}

        {/* Cat chat */}
        {onSendMessage && (
          <CatChat onSendMessage={onSendMessage} remainingPct={remainingPct} />
        )}

        {/* Per-person split */}
        {dashboard && !dashboardBusy && dashboard.fairSplit?.length > 0 && (
          <div className="mt-4 space-y-2">
            {dashboard.fairSplit.map((person) => {
              const user = dashboard.users?.find((u) => u.id === person.userId);
              const salary = user?.monthlySalary || person.monthlySalary || 0;
              return (
                <div key={person.userId}>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(212, 135, 10, 0.6)" }}>
                    <span className="font-medium">{person.name}</span>
                    <span>{currency(salary)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(50, 28, 6, 0.8)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, person.sharePct)}%`,
                        background: "#22b36b",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}

export default HomePage;
