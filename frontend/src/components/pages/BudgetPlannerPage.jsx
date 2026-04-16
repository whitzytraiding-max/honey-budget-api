/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, ChevronDown, ChevronUp, CloudUpload, Map,
  Trash2, Sparkles, Target,
} from "lucide-react";
import { ActionButton } from "../ui.jsx";
import { parseBudgetSpreadsheet } from "../../lib/budgetParser.js";

const STEPS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  ANALYSING: "analysing",
  QUESTIONS: "questions",
  REVIEW: "review",
  SAVING: "saving",
  ROADMAP: "roadmap",
};

const UPLOAD_STAGES = [
  { pct: 55, label: "Reading your file…" },
  { pct: 95, label: "Building your plan…" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));
}

function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function currentYYYYMM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Upload progress ───────────────────────────────────────────────────────────
function UploadProgress({ active, done }) {
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active && !done) { setPct(0); setStageIdx(0); return; }
    if (done) { clearInterval(intervalRef.current); setPct(100); return; }
    let current = 0, stage = 0;
    const delays = [120, 800];
    function tick() {
      const target = UPLOAD_STAGES[stage]?.pct ?? 90;
      if (current < target) { current = Math.min(current + 1, target); setPct(current); }
      if (current >= target && stage < UPLOAD_STAGES.length - 1) {
        stage++; setStageIdx(stage);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(tick, delays[stage] ?? 800);
      }
    }
    intervalRef.current = setInterval(tick, delays[0]);
    return () => clearInterval(intervalRef.current);
  }, [active, done]);

  if (!active && !done) return null;
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: done ? "#22c55e" : "#38bdf8" }}>
          {done ? "Done! Loading your plan…" : UPLOAD_STAGES[stageIdx]?.label}
        </span>
        <span style={{ color: "var(--hb-ink-soft)" }}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(148,163,184,0.2)" }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: done ? "#22c55e" : "#38bdf8" }} />
      </div>
      {!done && <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>Parsed locally — no upload needed.</p>}
    </div>
  );
}

