/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { CheckCircle, CreditCard, Pencil, Trash2, X } from "lucide-react";
import { ActionButton, EmptyState, Input, Select } from "../ui.jsx";

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
              <h3 className="truncate text-base font-semibold text-slate-700">{debt.title}</h3>
              {isPaidOff && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Paid off</span>
              )}
              {!isOwn && (
                <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{debt.ownerName}</span>
              )}
            </div>
            <p className="mt-0.5 text-2xl font-bold text-slate-800">
              {debt.currencyCode} {debt.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-2 text-sm font-normal text-slate-400">remaining</span>
            </p>
          </div>
          {isOwn && !isPaidOff && (
            <div className="flex shrink-0 gap-1">
              <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" type="button" onClick={() => onEdit(debt)} aria-label="Edit debt">
                <Pencil className="h-4 w-4" />
              </button>
              <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" type="button" onClick={() => onDelete(debt)} aria-label="Delete debt">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <ProgressBar pct={paidPct} />

        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
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
            className="mt-1 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
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
        <div className="border-t border-slate-100 bg-sky-50/60 px-5 py-5">
          <form onSubmit={onPaymentSubmit} className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-sky-800">Log a payment</p>
              <button type="button" onClick={onClosePayment} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={paymentForm.amount} onChange={onPaymentChange} placeholder="0.00" required />
              <Input label="Date" name="date" type="date" value={paymentForm.date} onChange={onPaymentChange} required />
            </div>
            <Input label="Note (optional)" name="note" value={paymentForm.note} onChange={onPaymentChange} placeholder="e.g. January payment" />
            <Select label="Method" name="paymentMethod" value={paymentForm.paymentMethod} onChange={onPaymentChange} options={PAYMENT_METHOD_OPTIONS} />
            <ActionButton busy={debtBusy} className="w-full">Save payment</ActionButton>
          </form>
        </div>
      )}

      {/* Payment history */}
      {debt.payments.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment history</p>
          <div className="space-y-1">
            {debt.payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{payment.note || "Payment"}</p>
                  <p className="text-xs text-slate-400">{payment.date}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-sky-700">
                    -{debt.currencyCode} {Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {payment.userId === currentUserId && (
                    <button className="text-slate-400 transition hover:text-rose-500" type="button" onClick={() => onDeletePayment(debt, payment)} aria-label="Delete payment">
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
      <div className="hb-surface-card rounded-2xl p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-700">
          {editingDebtId ? "Edit debt" : "Add a debt"}
        </h2>
        <form className="space-y-3" onSubmit={onDebtSubmit}>
          <Input label="Debt name" name="title" value={debtForm.title} onChange={onDebtChange} placeholder="e.g. Visa card, student loan" required />
          {!editingDebtId && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Total owed" name="originalAmount" type="number" inputMode="decimal" min="0.01" step="0.01" value={debtForm.originalAmount} onChange={onDebtChange} placeholder="0.00" required />
              <Select label="Currency" name="currencyCode" value={debtForm.currencyCode} onChange={onDebtChange} options={CURRENCY_OPTIONS} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min. payment (optional)" name="minimumPayment" type="number" inputMode="decimal" min="0" step="0.01" value={debtForm.minimumPayment} onChange={onDebtChange} placeholder="0.00" />
            <Select label="Payment method" name="paymentMethod" value={debtForm.paymentMethod} onChange={onDebtChange} options={PAYMENT_METHOD_OPTIONS} />
          </div>
          <div className="flex gap-3">
            <ActionButton busy={debtBusy} className="flex-1">
              {editingDebtId ? "Save changes" : "Add debt"}
            </ActionButton>
            {editingDebtId && (
              <button type="button" className="hb-button-secondary rounded-xl px-4 py-2 text-sm font-medium" onClick={onCancelDebtEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
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
