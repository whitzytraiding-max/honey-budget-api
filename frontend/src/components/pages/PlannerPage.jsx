import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Pencil,
  Repeat,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";

function PlannerPage({
  plannerData,
  plannerBusy,
  recurringBillForm,
  recurringBillBusy,
  editingRecurringBillId,
  onRecurringBillChange,
  onRecurringBillSubmit,
  onEditRecurringBill,
  onDeleteRecurringBill,
  onCancelRecurringBillEdit,
  ruleForm,
  ruleBusy,
  editingRuleId,
  onRuleChange,
  onRuleSubmit,
  onEditRule,
  onDeleteRule,
  onCancelRuleEdit,
  onNavigate,
  soloMode,
}) {
  const { locale } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const recurringBills = plannerData?.recurringBills ?? [];
  const upcomingBills = plannerData?.upcomingBills ?? [];
  const riskAreas = plannerData?.conflictCenter?.riskAreas ?? [];
  const prompts = plannerData?.conflictCenter?.prompts ?? [];
  const rules = plannerData?.householdRules ?? [];

  const billFormRef = useRef(null);
  useEffect(() => {
    if (editingRecurringBillId && billFormRef.current) {
      billFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editingRecurringBillId]);

  return (
    <div className="space-y-4">
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex rounded-full bg-white/90 p-2 text-sky-700 shadow-sm">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <p className="hb-kicker">Conflict-prevention center</p>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
              Upcoming bills, rules, and shared pressure points
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Recurring bills, shared money rules, and potential friction points — all in one place so nothing catches you off guard.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div className="space-y-4">
          <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
            <div className="flex items-center gap-3">
              <Repeat className="h-5 w-5 text-emerald-700" />
              <div>
                <h3 className="text-lg font-semibold">Recurring bills automation</h3>
                <p className="text-sm text-slate-600">
                  Rent, subscriptions, and utilities can auto-appear monthly instead of being
                  re-entered by hand.
                </p>
              </div>
            </div>

            <form ref={billFormRef} className="mt-4 flex flex-col gap-3" onSubmit={onRecurringBillSubmit}>
              {/* Bill name + Amount */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Bill name</p>
                  <input name="title" value={recurringBillForm.title} onChange={onRecurringBillChange} placeholder="Rent" className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "var(--hb-text)" }} />
                </div>
                <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Amount</p>
                  <input name="amount" type="number" min="0" step="0.01" value={recurringBillForm.amount} onChange={onRecurringBillChange} placeholder="750.00" className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "var(--hb-text)" }} />
                </div>
              </div>
              {/* Currency + Day of month */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Currency</p>
                  <select name="currencyCode" value={recurringBillForm.currencyCode} onChange={onRecurringBillChange} className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--hb-text)" }}>
                    {currencyOptions.map((o) => <option key={o.value} value={o.value} style={{ background: "var(--hb-input-bg)", color: "var(--hb-text)" }}>{o.label}</option>)}
                  </select>
                </div>
                <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Day of month</p>
                  <input name="dayOfMonth" type="number" min="1" max="28" step="1" value={recurringBillForm.dayOfMonth} onChange={onRecurringBillChange} placeholder="1" className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--hb-text)" }} />
                </div>
              </div>
              {/* Category */}
              <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Category</p>
                <input name="category" value={recurringBillForm.category} onChange={onRecurringBillChange} placeholder="Housing" className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--hb-text)" }} />
              </div>
              {/* Payment method pill */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Payment method</p>
                <div className="flex gap-1 p-1 rounded-full" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  {[{ value: "card", label: "Card" }, { value: "cash", label: "Cash" }].map(({ value, label }) => (
                    <button key={value} type="button"
                      className="flex-1 py-2.5 rounded-full text-sm font-semibold transition"
                      style={{ background: recurringBillForm.paymentMethod === value ? "var(--hb-accent-strong)" : "transparent", color: recurringBillForm.paymentMethod === value ? "var(--hb-accent-contrast)" : "var(--hb-text-muted)" }}
                      onClick={() => onRecurringBillChange({ target: { name: "paymentMethod", value } })}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Who pays */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Who pays this bill?</p>
                <div className="flex gap-1 p-1 rounded-full" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  {[{ value: "joint", label: "Joint" }, { value: "user", label: "Mine" }, { value: "partner", label: "Partner" }].map(({ value, label }) => (
                    <button key={value} type="button"
                      className="flex-1 py-2.5 rounded-full text-sm font-semibold transition"
                      style={{ background: recurringBillForm.paidBy === value ? "var(--hb-accent-strong)" : "transparent", color: recurringBillForm.paidBy === value ? "var(--hb-accent-contrast)" : "var(--hb-text-muted)" }}
                      onClick={() => onRecurringBillChange({ target: { name: "paidBy", value } })}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Start + End date */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2.5 rounded-[1.2rem] px-4 py-3 cursor-pointer" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--hb-accent-text)" }} />
                  <span className="flex-1 text-sm" style={{ color: recurringBillForm.startDate ? "var(--hb-text)" : "var(--hb-text-muted)" }}>
                    {recurringBillForm.startDate ? new Date(recurringBillForm.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Start date"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--hb-text-muted)" }} />
                  <input type="date" name="startDate" value={recurringBillForm.startDate} onChange={onRecurringBillChange} className="sr-only" />
                </label>
                <label className="flex items-center gap-2.5 rounded-[1.2rem] px-4 py-3 cursor-pointer" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--hb-text-muted)" }} />
                  <span className="flex-1 text-sm" style={{ color: recurringBillForm.endDate ? "var(--hb-text)" : "var(--hb-text-muted)" }}>
                    {recurringBillForm.endDate ? new Date(recurringBillForm.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "End date (optional)"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--hb-text-muted)" }} />
                  <input type="date" name="endDate" value={recurringBillForm.endDate} onChange={onRecurringBillChange} className="sr-only" />
                </label>
              </div>
              {/* Notes */}
              <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Notes (optional)</p>
                <textarea name="notes" value={recurringBillForm.notes} onChange={onRecurringBillChange} placeholder="Landlord transfer, Netflix family plan, electric bill, etc." rows={2} className="w-full bg-transparent text-sm outline-none resize-none" style={{ color: "var(--hb-text)" }} />
              </div>
              {/* Auto-create */}
              <label className="flex items-center gap-3 rounded-[1.2rem] px-4 py-3 cursor-pointer" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                <input checked={Boolean(recurringBillForm.autoCreate)} name="autoCreate" onChange={onRecurringBillChange} type="checkbox"
                  className="h-4 w-4 rounded accent-[var(--hb-accent-strong)]" />
                <span className="text-sm" style={{ color: "var(--hb-text)" }}>Auto-create this bill each month</span>
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={recurringBillBusy}
                  className="flex-1 rounded-[1.2rem] py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "var(--hb-accent-strong)", boxShadow: "0 8px 24px -6px var(--hb-accent-glow)" }}>
                  {recurringBillBusy ? "Saving…" : editingRecurringBillId ? "Update bill" : "Save bill 🐾"}
                </button>
                {editingRecurringBillId && (
                  <button type="button" onClick={onCancelRecurringBillEdit}
                    className="rounded-[1.2rem] px-4 py-3 text-sm font-medium transition"
                    style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-text-muted)" }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {recurringBills.length ? (
                recurringBills.map((bill) => (
                  <article
                    key={bill.id}
                    className="hb-panel-soft rounded-[1.25rem] border border-sky-100/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{bill.title}</p>
                          {bill.paidBy === "joint" && (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                              Joint
                            </span>
                          )}
                          {bill.paidBy === "user" && (
                            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                              {bill.userName ?? "Mine"}
                            </span>
                          )}
                          {bill.paidBy === "partner" && (
                            <span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-medium text-pink-700">
                              Partner
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {currency(bill.displayAmount)} · {bill.category} · {bill.userName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Next due: {bill.nextDueDate || "Not scheduled"} · Day {bill.dayOfMonth}
                        </p>
                        {bill.warning ? (
                          <p className="mt-2 text-sm text-amber-700">{bill.warning}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                          onClick={() => onEditRecurringBill(bill)}
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"
                          onClick={() => onDeleteRecurringBill(bill)}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="hb-panel-soft rounded-[1.25rem] border border-sky-100/70 px-4 py-5 text-sm text-slate-600">
                  No recurring bills saved yet. Start with rent, subscriptions, internet, or
                  utilities so the app can auto-fill them monthly.
                </div>
              )}
            </div>
          </section>

          {!soloMode && <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              <div>
                <h3 className="text-lg font-semibold">Shared money rules</h3>
                <p className="text-sm text-slate-600">
                  Set clear expectations so both partners stay on the same page.
                </p>
              </div>
            </div>

            <form className="mt-4 flex flex-col gap-3" onSubmit={onRuleSubmit}>
              <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Rule name</p>
                <input name="title" value={ruleForm.title} onChange={onRuleChange} placeholder="Check in before anything over $50" className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "var(--hb-text)" }} />
              </div>
              <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Rule details</p>
                <textarea name="details" value={ruleForm.details} onChange={onRuleChange} placeholder="Message each other before spending over the threshold unless it is groceries or transport." rows={3} className="w-full bg-transparent text-sm outline-none resize-none" style={{ color: "var(--hb-text)" }} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Threshold amount (optional)</p>
                  <input name="thresholdAmount" type="number" min="0" step="0.01" value={ruleForm.thresholdAmount} onChange={onRuleChange} placeholder="50.00" className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--hb-text)" }} />
                </div>
                <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Threshold currency</p>
                  <select name="currencyCode" value={ruleForm.currencyCode} onChange={onRuleChange} className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--hb-text)" }}>
                    {currencyOptions.map((o) => <option key={o.value} value={o.value} style={{ background: "var(--hb-input-bg)", color: "var(--hb-text)" }}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={ruleBusy}
                  className="flex-1 rounded-[1.2rem] py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "var(--hb-accent-strong)", boxShadow: "0 8px 24px -6px var(--hb-accent-glow)" }}>
                  {ruleBusy ? "Saving…" : editingRuleId ? "Update rule" : "Save rule 🐾"}
                </button>
                {editingRuleId && (
                  <button type="button" onClick={onCancelRuleEdit}
                    className="rounded-[1.2rem] px-4 py-3 text-sm font-medium transition"
                    style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)", color: "var(--hb-text-muted)" }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {rules.length ? (
                rules.map((rule) => (
                  <article
                    key={rule.id}
                    className="hb-panel-soft rounded-[1.25rem] border border-sky-100/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{rule.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{rule.details}</p>
                        {rule.thresholdAmount ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Threshold:{" "}
                            {currency(rule.thresholdAmount, {
                              sourceCurrency: rule.currencyCode || plannerData?.displayCurrencyCode,
                              convert: false,
                            })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                          onClick={() => onEditRule(rule)}
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"
                          onClick={() => onDeleteRule(rule)}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="hb-panel-soft rounded-[1.25rem] border border-sky-100/70 px-4 py-5 text-sm text-slate-600">
                  No shared rules yet. Start with one simple guideline like a spending threshold
                  or a weekly dining cap.
                </div>
              )}
            </div>
          </section>}
        </div>

        <div className="space-y-4">
          <section className="hb-surface-card rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-sky-700" />
              <div>
                <h3 className="text-lg font-semibold">Upcoming bills</h3>
                <p className="text-sm text-slate-600">
                  These are the next recurring bills that can land automatically.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {plannerBusy ? (
                <div className="hb-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-500">
                  Loading planner…
                </div>
              ) : upcomingBills.length ? (
                upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="hb-panel-mint rounded-[1.25rem] border border-sky-100/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{bill.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {currency(bill.displayAmount)} · {bill.nextDueDate}
                        </p>
                      </div>
                      {bill.dueSoon ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Due soon
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="hb-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-500">
                  No upcoming recurring bills yet.
                </div>
              )}
            </div>
          </section>

          <section className="hb-surface-card rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              <div>
                <h3 className="text-lg font-semibold">Current risk areas</h3>
                <p className="text-sm text-slate-600">
                  Areas that tend to cause tension — flagged early so you can get ahead of them.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {riskAreas.length ? (
                riskAreas.map((risk) => (
                  <article key={risk.key} className="hb-panel-soft rounded-[1.25rem] p-4">
                    <p className="font-semibold text-slate-900">{risk.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{risk.body}</p>
                  </article>
                ))
              ) : (
                <div className="hb-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-500">
                  No major risk areas are showing yet. That usually means the current month is
                  stable or your planner needs a few more rules and bills to work with.
                </div>
              )}
            </div>
          </section>

          <section className="hb-surface-card rounded-[1.75rem] p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Talk about this now</h3>
            <div className="mt-4 space-y-3">
              {prompts.length ? (
                prompts.map((prompt) => (
                  <div key={prompt} className="hb-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-700">
                    {prompt}
                  </div>
                ))
              ) : (
                <div className="hb-panel-soft rounded-[1.25rem] p-4 text-sm text-slate-500">
                  No conversation prompts yet. Add your recurring bills and complete the coach setup — the app will generate money topics worth talking about based on your actual spending patterns.
                </div>
              )}
            </div>
          </section>

          <section className="hb-surface-card rounded-[1.75rem] p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Push notifications</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {plannerData?.pushReadiness?.body}
            </p>
            <button
              className="hb-button-secondary mt-4 inline-flex rounded-[1.1rem] px-4 py-2 text-sm font-medium"
              onClick={() => onNavigate("notifications")}
              type="button"
            >
              Open notifications tab
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PlannerPage;
