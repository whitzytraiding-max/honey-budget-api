import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { getTodayLocalIso } from "../lib/date.js";

const DEBT_FIELDS = {
  title: "",
  originalAmount: "",
  currencyCode: "USD",
  minimumPayment: "",
  paymentMethod: "card",
};

const PAYMENT_FIELDS = {
  amount: "",
  date: "",
  note: "",
  paymentMethod: "card",
};

export function createDebtDraft(debt) {
  return {
    title: String(debt?.title ?? ""),
    originalAmount: String(debt?.originalAmount ?? ""),
    currencyCode: String(debt?.currencyCode ?? "USD"),
    minimumPayment: debt?.minimumPayment != null ? String(debt.minimumPayment) : "",
    paymentMethod: String(debt?.paymentMethod ?? "card"),
  };
}

export function useDebt({ appData, showConfirm }) {
  const { baseCurrencyCode, loadDashboard, loadSummary, setPageError } = appData;

  const [debtData, setDebtData] = useState(null);
  const [debtBusy, setDebtBusy] = useState(false);
  const [debtForm, setDebtForm] = useState(() => ({ ...DEBT_FIELDS, currencyCode: baseCurrencyCode }));
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [payingDebtId, setPayingDebtId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(() => ({ ...PAYMENT_FIELDS, date: getTodayLocalIso() }));

  async function loadDebts() {
    try {
      const data = await apiFetch("/api/debts");
      setDebtData(data);
      return data;
    } catch (err) {
      setDebtData(null);
      setPageError(err.message);
      return null;
    }
  }

  function updateDebtForm(event) {
    setPageError("");
    setDebtForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function updatePaymentForm(event) {
    setPageError("");
    setPaymentForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function startEditingDebt(debt) {
    setPageError("");
    setEditingDebtId(debt.id);
    setDebtForm(createDebtDraft(debt));
  }

  function resetDebtEditor() {
    setEditingDebtId(null);
    setDebtForm({ ...DEBT_FIELDS, currencyCode: baseCurrencyCode });
  }

  function openPaymentForm(debtId) {
    setPageError("");
    setPayingDebtId(debtId);
    setPaymentForm({ ...PAYMENT_FIELDS, date: getTodayLocalIso() });
  }

  function closePaymentForm() {
    setPayingDebtId(null);
    setPaymentForm({ ...PAYMENT_FIELDS, date: getTodayLocalIso() });
  }

  async function handleDebtSubmit(event) {
    event.preventDefault();
    setDebtBusy(true);
    setPageError("");

    const title = debtForm.title.trim();
    const amount = Number.parseFloat(debtForm.originalAmount);
    const minPayment = debtForm.minimumPayment ? Number.parseFloat(debtForm.minimumPayment) : null;

    if (!title) { setPageError("Enter a name for the debt."); setDebtBusy(false); return; }
    if (!editingDebtId && (!Number.isFinite(amount) || amount <= 0)) {
      setPageError("Enter the total amount owed.");
      setDebtBusy(false);
      return;
    }

    try {
      if (editingDebtId) {
        await apiFetch(`/api/debts/${editingDebtId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            minimumPayment: minPayment,
            paymentMethod: debtForm.paymentMethod,
          }),
        });
      } else {
        await apiFetch("/api/debts", {
          method: "POST",
          body: JSON.stringify({
            title,
            originalAmount: amount,
            currencyCode: debtForm.currencyCode,
            minimumPayment: minPayment,
            paymentMethod: debtForm.paymentMethod,
          }),
        });
      }
      resetDebtEditor();
      await loadDebts();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDebtBusy(false);
    }
  }

  async function handleDeleteDebt(debt) {
    if (!await showConfirm(`Delete "${debt.title}"? All payment history will be lost.`)) return;
    setDebtBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/debts/${debt.id}`, { method: "DELETE" });
      if (editingDebtId === debt.id) resetDebtEditor();
      await loadDebts();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDebtBusy(false);
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!payingDebtId) return;
    setDebtBusy(true);
    setPageError("");

    const amount = Number.parseFloat(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid payment amount.");
      setDebtBusy(false);
      return;
    }
    if (!paymentForm.date) {
      setPageError("Pick the payment date.");
      setDebtBusy(false);
      return;
    }

    try {
      await apiFetch(`/api/debts/${payingDebtId}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          date: paymentForm.date,
          note: paymentForm.note.trim(),
          paymentMethod: paymentForm.paymentMethod,
          currencyCode: baseCurrencyCode,
        }),
      });
      closePaymentForm();
      // Reload debts + budget (payment affects remaining balance)
      await Promise.all([loadDebts(), loadDashboard(), loadSummary()]);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDebtBusy(false);
    }
  }

  async function handleDeletePayment(debt, payment) {
    const label = payment.note || "this payment";
    if (!await showConfirm(`Delete ${label}? This will restore the payment to your budget and add the amount back to the debt balance.`)) return;
    setDebtBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/debts/${debt.id}/payment/${payment.id}`, { method: "DELETE" });
      await Promise.all([loadDebts(), loadDashboard(), loadSummary()]);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDebtBusy(false);
    }
  }

  return {
    debtData,
    debtBusy,
    debtForm,
    editingDebtId,
    payingDebtId,
    paymentForm,
    loadDebts,
    updateDebtForm,
    updatePaymentForm,
    startEditingDebt,
    resetDebtEditor,
    openPaymentForm,
    closePaymentForm,
    handleDebtSubmit,
    handleDeleteDebt,
    handlePaymentSubmit,
    handleDeletePayment,
  };
}
