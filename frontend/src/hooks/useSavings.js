import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { getTodayLocalIso } from "../lib/date.js";

const SAVINGS_FIELDS = { amount: "", note: "", currencyCode: "USD", savingsGoalId: "", date: "" };

function createSavingsGoalDraft(goal) {
  return {
    title: String(goal?.title ?? ""),
    targetAmount: String(goal?.targetAmount ?? ""),
    targetDate: String(goal?.targetDate ?? ""),
  };
}

export function useSavings({ appData, showConfirm }) {
  const {
    baseCurrencyCode, incomeProfileForm, loadSavings, loadSummary,
    selectedMonth, monthSummary, loadMonthView, route,
    setPageError,
  } = appData;

  const defaultCurrency = () => incomeProfileForm?.incomeCurrencyCode || baseCurrencyCode;

  const [savingsForm, setSavingsForm] = useState(() => ({
    ...SAVINGS_FIELDS, currencyCode: baseCurrencyCode, date: getTodayLocalIso(),
  }));
  const [savingsGoalForm, setSavingsGoalForm] = useState(() => createSavingsGoalDraft(null));
  const [editingSavingsGoalId, setEditingSavingsGoalId] = useState(null);
  const [editingSavingsEntryId, setEditingSavingsEntryId] = useState(null);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const [savingsTargetBusy, setSavingsTargetBusy] = useState(false);

  function updateSavingsForm(event) {
    setPageError("");
    setSavingsForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function updateSavingsGoalForm(event) {
    setPageError("");
    setSavingsGoalForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function handleEditSavingsGoal(goal) {
    setPageError("");
    setEditingSavingsGoalId(goal.id);
    setSavingsGoalForm(createSavingsGoalDraft(goal));
  }

  function resetSavingsGoalEditor() {
    setEditingSavingsGoalId(null);
    setSavingsGoalForm(createSavingsGoalDraft(null));
  }

  function handleEditSavingsEntry(entry) {
    setPageError("");
    setEditingSavingsEntryId(entry.id);
    setSavingsForm({
      amount: String(Math.abs(Number(entry.amount ?? entry.displayAmount ?? 0))),
      note: entry.note ?? "",
      currencyCode: entry.currencyCode || baseCurrencyCode,
      savingsGoalId: entry.savingsGoalId ? String(entry.savingsGoalId) : "",
      date: entry.date ?? getTodayLocalIso(),
    });
  }

  function resetSavingsEntryEditor() {
    setEditingSavingsEntryId(null);
    setSavingsForm({ ...SAVINGS_FIELDS, currencyCode: defaultCurrency(), date: getTodayLocalIso() });
  }

  async function handleSavingsGoalSubmit(event) {
    event.preventDefault();
    setSavingsTargetBusy(true);
    setPageError("");
    const amount = Number.parseFloat(savingsGoalForm.targetAmount);
    const title = savingsGoalForm.title.trim();
    if (!title) { setPageError("Enter a name for the shared savings goal."); setSavingsTargetBusy(false); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setPageError("Enter a valid savings goal amount."); setSavingsTargetBusy(false); return; }
    try {
      const url = editingSavingsGoalId ? `/api/savings/goal/${editingSavingsGoalId}` : "/api/savings/goal";
      await apiFetch(url, {
        method: editingSavingsGoalId ? "PATCH" : "POST",
        body: JSON.stringify({ title, targetAmount: amount, currencyCode: defaultCurrency(), targetDate: savingsGoalForm.targetDate || null }),
      });
      await loadSavings();
      resetSavingsGoalEditor();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setSavingsTargetBusy(false);
    }
  }

  async function handleDeleteSavingsGoal(goal) {
    if (!await showConfirm(`Delete the savings goal "${goal.title}"?`)) return;
    setSavingsTargetBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/savings/goal/${goal.id}`, { method: "DELETE" });
      if (editingSavingsGoalId === goal.id) resetSavingsGoalEditor();
      await loadSavings();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setSavingsTargetBusy(false);
    }
  }

  async function handleDeleteSavingsEntry(entry) {
    const label = entry.note && entry.note !== "Savings entry" ? entry.note : "this savings entry";
    if (!await showConfirm(`Delete ${label}?`)) return;
    setSavingsBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/savings/${entry.id}`, { method: "DELETE" });
      if (editingSavingsEntryId === entry.id) resetSavingsEntryEditor();
      await Promise.all([loadSavings(), loadSummary()]);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setSavingsBusy(false);
    }
  }

  async function handleSavingsWithdraw({ amount, note, savingsGoalId }) {
    setSavingsBusy(true);
    setPageError("");
    try {
      await apiFetch("/api/savings/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amount,
          note: note.trim() || "Transfer to current",
          currencyCode: defaultCurrency(),
          savingsGoalId: savingsGoalId || null,
        }),
      });
      await Promise.all([loadSavings(), loadSummary()]);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setSavingsBusy(false);
    }
  }

  async function handleSavingsSubmit(event) {
    event.preventDefault();
    setSavingsBusy(true);
    setPageError("");
    const amount = Number.parseFloat(savingsForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setPageError("Enter a valid savings amount greater than zero."); setSavingsBusy(false); return; }
    if (!savingsForm.date) { setPageError("Pick the savings date."); setSavingsBusy(false); return; }
    try {
      const url = editingSavingsEntryId ? `/api/savings/${editingSavingsEntryId}` : "/api/savings";
      await apiFetch(url, {
        method: editingSavingsEntryId ? "PATCH" : "POST",
        body: JSON.stringify({
          amount,
          currencyCode: savingsForm.currencyCode || baseCurrencyCode,
          savingsGoalId: savingsForm.savingsGoalId || null,
          note: savingsForm.note.trim(),
          date: savingsForm.date,
        }),
      });
      setEditingSavingsEntryId(null);
      setSavingsForm({ ...SAVINGS_FIELDS, currencyCode: defaultCurrency(), savingsGoalId: "" });
      const tasks = [loadSavings(), loadSummary()];
      if (route === "calendar" || route === "history" || monthSummary) tasks.push(loadMonthView(selectedMonth));
      await Promise.all(tasks);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setSavingsBusy(false);
    }
  }

  return {
    savingsForm,
    savingsGoalForm,
    editingSavingsGoalId,
    editingSavingsEntryId,
    savingsBusy,
    savingsTargetBusy,
    updateSavingsForm,
    updateSavingsGoalForm,
    handleEditSavingsGoal,
    resetSavingsGoalEditor,
    handleEditSavingsEntry,
    resetSavingsEntryEditor,
    handleSavingsGoalSubmit,
    handleDeleteSavingsGoal,
    handleDeleteSavingsEntry,
    handleSavingsWithdraw,
    handleSavingsSubmit,
  };
}
