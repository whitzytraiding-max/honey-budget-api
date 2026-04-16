/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle, ChevronDown, ChevronUp, CloudUpload, Map,
  Trash2, TrendingDown, TrendingUp, Clock, Sparkles, Target,
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

// ── Upload progress bar ───────────────────────────────────────────────────────
const UPLOAD_STAGES = [
  { pct: 55, label: "Reading your file…" },
  { pct: 95, label: "Building your plan…" },
];

function UploadProgress({ active, done }) {
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active && !done) { setPct(0); setStageIdx(0); return; }
    if (done) {
      clearInterval(intervalRef.current);
      setPct(100);
      setStageIdx(UPLOAD_STAGES.length - 1);
      return;
    }
    let current = 0;
    let stage = 0;
    const delays = [120, 800];
    function tick() {
      const target = UPLOAD_STAGES[stage]?.pct ?? 90;
      if (current < target) { current = Math.min(current + 1, target); setPct(current); }
      if (current >= target && stage < UPLOAD_STAGES.length - 1) {
        stage++;
        setStageIdx(stage);
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
        <span className={`font-medium ${done ? "text-emerald-500" : "text-sky-500"}`}>
          {done ? "Done! Loading your plan…" : UPLOAD_STAGES[stageIdx]?.label}
        </span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" style={{ background: "rgba(148,163,184,0.2)" }}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${done ? "bg-emerald-500" : "bg-sky-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!done && <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>Parsed locally — no upload needed.</p>}
    </div>
  );
}

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

