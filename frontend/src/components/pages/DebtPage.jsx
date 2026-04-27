/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { CreditCard, Pencil, Trash2, X } from "lucide-react";
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
  const color = clamped >= 100 ? "bg-emerald-500" : clamped >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
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
    <div className={`hb-surface-card rounded-2xl p-5 ${isPaidOff ? "opacity-75" : ""}`}>
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
          <p className="mt-0.5 text-xs text-slate-500">
            {debt.currencyCode} {debt.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining
            {" · "}
            {paidPct.toFixed(0)}% paid off
          </p>
        </div>
        {isOwn && (
          <div className="flex shrink-0 gap-1">
            <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" type="button" onClick={() => onEdit(debt)} aria-label="Edit debt">
              <Pencil className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-500" type="button" onClick={() => onDelete(debt)} aria-label="Delete debt">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <ProgressBar pct={paidPct} />

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{debt.currencyCode} {debt.originalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} original</span>
        {estimatedMonths && !isPaidOff && (
          <span>~{estimatedMonths} month{estimatedMonths !== 1 ? "s" : ""} at min payment</span>
        )}
      </div>

      {!isPaidOff && (
        <button
          className="mt-4 w-full rounded-xl bg-amber-50 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
          type="button"
          onClick={() => onPay(debt.id)}
        >
          Log payment
        </button>
      )}

      {isPayingThis && (
        <form className="mt-4 space-y-3 border-t border-slate-100 pt-4" onSubmit={onPaymentSubmit}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Log a payment</p>
            <button type="button" onClick={onClosePayment} className="text-slate-500 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={paymentForm.amount} onChange={onPaymentChange} placeholder="0.00" required />
            <Input label="Date" name="date" type="date" value={paymentForm.date} onChange={onPaymentChange} required />
          </div>
          <Input label="Note (optional)" name="note" value={paymentForm.note} onChange={onPaymentChange} placeholder="e.g. January payment" />
          <Select label="Payment method" name="paymentMethod" value={paymentForm.paymentMethod} onChange={onPaymentChange} options={PAYMENT_METHOD_OPTIONS} />
          <ActionButton busy={debtBusy} className="w-full">Save payment</ActionButton>
        </form>
      )}

      {debt.payments.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Payment history</p>
          {debt.payments.slice(0, 5).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">{payment.note || "Payment"}</p>
                <p className="text-xs text-slate-500">{payment.date}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-rose-600">
                  -{debt.currencyCode} {Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {payment.userId === currentUserId && (
                  <button className="text-slate-500 transition hover:text-rose-500" type="button" onClick={() => onDeletePayment(debt, payment)} aria-label="Delete payment">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DebtPage({
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

  return (
    <div className="space-y-6">
      {/* Summary */}
      {activeDebts.length > 0 && (
        <div className="hb-hero-panel rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-500">Total remaining debt</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-700">
            {baseCurrencyCode} {totalOwed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">{activeDebts.length} active debt{activeDebts.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* Add / Edit debt form */}
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

      {/* Active debts */}
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

      {/* Paid off debts */}
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
          body="Add a debt above to start tracking your payoff progress. Each payment will automatically deduct from your monthly budget."
          icon={<CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-500" />}
        />
      )}
    </div>
  );
}
