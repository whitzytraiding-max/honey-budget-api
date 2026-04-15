/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, CloudUpload, Map, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { ActionButton } from "../ui.jsx";

const STEPS = { IDLE: "idle", UPLOADING: "uploading", QUESTIONS: "questions", REVIEW: "review", SAVING: "saving", ROADMAP: "roadmap" };

const UPLOAD_STAGES = [
  { pct: 25, label: "Waking up the server…" },
  { pct: 60, label: "Uploading your file…" },
  { pct: 85, label: "Reading spreadsheet…" },
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
    // Advance quickly at first (waking server), then slow down
    const delays = [300, 600, 1200, 2500];

    function tick() {
      const target = UPLOAD_STAGES[stage]?.pct ?? 90;
      if (current < target) {
        current = Math.min(current + 1, target);
        setPct(current);
      }
      if (current >= target && stage < UPLOAD_STAGES.length - 1) {
        stage++;
        setStageIdx(stage);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(tick, delays[stage] ?? 2500);
      }
    }

    intervalRef.current = setInterval(tick, delays[0]);
    return () => clearInterval(intervalRef.current);
  }, [active, done]);

  if (!active && !done) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${done ? "text-emerald-600" : "text-sky-600"}`}>
          {done ? "Done! Loading your plan…" : UPLOAD_STAGES[stageIdx]?.label}
        </span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${done ? "from-emerald-400 to-emerald-500" : "from-sky-400 to-sky-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!done && <p className="text-xs text-slate-400">This can take up to 60s on first load while the server wakes up.</p>}
    </div>
  );
}

function fmt(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount ?? 0));
}

function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

export default function BudgetPlannerPage({ apiBase = "", token = "", displayCurrency = "USD" }) {
  const [step, setStep] = useState(STEPS.IDLE);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileRef = useRef(null);

  // Parse step state
  const [parsedPlan, setParsedPlan] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [extractedText, setExtractedText] = useState("");
  const [answers, setAnswers] = useState("");

  // Roadmap
  const [activePlan, setActivePlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [expandedMonth, setExpandedMonth] = useState(null);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Load existing plan on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${apiBase}/api/budget-planner`, { headers: headers() });
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data ?? json;
        setPlans(d.plans ?? []);
        if (d.activePlan) {
          setActivePlan(d.activePlan);
          setStep(STEPS.ROADMAP);
        }
      } catch { /* no existing plan */ }
    }
    load();
  }, [apiBase, headers]);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploadDone(false);
    setStep(STEPS.UPLOADING);

    // Step 1: poll /health until we get a real 200 response (not a 502 from Render proxy)
    const wakeDeadline = Date.now() + 120_000;
    let serverReady = false;
    while (Date.now() < wakeDeadline) {
      try {
        const wakeCtrl = new AbortController();
        const wt = setTimeout(() => wakeCtrl.abort(), 8_000);
        const hr = await fetch(`${apiBase}/health`, { signal: wakeCtrl.signal });
        clearTimeout(wt);
        if (hr.ok) { serverReady = true; break; }
      } catch { /* not ready yet */ }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    if (!serverReady) {
      setError("Server is taking too long to wake up. Please try again in a moment.");
      setStep(STEPS.IDLE);
      return;
    }

    // Step 2: read file as base64, then send as JSON (avoids multipart/multer issues)
    let base64data;
    try {
      base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch {
      setError("Could not read the file. Please try again.");
      setStep(STEPS.IDLE);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${apiBase}/api/budget-planner/parse`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64data, mimeType: file.type, filename: file.name }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error("Server returned an unexpected response. Please try again.");
      }
      if (!res.ok) throw new Error(json.error?.message || json.message || "Upload failed.");

      const d = json.data ?? json;
      setParsedPlan(d.parsedPlan);
      // Show 100% complete briefly before switching step
      setUploadDone(true);
      setTimeout(() => {
        setUploadDone(false);
        setStep(STEPS.REVIEW);
      }, 700);
    } catch (err) {
      clearTimeout(timeout);
      setUploadDone(false);
      setError(err.name === "AbortError" ? "Server took too long to respond. Please try again." : err.message);
      setStep(STEPS.IDLE);
    }
  }

  async function handleAnswers() {
    if (!answers.trim()) {
      setStep(STEPS.REVIEW);
      return;
    }
    setError(null);
    setStep(STEPS.UPLOADING);
    try {
      const res = await fetch(`${apiBase}/api/budget-planner/refine`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText, parsedPlan, answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || "Refinement failed.");
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
    const saveCtrl = new AbortController();
    const saveTimeout = setTimeout(() => saveCtrl.abort(), 60_000);
    try {
      const res = await fetch(`${apiBase}/api/budget-planner/save`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ parsedPlan }),
        signal: saveCtrl.signal,
      });
      clearTimeout(saveTimeout);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || "Save failed.");

      // Reload roadmap
      const roadmapRes = await fetch(`${apiBase}/api/budget-planner`, { headers: headers() });
      const roadmapJson = await roadmapRes.json();
      const rd = roadmapJson.data ?? roadmapJson;
      const loadedPlan = rd.activePlan ?? null;
      setPlans(rd.plans ?? []);
      setActivePlan(loadedPlan);
      if (loadedPlan) {
        setStep(STEPS.ROADMAP);
      } else {
        // Plan saved but roadmap couldn't load — show the parsed plan as a local roadmap
        setActivePlan({ parsedPlan, roadmap: [] });
        setStep(STEPS.ROADMAP);
      }
    } catch (err) {
      clearTimeout(saveTimeout);
      setError(err.name === "AbortError" ? "Save timed out. Please try again." : err.message);
      setStep(STEPS.REVIEW);
    }
  }

  async function handleDelete(planId) {
    try {
      await fetch(`${apiBase}/api/budget-planner/${planId}`, { method: "DELETE", headers: headers() });
      setActivePlan(null);
      setPlans([]);
      setStep(STEPS.IDLE);
    } catch { /* ignore */ }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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

    return (
      <div className="space-y-4">
        {/* Header */}
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full bg-sky-100 p-2.5 text-sky-600">
                <Map className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold sm:text-2xl">{plan.name}</h2>
                <p className="text-sm text-slate-500">{monthLabel(plan.startMonth)} → {monthLabel(plan.endMonth)}</p>
              </div>
            </div>
            <button
              className="rounded-xl p-2 text-slate-400 transition hover:text-rose-500"
              onClick={() => activePlan?.id && handleDelete(activePlan.id)}
              title="Delete plan"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {goalAmount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {plan.goalDescription || "Savings goal"}: <span className="text-sky-600">{fmt(goalAmount, currency)}</span>
                </span>
                <span className="font-semibold text-slate-900">{goalPct}%</span>
              </div>
              <div className="hb-progress-track mt-2 h-3 overflow-hidden rounded-full shadow-inner">
                <div
                  className="hb-progress-fill h-full rounded-full bg-gradient-to-r transition-all duration-700"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {fmt(currentSavings, currency)} saved so far
              </p>
            </div>
          )}
        </section>

        {/* Month-by-month roadmap */}
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Monthly roadmap</h3>
          <div className="space-y-2">
            {roadmap.map((m) => {
              const isOpen = expandedMonth === m.month;
              const status = m.status;
              const statusColor = status === "on-track" ? "text-emerald-600" : status === "behind" ? "text-rose-500" : "text-slate-400";
              const StatusIcon = status === "on-track" ? TrendingUp : status === "behind" ? TrendingDown : Minus;

              return (
                <div key={m.month} className="hb-panel-soft rounded-[1.2rem] border border-sky-100 overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => setExpandedMonth(isOpen ? null : m.month)}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                      <span className="font-medium text-slate-900">{monthLabel(m.month)}</span>
                      {status !== "upcoming" && (
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {status === "on-track" ? "On track" : "Behind"}
                        </span>
                      )}
                      {status === "upcoming" && (
                        <span className="text-xs text-slate-400">Upcoming</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">
                        {m.actual ? fmt(m.actual.savings, currency) : fmt(m.planned.savings, currency)}
                        <span className="ml-1 text-xs text-slate-400">saved</span>
                      </span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-sky-100 px-4 pb-4 pt-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Planned</p>
                          <p className="text-slate-700">Income: <span className="font-medium">{fmt(m.planned.income, currency)}</span></p>
                          <p className="text-slate-700">Expenses: <span className="font-medium">{fmt(m.planned.totalExpenses, currency)}</span></p>
                          <p className="text-slate-700">Savings: <span className="font-medium text-sky-600">{fmt(m.planned.savings, currency)}</span></p>
                        </div>
                        {m.actual && (
                          <div>
                            <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Actual</p>
                            <p className="text-slate-700">Expenses: <span className="font-medium">{fmt(m.actual.totalExpenses, currency)}</span></p>
                            <p className="text-slate-700">Savings: <span className={`font-medium ${m.actual.savings >= m.planned.savings ? "text-emerald-600" : "text-rose-500"}`}>{fmt(m.actual.savings, currency)}</span></p>
                          </div>
                        )}
                      </div>

                      {m.planned.categories?.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Planned breakdown</p>
                          <div className="space-y-1">
                            {m.planned.categories.map((cat) => (
                              <div key={cat.name} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">{cat.name}</span>
                                <span className="font-medium text-slate-800">{fmt(cat.amount, currency)}</span>
                              </div>
                            ))}
                          </div>
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
            className="text-sm text-slate-400 transition hover:text-sky-600"
            onClick={() => { setStep(STEPS.IDLE); setActivePlan(null); }}
            type="button"
          >
            Import a new budget
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
            <span className="inline-flex rounded-full bg-emerald-100 p-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Review your budget</h2>
              <p className="text-sm text-slate-500">Check the details look right before saving.</p>
            </div>
          </div>

          <div className="hb-panel-soft rounded-[1.2rem] border border-sky-100 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Name</span>
              <span className="font-medium text-slate-900">{parsedPlan.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Period</span>
              <span className="font-medium text-slate-900">{monthLabel(parsedPlan.startMonth)} → {monthLabel(parsedPlan.endMonth)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Currency</span>
              <span className="font-medium text-slate-900">{currency}</span>
            </div>
            {parsedPlan.goalAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Savings goal</span>
                <span className="font-medium text-sky-600">{fmt(parsedPlan.goalAmount, currency)}</span>
              </div>
            )}
            {parsedPlan.goalDescription && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Goal</span>
                <span className="font-medium text-slate-900">{parsedPlan.goalDescription}</span>
              </div>
            )}
          </div>
        </section>

        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <h3 className="mb-3 font-semibold text-slate-900">Monthly plan ({parsedPlan.months?.length} months)</h3>
          <div className="space-y-2">
            {(parsedPlan.months ?? []).map((m) => (
              <div key={m.month} className="hb-panel-soft rounded-[1.2rem] border border-sky-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{monthLabel(m.month)}</span>
                  <div className="text-right text-sm">
                    <span className="text-slate-600">In: {fmt(m.income, currency)}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-sky-600 font-medium">Save: {fmt(m.plannedSavings, currency)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-rose-500 px-1">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={handleSave} busy={step === STEPS.SAVING} className="flex-1">
            Save &amp; view roadmap
          </ActionButton>
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

  // ── SAVING STEP ───────────────────────────────────────────────────────────
  if (step === STEPS.SAVING) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-6 sm:rounded-[1.75rem]">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
            <p className="font-medium text-slate-700">Saving your plan…</p>
            <p className="text-sm text-slate-400">Building your roadmap with real transaction data.</p>
          </div>
        </section>
      </div>
    );
  }

  // ── QUESTIONS STEP ────────────────────────────────────────────────────────
  if (step === STEPS.QUESTIONS) {
    return (
      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <h2 className="text-xl font-semibold mb-1">A few quick questions</h2>
          <p className="text-sm text-slate-500 mb-4">The AI spotted a few things it needs to clarify before building your roadmap.</p>

          <div className="hb-panel-soft rounded-[1.2rem] border border-sky-100 p-4 mb-4 space-y-2">
            {questions.map((q, i) => (
              <p key={i} className="text-sm text-slate-700">
                <span className="font-medium text-sky-600">{i + 1}.</span> {q}
              </p>
            ))}
          </div>

          <textarea
            className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            rows={5}
            placeholder="Type your answers here... (e.g. 1. Yes, that's USD. 2. The goal is to save for a car.)"
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
          />
          {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton onClick={handleAnswers} className="flex-1">
            Continue
          </ActionButton>
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

  // ── IDLE / UPLOAD STEP ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex rounded-full bg-sky-100 p-2.5 text-sky-600">
            <Map className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Budget Planner</h2>
            <p className="text-sm text-slate-500">Import a spreadsheet and get a personalised roadmap.</p>
          </div>
        </div>
      </section>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <h3 className="mb-3 font-semibold text-slate-900">Upload your budget</h3>
        <p className="mb-4 text-sm text-slate-500">
          Upload an Excel (.xlsx) or CSV file. We'll read it, organise your income and expenses, and build your roadmap automatically.
        </p>

        <div
          className={`relative flex flex-col items-center justify-center gap-3 rounded-[1.2rem] border-2 border-dashed px-6 py-10 transition cursor-pointer ${
            dragOver ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CloudUpload className={`h-10 w-10 transition ${dragOver ? "text-sky-500" : "text-slate-300"}`} />
          <div className="text-center">
            <p className="font-medium text-slate-700">Drop your file here or tap to browse</p>
            <p className="mt-1 text-sm text-slate-400">Excel (.xlsx, .xls) or CSV — up to 5 MB</p>
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

        {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
      </section>

      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <h3 className="mb-3 font-semibold text-slate-900">How it works</h3>
        <div className="space-y-3">
          {[
            { n: "1", title: "Upload your spreadsheet", body: "Any format — monthly columns, annual totals, however you track it." },
            { n: "2", title: "Reads and organises it", body: "Extracts income, expense categories, and your savings goal automatically. Works with monthly columns, annual totals, or simple two-column layouts." },
            { n: "3", title: "Confirm and save", body: "Review the parsed plan before it's saved. Make sure the numbers look right." },
            { n: "4", title: "Track your roadmap", body: "Each month shows planned vs actual. You'll see instantly if you're on track toward your goal." },
          ].map((item) => (
            <div key={item.n} className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-600">{item.n}</span>
              <div>
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-sm text-slate-500">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
