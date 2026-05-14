import { useState } from "react";
import { ArrowDownLeft, CalendarDays, Check, ChevronDown, Pencil, PiggyBank, Plus, Target, Trash2, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";

function GoalProgress({ goal }) {
  const pct = goal.progressPct ?? 0;
  const barColor = pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-sky-400" : "bg-indigo-400";
  return (
    <div className="mt-3">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
        <span>{currency(goal.totalSaved)} saved</span>
        <span className="font-semibold" style={{ color: pct >= 100 ? "#10b981" : pct >= 60 ? "#0ea5e9" : "#6366f1" }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

const WITHDRAW_EMPTY = { amount: "", note: "", savingsGoalId: "" };

export default function SavingsPage({
  activeTab = "goals",
  savingsData,
  savingsForm,
  savingsTargetForm,
  savingsGoalForm,
  editingSavingsGoalId,
  editingSavingsEntryId,
  onSavingsChange,
  onSavingsGoalChange,
  onSavingsSubmit,
  onSavingsGoalSubmit,
  onEditSavingsGoal,
  onDeleteSavingsGoal,
  onCancelSavingsGoalEdit,
  onEditSavingsEntry,
  onDeleteSavingsEntry,
  onCancelSavingsEntryEdit,
  onSavingsWithdraw,
  savingsBusy,
  savingsTargetBusy,
}) {
  const { t, locale } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const entries = savingsData?.entries ?? [];
  const goals = savingsData?.goals ?? [];
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState(WITHDRAW_EMPTY);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  const goalOptions = [
    { label: "No specific goal", value: "" },
    ...goals.map((g) => ({ label: g.title, value: String(g.id) })),
  ];

  function handleGoalSubmit(e) { onSavingsGoalSubmit(e); setShowGoalForm(false); }
  function handleEditGoal(goal) { onEditSavingsGoal(goal); setShowGoalForm(true); }
  function handleCancelGoal() { onCancelSavingsGoalEdit(); setShowGoalForm(false); }

  async function handleWithdrawSubmit(e) {
    e.preventDefault();
    const amount = Number.parseFloat(withdrawForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setWithdrawBusy(true);
    try {
      await onSavingsWithdraw({ amount, note: withdrawForm.note, savingsGoalId: withdrawForm.savingsGoalId || null });
      setWithdrawForm(WITHDRAW_EMPTY);
      setShowWithdrawForm(false);
    } finally {
      setWithdrawBusy(false);
    }
  }

  // "history" tab
  if (activeTab === "history") {
    return (
      <section className="hb-surface-card rounded-[2rem] p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Savings History</h2>
        <div className="space-y-2">
          {entries.length ? (
            entries.map((entry) => {
              const isWithdrawal = Number(entry.amount ?? entry.displayAmount) < 0;
              const isEditing = editingSavingsEntryId === entry.id;
              const label = entry.note && entry.note !== "Savings entry" && entry.note !== "Transfer to current"
                ? entry.note
                : isWithdrawal ? "Transfer to current" : (entry.savingsGoalTitle ?? "Savings entry");
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-[1.2rem] px-4 py-3 transition ${isEditing ? "bg-sky-50 ring-2 ring-sky-200" : "bg-slate-50"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
                      {isWithdrawal && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <ArrowDownLeft className="h-3 w-3" /> Withdrawal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {entry.date}
                      {entry.userName ? ` · ${entry.userName}` : ""}
                      {entry.savingsGoalTitle ? ` · ${entry.savingsGoalTitle}` : ""}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <p className={`text-sm font-bold ${isWithdrawal ? "text-amber-600" : "text-emerald-600"}`}>
                      {isWithdrawal ? "-" : "+"}{currency(Math.abs(Number(entry.displayAmount ?? entry.amount)))}
                    </p>
                    {!isWithdrawal && (
                      <button type="button" onClick={() => onEditSavingsEntry(entry)} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 transition">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    <button type="button" onClick={() => onDeleteSavingsEntry(entry)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No savings logged yet.</p>
          )}
        </div>
      </section>
    );
  }

  // "log" tab
  if (activeTab === "log") {
    return (
      <div className="flex flex-col gap-3">
        {editingSavingsEntryId && (
          <div
            className="flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-sm"
            style={{ background: "rgba(50, 30, 8, 0.85)", border: "1px solid rgba(212, 135, 10, 0.35)", color: "#fde68a" }}
          >
            <p>Editing savings entry</p>
            <button className="inline-flex items-center gap-1 font-semibold" onClick={onCancelSavingsEntryEdit} type="button">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        )}

        <form onSubmit={onSavingsSubmit} className="flex flex-col gap-3">
          {/* Amount */}
          <div className="rounded-[1.2rem] px-5 py-4" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Amount</p>
            <input
              name="amount" type="number" min="0" step="0.01"
              value={savingsForm.amount} onChange={onSavingsChange} placeholder="0.00"
              className="w-full bg-transparent text-2xl font-bold outline-none"
              style={{ color: "#f0e0c0" }}
            />
          </div>

          {/* Date */}
          <label className="flex items-center gap-2.5 rounded-[1.2rem] px-4 py-3 cursor-pointer" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#D4870A" }} />
            <span className="flex-1 text-sm font-medium" style={{ color: savingsForm.date ? "#f0e0c0" : "rgba(240,210,160,0.35)" }}>
              {savingsForm.date ? new Date(savingsForm.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Select date"}
            </span>
            <ChevronDown className="h-4 w-4" style={{ color: "rgba(212, 135, 10, 0.5)" }} />
            <input type="date" name="date" value={savingsForm.date} onChange={onSavingsChange} className="sr-only" />
          </label>

          {/* Goal */}
          <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Goal (optional)</p>
            <select name="savingsGoalId" value={savingsForm.savingsGoalId} onChange={onSavingsChange} className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }}>
              {goalOptions.map((o) => <option key={o.value} value={o.value} style={{ background: "#1a1108" }}>{o.label}</option>)}
            </select>
          </div>

          {/* Note */}
          <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Note (optional)</p>
            <input
              name="note" value={savingsForm.note} onChange={onSavingsChange}
              placeholder="Payday transfer, side income…"
              className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }}
            />
          </div>

          <button type="submit" disabled={savingsBusy}
            className="w-full rounded-[1.2rem] py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: "#D4870A", boxShadow: "0 8px 24px -6px rgba(180, 100, 5, 0.5)" }}>
            {savingsBusy ? "Saving…" : editingSavingsEntryId ? "Update Entry" : "Log Saving 🐾"}
          </button>
        </form>

        {/* Transfer to Current */}
        <div className="rounded-[1.35rem] p-4" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ArrowDownLeft className="h-4 w-4 shrink-0" style={{ color: "#D4870A" }} />
              <p className="text-sm font-semibold" style={{ color: "#f0e0c0" }}>Transfer to Current</p>
            </div>
            {!showWithdrawForm && (
              <button type="button" onClick={() => setShowWithdrawForm(true)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: "rgba(212, 135, 10, 0.15)", color: "#D4870A", border: "1px solid rgba(212, 135, 10, 0.3)" }}>
                Withdraw
              </button>
            )}
          </div>
          {showWithdrawForm ? (
            <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-3 mt-4">
              <p className="text-xs" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Moves money back to your current balance as a negative savings entry.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Amount</p>
                  <input type="number" min="0" step="0.01" value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "#f0e0c0" }} />
                </div>
                <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>From goal</p>
                  <select value={withdrawForm.savingsGoalId}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, savingsGoalId: e.target.value }))}
                    className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }}>
                    {goalOptions.map((o) => <option key={o.value} value={o.value} style={{ background: "#1a1108" }}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Note (optional)</p>
                <input value={withdrawForm.note}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Emergency repair, medical bill…"
                  className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={withdrawBusy}
                  className="flex-1 rounded-[1.0rem] py-3 text-sm font-bold text-white transition disabled:opacity-40"
                  style={{ background: "#D4870A", boxShadow: "0 6px 18px -6px rgba(180, 100, 5, 0.5)" }}>
                  {withdrawBusy ? "…" : "Transfer"}
                </button>
                <button type="button" onClick={() => { setShowWithdrawForm(false); setWithdrawForm(WITHDRAW_EMPTY); }}
                  className="rounded-[1.0rem] px-4 py-3 text-sm font-medium transition"
                  style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)", color: "rgba(212, 135, 10, 0.7)" }}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "rgba(156, 120, 85, 0.6)" }}>Need to dip into savings? Tap Withdraw to move an amount back to your current balance.</p>
          )}
        </div>
      </div>
    );
  }

  // "goals" tab (default)
  return (
    <div className="space-y-5">
      {savingsData && (
        <section className="hb-surface-card rounded-[2rem] p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Saved this period", value: currency(savingsData.totalSavedThisWindow ?? 0), color: "text-emerald-600" },
              { label: "All time", value: currency(savingsData.allTimeSaved ?? 0), color: "text-emerald-600" },
              { label: "Monthly target", value: currency(savingsData.householdSavingsTarget ?? 0), color: "text-slate-900" },
              { label: "Remaining to goal", value: currency(savingsData.longTermGoal?.remainingAmount ?? savingsData.remainingToGoal ?? 0), color: "text-slate-900" },
            ].map((stat) => (
              <div key={stat.label} className="hb-panel-soft rounded-[1.2rem] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className={`mt-1.5 text-lg font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
          {(savingsData.targetProgressPct ?? 0) > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="hb-progress-fill h-full rounded-full transition-all duration-700" style={{ width: `${savingsData.targetProgressPct}%` }} />
            </div>
          )}
        </section>
      )}

      <section className="hb-surface-card rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Target className="h-5 w-5 text-sky-600 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-900">Savings Goals</h2>
          </div>
          {!showGoalForm && (
            <button type="button" onClick={() => { onCancelSavingsGoalEdit(); setShowGoalForm(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition">
              <Plus className="h-3.5 w-3.5" /> Add Goal
            </button>
          )}
        </div>

        {showGoalForm && (
          <form onSubmit={handleGoalSubmit} className="mb-4 flex flex-col gap-3 rounded-[1.35rem] p-4" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "#f0e0c0" }}>{editingSavingsGoalId ? "Edit goal" : "New goal"}</p>
              <button type="button" onClick={handleCancelGoal} style={{ color: "rgba(212, 135, 10, 0.6)" }}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Goal name</p>
                <input name="title" value={savingsGoalForm.title} onChange={onSavingsGoalChange} placeholder="Emergency fund, Japan trip…" className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }} />
              </div>
              <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Target amount</p>
                <input name="targetAmount" type="number" min="0" step="0.01" value={savingsGoalForm.targetAmount} onChange={onSavingsGoalChange} placeholder="5000.00" className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }} />
              </div>
            </div>
            <label className="flex items-center gap-2.5 rounded-[1.0rem] px-3 py-2.5 cursor-pointer" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
              <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#D4870A" }} />
              <span className="flex-1 text-sm" style={{ color: savingsGoalForm.targetDate ? "#f0e0c0" : "rgba(240,210,160,0.35)" }}>
                {savingsGoalForm.targetDate ? new Date(savingsGoalForm.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Target date (optional)"}
              </span>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "rgba(212, 135, 10, 0.5)" }} />
              <input type="date" name="targetDate" value={savingsGoalForm.targetDate} onChange={onSavingsGoalChange} className="sr-only" />
            </label>
            <button type="submit" disabled={savingsTargetBusy}
              className="w-full rounded-[1.0rem] py-3 text-sm font-bold text-white transition disabled:opacity-40"
              style={{ background: "#D4870A", boxShadow: "0 6px 18px -6px rgba(180, 100, 5, 0.5)" }}>
              {savingsTargetBusy ? "Saving…" : editingSavingsGoalId ? "Update Goal" : "Save Goal"}
            </button>
          </form>
        )}

        {goals.length > 0 ? (
          <div className="space-y-3">
            {goals.map((goal) => (
              <article key={goal.id} className="hb-panel-soft rounded-[1.5rem] border border-sky-100/80 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{goal.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {currency(goal.totalSaved)} of {currency(goal.targetAmount)}
                      {goal.targetDate ? ` · Target: ${goal.targetDate}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {goal.progressPct >= 100 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        <Check className="h-3 w-3" /> Done
                      </span>
                    )}
                    <button type="button" onClick={() => handleEditGoal(goal)} className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button type="button" onClick={() => onDeleteSavingsGoal(goal)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <GoalProgress goal={goal} />
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{currency(goal.remainingAmount)} remaining</span>
                  {goal.suggestedMonthlyContribution ? (
                    <span className="font-semibold text-slate-700">{currency(goal.suggestedMonthlyContribution)}/mo suggested</span>
                  ) : null}
                </div>
                {goal.milestones?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {goal.milestones.map((m) => (
                      <span key={m.value} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.reached ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        {m.reached ? "✓ " : ""}{m.value}%
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          !showGoalForm && (
            <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50/40 px-4 py-8 text-center">
              <Target className="mx-auto mb-2 h-8 w-8 text-sky-300" />
              <p className="text-sm font-medium text-slate-600">No goals yet</p>
              <p className="mt-1 text-xs text-slate-400">Add a goal to track your savings progress.</p>
              <button type="button" onClick={() => setShowGoalForm(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition">
                <Plus className="h-4 w-4" /> Add your first goal
              </button>
            </div>
          )
        )}
      </section>
    </div>
  );
}
