import { useState } from "react";
import { Check, Pencil, PiggyBank, Plus, Target, Trash2, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { ActionButton, Input, Select } from "../ui.jsx";

function GoalProgress({ goal }) {
  const pct = goal.progressPct ?? 0;
  const barColor =
    pct >= 100
      ? "bg-emerald-400"
      : pct >= 60
        ? "bg-sky-400"
        : "bg-indigo-400";

  return (
    <div className="mt-3">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
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

export default function SavingsPage({
  savingsData,
  savingsForm,
  savingsTargetForm,
  savingsGoalForm,
  editingSavingsGoalId,
  onSavingsChange,
  onSavingsGoalChange,
  onSavingsSubmit,
  onSavingsGoalSubmit,
  onEditSavingsGoal,
  onDeleteSavingsGoal,
  onCancelSavingsGoalEdit,
  savingsBusy,
  savingsTargetBusy,
}) {
  const { t, locale } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const entries = savingsData?.entries ?? [];
  const goals = savingsData?.goals ?? [];
  const [showGoalForm, setShowGoalForm] = useState(false);

  const goalOptions = [
    { label: "No specific goal", value: "" },
    ...goals.map((g) => ({ label: g.title, value: String(g.id) })),
  ];

  function handleGoalSubmit(e) {
    onSavingsGoalSubmit(e);
    setShowGoalForm(false);
  }

  function handleEditGoal(goal) {
    onEditSavingsGoal(goal);
    setShowGoalForm(true);
  }

  function handleCancelGoal() {
    onCancelSavingsGoalEdit();
    setShowGoalForm(false);
  }

  return (
    <div className="space-y-5">

      {/* ── Log a saving ──────────────────────────────────────────── */}
      <section className="hb-panel-multi rounded-[2rem] border border-sky-200/70 p-5 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)]">
        <div className="flex items-center gap-2.5 mb-4">
          <PiggyBank className="h-5 w-5 text-emerald-600 shrink-0" />
          <h2 className="text-lg font-semibold text-slate-900">Log a Saving</h2>
        </div>

        <form onSubmit={onSavingsSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <Input
                label="Amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={savingsForm.amount}
                onChange={onSavingsChange}
                placeholder="0.00"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Input
                label="Date"
                name="date"
                type="date"
                value={savingsForm.date}
                onChange={onSavingsChange}
              />
            </div>
            <div className="col-span-2">
              <Select
                label="Goal (optional)"
                name="savingsGoalId"
                value={savingsForm.savingsGoalId}
                onChange={onSavingsChange}
                options={goalOptions}
              />
            </div>
          </div>

          <Input
            label="Note (optional)"
            name="note"
            value={savingsForm.note}
            onChange={onSavingsChange}
            placeholder="Payday transfer, side income…"
          />

          <ActionButton busy={savingsBusy} className="w-full sm:w-auto">
            Log Saving
          </ActionButton>
        </form>
      </section>

      {/* ── Savings goals ─────────────────────────────────────────── */}
      <section className="hb-surface-card rounded-[2rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Target className="h-5 w-5 text-sky-600 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-900">Savings Goals</h2>
          </div>
          {!showGoalForm && (
            <button
              type="button"
              onClick={() => { onCancelSavingsGoalEdit(); setShowGoalForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Goal
            </button>
          )}
        </div>

        {/* Goal form */}
        {showGoalForm && (
          <form
            onSubmit={handleGoalSubmit}
            className="mb-4 rounded-[1.5rem] border border-sky-100 bg-sky-50/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-slate-800">
                {editingSavingsGoalId ? "Edit goal" : "New goal"}
              </p>
              <button type="button" onClick={handleCancelGoal} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Goal name"
                name="title"
                value={savingsGoalForm.title}
                onChange={onSavingsGoalChange}
                placeholder="Emergency fund, Japan trip…"
              />
              <Input
                label="Target amount"
                name="targetAmount"
                type="number"
                min="0"
                step="0.01"
                value={savingsGoalForm.targetAmount}
                onChange={onSavingsGoalChange}
                placeholder="5000.00"
              />
            </div>
            <Input
              label="Target date (optional)"
              name="targetDate"
              type="date"
              value={savingsGoalForm.targetDate}
              onChange={onSavingsGoalChange}
            />
            <ActionButton busy={savingsTargetBusy} className="w-full sm:w-auto">
              {editingSavingsGoalId ? "Update Goal" : "Save Goal"}
            </ActionButton>
          </form>
        )}

        {/* Goals list */}
        {goals.length > 0 ? (
          <div className="space-y-3">
            {goals.map((goal) => (
              <article
                key={goal.id}
                className="hb-panel-soft rounded-[1.5rem] border border-sky-100/80 px-4 py-4"
              >
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
                    <button
                      type="button"
                      onClick={() => handleEditGoal(goal)}
                      className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavingsGoal(goal)}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <GoalProgress goal={goal} />

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{currency(goal.remainingAmount)} remaining</span>
                  {goal.suggestedMonthlyContribution ? (
                    <span className="font-semibold text-slate-700">
                      {currency(goal.suggestedMonthlyContribution)}/mo suggested
                    </span>
                  ) : null}
                </div>

                {goal.milestones?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {goal.milestones.map((m) => (
                      <span
                        key={m.value}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          m.reached ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                        }`}
                      >
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
              <button
                type="button"
                onClick={() => setShowGoalForm(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
              >
                <Plus className="h-4 w-4" />
                Add your first goal
              </button>
            </div>
          )
        )}
      </section>

      {/* ── Stats strip ───────────────────────────────────────────── */}
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
              <div
                className="hb-progress-fill h-full rounded-full transition-all duration-700"
                style={{ width: `${savingsData.targetProgressPct}%` }}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Recent entries ────────────────────────────────────────── */}
      <section className="hb-surface-card rounded-[2rem] p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Recent Savings</h2>
        <div className="space-y-2">
          {entries.length ? (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-[1.2rem] bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {entry.note && entry.note !== "Savings entry" ? entry.note : (entry.savingsGoalTitle ?? "Savings entry")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {entry.date}
                    {entry.userName ? ` · ${entry.userName}` : ""}
                    {entry.savingsGoalTitle ? ` · ${entry.savingsGoalTitle}` : ""}
                  </p>
                </div>
                <p className="ml-3 shrink-0 text-sm font-bold text-emerald-600">
                  +{currency(entry.displayAmount ?? entry.amount)}
                </p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">No savings logged yet.</p>
          )}
        </div>
      </section>

    </div>
  );
}
