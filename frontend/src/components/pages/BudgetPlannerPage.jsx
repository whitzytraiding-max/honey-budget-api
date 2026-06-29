/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, CheckCircle, ChevronDown, ChevronUp, CloudUpload, Map,
  Trash2, Sparkles, Target, Plus, Wallet, PencilLine, ArrowRight,
} from "lucide-react";
import { ActionButton } from "../ui.jsx";
import { parseBudgetSpreadsheet } from "../../lib/budgetParser.js";

const STEPS = {
  IDLE: "idle",
  BUILD: "build",
  UPLOADING: "uploading",
  ANALYSING: "analysing",
  QUESTIONS: "questions",
  REVIEW: "review",
  SAVING: "saving",
  ROADMAP: "roadmap",
};

// Common expense categories offered as quick-add chips in the manual builder
const COMMON_CATEGORIES = [
  "Housing", "Food & Dining", "Transport", "Utilities",
  "Entertainment", "Health", "Subscriptions", "Debt",
];

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
        <span className="font-medium" style={{ color: done ? "var(--hb-good)" : "var(--hb-accent)" }}>
          {done ? "Done! Loading your plan…" : UPLOAD_STAGES[stageIdx]?.label}
        </span>
        <span style={{ color: "var(--hb-ink-soft)" }}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--hb-track)" }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: done ? "var(--hb-good)" : "var(--hb-accent)" }} />
      </div>
      {!done && <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>Parsed locally — no upload needed.</p>}
    </div>
  );
}

// ── Timeline journey roadmap ──────────────────────────────────────────────────
const CHECKIN_OPTIONS = [
  { value: "on-track", emoji: "✅", label: "On Track", color: "var(--hb-good-text)", bg: "var(--hb-good-soft-bg)" },
  { value: "behind",   emoji: "⚠️",  label: "Behind",   color: "var(--hb-bad)", bg: "var(--hb-bad-soft-bg)"  },
  { value: "ahead",    emoji: "🔥",  label: "Ahead",    color: "var(--hb-accent)", bg: "var(--hb-accent-soft-bg)" },
];

