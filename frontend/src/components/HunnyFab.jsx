/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useRef, useState } from "react";
import { Mic, X } from "lucide-react";
import { MoneyCat } from "./MoneyCat.jsx";
import { hapticLight } from "../lib/native.js";

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

// Floating "Hunny" coach button. Lives at the app root (outside the page-enter
// transform) so position:fixed anchors to the viewport. Tap to open a compact
// chat card with suggestion chips + a mic; works without browser voice too.
export default function HunnyFab({ onSendMessage, remainingPct = 50 }) {
  const [bubble, setBubble] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
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
    setOpen(true);
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
      setError("Voice isn't available here — tap a suggestion instead.");
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
        setError(
          isStandalone
            ? "Go to iOS Settings → Honey Budget → enable Microphone."
            : "Microphone access denied. Allow it in your browser settings."
        );
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

  function handleMicTap() {
    if (busy) return;
    hapticLight();
    if (recording) stopRecording();
    else startRecording();
  }

  function toggleOpen() {
    hapticLight();
    if (recording) stopRecording();
    setOpen((o) => !o);
  }

  const bubbleBg = error ? "var(--hb-bad-soft-bg)" : "var(--hb-surface-strong)";
  const bubbleBorder = error ? "1px solid var(--hb-bad-line)" : "1px solid var(--hb-border)";
  const bubbleTextColor = error ? "var(--hb-bad-text)" : "var(--hb-text)";

  return (
    <div
      className="fixed right-3 z-30 flex flex-col items-end sm:right-5"
      style={{ bottom: "calc(5.9rem + env(safe-area-inset-bottom))" }}
    >
      {open && (
        <div
          className="mb-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl px-4 py-3 shadow-xl"
          style={{ background: bubbleBg, border: bubbleBorder, color: bubbleTextColor }}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--hb-accent-text)" }}>
              Hunny
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-0.5 rounded-lg p-1 transition hover:opacity-70"
              style={{ color: "var(--hb-text-muted)" }}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-sm leading-relaxed">
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--hb-accent)", animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--hb-accent)", animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--hb-accent)", animationDelay: "300ms" }} />
              </span>
            ) : recording ? (
              <span className="flex items-center gap-2 font-medium" style={{ color: "var(--hb-accent-text)" }}>
                <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--hb-accent)" }} />
                Listening… tap the mic again to send
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
                        style={{ background: "var(--hb-good-soft-bg)", color: "var(--hb-good-text)", border: "1px solid var(--hb-good-line)" }}
                      >
                        ✓ {ACTION_LABELS[a.tool] ?? a.tool}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span>Hi! I'm Hunny 🍯 Ask me anything about your money.</span>
            )}
          </div>

          {!busy && !recording && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {CAT_HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => sendText(h)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
                  style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)", border: "1px solid var(--hb-accent-line)" }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleMicTap}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60"
            style={{ background: recording ? "var(--hb-bad)" : "var(--hb-accent)", color: "var(--hb-accent-contrast)" }}
          >
            <Mic className="h-4 w-4" />
            {recording ? "Tap to send" : "Tap to talk"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Talk to Hunny"
        className="relative flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 hover:scale-105"
        style={{
          background: "var(--hb-surface-strong)",
          border: "1px solid var(--hb-border)",
          boxShadow: "0 10px 30px -8px var(--hb-accent-glow)",
          WebkitTouchCallout: "none",
          animation: open ? "none" : "hb-hunny-float 3.6s ease-in-out infinite",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {recording && (
          <span className="absolute inset-0 -m-1 animate-ping rounded-full pointer-events-none" style={{ background: "var(--hb-accent-ring)" }} />
        )}
        <MoneyCat remainingPct={remainingPct} size={54} />
      </button>

      {!open && (
        <span className="mt-1 text-[10px] font-medium" style={{ color: "var(--hb-text-muted)" }}>
          Tap to chat
        </span>
      )}
    </div>
  );
}