// ── Main component ────────────────────────────────────────────────────────────
export default function BudgetPlannerPage({ apiBase = "", token = "", displayCurrency = "USD" }) {
  const [step, setStep] = useState(STEPS.IDLE);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileRef = useRef(null);

  // Parse state
  const [parsedPlan, setParsedPlan] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState("");

  // Roadmap
  const [activePlan, setActivePlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [expandedMonth, setExpandedMonth] = useState(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Load existing plan on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${apiBase}/api/budget-planner`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data ?? json;
        setPlans(d.plans ?? []);
        if (d.activePlan) { setActivePlan(d.activePlan); setStep(STEPS.ROADMAP); }
      } catch { /* no existing plan */ }
    }
    load();
  }, [apiBase, authHeaders]);

  // ── File handling ─────────────────────────────────────────────────────────
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
        // Ask Gemini to check the spreadsheet structure
        setStep(STEPS.ANALYSING);
        try {
          const res = await fetch(`${apiBase}/api/budget-planner/analyse`, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ rawHeaders: rh, sampleRows: sr, parsedPlan: plan }),
          });
          const json = await res.json();
          const d = json.data ?? json;
          if (d.questions?.length > 0) {
            setQuestions(d.questions);
            setStep(STEPS.QUESTIONS);
          } else {
            setStep(STEPS.REVIEW);
          }
        } catch {
          setStep(STEPS.REVIEW); // Gemini unavailable — proceed anyway
        }
      } else {
        setUploadDone(true);
        setTimeout(() => { setUploadDone(false); setStep(STEPS.REVIEW); }, 500);
      }
    } catch (err) {
      setUploadDone(false);
      setError(err.message || "Could not read the spreadsheet. Please check the file format.");
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
      const d = json.data ?? json;
      setParsedPlan(d.parsedPlan);
      setStep(STEPS.REVIEW);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.QUESTIONS);
    }
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
      const roadmapRes = await fetch(`${apiBase}/api/budget-planner`, { headers: authHeaders() });
      const roadmapJson = await roadmapRes.json();
      const rd = roadmapJson.data ?? roadmapJson;
      setPlans(rd.plans ?? []);
      setActivePlan(rd.activePlan ?? { parsedPlan, roadmap: [] });
      setStep(STEPS.ROADMAP);
    } catch (err) {
      clearTimeout(timeout);
      setError(err.name === "AbortError" ? "Save timed out. Please try again." : err.message);
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

  // ── ANALYSING STEP ─────────────────────────────────────────────────────────
  if (step === STEPS.ANALYSING) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-6 sm:rounded-[1.75rem]">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
              <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-sky-500" />
            </div>
            <p className="font-semibold" style={{ color: "inherit" }}>Checking with Gemini AI…</p>
            <p className="text-sm text-center max-w-xs" style={{ color: "var(--hb-ink-soft)" }}>
              Reviewing your column names. May ask one or two quick questions.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ── SAVING STEP ────────────────────────────────────────────────────────────
  if (step === STEPS.SAVING) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-6 sm:rounded-[1.75rem]">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
            <p className="font-semibold" style={{ color: "inherit" }}>Saving your plan…</p>
            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Building your roadmap with real transaction data.</p>
          </div>
        </section>
      </div>
    );
  }

  // ── ROADMAP VIEW ──────────────────────────────────────────────────────────
  if (step === STEPS.ROADMAP && activePlan) {
    const plan = activePlan.parsedPlan;
    const roadmap = activePlan.roadmap ?? [];
    const currency = plan.currency || displayCurrency;
    const goalAmount = Number(plan.goalAmount ?? 0);
    const lastActual = [...roadmap].reverse().find((m) => m.actual !== null);
    const currentSavings = lastActual?.cumulativeActualSavings ?? 0;
    const goalPct = goalAmount > 0 ? Math.min(100, Math.round((currentSavings / goalAmount) * 100)) : 0;
    const totalPlannedSavings = roadmap.reduce((s, m) => s + (m.planned?.savings ?? 0), 0);

    return (
      <div className="space-y-4">
        {/* ── HEADER CARD ── */}
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6 overflow-hidden relative">
          {/* subtle background glow */}
          <div className="pointer-events-none absolute inset-0 rounded-[1.75rem]"
            style={{ background: "radial-gradient(circle at 80% 0%, rgba(56,189,248,0.10), transparent 50%)" }} />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(56,189,248,0.15)" }}>
                <Map className="h-5 w-5 text-sky-400" />
              </span>
              <div>
                <h2 className="text-xl font-semibold sm:text-2xl">{plan.name}</h2>
                <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>
                  {monthLabel(plan.startMonth)} → {monthLabel(plan.endMonth)}
                </p>
              </div>
            </div>
            <button
              className="rounded-xl p-2 transition opacity-40 hover:opacity-100 hover:text-rose-500"
              onClick={() => activePlan?.id && handleDelete(activePlan.id)}
              title="Delete plan"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Goal progress */}
          {goalAmount > 0 && (
            <div className="relative mt-5">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-sky-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hb-ink-soft)" }}>
                      {plan.goalDescription || "Savings goal"}
                    </span>
                  </div>
                  <p className="text-2xl font-bold mt-0.5 tracking-tight">{fmt(goalAmount, currency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tracking-tight text-sky-400">{goalPct}%</p>
                  <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>{fmt(currentSavings, currency)} saved</p>
                </div>
              </div>
              <div className="hb-progress-track h-3 overflow-hidden rounded-full">
                <div className="hb-progress-fill h-full rounded-full transition-all duration-700" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>$0</span>
                <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>{fmt(goalAmount, currency)} goal</span>
              </div>
            </div>
          )}

          {/* Summary chips */}
          <div className="relative flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(56,189,248,0.12)", color: "var(--hb-ink-soft)" }}>
              {roadmap.length} months
            </span>
            {totalPlannedSavings > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(34,197,94,0.12)", color: "var(--hb-ink-soft)" }}>
                {fmt(totalPlannedSavings / (roadmap.length || 1), currency)}/mo planned
              </span>
            )}
          </div>
        </section>

        {/* ── MONTHLY ROADMAP ── */}
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <h3 className="mb-4 font-semibold text-base">Monthly roadmap</h3>
          <div className="space-y-2">
            {roadmap.map((m) => {
              const isOpen = expandedMonth === m.month;
              const status = m.status;
              const plannedSav = m.planned?.savings ?? 0;
              const actualSav = m.actual?.savings ?? null;
              const displaySav = actualSav !== null ? actualSav : plannedSav;
              const savPct = plannedSav > 0 && actualSav !== null
                ? Math.min(100, Math.round((actualSav / plannedSav) * 100))
                : null;

              const accentColor = status === "on-track"
                ? "rgba(34,197,94,0.8)"
                : status === "behind"
                  ? "rgba(239,68,68,0.8)"
                  : "rgba(148,163,184,0.4)";

              const StatusIcon = status === "on-track" ? TrendingUp : status === "behind" ? TrendingDown : Clock;
              const statusLabel = status === "on-track" ? "On track" : status === "behind" ? "Behind" : "Upcoming";
              const statusTextColor = status === "on-track" ? "#22c55e" : status === "behind" ? "#ef4444" : undefined;

              return (
                <div key={m.month} className="overflow-hidden rounded-[1.2rem]"
                  style={{ border: "1px solid var(--hb-border)", background: "rgba(255,255,255,0.03)" }}>

                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition"
                    onClick={() => setExpandedMonth(isOpen ? null : m.month)}
                    type="button"
                  >
                    {/* Status dot / accent */}
                    <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: accentColor }} />

                    {/* Month + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{monthLabel(m.month)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: status === "on-track"
                              ? "rgba(34,197,94,0.12)"
                              : status === "behind"
                                ? "rgba(239,68,68,0.12)"
                                : "rgba(148,163,184,0.10)",
                            color: statusTextColor ?? "var(--hb-ink-soft)",
                          }}>
                          <StatusIcon className="h-3 w-3" />
                          {statusLabel}
                        </span>
                      </div>

                      {/* Mini progress bar — only for past/current months */}
                      {savPct !== null && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.2)" }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${savPct}%`,
                                background: savPct >= 100 ? "#22c55e" : savPct >= 60 ? "#f59e0b" : "#ef4444",
                              }} />
                          </div>
                          <span className="text-xs shrink-0" style={{ color: "var(--hb-ink-soft)" }}>{savPct}%</span>
                        </div>
                      )}
                    </div>

                    {/* Savings amount */}
                    <div className="shrink-0 text-right">
                      <span className="font-semibold tabular-nums"
                        style={{ color: status === "on-track" ? "#22c55e" : status === "behind" ? "#ef4444" : undefined }}>
                        {fmt(displaySav, currency)}
                      </span>
                      <span className="ml-1 text-xs" style={{ color: "var(--hb-ink-soft)" }}>
                        {actualSav !== null ? "saved" : "planned"}
                      </span>
                    </div>

                    {isOpen
                      ? <ChevronUp className="shrink-0 h-4 w-4" style={{ color: "var(--hb-ink-soft)" }} />
                      : <ChevronDown className="shrink-0 h-4 w-4" style={{ color: "var(--hb-ink-soft)" }} />}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0" style={{ borderTop: "1px solid var(--hb-border)" }}>
                      <div className="grid grid-cols-2 gap-4 pt-3 text-sm">
                        {/* Planned column */}
                        <div>
                          <p className="hb-kicker mb-2">Planned</p>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span style={{ color: "var(--hb-ink-soft)" }}>Income</span>
                              <span className="font-semibold">{fmt(m.planned.income, currency)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: "var(--hb-ink-soft)" }}>Expenses</span>
                              <span className="font-semibold">{fmt(m.planned.totalExpenses, currency)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: "var(--hb-ink-soft)" }}>Savings</span>
                              <span className="font-semibold text-sky-400">{fmt(m.planned.savings, currency)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actual column */}
                        {m.actual ? (
                          <div>
                            <p className="hb-kicker mb-2">Actual</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span style={{ color: "var(--hb-ink-soft)" }}>Expenses</span>
                                <span className="font-semibold">{fmt(m.actual.totalExpenses, currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span style={{ color: "var(--hb-ink-soft)" }}>Savings</span>
                                <span className="font-semibold"
                                  style={{ color: m.actual.savings >= m.planned.savings ? "#22c55e" : "#ef4444" }}>
                                  {fmt(m.actual.savings, currency)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="hb-kicker mb-2">Actual</p>
                            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Not yet</p>
                          </div>
                        )}
                      </div>

                      {/* Category breakdown with bars */}
                      {m.planned.categories?.length > 0 && (
                        <div className="mt-4">
                          <p className="hb-kicker mb-2">Breakdown</p>
                          <div className="space-y-2">
                            {m.planned.categories
                              .sort((a, b) => b.amount - a.amount)
                              .map((cat) => {
                                const barPct = m.planned.totalExpenses > 0
                                  ? Math.round((cat.amount / m.planned.totalExpenses) * 100)
                                  : 0;
                                return (
                                  <div key={cat.name}>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span style={{ color: "var(--hb-ink-soft)" }}>{cat.name}</span>
                                      <span className="font-medium tabular-nums">{fmt(cat.amount, currency)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.15)" }}>
                                      <div className="h-full rounded-full"
                                        style={{ width: `${barPct}%`, background: "rgba(56,189,248,0.6)" }} />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Cumulative progress */}
                      {goalAmount > 0 && m.cumulativePlannedSavings > 0 && (
                        <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(56,189,248,0.07)" }}>
                          <div className="flex justify-between text-xs" style={{ color: "var(--hb-ink-soft)" }}>
                            <span>Cumulative planned</span>
                            <span className="font-semibold">{fmt(m.cumulativePlannedSavings, currency)}</span>
                          </div>
                          {m.cumulativeActualSavings > 0 && (
                            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--hb-ink-soft)" }}>
                              <span>Cumulative actual</span>
                              <span className="font-semibold text-sky-400">{fmt(m.cumulativeActualSavings, currency)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-center pb-4">
          <button
            className="text-sm transition opacity-50 hover:opacity-100"
            onClick={() => { setStep(STEPS.IDLE); setActivePlan(null); }}
            type="button"
          >
            Import a new budget
          </button>
        </div>
      </div>
    );
  }

  // ── QUESTIONS STEP ────────────────────────────────────────────────────────
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
              <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>
                Gemini spotted a few things it needs to clarify.
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.15)" }}>
                <span className="font-semibold" style={{ color: "#a855f7" }}>{i + 1}. </span>{q}
              </div>
            ))}
          </div>

          <textarea
            className="w-full rounded-[1rem] px-4 py-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2"
            style={{
              background: "rgba(0,0,0,0.08)",
              border: "1px solid var(--hb-border)",
              color: "inherit",
              focusRingColor: "rgba(168,85,247,0.3)",
            }}
            rows={5}
            placeholder="Type your answers here…  e.g. 1. Yes, column B is my take-home pay. 2. Yes, group the book entries as Travel."
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
          />
          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={handleAnswers} className="flex-1">Continue</ActionButton>
          <button
            className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
            onClick={() => setStep(STEPS.REVIEW)}
            type="button"
          >
            Skip — looks fine
          </button>
        </div>
      </div>
    );
  }

  // ── REVIEW STEP ───────────────────────────────────────────────────────────
  if (step === STEPS.REVIEW && parsedPlan) {
    const currency = parsedPlan.currency || displayCurrency;

    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(34,197,94,0.12)" }}>
              <CheckCircle className="h-5 w-5" style={{ color: "#22c55e" }} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Review your budget</h2>
              <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Check the details look right before saving.</p>
            </div>
          </div>

          <div className="rounded-[1.2rem] p-4 space-y-2" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid var(--hb-border)" }}>
            {[
              ["Name", parsedPlan.name],
              ["Period", `${monthLabel(parsedPlan.startMonth)} → ${monthLabel(parsedPlan.endMonth)}`],
              ["Currency", currency],
              parsedPlan.goalAmount ? ["Savings goal", fmt(parsedPlan.goalAmount, currency)] : null,
              parsedPlan.goalDescription ? ["Goal", parsedPlan.goalDescription] : null,
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
                <span className="font-medium">{monthLabel(m.month)}</span>
                <div className="text-sm flex items-center gap-2">
                  <span style={{ color: "var(--hb-ink-soft)" }}>In: {fmt(m.income, currency)}</span>
                  <span style={{ color: "var(--hb-border)" }}>·</span>
                  <span className="font-semibold text-sky-400">Save: {fmt(m.plannedSavings, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-rose-400 px-1">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={handleSave} className="flex-1">Save &amp; view roadmap</ActionButton>
          <button
            className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
            onClick={() => setStep(STEPS.IDLE)}
            type="button"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  // ── IDLE / UPLOAD STEP ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex rounded-2xl p-2.5" style={{ background: "rgba(56,189,248,0.12)" }}>
            <Map className="h-5 w-5 text-sky-400" />
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
          Upload an Excel (.xlsx) or CSV file. Parsed instantly in your browser — no upload needed.
        </p>

        <div
          className={`relative flex flex-col items-center justify-center gap-3 rounded-[1.2rem] border-2 border-dashed px-6 py-10 transition cursor-pointer ${
            dragOver ? "border-sky-400" : "border-[var(--hb-border)]"
          }`}
          style={{ background: dragOver ? "rgba(56,189,248,0.06)" : "rgba(0,0,0,0.03)" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CloudUpload className="h-10 w-10" style={{ color: dragOver ? "#38bdf8" : "var(--hb-ink-soft)", opacity: dragOver ? 1 : 0.5 }} />
          <div className="text-center">
            <p className="font-medium">Drop your file here or tap to browse</p>
            <p className="mt-1 text-sm" style={{ color: "var(--hb-ink-soft)" }}>Excel (.xlsx, .xls) or CSV — up to 5 MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>

        <UploadProgress active={step === STEPS.UPLOADING} done={uploadDone} />
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </section>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <h3 className="mb-3 font-semibold">How it works</h3>
        <div className="space-y-3">
          {[
            { n: "1", title: "Upload your spreadsheet", body: "Any format — monthly columns, annual totals, however you track it." },
            { n: "2", title: "Instant local parsing", body: "Reads and organises income, expenses, and savings goals directly in your browser. Gemini AI handles anything unusual." },
            { n: "3", title: "Confirm and save", body: "Review the parsed plan before it's saved. Make sure the numbers look right." },
            { n: "4", title: "Track your roadmap", body: "Each month shows planned vs actual. See instantly if you're on track toward your goal." },
          ].map((item) => (
            <div key={item.n} className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-sky-400"
                style={{ background: "rgba(56,189,248,0.12)" }}>
                {item.n}
              </span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
