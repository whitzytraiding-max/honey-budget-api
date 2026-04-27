import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { getTodayLocalIso, getCurrentMonthKey } from "../lib/date.js";

const TRANSACTION_FIELDS = {
  amount: "", description: "", category: "Dining", currencyCode: "USD",
  type: "one-time", paymentMethod: "card", date: "", logAsUserId: "",
};

function readExpenseDraft(formEl) {
  const fd = new FormData(formEl);
  return {
    amount: String(fd.get("amount") ?? "").trim(),
    description: String(fd.get("description") ?? "").trim(),
    category: String(fd.get("category") ?? "Dining"),
    currencyCode: String(fd.get("currencyCode") ?? "USD"),
    type: String(fd.get("type") ?? "one-time"),
    paymentMethod: String(fd.get("paymentMethod") ?? "card"),
    date: String(fd.get("date") ?? "").trim(),
  };
}

export function useExpenses({ appData, showConfirm, navigate }) {
  const {
    baseCurrencyCode, currencyCode, mmkRateData, loadMmkRate,
    session, refreshBudgetViews, selectedMonth, setSelectedMonth, monthSummary, route,
    setPageError,
  } = appData;

  const [expenseForm, setExpenseForm] = useState(() => ({
    ...TRANSACTION_FIELDS,
    currencyCode: baseCurrencyCode,
    date: getTodayLocalIso(),
  }));
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState(null);

  function updateExpenseForm(event) {
    setPageError("");
    setExpenseForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function resetExpenseEditor() {
    setEditingTransactionId(null);
    setExpenseForm({ ...TRANSACTION_FIELDS, currencyCode: baseCurrencyCode, date: getTodayLocalIso() });
  }

  function handleEditTransaction(transaction) {
    setPageError("");
    setEditingTransactionId(transaction.id);
    setExpenseForm({
      amount: String(transaction.amount ?? ""),
      description: transaction.description ?? "",
      category: transaction.category ?? TRANSACTION_FIELDS.category,
      currencyCode: transaction.currencyCode ?? baseCurrencyCode,
      type: transaction.type ?? TRANSACTION_FIELDS.type,
      paymentMethod: transaction.paymentMethod ?? TRANSACTION_FIELDS.paymentMethod,
      date: transaction.date ?? getTodayLocalIso(),
    });
    navigate("expenses");
  }

  async function handleDeleteTransaction(transaction) {
    if (!await showConfirm(`Delete "${transaction.description}" from ${transaction.date}?`)) return;
    setExpenseBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
      if (editingTransactionId === transaction.id) resetExpenseEditor();
      await refreshBudgetViews({ includeMonth: true });
    } catch (err) {
      setPageError(err.message);
    } finally {
      setExpenseBusy(false);
    }
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    setExpenseBusy(true);
    setPageError("");

    const draft = readExpenseDraft(event.currentTarget);
    const amount = Number.parseFloat(draft.amount);
    const monthKey = draft.date ? draft.date.slice(0, 7) : getCurrentMonthKey();

    setExpenseForm({ amount: draft.amount, description: draft.description, category: draft.category,
      currencyCode: draft.currencyCode, type: draft.type, paymentMethod: draft.paymentMethod, date: draft.date });

    if (!draft.amount || Number.isNaN(amount) || amount <= 0) {
      setPageError("Enter a valid amount greater than zero.");
      setExpenseBusy(false);
      return;
    }
    if (!draft.date) {
      setPageError("Pick the date you spent the money.");
      setExpenseBusy(false);
      return;
    }

    try {
      const mmkInvolved = draft.currencyCode === "MMK" || currencyCode === "MMK" || baseCurrencyCode === "MMK";
      if (mmkInvolved && session?.couple) {
        const year = Number(draft.date.slice(0, 4));
        const month = Number(draft.date.slice(5, 7));
        const activeRate =
          mmkRateData?.year === year && mmkRateData?.month === month
            ? mmkRateData
            : await loadMmkRate(year, month);
        if (!activeRate?.rate?.rate) {
          setPageError(`Save an MMK monthly rate for ${String(month).padStart(2, "0")}/${year} before logging MMK-related expenses.`);
          setExpenseBusy(false);
          return;
        }
      }

      const url = editingTransactionId ? `/api/transactions/${editingTransactionId}` : "/api/transactions";
      await apiFetch(url, {
        method: editingTransactionId ? "PATCH" : "POST",
        body: JSON.stringify({
          amount,
          description: draft.description || `${draft.category} expense`,
          category: draft.category,
          currencyCode: draft.currencyCode || baseCurrencyCode,
          displayCurrencyCode: currencyCode,
          type: draft.type,
          paymentMethod: draft.paymentMethod,
          date: draft.date,
          ...(draft.logAsUserId === "joint" && !editingTransactionId
            ? { joint: true }
            : draft.logAsUserId && !editingTransactionId
              ? { logAsUserId: Number(draft.logAsUserId) }
              : {}),
        }),
      });

      resetExpenseEditor();
      setSelectedMonth(monthKey);
      await refreshBudgetViews({ monthKey, includeMonth: true, includeNotifications: true });
    } catch (err) {
      setPageError(err.message);
    } finally {
      setExpenseBusy(false);
    }
  }

  return {
    expenseForm,
    expenseBusy,
    editingTransactionId,
    updateExpenseForm,
    resetExpenseEditor,
    handleEditTransaction,
    handleDeleteTransaction,
    handleExpenseSubmit,
  };
}
