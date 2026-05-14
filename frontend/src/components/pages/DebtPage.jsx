/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { CalendarDays, CheckCircle, ChevronDown, CreditCard, Pencil, Trash2, X } from "lucide-react";
import { EmptyState } from "../ui.jsx";

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
  { value: "MMK", label: "MMK" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Transfer" },
];

function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 100 ? "bg-emerald-500" : clamped >= 50 ? "bg-sky-400" : "bg-rose-400";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function DebtCard({ debt, currentUserId, onPay, onEdit, onDelete, onDeletePayment, payingDebtId, paymentForm, onPaymentChange, onPaymentSubmit, onClosePayment, debtBusy }) {
  const paidPct = debt.originalAmount > 0
    ? ((debt.originalAmount - debt.currentBalance) / debt.originalAmount) * 100
    : 100;
  const isPaidOff = Boolean(debt.paidOffAt) || debt.currentBalance <= 0;
  const isOwn = debt.userId === currentUserId;
  const isPayingThis = payingDebtId === debt.id;

  const estimatedMonths = debt.minimumPayment && debt.minimumPayment > 0 && debt.currentBalance > 0
    ? Math.ceil(debt.currentBalance / debt.minimumPayment)
    : null;

  return (
    <div className={`hb-surface-card rounded-2xl overflow-hidden ${isPaidOff ? "opacity-75" : ""}`}>
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold" style={{ color: "var(--hb-ink)" }}>{debt.title}</h3>
              {isPaidOff && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>Paid off</span>
              )}
              {!isOwn && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>{debt.ownerName}</span>
              )}
            </div>
            <p className="mt-0.5 text-2xl font-bold" style={{ color: "var(--hb-ink)" }}>
              {debt.currencyCode} {debt.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-2 text-sm font-normal" style={{ color: "var(--hb-ink-soft)" }}>remaining</span>
            </p>
          </div>
          {isOwn && !isPaidOff && (
            <div className="flex shrink-0 gap-1">
              <button className="rounded-lg p-1.5 transition" style={{ color: "var(--hb-ink-soft)" }} type="button" onClick={() => onEdit(debt)} aria-label="Edit debt">
                <Pencil className="h-4 w-4" />
              </button>
              <button className="rounded-lg p-1.5 transition hover:text-rose-400" style={{ color: "var(--hb-ink-soft)" }} type="button" onClick={() => onDelete(debt)} aria-label="Delete debt">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <ProgressBar pct={paidPct} />

        <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--hb-ink-soft)" }}>
          <span>{paidPct.toFixed(0)}% paid off · {debt.currencyCode} {debt.originalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} original</span>
          {estimatedMonths && !isPaidOff && (
            <span>~{estimatedMonths} mo. at min</span>
          )}
        </div>
      </div>

      {/* Payment action */}
      {!isPaidOff && !isPayingThis && (
        <div className="px-5 pb-5">
          <button
            className="mt-1 w-full rounded-[1.2rem] py-3 text-sm font-bold text-white transition active:scale-[0.98]"
            style={{ background: "#D4870A", boxShadow: "0 8px 24px -6px rgba(180, 100, 5, 0.5)" }}
            type="button"
            onClick={() => onPay(debt.id)}
          >
            <CheckCircle className="mr-2 inline h-4 w-4" />
            Record Payment
          </button>
        </div>
      )}

      {/* Payment form */}
      {isPayingThis && (
        <div className="border-t px-4 py-4" style={{ borderColor: "rgba(100, 65, 20, 0.3)" }}>
          <form onSubmit={onPaymentSubmit} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "#D4870A" }}>Log a payment</p>
              <button type="button" onClick={onClosePayment} style={{ color: "rgba(212, 135, 10, 0.6)" }}><X className="h-4 w-4" /></button>
            </div>
            {/* Amount */}
            <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Amount</p>
              <input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={paymentForm.amount} onChange={onPaymentChange} placeholder="0.00" required className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "#f0e0c0" }} />
            </div>
            {/* Date */}
            <label className="flex items-center gap-2.5 rounded-[1.0rem] px-3 py-2.5 cursor-pointer" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
              <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#D4870A" }} />
              <span className="flex-1 text-sm" style={{ color: paymentForm.date ? "#f0e0c0" : "rgba(240,210,160,0.35)" }}>
                {paymentForm.date ? new Date(paymentForm.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Select date"}
              </span>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "rgba(212, 135, 10, 0.5)" }} />
              <input type="date" name="date" value={paymentForm.date} onChange={onPaymentChange} required className="sr-only" />
            </label>
            {/* Note */}
            <div className="rounded-[1.0rem] px-3 py-2.5" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)" }}>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Note (optional)</p>
              <input name="note" value={paymentForm.note} onChange={onPaymentChange} placeholder="e.g. January payment" className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }} />
            </div>
            {/* Payment method pill toggle */}
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Method</p>
              <div className="flex gap-1 p-1 rounded-full" style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
                {PAYMENT_METHOD_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button"
                    className="flex-1 py-2 rounded-full text-xs font-semibold transition"
                    style={{ background: paymentForm.paymentMethod === value ? "#D4870A" : "transparent", color: paymentForm.paymentMethod === value ? "#fff" : "rgba(212, 135, 10, 0.5)" }}
                    onClick={() => onPaymentChange({ target: { name: "paymentMethod", value } })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={debtBusy}
              className="w-full rounded-[1.0rem] py-3 text-sm font-bold text-white transition disabled:opacity-40"
              style={{ background: "#D4870A", boxShadow: "0 6px 18px -6px rgba(180, 100, 5, 0.5)" }}>
              {debtBusy ? "Saving…" : "Save payment 🐾"}
            </button>
          </form>
        </div>
      )}

      {/* Payment history */}
      {debt.payments.length > 0 && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--hb-border)" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hb-ink-soft)" }}>Payment history</p>
          <div className="space-y-1">
            {debt.payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
                <div className="min-w-0">
                  <p className="truncate text-sm" style={{ color: "var(--hb-ink)" }}>{payment.note || "Payment"}</p>
                  <p className="text-xs" style={{ color: "var(--hb-ink-soft)" }}>{payment.date}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "#38bdf8" }}>
                    -{debt.currencyCode} {Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {payment.userId === currentUserId && (
                    <button className="transition hover:text-rose-400" style={{ color: "var(--hb-ink-soft)" }} type="button" onClick={() => onDeletePayment(debt, payment)} aria-label="Delete payment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DebtPage({
  activeTab = "debts",
  debtData,
  debtBusy,
  debtForm,
  editingDebtId,
  payingDebtId,
  paymentForm,
  currentUserId,
  baseCurrencyCode,
  onDebtChange,
  onDebtSubmit,
  onEditDebt,
  onDeleteDebt,
  onCancelDebtEdit,
  onPaymentChange,
  onPaymentSubmit,
  onOpenPayment,
  onClosePayment,
  onDeletePayment,
}) {
  const debts = debtData?.debts ?? [];
  const activeDebts = debts.filter((d) => !d.paidOffAt && d.currentBalance > 0);
  const paidDebts = debts.filter((d) => d.paidOffAt || d.currentBalance <= 0);
  const totalOwed = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);

  // "payments" tab — aggregate all payments across all debts
  if (activeTab === "payments") {
    const allPayments = debts.flatMap((d) =>
      d.payments.map((p) => ({ ...p, debtTitle: d.title, currencyCode: d.currencyCode }))
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="space-y-4">
        {allPayments.length > 0 ? (
          <div className="hb-surface-card rounded-2xl p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-700">All Payments</h2>
            <div className="space-y-2">
              {allPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{payment.debtTitle}</p>
                    <p className="text-xs text-slate-400">{payment.note || "Payment"} · {payment.date}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-sky-700">
                      -{payment.currencyCode} {Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {payment.userId === currentUserId && (
                      <button
                        className="text-slate-400 hover:text-rose-500 transition"
                        type="button"
                        onClick={() => {
                          const debt = debts.find((d) => d.payments.some((p) => p.id === payment.id));
                          if (debt) onDeletePayment(debt, payment);
                        }}
                        aria-label="Delete payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No payments yet"
            body="Record payments on your debts to see the history here."
            icon={<CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-400" />}
          />
        )}
      </div>
    );
  }

  // "add" tab — add/edit form
  if (activeTab === "add") {
    return (
      <form className="flex flex-col gap-3" onSubmit={onDebtSubmit}>
        {editingDebtId && (
          <div className="flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-sm"
            style={{ background: "rgba(50, 30, 8, 0.85)", border: "1px solid rgba(212, 135, 10, 0.35)", color: "#fde68a" }}>
            <p>Editing debt</p>
            <button type="button" onClick={onCancelDebtEdit} className="inline-flex items-center gap-1 font-semibold"><X className="h-4 w-4" /> Cancel</button>
          </div>
        )}
        {/* Debt name */}
        <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Debt name</p>
          <input name="title" value={debtForm.title} onChange={onDebtChange} placeholder="e.g. Visa card, student loan" required className="w-full bg-transparent text-sm font-semibold outline-none" style={{ color: "#f0e0c0" }} />
        </div>
        {/* Total owed + Currency */}
        {!editingDebtId && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Total owed</p>
              <input name="originalAmount" type="number" inputMode="decimal" min="0.01" step="0.01" value={debtForm.originalAmount} onChange={onDebtChange} placeholder="0.00" required className="w-full bg-transparent text-2xl font-bold outline-none" style={{ color: "#f0e0c0" }} />
            </div>
            <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Currency</p>
              <select name="currencyCode" value={debtForm.currencyCode} onChange={onDebtChange} className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }}>
                {CURRENCY_OPTIONS.map((o) => <option key={o.value} value={o.value} style={{ background: "#1a1108" }}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}
        {/* Min payment */}
        <div className="rounded-[1.2rem] px-4 py-3" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Min. payment (optional)</p>
          <input name="minimumPayment" type="number" inputMode="decimal" min="0" step="0.01" value={debtForm.minimumPayment} onChange={onDebtChange} placeholder="0.00" className="w-full bg-transparent text-sm outline-none" style={{ color: "#f0e0c0" }} />
        </div>
        {/* Payment method pill */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Payment method</p>
          <div className="flex gap-1 p-1 rounded-full" style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}>
            {PAYMENT_METHOD_OPTIONS.map(({ value, label }) => (
              <button key={value} type="button"
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition"
                style={{ background: debtForm.paymentMethod === value ? "#D4870A" : "transparent", color: debtForm.paymentMethod === value ? "#fff" : "rgba(212, 135, 10, 0.5)" }}
                onClick={() => onDebtChange({ target: { name: "paymentMethod", value } })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={debtBusy}
          className="w-full rounded-[1.2rem] py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
          style={{ background: "#D4870A", boxShadow: "0 8px 24px -6px rgba(180, 100, 5, 0.5)" }}>
          {debtBusy ? "Saving…" : editingDebtId ? "Save changes" : "Add debt 🐾"}
        </button>
      </form>
    );
  }

  // "debts" tab (default)
  return (
    <div className="space-y-6">
      {activeDebts.length > 0 && (
        <div className="hb-hero-panel rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-500">Total remaining debt</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-700">
            {baseCurrencyCode} {totalOwed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">{activeDebts.length} active debt{activeDebts.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {activeDebts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Active debts</h2>
          {activeDebts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              currentUserId={currentUserId}
              onPay={onOpenPayment}
              onEdit={onEditDebt}
              onDelete={onDeleteDebt}
              onDeletePayment={onDeletePayment}
              payingDebtId={payingDebtId}
              paymentForm={paymentForm}
              onPaymentChange={onPaymentChange}
              onPaymentSubmit={onPaymentSubmit}
              onClosePayment={onClosePayment}
              debtBusy={debtBusy}
            />
          ))}
        </div>
      )}

      {paidDebts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Paid off</h2>
          {paidDebts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              currentUserId={currentUserId}
              onPay={onOpenPayment}
              onEdit={onEditDebt}
              onDelete={onDeleteDebt}
              onDeletePayment={onDeletePayment}
              payingDebtId={payingDebtId}
              paymentForm={paymentForm}
              onPaymentChange={onPaymentChange}
              onPaymentSubmit={onPaymentSubmit}
              onClosePayment={onClosePayment}
              debtBusy={debtBusy}
            />
          ))}
        </div>
      )}

      {debts.length === 0 && (
        <EmptyState
          title="No debts tracked yet"
          body="Tap 'Add Debt' below to start tracking your payoff progress."
          icon={<CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-400" />}
        />
      )}
    </div>
  );
}