// ── Per-month edit panel (inside an expanded roadmap card) ────────────────────
function MonthEditPanel({ monthPlan, currency, saving, onCancel, onSave }) {
  const idRef = useRef(0);
  const [income, setIncome] = useState(monthPlan.income != null ? String(monthPlan.income) : "");
  const [rows, setRows] = useState(() =>
    (monthPlan.categories?.length ? monthPlan.categories : [{ name: "", amount: "" }])
      .map((c) => ({ id: idRef.current++, name: c.name ?? "", amount: c.amount != null ? String(c.amount) : "" })),
  );

  function addRow(presetName = "") { setRows((rs) => [...rs, { id: idRef.current++, name: presetName, amount: "" }]); }
  function updateRow(id, field, value) { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r))); }
  function removeRow(id) { setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs)); }

  const incomeNum = Number(income) || 0;
  const totalExpenses = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const leftOver = incomeNum - totalExpenses;
  const usedCategories = new Set(rows.map((r) => r.name.trim()).filter(Boolean));

  function handleSave() {
    const cats = rows
      .map((r) => ({ name: (r.name || "").trim() || "Other", amount: Number(r.amount) || 0 }))
      .filter((c) => c.amount > 0);
    const merged = {};
    for (const c of cats) merged[c.name] = (merged[c.name] ?? 0) + c.amount;
    const mergedCats = Object.entries(merged).map(([n, a]) => ({ name: n, amount: a }));
    const te = mergedCats.reduce((s, c) => s + c.amount, 0);
    onSave({
      ...monthPlan,
      income: incomeNum,
      categories: mergedCats,
      totalExpenses: te,
      plannedSavings: Math.max(0, incomeNum - te),
    });
  }

  return (
    <div className="pt-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hb-ink-soft)" }}>
        Editing {monthLabel(monthPlan.month)}
      </p>

      <div className="rounded-[1rem] px-3 py-2.5" style={{ background: "var(--hb-good-soft-bg)", border: "1px solid var(--hb-border)" }}>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>Income</p>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={income}
          onChange={(e) => setIncome(e.target.value)} placeholder="0.00"
          className="w-full bg-transparent text-base font-bold outline-none tabular-nums" style={{ color: "var(--hb-text)" }} />
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input list="hb-budget-categories-edit" value={r.name} onChange={(e) => updateRow(r.id, "name", e.target.value)} placeholder="Expense name"
              className="flex-1 min-w-0 rounded-[0.8rem] px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-text)" }} />
            <input type="number" inputMode="decimal" min="0" step="0.01" value={r.amount} onChange={(e) => updateRow(r.id, "amount", e.target.value)} placeholder="0.00"
              className="w-24 shrink-0 rounded-[0.8rem] px-3 py-2 text-sm font-semibold outline-none tabular-nums text-right"
              style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-text)" }} />
            <button type="button" onClick={() => removeRow(r.id)} className="shrink-0 p-2 rounded-lg transition opacity-40 hover:opacity-90"
              style={{ color: "var(--hb-ink-soft)" }} disabled={rows.length <= 1} title="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <datalist id="hb-budget-categories-edit">
        {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => addRow()}
          className="inline-flex items-center gap-1.5 rounded-[0.8rem] px-3 py-1.5 text-xs font-semibold transition"
          style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)" }}>
          <Plus className="h-3.5 w-3.5" /> Add expense
        </button>
        {COMMON_CATEGORIES.filter((c) => !usedCategories.has(c)).map((c) => (
          <button key={c} type="button" onClick={() => addRow(c)}
            className="rounded-full px-2.5 py-1 text-xs font-medium transition opacity-80 hover:opacity-100"
            style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-ink-soft)" }}>
            + {c}
          </button>
        ))}
      </div>

      <div className="rounded-[1rem] px-3 py-2.5 flex justify-between items-center"
        style={{ background: leftOver >= 0 ? "var(--hb-good-soft-bg)" : "var(--hb-bad-soft-bg)" }}>
        <span className="text-xs font-semibold">Left over</span>
        <span className="text-base font-bold tabular-nums"
          style={{ color: leftOver >= 0 ? "var(--hb-good-text)" : "var(--hb-bad-text)" }}>{fmt(leftOver, currency)}</span>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex-1 rounded-[1rem] py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          style={{ background: "var(--hb-accent)" }}>
          {saving ? "Saving…" : "Save month"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-[1rem] px-4 py-2.5 text-sm font-medium transition"
          style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-ink-soft)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TimelineRoadmap({ roadmap, plan, currency, goalAmount, currentSavings, goalPct, displayCurrency, onDelete, activePlanId, onImportNew, onImportGoal, importGoalBusy, importGoalDone, onUpdatePlan }) {
  const cur = currentYYYYMM();
  const totalPlanned = roadmap.reduce((s, m) => s + (m.planned?.savings ?? 0), 0);

  // Auto-open current month
  const [expanded, setExpanded] = useState(() => cur);
  const [editingMonth, setEditingMonth] = useState(null);
  const [savingMonth, setSavingMonth] = useState(false);

  // Persist an edited month back into the plan, recompute start/end + goal default
  async function saveMonth(monthKey, updatedMonth) {
    const months = (plan.months ?? []).map((pm) => (pm.month === monthKey ? updatedMonth : pm));
    const updatedPlan = {
      ...plan,
      startMonth: months[0]?.month ?? plan.startMonth,
      endMonth: months[months.length - 1]?.month ?? plan.endMonth,
      months,
    };
    setSavingMonth(true);
    try {
      await onUpdatePlan(updatedPlan);
    } finally {
      setSavingMonth(false);
      setEditingMonth(null);
    }
  }

  // Per-month manual check-ins stored in localStorage
  const checkinKey = `hb_checkins_${activePlanId}`;
  const [checkIns, setCheckIns] = useState(() => {
    try { return JSON.parse(localStorage.getItem(checkinKey) ?? "{}"); } catch { return {}; }
  });
  function setCheckIn(month, value) {
    const updated = { ...checkIns, [month]: value };
    setCheckIns(updated);
    localStorage.setItem(checkinKey, JSON.stringify(updated));
  }

  function nodeState(m) {
    if (m.month === cur) return "current";
    if (m.month < cur) return "completed";
    return "upcoming";
  }

  function badge(m) {
    if (!m.actual) return null;
    const savRatio = m.planned.savings > 0 ? m.actual.savings / m.planned.savings : 0;
    const expRatio = m.planned.totalExpenses > 0 ? m.actual.totalExpenses / m.planned.totalExpenses : 1;
    if (savRatio > 1.05) return { emoji: "🔥", label: "Ahead", color: "var(--hb-accent)", bg: "var(--hb-accent-soft-bg)" };
    if (expRatio > 1.05) return { emoji: "⚠", label: "Overspending", color: "var(--hb-bad)", bg: "var(--hb-bad-soft-bg)" };
    return { emoji: "✅", label: "On Track", color: "var(--hb-good-text)", bg: "var(--hb-good-soft-bg)" };
  }

  return (
    <div className="space-y-4">
      {/* ── GOAL HEADER ── */}
      <section className="hb-surface-card rounded-[1.5rem] p-5 sm:rounded-[1.75rem] overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 90% -10%, var(--hb-accent-soft-bg), transparent 55%)" }} />

        <div className="relative flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "var(--hb-accent-soft-bg)" }}>
              <Map className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
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
                  <Target className="h-3 w-3" style={{ color: "var(--hb-accent-text)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--hb-ink-soft)" }}>
                    {plan.goalDescription || "Savings goal"}
                  </span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{fmt(goalAmount, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold tracking-tight" style={{ color: "var(--hb-accent-text)" }}>{goalPct}%</p>
                <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>{fmt(currentSavings, currency)} saved</p>
              </div>
            </div>
            <div className="hb-progress-track h-3 rounded-full overflow-hidden">
              <div className="hb-progress-fill h-full rounded-full transition-all duration-1000"
                style={{ width: `${goalPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-ink-soft)" }}>
                {roadmap.length} months
              </span>
              {totalPlanned > 0 && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "var(--hb-good-soft-bg)", color: "var(--hb-ink-soft)" }}>
                  {fmt(totalPlanned / (roadmap.length || 1), currency)}/mo target
                </span>
              )}
            </div>

            {/* Import to Savings Goals */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--hb-border)" }}>
              {importGoalDone ? (
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--hb-good-text)" }}>
                  <CheckCircle className="h-4 w-4" />
                  Added to Savings Goals
                </div>
              ) : (
                <button
                  type="button"
                  disabled={importGoalBusy}
                  onClick={onImportGoal}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: "var(--hb-accent-soft-bg)",
                    color: "var(--hb-accent-text)",
                    opacity: importGoalBusy ? 0.6 : 1,
                  }}
                >
                  {importGoalBusy ? "Adding…" : "＋ Import as Savings Goal"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <span className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-ink-soft)" }}>
              {roadmap.length} months
            </span>
            {totalPlanned > 0 && (
              <span className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "var(--hb-good-soft-bg)", color: "var(--hb-ink-soft)" }}>
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
            const planMonth = (plan.months ?? []).find((pm) => pm.month === m.month) ?? null;
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
                        ? "var(--hb-good)"
                        : isCurrent
                          ? "var(--hb-accent)"
                          : "var(--hb-track)",
                      boxShadow: isCurrent
                        ? "0 0 0 4px var(--hb-accent-soft-bg), 0 0 16px var(--hb-accent-soft-bg)"
                        : isCompleted
                          ? "0 0 6px var(--hb-good-soft-bg)"
                          : "none",
                      border: isUpcoming ? "2px solid var(--hb-track)" : "none",
                      flexShrink: 0,
                    }}>
                    {isCompleted && <Check className="text-white" style={{ width: 8, height: 8 }} />}
                    {isCurrent && (
                      <>
                        <div className="absolute inset-0 rounded-full animate-ping"
                          style={{ background: "var(--hb-accent-soft-bg)", animationDuration: "2s" }} />
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
                        ? "var(--hb-good)"
                        : isCurrent
                          ? "var(--hb-accent)"
                          : "var(--hb-track)",
                    }} />
                  )}
                </div>

                {/* ── CARD ── */}
                <div className="flex-1 min-w-0 pb-3">
                  <div className="rounded-[1.2rem] overflow-hidden"
                    style={{
                      background: isCurrent
                        ? "var(--hb-accent-soft-bg)"
                        : isCompleted
                          ? "var(--hb-surface-soft)"
                          : "transparent",
                      border: isCurrent
                        ? "1px solid var(--hb-accent-soft-bg)"
                        : isCompleted
                          ? "1px solid var(--hb-border)"
                          : "1px solid var(--hb-track)",
                      boxShadow: isCurrent
                        ? "0 0 0 1px var(--hb-accent-soft-bg), 0 8px 28px var(--hb-accent-soft-bg)"
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
                            style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)", letterSpacing: "0.05em" }}>
                            NOW
                          </span>
                        )}
                        {b && (
                          <span className="text-xs font-semibold rounded-full px-2 py-0.5"
                            style={{ background: b.bg, color: b.color }}>
                            {b.emoji} {b.label}
                          </span>
                        )}
                        {checkIns[m.month] && (() => {
                          const ci = CHECKIN_OPTIONS.find((o) => o.value === checkIns[m.month]);
                          return ci ? (
                            <span className="text-xs font-semibold rounded-full px-2 py-0.5"
                              style={{ background: ci.bg, color: ci.color }}>
                              {ci.emoji} {ci.label}
                            </span>
                          ) : null;
                        })()}
                      </div>

                      {/* Collapsed right side */}
                      {!isOpen && (
                        <span className="text-sm font-semibold tabular-nums shrink-0"
                          style={{
                            color: actualSav !== null
                              ? (actualSav >= plannedSav ? "var(--hb-good)" : "var(--hb-bad)")
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
                          style={{ background: "var(--hb-track)" }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${savPct}%`,
                              background: savPct >= 100
                                ? "var(--hb-good)"
                                : savPct >= 60
                                  ? "var(--hb-accent)"
                                  : "var(--hb-accent)",
                              transition: "width 0.9s cubic-bezier(0.34,1.56,0.64,1)",
                            }} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>
                            {fmt(actualSav ?? 0, currency)} saved
                          </span>
                          <span className="text-xs font-bold"
                            style={{
                              color: savPct >= 100 ? "var(--hb-good)" : savPct >= 60 ? "var(--hb-accent)" : "var(--hb-accent)",
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
                    {isOpen && editingMonth === m.month && planMonth && (
                      <div className="px-3.5 pb-4" style={{ borderTop: "1px solid var(--hb-border)" }}>
                        <MonthEditPanel
                          monthPlan={planMonth}
                          currency={currency}
                          saving={savingMonth}
                          onCancel={() => setEditingMonth(null)}
                          onSave={(updated) => saveMonth(m.month, updated)}
                        />
                      </div>
                    )}

                    {isOpen && editingMonth !== m.month && (
                      <div className="px-3.5 pb-4" style={{ borderTop: "1px solid var(--hb-border)" }}>
                        {/* 3-stat row */}
                        <div className="grid grid-cols-3 gap-2 pt-3 mb-3">
                          {[
                            {
                              label: "Income",
                              value: fmt(m.planned.income, currency),
                              color: "var(--hb-good-text)",
                            },
                            {
                              label: m.actual ? "Spent" : "Budgeted",
                              value: fmt(
                                m.actual ? m.actual.totalExpenses : m.planned.totalExpenses,
                                currency,
                              ),
                              color: m.actual && m.actual.totalExpenses > m.planned.totalExpenses * 1.05
                                ? "var(--hb-bad)"
                                : "inherit",
                            },
                            {
                              label: "Saved",
                              value: fmt(actualSav !== null ? actualSav : plannedSav, currency),
                              color: actualSav !== null
                                ? (actualSav >= plannedSav ? "var(--hb-good)" : "var(--hb-bad)")
                                : "var(--hb-accent)",
                            },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="rounded-xl p-2.5 text-center"
                              style={{ background: "var(--hb-surface-soft)" }}>
                              <p className="text-xs mb-1" style={{ color: "var(--hb-ink-soft)" }}>{label}</p>
                              <p className="text-sm font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Full expense list (planned, with actual per category when available) */}
                        {m.planned.categories?.length > 0 ? (
                          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--hb-border)" }}>
                            <div className="flex items-center justify-between px-3 py-2"
                              style={{ background: "var(--hb-surface-soft)" }}>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>
                                Expenses
                              </span>
                              {m.actual && (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>
                                  Planned · Actual
                                </span>
                              )}
                            </div>
                            {m.planned.categories
                              .slice()
                              .sort((a, b) => b.amount - a.amount)
                              .map((cat) => {
                                const actualCat = m.actual?.categories?.find((c) => c.name === cat.name);
                                const pct = m.planned.totalExpenses > 0
                                  ? Math.round((cat.amount / m.planned.totalExpenses) * 100)
                                  : 0;
                                const over = actualCat && actualCat.amount > cat.amount * 1.05;
                                return (
                                  <div key={cat.name} className="px-3 py-2"
                                    style={{ borderTop: "1px solid var(--hb-border)" }}>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                      <span style={{ color: "var(--hb-text)" }}>{cat.name}</span>
                                      <span className="tabular-nums font-medium">
                                        {fmt(cat.amount, currency)}
                                        {m.actual && (
                                          <span style={{ color: over ? "var(--hb-bad)" : "var(--hb-ink-soft)" }}>
                                            {" · "}{fmt(actualCat?.amount ?? 0, currency)}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden"
                                      style={{ background: "var(--hb-track)" }}>
                                      <div className="h-full rounded-full"
                                        style={{
                                          width: `${pct}%`,
                                          background: "var(--hb-accent-soft-bg)",
                                          transition: "width 0.6s ease",
                                        }} />
                                    </div>
                                  </div>
                                );
                              })}
                            <div className="flex justify-between px-3 py-2 text-xs font-bold"
                              style={{ borderTop: "1px solid var(--hb-border)", background: "var(--hb-surface-soft)" }}>
                              <span>Total expenses</span>
                              <span className="tabular-nums">{fmt(m.planned.totalExpenses, currency)}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs py-2" style={{ color: "var(--hb-ink-soft)" }}>
                            No expenses listed for this month yet.
                          </p>
                        )}

                        {/* Savings row */}
                        <div className="mt-2 rounded-xl px-3 py-2.5 flex justify-between items-center"
                          style={{ background: "var(--hb-good-soft-bg)" }}>
                          <span className="text-xs font-semibold" style={{ color: "var(--hb-ink-soft)" }}>
                            {actualSav !== null ? "Saved this month" : "Planned savings"}
                          </span>
                          <span className="text-sm font-bold tabular-nums"
                            style={{ color: actualSav !== null
                              ? (actualSav >= plannedSav ? "var(--hb-good-text)" : "var(--hb-bad-text)")
                              : "var(--hb-good-text)" }}>
                            {fmt(actualSav !== null ? actualSav : plannedSav, currency)}
                          </span>
                        </div>

                        {/* Edit this month */}
                        {planMonth && onUpdatePlan && (
                          <button
                            type="button"
                            onClick={() => setEditingMonth(m.month)}
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition"
                            style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)" }}
                          >
                            <PencilLine className="h-4 w-4" /> Edit this month
                          </button>
                        )}

                        {/* Cumulative chip */}
                        {m.cumulativePlannedSavings > 0 && (
                          <div className="mt-3 rounded-xl px-3 py-2 flex justify-between items-center"
                            style={{ background: "var(--hb-accent-soft-bg)" }}>
                            <span className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>Cumulative saved</span>
                            <span className="text-xs font-bold" style={{ color: "var(--hb-accent-text)" }}>
                              {fmt(
                                m.cumulativeActualSavings > 0
                                  ? m.cumulativeActualSavings
                                  : m.cumulativePlannedSavings,
                                currency,
                              )}
                            </span>
                          </div>
                        )}

                        {/* Manual check-in */}
                        <div className="mt-3 rounded-xl px-3 py-3"
                          style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                          <p className="text-xs mb-2 font-semibold uppercase tracking-wider"
                            style={{ color: "var(--hb-ink-soft)" }}>
                            Your check-in
                          </p>
                          <div className="flex gap-2">
                            {CHECKIN_OPTIONS.map((opt) => {
                              const active = checkIns[m.month] === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className="flex-1 rounded-xl py-2 text-xs font-semibold transition"
                                  style={{
                                    background: active ? opt.bg : "var(--hb-surface-soft)",
                                    border: active ? `1px solid ${opt.color}` : "1px solid transparent",
                                    color: active ? opt.color : "var(--hb-ink-soft)",
                                  }}
                                  onClick={() => setCheckIn(m.month, active ? null : opt.value)}
                                >
                                  {opt.emoji} {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
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

// ── Build a parsedPlan from manual builder input ──────────────────────────────
// Mirrors the single-period spreadsheet shape: one monthly template repeated
// across 12 months so it slots straight into the save → roadmap pipeline.
function buildManualPlan({ name, startMonth, currency, income, expenses, goalAmount, goalDescription }) {
  const categories = expenses
    .map((e) => ({ name: (e.name || "").trim() || "Other", amount: Number(e.amount) || 0 }))
    .filter((e) => e.amount > 0);
  // Merge duplicate category names
  const merged = {};
  for (const c of categories) merged[c.name] = (merged[c.name] ?? 0) + c.amount;
  const mergedCats = Object.entries(merged).map(([n, a]) => ({ name: n, amount: a }));

  const totalExpenses = mergedCats.reduce((s, c) => s + c.amount, 0);
  const inc = Number(income) || 0;
  const plannedSavings = Math.max(0, inc - totalExpenses);

  const [y, m] = startMonth.split("-").map(Number);
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, m - 1 + i, 1);
    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      income: inc,
      categories: mergedCats.map((c) => ({ ...c })),
      totalExpenses,
      plannedSavings,
    });
  }

  const goal = Number(goalAmount) > 0
    ? Number(goalAmount)
    : (plannedSavings > 0 ? Math.round(plannedSavings * 12) : null);

  return {
    name: (name || "").trim() || "My Monthly Budget",
    startMonth: months[0].month,
    endMonth: months[months.length - 1].month,
    currency,
    goalAmount: goal,
    goalDescription: goalDescription || (goal ? "Yearly savings goal" : null),
    months,
  };
}

// ── Manual budget builder ─────────────────────────────────────────────────────
function ManualBuilder({ displayCurrency, onCancel, onSave }) {
  const [name, setName] = useState("My Monthly Budget");
  const [startMonth, setStartMonth] = useState(currentYYYYMM());
  const [income, setIncome] = useState("");
  const [rows, setRows] = useState([{ id: 1, name: "", amount: "" }]);
  const [goalAmount, setGoalAmount] = useState("");
  const nextId = useRef(2);

  const currency = displayCurrency || "USD";

  function addRow(presetName = "") {
    setRows((rs) => [...rs, { id: nextId.current++, name: presetName, amount: "" }]);
  }
  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function removeRow(id) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  }

  const incomeNum = Number(income) || 0;
  const totalExpenses = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const leftOver = incomeNum - totalExpenses;
  const usedCategories = new Set(rows.map((r) => r.name.trim()).filter(Boolean));

  function handleSubmit() {
    const plan = buildManualPlan({
      name, startMonth, currency, income: incomeNum,
      expenses: rows, goalAmount,
    });
    onSave(plan);
  }

  const canSave = incomeNum > 0 || totalExpenses > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-2xl p-2.5" style={{ background: "var(--hb-accent-soft-bg)" }}>
            <PencilLine className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
          </span>
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Build your budget</h2>
            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>
              Add your income and monthly expenses — we'll show what's left.
            </p>
          </div>
        </div>
      </section>

      {/* Plan basics */}
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>Plan name</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Monthly Budget"
              className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "var(--hb-text)" }} />
          </div>
          <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>Starting month</p>
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value || currentYYYYMM())}
              className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "var(--hb-text)" }} />
          </div>
        </div>
        <div className="rounded-[1.2rem] px-4 py-3 flex items-center gap-3"
          style={{ background: "var(--hb-good-soft-bg)", border: "1px solid var(--hb-border)" }}>
          <Wallet className="h-5 w-5 shrink-0" style={{ color: "var(--hb-good-text)" }} />
          <div className="flex-1">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>Monthly income</p>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={income}
              onChange={(e) => setIncome(e.target.value)} placeholder="0.00"
              className="w-full bg-transparent text-lg font-bold outline-none tabular-nums" style={{ color: "var(--hb-text)" }} />
          </div>
        </div>
      </section>

      {/* Expenses */}
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Monthly expenses</h3>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--hb-ink-soft)" }}>
            {fmt(totalExpenses, currency)}
          </span>
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <input
                list="hb-budget-categories"
                value={r.name}
                onChange={(e) => updateRow(r.id, "name", e.target.value)}
                placeholder="Expense name"
                className="flex-1 min-w-0 rounded-[1rem] px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-text)" }}
              />
              <input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={r.amount}
                onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                placeholder="0.00"
                className="w-24 shrink-0 rounded-[1rem] px-3 py-2.5 text-sm font-semibold outline-none tabular-nums text-right"
                style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-text)" }}
              />
              <button type="button" onClick={() => removeRow(r.id)}
                className="shrink-0 p-2 rounded-xl transition opacity-40 hover:opacity-90"
                style={{ color: "var(--hb-ink-soft)" }} title="Remove" disabled={rows.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <datalist id="hb-budget-categories">
          {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>

        <button type="button" onClick={() => addRow()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-[1rem] px-3.5 py-2 text-sm font-semibold transition"
          style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)" }}>
          <Plus className="h-4 w-4" /> Add expense
        </button>

        {/* Quick-add category chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMON_CATEGORIES.filter((c) => !usedCategories.has(c)).map((c) => (
            <button key={c} type="button" onClick={() => addRow(c)}
              className="rounded-full px-3 py-1 text-xs font-medium transition opacity-80 hover:opacity-100"
              style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-ink-soft)" }}>
              + {c}
            </button>
          ))}
        </div>
      </section>

      {/* Live summary */}
      <section className="hb-surface-card rounded-[1.5rem] p-5 sm:rounded-[1.75rem] overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 90% -10%, ${leftOver >= 0 ? "var(--hb-good-soft-bg)" : "var(--hb-bad-soft-bg)"}, transparent 60%)` }} />
        <div className="relative space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--hb-ink-soft)" }}>Income</span>
            <span className="font-semibold tabular-nums" style={{ color: "var(--hb-good-text)" }}>{fmt(incomeNum, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--hb-ink-soft)" }}>Expenses</span>
            <span className="font-semibold tabular-nums">− {fmt(totalExpenses, currency)}</span>
          </div>
          <div className="h-px my-1" style={{ background: "var(--hb-border)" }} />
          <div className="flex items-end justify-between">
            <span className="text-sm font-semibold">Left over each month</span>
            <span className="text-2xl font-bold tabular-nums"
              style={{ color: leftOver >= 0 ? "var(--hb-good-text)" : "var(--hb-bad-text)" }}>
              {fmt(leftOver, currency)}
            </span>
          </div>
          {leftOver < 0 && (
            <p className="text-xs pt-1" style={{ color: "var(--hb-bad-text)" }}>
              You're spending more than you earn. Trim an expense or add income.
            </p>
          )}
        </div>
      </section>

      {/* Optional savings goal */}
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-ink-soft)" }}>Savings goal (optional)</p>
          <input type="number" inputMode="decimal" min="0" step="0.01" value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            placeholder={leftOver > 0 ? `e.g. ${fmt(leftOver * 12, currency)} a year` : "Total you want to save"}
            className="w-full bg-transparent text-sm font-semibold outline-none tabular-nums" style={{ color: "var(--hb-text)" }} />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--hb-ink-soft)" }}>
          Leave blank to use your yearly left-over ({fmt(Math.max(0, leftOver) * 12, currency)}) as the target.
        </p>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <ActionButton onClick={handleSubmit} className="flex-1" disabled={!canSave}>
          Save &amp; view roadmap
        </ActionButton>
        <button
          className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
          onClick={onCancel} type="button">
          Cancel
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
  const [importGoalBusy, setImportGoalBusy] = useState(false);
  const [importGoalDone, setImportGoalDone] = useState(false);

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

  async function handleSave(planArg, fallbackStep = STEPS.REVIEW) {
    // planArg is a parsed plan only when it has months (REVIEW passes a click event)
    const planToSave = planArg?.months ? planArg : parsedPlan;
    if (planArg?.months) setParsedPlan(planArg);
    setError(null);
    setStep(STEPS.SAVING);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(`${apiBase}/api/budget-planner/save`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ parsedPlan: planToSave }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed.");
      const rd = await fetch(`${apiBase}/api/budget-planner`, { headers: authHeaders() })
        .then((r) => r.json()).then((j) => j.data ?? j);
      setPlans(rd.plans ?? []);
      setActivePlan(rd.activePlan ?? { parsedPlan: planToSave, roadmap: [] });
      setStep(STEPS.ROADMAP);
    } catch (err) {
      clearTimeout(timeout);
      setError(err.name === "AbortError" ? "Save timed out." : err.message);
      setStep(fallbackStep);
    }
  }

  async function handleDelete(planId) {
    try {
      await fetch(`${apiBase}/api/budget-planner/${planId}`, { method: "DELETE", headers: authHeaders() });
      setActivePlan(null); setPlans([]); setStep(STEPS.IDLE);
    } catch { /* ignore */ }
  }

  async function handleImportGoal() {
    if (!activePlan) return;
    const plan = activePlan.parsedPlan;
    setImportGoalBusy(true);
    try {
      await fetch(`${apiBase}/api/savings/goal`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plan.goalDescription || plan.name,
          targetAmount: plan.goalAmount,
          targetDate: plan.endMonth ? `${plan.endMonth}-28` : null,
          currencyCode: plan.currency || displayCurrency,
        }),
      });
      setImportGoalDone(true);
    } catch { /* silently fail */ }
    setImportGoalBusy(false);
  }

  async function handleUpdatePlan(updatedPlan) {
    if (!activePlan?.id) return;
    try {
      const res = await fetch(`${apiBase}/api/budget-planner/${activePlan.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ parsedPlan: updatedPlan }),
      });
      if (!res.ok) throw new Error("Update failed.");
      const rd = await fetch(`${apiBase}/api/budget-planner`, { headers: authHeaders() })
        .then((r) => r.json()).then((j) => j.data ?? j);
      setPlans(rd.plans ?? []);
      setActivePlan(rd.activePlan ?? { ...activePlan, parsedPlan: updatedPlan });
    } catch {
      // Keep the edit visible locally even if the refresh failed
      setActivePlan((ap) => (ap ? { ...ap, parsedPlan: updatedPlan } : ap));
    }
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
        onImportGoal={handleImportGoal}
        importGoalBusy={importGoalBusy}
        importGoalDone={importGoalDone}
        onUpdatePlan={handleUpdatePlan}
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
                style={{ borderColor: "var(--hb-accent-soft-bg)", borderTopColor: "var(--hb-accent)" }} />
              <Sparkles className="absolute inset-0 m-auto h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
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

  // ── BUILD (manual) ────────────────────────────────────────────────────────
  if (step === STEPS.BUILD) {
    return (
      <ManualBuilder
        displayCurrency={displayCurrency}
        onCancel={() => { setError(null); setStep(STEPS.IDLE); }}
        onSave={(plan) => handleSave(plan, STEPS.BUILD)}
      />
    );
  }

  // ── SAVING ────────────────────────────────────────────────────────────────
  if (step === STEPS.SAVING) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-6 sm:rounded-[1.75rem]">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-12 w-12 animate-spin rounded-full border-4"
              style={{ borderColor: "var(--hb-accent-soft-bg)", borderTopColor: "var(--hb-accent)" }} />
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
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "var(--hb-accent-soft-bg)" }}>
              <Sparkles className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Quick question</h2>
              <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Gemini spotted a few things to clarify.</p>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--hb-accent-soft-bg)", border: "1px solid var(--hb-accent-soft-bg)" }}>
                <span className="font-semibold" style={{ color: "var(--hb-accent-text)" }}>{i + 1}. </span>{q}
              </div>
            ))}
          </div>
          <textarea
            className="w-full rounded-[1rem] px-4 py-3 text-sm focus:outline-none"
            style={{
              background: "var(--hb-surface-soft)",
              border: "1px solid var(--hb-border)",
              color: "inherit",
              minHeight: 120,
            }}
            placeholder="Type your answers here…"
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
          />
          {error && <p className="mt-2 text-sm" style={{ color: "var(--hb-bad-text)" }}>{error}</p>}
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
            <span className="inline-flex rounded-2xl p-2.5" style={{ background: "var(--hb-good-soft-bg)" }}>
              <Check className="h-5 w-5" style={{ color: "var(--hb-good-text)" }} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Review your budget</h2>
              <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Check the details look right before saving.</p>
            </div>
          </div>
          <div className="rounded-[1.2rem] p-4 space-y-2"
            style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
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
                style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                <span className="font-medium text-sm">{monthLabel(m.month)}</span>
                <div className="text-sm flex items-center gap-2">
                  <span style={{ color: "var(--hb-ink-soft)" }}>In: {fmt(m.income, currency)}</span>
                  <span style={{ color: "var(--hb-track)" }}>·</span>
                  <span className="font-semibold" style={{ color: "var(--hb-accent-text)" }}>Save: {fmt(m.plannedSavings, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-sm px-1" style={{ color: "var(--hb-bad-text)" }}>{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={() => handleSave()} className="flex-1">Save &amp; view roadmap</ActionButton>
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
          <span className="inline-flex rounded-2xl p-2.5" style={{ background: "var(--hb-accent-soft-bg)" }}>
            <Map className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
          </span>
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Budget Planner</h2>
            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>Build a budget from scratch or import a spreadsheet — then track your roadmap.</p>
          </div>
        </div>
      </section>

      {/* Build from scratch — primary path */}
      <button
        type="button"
        onClick={() => { setError(null); setStep(STEPS.BUILD); }}
        className="hb-surface-card w-full text-left rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6 transition active:scale-[0.99] relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 95% -10%, var(--hb-accent-soft-bg), transparent 55%)" }} />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex rounded-2xl p-2.5" style={{ background: "var(--hb-accent-soft-bg)" }}>
            <PencilLine className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Build a budget from scratch</h3>
            <p className="text-sm" style={{ color: "var(--hb-ink-soft)" }}>
              Add your income and expenses — see what's left each month.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0" style={{ color: "var(--hb-accent-text)" }} />
        </div>
      </button>

      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1" style={{ background: "var(--hb-border)" }} />
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--hb-ink-soft)" }}>or import</span>
        <div className="h-px flex-1" style={{ background: "var(--hb-border)" }} />
      </div>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <h3 className="mb-3 font-semibold">Upload a spreadsheet</h3>
        <p className="mb-4 text-sm" style={{ color: "var(--hb-ink-soft)" }}>
          Excel or CSV. Parsed instantly in your browser — Gemini AI handles anything unusual.
        </p>
        <div
          className="relative flex flex-col items-center justify-center gap-3 rounded-[1.2rem] border-2 border-dashed px-6 py-10 cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? "var(--hb-accent)" : "var(--hb-border)",
            background: dragOver ? "var(--hb-accent-soft-bg)" : "var(--hb-surface-soft)",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CloudUpload className="h-10 w-10 transition-all"
            style={{ color: dragOver ? "var(--hb-accent)" : "var(--hb-ink-soft)", opacity: dragOver ? 1 : 0.4 }} />
          <div className="text-center">
            <p className="font-medium">Drop your file here or tap to browse</p>
            <p className="mt-1 text-sm" style={{ color: "var(--hb-ink-soft)" }}>Excel (.xlsx, .xls) or CSV · up to 5 MB</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        <UploadProgress active={step === STEPS.UPLOADING} done={uploadDone} />
        {error && <p className="mt-3 text-sm" style={{ color: "var(--hb-bad-text)" }}>{error}</p>}
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
                style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)" }}>
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