// ── Timeline journey roadmap ──────────────────────────────────────────────────
function TimelineRoadmap({ roadmap, plan, currency, goalAmount, currentSavings, goalPct, displayCurrency, onDelete, activePlanId, onImportNew }) {
  const cur = currentYYYYMM();
  const totalPlanned = roadmap.reduce((s, m) => s + (m.planned?.savings ?? 0), 0);

  // Auto-open current month
  const [expanded, setExpanded] = useState(() => cur);

  function nodeState(m) {
    if (m.month === cur) return "current";
    if (m.month < cur) return "completed";
    return "upcoming";
  }

  function badge(m) {
    if (!m.actual) return null;
    const savRatio = m.planned.savings > 0 ? m.actual.savings / m.planned.savings : 0;
    const expRatio = m.planned.totalExpenses > 0 ? m.actual.totalExpenses / m.planned.totalExpenses : 1;
    if (savRatio > 1.05) return { emoji: "🔥", label: "Ahead", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    if (expRatio > 1.05) return { emoji: "⚠", label: "Overspending", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
    return { emoji: "✅", label: "On Track", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  }

  return (
    <div className="space-y-4">
      {/* ── GOAL HEADER ── */}
      <section className="hb-surface-card rounded-[1.5rem] p-5 sm:rounded-[1.75rem] overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 90% -10%, rgba(56,189,248,0.12), transparent 55%)" }} />

        <div className="relative flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(56,189,248,0.12)" }}>
              <Map className="h-5 w-5" style={{ color: "#38bdf8" }} />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-tight">{plan.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--hb-ink-soft)" }}>
                {monthLabel(plan.startMonth)} → {monthLabel(plan.endMonth)}
              </p>
            </div>
          </div>
          <button className="p-2 rounded-xl transition opacity-30 hover:opacity-80"
            onClick={() => activePlanId && onDelete(activePlanId)} title="Delete plan" type="button">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {goalAmount > 0 ? (
          <div className="relative">
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3 w-3" style={{ color: "#38bdf8" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--hb-ink-soft)" }}>
                    {plan.goalDescription || "Savings goal"}
                  </span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{fmt(goalAmount, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold tracking-tight" style={{ color: "#38bdf8" }}>{goalPct}%</p>
                <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>{fmt(currentSavings, currency)} saved</p>
              </div>
            </div>
            <div className="hb-progress-track h-3 rounded-full overflow-hidden">
              <div className="hb-progress-fill h-full rounded-full transition-all duration-1000"
                style={{ width: `${goalPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(56,189,248,0.1)", color: "var(--hb-ink-soft)" }}>
                {roadmap.length} months
              </span>
              {totalPlanned > 0 && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "rgba(34,197,94,0.1)", color: "var(--hb-ink-soft)" }}>
                  {fmt(totalPlanned / (roadmap.length || 1), currency)}/mo target
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <span className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(56,189,248,0.1)", color: "var(--hb-ink-soft)" }}>
              {roadmap.length} months
            </span>
            {totalPlanned > 0 && (
              <span className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(34,197,94,0.1)", color: "var(--hb-ink-soft)" }}>
                {fmt(totalPlanned / (roadmap.length || 1), currency)}/mo planned
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── TIMELINE ── */}
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-5">
        <p className="font-semibold mb-5 text-sm uppercase tracking-widest"
          style={{ color: "var(--hb-ink-soft)" }}>
          Journey
        </p>

        <div>
          {roadmap.map((m, idx) => {
            const state = nodeState(m);
            const isCurrent = state === "current";
            const isCompleted = state === "completed";
            const isUpcoming = state === "upcoming";
            const isLast = idx === roadmap.length - 1;
            const isOpen = expanded === m.month;

            const b = badge(m);
            const plannedSav = m.planned?.savings ?? 0;
            const actualSav = m.actual?.savings ?? null;
            const savPct = plannedSav > 0 && actualSav !== null
              ? Math.min(100, Math.round((actualSav / plannedSav) * 100))
              : null;

            return (
              <div key={m.month} className="flex gap-3">
                {/* ── NODE + LINE ── */}
                <div className="flex flex-col items-center" style={{ width: 20 }}>
                  {/* Node */}
                  <div className="relative shrink-0 rounded-full flex items-center justify-center"
                    style={{
                      marginTop: 14,
                      width: isCurrent ? 20 : 14,
                      height: isCurrent ? 20 : 14,
                      background: isCompleted
                        ? "#22c55e"
                        : isCurrent
                          ? "#38bdf8"
                          : "rgba(148,163,184,0.2)",
                      boxShadow: isCurrent
                        ? "0 0 0 4px rgba(56,189,248,0.18), 0 0 16px rgba(56,189,248,0.35)"
                        : isCompleted
                          ? "0 0 6px rgba(34,197,94,0.3)"
                          : "none",
                      border: isUpcoming ? "2px solid rgba(148,163,184,0.25)" : "none",
                      flexShrink: 0,
                    }}>
                    {isCompleted && <Check className="text-white" style={{ width: 8, height: 8 }} />}
                    {isCurrent && (
                      <>
                        <div className="absolute inset-0 rounded-full animate-ping"
                          style={{ background: "rgba(56,189,248,0.25)", animationDuration: "2s" }} />
                        <div className="w-2 h-2 rounded-full bg-white" style={{ opacity: 0.9 }} />
                      </>
                    )}
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex-1 rounded-full" style={{
                      width: 2,
                      marginTop: 4,
                      minHeight: 24,
                      background: isCompleted
                        ? "linear-gradient(180deg, #22c55e 0%, rgba(56,189,248,0.3) 100%)"
                        : isCurrent
                          ? "linear-gradient(180deg, #38bdf8 0%, rgba(148,163,184,0.15) 100%)"
                          : "rgba(148,163,184,0.12)",
                    }} />
                  )}
                </div>

                {/* ── CARD ── */}
                <div className="flex-1 min-w-0 pb-3">
                  <div className="rounded-[1.2rem] overflow-hidden"
                    style={{
                      background: isCurrent
                        ? "rgba(56,189,248,0.05)"
                        : isCompleted
                          ? "rgba(255,255,255,0.02)"
                          : "transparent",
                      border: isCurrent
                        ? "1px solid rgba(56,189,248,0.22)"
                        : isCompleted
                          ? "1px solid var(--hb-border)"
                          : "1px solid rgba(148,163,184,0.10)",
                      boxShadow: isCurrent
                        ? "0 0 0 1px rgba(56,189,248,0.08), 0 8px 28px rgba(56,189,248,0.07)"
                        : "none",
                    }}>

                    {/* Header row */}
                    <button
                      className="w-full flex items-center gap-2 px-3.5 text-left"
                      style={{ paddingTop: 12, paddingBottom: isOpen || isUpcoming ? 8 : 12 }}
                      onClick={() => {
                        if (isUpcoming && !isOpen) setExpanded(m.month);
                        else setExpanded(isOpen ? null : m.month);
                      }}
                      type="button"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${isCurrent ? "text-base" : "text-sm"}`}>
                          {monthLabel(m.month)}
                        </span>
                        {isCurrent && (
                          <span className="text-xs font-bold rounded-full px-2 py-0.5"
                            style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", letterSpacing: "0.05em" }}>
                            NOW
                          </span>
                        )}
                        {b && (
                          <span className="text-xs font-semibold rounded-full px-2 py-0.5"
                            style={{ background: b.bg, color: b.color }}>
                            {b.emoji} {b.label}
                          </span>
                        )}
                      </div>

                      {/* Collapsed right side */}
                      {!isOpen && (
                        <span className="text-sm font-semibold tabular-nums shrink-0"
                          style={{
                            color: actualSav !== null
                              ? (actualSav >= plannedSav ? "#22c55e" : "#ef4444")
                              : "var(--hb-ink-soft)",
                          }}>
                          {fmt(actualSav !== null ? actualSav : plannedSav, currency)}
                        </span>
                      )}
                      <span className="shrink-0" style={{ color: "var(--hb-ink-soft)" }}>
                        {isOpen
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {/* ── PROGRESS BAR (past + current) ── */}
                    {savPct !== null && (
                      <div className="px-3.5 pb-3">
                        <div className="h-2 rounded-full overflow-hidden mb-1"
                          style={{ background: "rgba(148,163,184,0.12)" }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${savPct}%`,
                              background: savPct >= 100
                                ? "linear-gradient(90deg,#22c55e,#4ade80)"
                                : savPct >= 60
                                  ? "linear-gradient(90deg,#f59e0b,#fcd34d)"
                                  : "linear-gradient(90deg,#38bdf8,#818cf8)",
                              transition: "width 0.9s cubic-bezier(0.34,1.56,0.64,1)",
                            }} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>
                            {fmt(actualSav ?? 0, currency)} saved
                          </span>
                          <span className="text-xs font-bold"
                            style={{
                              color: savPct >= 100 ? "#22c55e" : savPct >= 60 ? "#f59e0b" : "#38bdf8",
                            }}>
                            {savPct}% of target
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ── UPCOMING collapsed label ── */}
                    {isUpcoming && !isOpen && (
                      <div className="px-3.5 pb-3">
                        <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>
                          {fmt(plannedSav, currency)} planned
                        </span>
                      </div>
                    )}

                    {/* ── EXPANDED DETAIL ── */}
                    {isOpen && (
                      <div className="px-3.5 pb-4" style={{ borderTop: "1px solid var(--hb-border)" }}>
                        {/* 3-stat row */}
                        <div className="grid grid-cols-3 gap-2 pt-3 mb-3">
                          {[
                            {
                              label: "Income",
                              value: fmt(m.planned.income, currency),
                              color: "#22c55e",
                            },
                            {
                              label: "Spent",
                              value: fmt(
                                m.actual ? m.actual.totalExpenses : m.planned.totalExpenses,
                                currency,
                              ),
                              color: m.actual && m.actual.totalExpenses > m.planned.totalExpenses * 1.05
                                ? "#ef4444"
                                : "inherit",
                            },
                            {
                              label: "Saved",
                              value: fmt(actualSav !== null ? actualSav : plannedSav, currency),
                              color: actualSav !== null
                                ? (actualSav >= plannedSav ? "#22c55e" : "#ef4444")
                                : "#38bdf8",
                            },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="rounded-xl p-2.5 text-center"
                              style={{ background: "rgba(0,0,0,0.08)" }}>
                              <p className="text-xs mb-1" style={{ color: "var(--hb-ink-soft)" }}>{label}</p>
                              <p className="text-sm font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Category bars */}
                        {m.planned.categories?.length > 0 && (
                          <div className="space-y-2 mt-1">
                            {m.planned.categories
                              .slice()
                              .sort((a, b) => b.amount - a.amount)
                              .slice(0, 5)
                              .map((cat) => {
                                const pct = m.planned.totalExpenses > 0
                                  ? Math.round((cat.amount / m.planned.totalExpenses) * 100)
                                  : 0;
                                return (
                                  <div key={cat.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span style={{ color: "var(--hb-ink-soft)" }}>{cat.name}</span>
                                      <span className="font-medium tabular-nums">{fmt(cat.amount, currency)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden"
                                      style={{ background: "rgba(148,163,184,0.1)" }}>
                                      <div className="h-full rounded-full"
                                        style={{
                                          width: `${pct}%`,
                                          background: "rgba(56,189,248,0.45)",
                                          transition: "width 0.6s ease",
                                        }} />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}

                        {/* Cumulative chip */}
                        {m.cumulativePlannedSavings > 0 && (
                          <div className="mt-3 rounded-xl px-3 py-2 flex justify-between items-center"
                            style={{ background: "rgba(56,189,248,0.06)" }}>
                            <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>Cumulative saved</span>
                            <span className="text-xs font-bold" style={{ color: "#38bdf8" }}>
                              {fmt(
                                m.cumulativeActualSavings > 0
                                  ? m.cumulativeActualSavings
                                  : m.cumulativePlannedSavings,
                                currency,
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-center pb-4">
        <button
          className="text-sm transition opacity-40 hover:opacity-100"
          onClick={onImportNew}
          type="button"
        >
          Import a new budget
        </button>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export default function BudgetPlannerPage({ apiBase = "", token = "", displayCurrency = "USD" }) {
  const [step, setStep] = useState(STEPS.IDLE);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileRef = useRef(null);

  const [parsedPlan, setParsedPlan] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState("");

  const [activePlan, setActivePlan] = useState(null);
  const [plans, setPlans] = useState([]);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${apiBase}/api/budget-planner`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data ?? json;
        setPlans(d.plans ?? []);
        if (d.activePlan) { setActivePlan(d.activePlan); setStep(STEPS.ROADMAP); }
      } catch { /* no plan */ }
    }
    load();
  }, [apiBase, authHeaders]);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploadDone(false);
    setAnswers("");
    setStep(STEPS.UPLOADING);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { parsedPlan: plan, confidence, rawHeaders: rh, sampleRows: sr } =
        parseBudgetSpreadsheet(arrayBuffer, file.type, file.name);
      setParsedPlan(plan);
      setRawHeaders(rh);
      setSampleRows(sr);

      if (confidence === "low") {
        setStep(STEPS.ANALYSING);
        try {
          const res = await fetch(`${apiBase}/api/budget-planner/analyse`, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ rawHeaders: rh, sampleRows: sr, parsedPlan: plan }),
          });
          const json = await res.json();
          const d = json.data ?? json;
          if (d.questions?.length > 0) { setQuestions(d.questions); setStep(STEPS.QUESTIONS); }
          else setStep(STEPS.REVIEW);
        } catch { setStep(STEPS.REVIEW); }
      } else {
        setUploadDone(true);
        setTimeout(() => { setUploadDone(false); setStep(STEPS.REVIEW); }, 500);
      }
    } catch (err) {
      setUploadDone(false);
      setError(err.message || "Could not read the spreadsheet.");
      setStep(STEPS.IDLE);
    }
  }

  async function handleAnswers() {
    if (!answers.trim()) { setStep(STEPS.REVIEW); return; }
    setError(null);
    setStep(STEPS.ANALYSING);
    try {
      const res = await fetch(`${apiBase}/api/budget-planner/refine`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ rawHeaders, sampleRows, parsedPlan, answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Refinement failed.");
      setParsedPlan((json.data ?? json).parsedPlan);
      setStep(STEPS.REVIEW);
    } catch (err) { setError(err.message); setStep(STEPS.QUESTIONS); }
  }

  async function handleSave() {
    setError(null);
    setStep(STEPS.SAVING);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(`${apiBase}/api/budget-planner/save`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ parsedPlan }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed.");
      const rd = await fetch(`${apiBase}/api/budget-planner`, { headers: authHeaders() })
        .then((r) => r.json()).then((j) => j.data ?? j);
      setPlans(rd.plans ?? []);
      setActivePlan(rd.activePlan ?? { parsedPlan, roadmap: [] });
      setStep(STEPS.ROADMAP);
    } catch (err) {
      clearTimeout(timeout);
      setError(err.name === "AbortError" ? "Save timed out." : err.message);
      setStep(STEPS.REVIEW);
    }
  }

  async function handleDelete(planId) {
    try {
      await fetch(`${apiBase}/api/budget-planner/${planId}`, { method: "DELETE", headers: authHeaders() });
      setActivePlan(null); setPlans([]); setStep(STEPS.IDLE);
    } catch { /* ignore */ }
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── ROADMAP ───────────────────────────────────────────────────────────────
  if (step === STEPS.ROADMAP && activePlan) {
    const plan = activePlan.parsedPlan;
    const roadmap = activePlan.roadmap ?? [];
    const currency = plan.currency || displayCurrency;
    const goalAmount = Number(plan.goalAmount ?? 0);
    const lastActual = [...roadmap].reverse().find((m) => m.actual !== null);
    const currentSavings = lastActual?.cumulativeActualSavings ?? 0;
    const goalPct = goalAmount > 0 ? Math.min(100, Math.round((currentSavings / goalAmount) * 100)) : 0;

    return (
      <TimelineRoadmap
        roadmap={roadmap}
        plan={plan}
        currency={currency}
        goalAmount={goalAmount}
        currentSavings={currentSavings}
        goalPct={goalPct}
        displayCurrency={displayCurrency}
        activePlanId={activePlan.id}
        onDelete={handleDelete}
        onImportNew={() => { setActivePlan(null); setStep(STEPS.IDLE); }}
      />
    );
  }

  // ── ANALYSING ─────────────────────────────────────────────────────────────
  if (step === STEPS.ANALYSING) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-6 sm:rounded-[1.75rem]">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-sky-400"
                style={{ borderColor: "rgba(56,189,248,0.2)", borderTopColor: "#38bdf8" }} />
              <Sparkles className="absolute inset-0 m-auto h-5 w-5" style={{ color: "#38bdf8" }} />
            </div>
            <p className="font-semibold">Checking with Gemini AI…</p>
            <p className="text-sm text-center max-w-xs" style={{ color: "var(--hb-ink-soft)" }}>
              Reviewing your column names. May ask a quick question or two.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ── SAVING ────────────────────────────────────────────────────────────────
  if (step === STEPS.SAVING) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-6 sm:rounded-[1.75rem]">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-12 w-12 animate-spin rounded-full border-4"
              style={{ borderColor: "rgba(56,189,248,0.2)", borderTopColor: "#38bdf8" }} />
            <p className="font-semibold">Saving your plan…</p>
            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Building your roadmap.</p>
          </div>
        </section>
      </div>
    );
  }

  // ── QUESTIONS ─────────────────────────────────────────────────────────────
  if (step === STEPS.QUESTIONS) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(168,85,247,0.12)" }}>
              <Sparkles className="h-5 w-5" style={{ color: "#a855f7" }} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Quick question</h2>
              <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Gemini spotted a few things to clarify.</p>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.15)" }}>
                <span className="font-semibold" style={{ color: "#a855f7" }}>{i + 1}. </span>{q}
              </div>
            ))}
          </div>
          <textarea
            className="w-full rounded-[1rem] px-4 py-3 text-sm focus:outline-none"
            style={{
              background: "rgba(0,0,0,0.08)",
              border: "1px solid var(--hb-border)",
              color: "inherit",
              minHeight: 120,
            }}
            placeholder="Type your answers here…"
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
          />
          {error && <p className="mt-2 text-sm" style={{ color: "#f87171" }}>{error}</p>}
        </section>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={handleAnswers} className="flex-1">Continue</ActionButton>
          <button
            className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
            onClick={() => setStep(STEPS.REVIEW)} type="button">
            Skip — looks fine
          </button>
        </div>
      </div>
    );
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────
  if (step === STEPS.REVIEW && parsedPlan) {
    const currency = parsedPlan.currency || displayCurrency;
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(34,197,94,0.12)" }}>
              <Check className="h-5 w-5" style={{ color: "#22c55e" }} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Review your budget</h2>
              <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Check the details look right before saving.</p>
            </div>
          </div>
          <div className="rounded-[1.2rem] p-4 space-y-2"
            style={{ background: "rgba(0,0,0,0.06)", border: "1px solid var(--hb-border)" }}>
            {[
              ["Name", parsedPlan.name],
              ["Period", `${monthLabel(parsedPlan.startMonth)} → ${monthLabel(parsedPlan.endMonth)}`],
              ["Currency", currency],
              parsedPlan.goalAmount ? ["Savings goal", fmt(parsedPlan.goalAmount, currency)] : null,
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: "var(--hb-ink-soft)" }}>{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <h3 className="mb-3 font-semibold">{parsedPlan.months?.length} months</h3>
          <div className="space-y-2">
            {(parsedPlan.months ?? []).map((m) => (
              <div key={m.month} className="flex items-center justify-between rounded-[1rem] px-4 py-3"
                style={{ background: "rgba(0,0,0,0.04)", border: "1px solid var(--hb-border)" }}>
                <span className="font-medium text-sm">{monthLabel(m.month)}</span>
                <div className="text-sm flex items-center gap-2">
                  <span style={{ color: "var(--hb-ink-soft)" }}>In: {fmt(m.income, currency)}</span>
                  <span style={{ color: "rgba(148,163,184,0.4)" }}>·</span>
                  <span className="font-semibold" style={{ color: "#38bdf8" }}>Save: {fmt(m.plannedSavings, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-sm px-1" style={{ color: "#f87171" }}>{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={handleSave} className="flex-1">Save &amp; view roadmap</ActionButton>
          <button
            className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
            onClick={() => setStep(STEPS.IDLE)} type="button">
            Start over
          </button>
        </div>
      </div>
    );
  }

  // ── IDLE / UPLOAD ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(56,189,248,0.12)" }}>
            <Map className="h-5 w-5" style={{ color: "#38bdf8" }} />
          </span>
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Budget Planner</h2>
            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Import a spreadsheet and get a personalised roadmap.</p>
          </div>
        </div>
      </section>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <h3 className="mb-3 font-semibold">Upload your budget</h3>
        <p className="mb-4 text-sm" style={{ color: "var(--hb-ink-soft)" }}>
          Excel or CSV. Parsed instantly in your browser — Gemini AI handles anything unusual.
        </p>
        <div
          className="relative flex flex-col items-center justify-center gap-3 rounded-[1.2rem] border-2 border-dashed px-6 py-10 cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? "#38bdf8" : "var(--hb-border)",
            background: dragOver ? "rgba(56,189,248,0.06)" : "rgba(0,0,0,0.03)",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CloudUpload className="h-10 w-10 transition-all"
            style={{ color: dragOver ? "#38bdf8" : "var(--hb-ink-soft)", opacity: dragOver ? 1 : 0.4 }} />
          <div className="text-center">
            <p className="font-medium">Drop your file here or tap to browse</p>
            <p className="mt-1 text-sm" style={{ color: "var(--hb-ink-soft)" }}>Excel (.xlsx, .xls) or CSV · up to 5 MB</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        <UploadProgress active={step === STEPS.UPLOADING} done={uploadDone} />
        {error && <p className="mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>}
      </section>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <h3 className="mb-3 font-semibold">How it works</h3>
        <div className="space-y-3">
          {[
            { n: "1", title: "Upload your spreadsheet", body: "Any format — monthly columns, annual totals, however you track it." },
            { n: "2", title: "Instant local parsing", body: "Reads your file directly in the browser. Gemini AI handles unusual column names." },
            { n: "3", title: "Confirm and save", body: "Review before saving. Make sure the numbers look right." },
            { n: "4", title: "Track your journey", body: "See planned vs actual each month. Know instantly if you're on track." },
          ].map((item) => (
            <div key={item.n} className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
                {item.n}
              </span>
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
