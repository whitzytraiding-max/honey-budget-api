import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Pencil,
  Repeat,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { ActionButton, Input, Select, Textarea } from "../ui.jsx";
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
}) {
  const { locale } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const recurringBills = plannerData?.recurringBills ?? [];
  const upcomingBills = plannerData?.upcomingBills ?? [];
  const riskAreas = plannerData?.conflictCenter?.riskAreas ?? [];
  const prompts = plannerData?.conflictCenter?.prompts ?? [];
  const rules = plannerData?.householdRules ?? [];

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
              This is the first planner pass: recurring bills auto-create monthly, your shared
              money rules live here, and the couple gets one place to see what needs a quick check-in.
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

            <form className="mt-4 grid gap-4" onSubmit={onRecurringBillSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Bill name"
                  name="title"
                  value={recurringBillForm.title}
                  onChange={onRecurringBillChange}
                  placeholder="Rent"
                />
                <Input
                  label="Amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={recurringBillForm.amount}
                  onChange={onRecurringBillChange}
                  placeholder="750.00"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Currency"
                  name="currencyCode"
                  value={recurringBillForm.currencyCode}
                  onChange={onRecurringBillChange}
                  options={currencyOptions}
                />
                <Input
                  label="Day of month"
                  name="dayOfMonth"
                  type="number"
                  min="1"
                  max="28"
                  step="1"
                  value={recurringBillForm.dayOfMonth}
                  onChange={onRecurringBillChange}
                  placeholder="1"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Category"
                  name="category"
                  value={recurringBillForm.category}
                  onChange={onRecurringBillChange}
                  placeholder="Housing"
                />
                <Select
                  label="Payment method"
                  name="paymentMethod"
                  value={recurringBillForm.paymentMethod}
                  onChange={onRecurringBillChange}
                  options={[
                    { value: "card", label: "Card" },
                    { value: "cash", label: "Cash" },
                  ]}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Start date"
                  name="startDate"
                  type="date"
                  value={recurringBillForm.startDate}
                  onChange={onRecurringBillChange}
                />
                <Input
                  label="End date (optional)"
                  name="endDate"
                  type="date"
                  value={recurringBillForm.endDate}
                  onChange={onRecurringBillChange}
                />
              </div>
              <Textarea
                label="Notes (optional)"
                name="notes"
                value={recurringBillForm.notes}
                onChange={onRecurringBillChange}
                placeholder="Landlord transfer, Netflix family plan, electric bill, etc."
              />
              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input
                  checked={Boolean(recurringBillForm.autoCreate)}
                  className="h-4 w-4 rounded border-slate-300"
                  name="autoCreate"
                  onChange={onRecurringBillChange}
                  type="checkbox"
                />
                Auto-create this bill each month
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <ActionButton busy={recurringBillBusy} className="sm:w-auto">
                  {editingRecurringBillId ? "Update recurring bill" : "Save recurring bill"}
                </ActionButton>
                {editingRecurringBillId ? (
                  <button
                    className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
                    onClick={onCancelRecurringBillEdit}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
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
                        <p className="font-semibold text-slate-900">{bill.title}</p>
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

          <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              <div>
                <h3 className="text-lg font-semibold">Shared money rules</h3>
                <p className="text-sm text-slate-600">
                  Keep the rules simple and visible so arguments do not start from surprises.
                </p>
              </div>
            </div>

            <form className="mt-4 grid gap-4" onSubmit={onRuleSubmit}>
              <Input
                label="Rule name"
                name="title"
                value={ruleForm.title}
                onChange={onRuleChange}
                placeholder="Check in before anything over $50"
              />
              <Textarea
                label="Rule details"
                name="details"
                value={ruleForm.details}
                onChange={onRuleChange}
                placeholder="Message each other before spending over the threshold unless it is groceries or transport."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Optional threshold amount"
                  name="thresholdAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ruleForm.thresholdAmount}
                  onChange={onRuleChange}
                  placeholder="50.00"
                />
                <Select
                  label="Threshold currency"
                  name="currencyCode"
                  value={ruleForm.currencyCode}
                  onChange={onRuleChange}
                  options={currencyOptions}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <ActionButton busy={ruleBusy} className="sm:w-auto">
                  {editingRuleId ? "Update rule" : "Save rule"}
                </ActionButton>
                {editingRuleId ? (
                  <button
                    className="hb-button-secondary inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3 font-medium transition"
                    onClick={onCancelRuleEdit}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
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
          </section>
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
                  The first version of the conflict center flags the places most likely to create
                  tension this month.
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
                  Once you add recurring bills or coach answers, this section will surface useful
                  discussion starters.
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
