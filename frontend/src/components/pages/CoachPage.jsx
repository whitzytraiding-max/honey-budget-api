/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Send, Sparkles, Settings } from "lucide-react";

const CHAT_SUGGESTIONS = [
  "How are we tracking this month?",
  "Where are we overspending?",
  "Am I on track with my savings?",
  "I got a raise — update my income",
  "Add a new Netflix bill for $18",
  "Which category should we cut first?",
];

const ACTION_LABELS = {
  update_income: "Income updated",
  log_expense: "Expense logged",
  update_bill: "Bill updated",
  add_bill: "Bill added",
};

const TIPS = [
  { title: "50/30/20 Rule", body: "Spend 50% on needs, 30% on wants, save 20%. A simple framework that works for most households.", accent: "#0284c7" },
  { title: "Pay Yourself First", body: "Set up an automatic transfer to savings on payday — before you can spend it.", accent: "#16a34a" },
  { title: "Emergency Fund", body: "Keep 3–6 months of expenses in a separate, easily accessible account.", accent: "#d97706" },
  { title: "Debt Avalanche", body: "Pay minimums on all debts, then throw extra cash at the highest-interest one first.", accent: "#dc2626" },
  { title: "Track Every Week", body: "Spend 10 minutes every Sunday reviewing your spending. Awareness changes behaviour.", accent: "#7c3aed" },
  { title: "Small Leaks Sink Ships", body: "Subscriptions, coffee, impulse buys — add them up for the year and you'll be surprised.", accent: "#0891b2" },
];

function CoachTips() {
  return (
    <div className="hb-surface-card rounded-[2rem] p-5 sm:p-6">
      <h1 className="text-xl font-bold mb-1" style={{ color: "var(--hb-ink)" }}>Financial Tips</h1>
      <p className="text-sm mb-5" style={{ color: "var(--hb-ink-soft)" }}>Quick principles to build better money habits.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className="rounded-2xl p-4"
            style={{ background: "var(--hb-surface-strong)", border: "1px solid var(--hb-border)" }}
          >
            <div className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: tip.accent }}>
              {tip.title}
            </div>
            <p className="text-sm leading-6" style={{ color: "var(--hb-ink)" }}>{tip.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachChat({ onSendMessage, onEditProfile }) {
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
      if (e.error === "no-speech" || e.error === "aborted") return;
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
      if (e.error === "not-allowed") {
        setError("Microphone access was denied. Please allow it in your browser settings and try again.");
      } else {
        setError("Voice input stopped. Tap the mic to try again.");
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
      if (committedRef.current) setMessage(committedRef.current);
      inputRef.current?.focus();
    };

    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setError("Couldn't start voice input. Tap the mic to try again.");
    }
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
    <div className="flex flex-col" style={{ minHeight: "70vh" }}>
      <div className="hb-surface-card rounded-[2rem] p-5 sm:p-6 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--hb-ink)" }}>Hunny</h1>
              <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>Ask anything — I can update your data too</p>
            </div>
          </div>
          {onEditProfile && (
            <button
              type="button"
              onClick={onEditProfile}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition"
              style={{ background: "var(--hb-surface-strong)", color: "var(--hb-ink-soft)" }}
            >
              <Settings className="h-3.5 w-3.5" />
              Profile
            </button>
          )}
        </div>
      </div>

      <div className="hb-surface-card flex-1 rounded-[2rem] p-5 sm:p-6 flex flex-col gap-4">
        {isEmpty && (
          <div className="flex flex-wrap gap-2 pb-2">
            {CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                style={{ background: "var(--hb-surface-strong)", color: "var(--hb-ink-soft)", border: "1px solid var(--hb-border)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {!isEmpty && (
          <div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: "52vh" }}>
            {history.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6"
                  style={
                    msg.role === "user"
                      ? { background: "#0284c7", color: "#fff" }
                      : { background: "var(--hb-surface-strong)", color: "var(--hb-ink)", border: "1px solid var(--hb-border)" }
                  }
                >
                  {msg.text}
                </div>
                {msg.actions?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {msg.actions.map((a, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)" }}
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
                <div
                  className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "var(--hb-surface-strong)", color: "var(--hb-ink-soft)", border: "1px solid var(--hb-border)" }}
                >
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

        <form className="mt-auto flex gap-2 pt-2" onSubmit={handleSubmit}>
          <button
            type="button"
            onClick={toggleVoice}
            title={listening ? "Tap to stop" : "Tap to speak"}
            className="flex shrink-0 items-center justify-center rounded-2xl px-3 py-3 transition"
            style={listening ? { background: "#ef4444", color: "#fff" } : { background: "var(--hb-surface-strong)", color: "var(--hb-ink-soft)" }}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <div className="relative flex-1">
            <input
              ref={inputRef}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hb-surface-strong)", color: "var(--hb-ink)", border: "1px solid var(--hb-border)" }}
              placeholder={listening ? "Speak now…" : "Ask anything or say 'update my income to $X'…"}
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
      </div>
    </div>
  );
}

export default function CoachPage({ activeTab = "chat", onSendMessage, onEditProfile }) {
  if (activeTab === "tips") return <CoachTips />;
  return <CoachChat onSendMessage={onSendMessage} onEditProfile={onEditProfile} />;
}
