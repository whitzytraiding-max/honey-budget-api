/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useMemo, useRef, useState } from "react";
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

function CatChat({ onSendMessage, remainingPct, isDark }) {
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

  const bubbleBg = error
    ? (isDark ? "rgba(80, 14, 18, 0.9)" : "rgba(254, 226, 226, 0.97)")
    : (isDark ? "rgba(50, 30, 8, 0.9)" : "rgba(255, 249, 224, 0.97)");
  const bubbleBorder = error
    ? (isDark ? "1px solid rgba(248, 113, 113, 0.35)" : "1px solid rgba(248, 113, 113, 0.45)")
    : (isDark ? "1px solid rgba(100, 65, 20, 0.4)" : "1px solid rgba(180, 120, 20, 0.28)");
  const bubbleTextColor = error
    ? (isDark ? "#fca5a5" : "#991b1b")
    : (isDark ? "#f0e0c0" : "#3C2000");

  return (
    <div className="flex flex-col items-center gap-0 pt-3">
      {/* Speech bubble */}
      <div className="relative w-full max-w-xs mx-auto mb-1">
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{ background: bubbleBg, border: bubbleBorder, color: bubbleTextColor }}
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
                      style={{
                        background: isDark ? "rgba(6, 60, 30, 0.8)" : "rgba(220, 252, 231, 0.9)",
                        color: isDark ? "#86efac" : "#166534",
                        border: isDark ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(52, 211, 153, 0.4)",
                      }}
                    >
                      ✓ {ACTION_LABELS[a.tool] ?? a.tool}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span style={{ color: isDark ? "rgba(240, 210, 160, 0.7)" : "rgba(100, 65, 10, 0.65)" }}>
              <span className="font-semibold" style={{ color: isDark ? "#f0e0c0" : "#2C1800" }}>Tap me to chat!</span>{" "}
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
            borderTop: `11px solid ${bubbleBorder.replace("1px solid ", "")}`,
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-[8px] w-0 h-0"
          style={{
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `10px solid ${bubbleBg}`,
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

      <p className="mt-1 text-[11px] font-medium tracking-wide text-center" style={{ color: isDark ? "rgba(212, 135, 10, 0.35)" : "rgba(120, 80, 10, 0.4)" }}>
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
  theme = "system",
}) {
  const { t } = useLanguage();

  const isDark = useMemo(() => {
    if (theme === "light") return false;
    if (theme === "dark") return true;
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  }, [theme]);

  const setupRemaining = setupChecklist.filter((item) => !item.completed).length;
  const householdIncome = Number(summaryData?.householdIncome ?? 0);
  const totalSpent = Number(summaryData?.totalExpenses ?? 0);
  const remainingBudget = Number(summaryData?.remainingBudget ?? 0);
  const remainingPct = Number(summaryData?.remainingPct ?? 50);

  const numberColor = useMemo(() => {
    if (householdIncome === 0) return isDark ? "#D4870A" : "#C47808";
    if (remainingBudget < 0 || remainingPct <= 15) return isDark ? "#ef4444" : "#dc2626";
    if (remainingPct <= 50) return isDark ? "#D4870A" : "#C47808";
    return isDark ? "#22b36b" : "#1a9e5c";
  }, [isDark, householdIncome, remainingBudget, remainingPct]);

  const barColor = remainingPct <= 15 ? "#ef4444" : remainingPct <= 50 ? "#D4870A" : "#22b36b";

  // Light-mode style tokens
  const sectionBg = isDark ? "rgba(42, 26, 8, 0.85)" : "rgba(255, 249, 228, 0.97)";
  const sectionBorder = isDark ? "1px solid rgba(212, 135, 10, 0.3)" : "1px solid rgba(180, 120, 20, 0.28)";
  const heroBg = isDark ? "rgba(38, 24, 8, 0.88)" : "rgba(255, 250, 232, 0.97)";
  const heroBorder = isDark ? "1px solid rgba(100, 65, 20, 0.4)" : "1px solid rgba(180, 120, 20, 0.22)";
  const heroInnerBg = isDark
    ? "linear-gradient(180deg, #3a2208 0%, #2a1808 60%, #1e1208 100%)"
    : "linear-gradient(180deg, #FFFEF5 0%, #FFFAED 60%, #FFF6E4 100%)";
  const heroInnerShadow = isDark ? "inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 4px rgba(180,120,20,0.08)";
  const kickerColor = isDark ? "rgba(212, 135, 10, 0.6)" : "rgba(120, 80, 10, 0.6)";
  const periodColor = isDark ? "rgba(212, 135, 10, 0.5)" : "rgba(120, 80, 10, 0.5)";
  const barLabelColor = isDark ? "rgba(212, 135, 10, 0.55)" : "rgba(110, 72, 8, 0.65)";
  const trackBg = isDark ? "rgba(50, 28, 6, 0.8)" : "rgba(235, 210, 150, 0.55)";
  const emptyTextColor = isDark ? "rgba(212, 135, 10, 0.55)" : "rgba(120, 80, 10, 0.55)";
  const splitLabelColor = isDark ? "rgba(212, 135, 10, 0.6)" : "rgba(100, 65, 10, 0.7)";
  const setupKickerColor = isDark ? "rgba(156, 120, 85, 0.7)" : "rgba(100, 70, 15, 0.65)";
  const setupHeadingColor = isDark ? "#f0e0c0" : "#2C1800";

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

        {/* Cat chat */}
        {onSendMessage && (
          <CatChat onSendMessage={onSendMessage} remainingPct={remainingPct} isDark={isDark} />
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
