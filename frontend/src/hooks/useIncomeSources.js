import { useState } from "react";
import { apiFetch } from "../lib/api.js";

const INCOME_SOURCE_FIELDS = {
  label: "",
  amount: "",
  currencyCode: "USD",
  paymentMethod: "card",
};

export function useIncomeSources({ appData }) {
  const { baseCurrencyCode, loadDashboard, loadSummary, setPageError } = appData;

  const [incomeSources, setIncomeSources] = useState(null);
  const [incomeSourceBusy, setIncomeSourceBusy] = useState(false);
  const [incomeSourceForm, setIncomeSourceForm] = useState(() => ({
    ...INCOME_SOURCE_FIELDS,
    currencyCode: baseCurrencyCode || "USD",
  }));
  const [editingIncomeSourceId, setEditingIncomeSourceId] = useState(null);

  function resetIncomeSourceEditor() {
    setEditingIncomeSourceId(null);
    setIncomeSourceForm({ ...INCOME_SOURCE_FIELDS, currencyCode: baseCurrencyCode || "USD" });
  }

  async function loadIncomeSources() {
    const data = await apiFetch("/api/income-sources");
    setIncomeSources(data?.incomeSources ?? []);
  }

  function handleIncomeSourceChange(event) {
    const { name, value } = event.target;
    setIncomeSourceForm((form) => ({ ...form, [name]: value }));
  }

  function handleEditIncomeSource(source) {
    setEditingIncomeSourceId(source.id);
    setIncomeSourceForm({
      label: String(source.label ?? ""),
      amount: String(source.amount ?? ""),
      currencyCode: String(source.currencyCode ?? baseCurrencyCode ?? "USD"),
      paymentMethod: String(source.paymentMethod ?? "card"),
    });
  }

  async function refreshBudgetHero() {
    // Income changes the month's "left to spend" — refresh the dashboard + summary.
    await Promise.all([
      loadDashboard?.().catch(() => {}),
      loadSummary?.().catch(() => {}),
    ]);
  }

  async function handleIncomeSourceSubmit(event) {
    event?.preventDefault?.();
    const label = incomeSourceForm.label.trim();
    const amount = Number.parseFloat(incomeSourceForm.amount);
    if (!label) { setPageError("Give this income a name (e.g. Freelance)."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setPageError("Enter a valid income amount."); return; }

    setIncomeSourceBusy(true);
    setPageError("");
    try {
      const url = editingIncomeSourceId ? `/api/income-sources/${editingIncomeSourceId}` : "/api/income-sources";
      await apiFetch(url, {
        method: editingIncomeSourceId ? "PATCH" : "POST",
        body: JSON.stringify({
          label,
          amount,
          currencyCode: incomeSourceForm.currencyCode || baseCurrencyCode || "USD",
          paymentMethod: incomeSourceForm.paymentMethod === "cash" ? "cash" : "card",
        }),
      });
      await loadIncomeSources();
      resetIncomeSourceEditor();
      await refreshBudgetHero();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setIncomeSourceBusy(false);
    }
  }

  async function handleDeleteIncomeSource(source) {
    setIncomeSourceBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/income-sources/${source.id}`, { method: "DELETE" });
      if (editingIncomeSourceId === source.id) resetIncomeSourceEditor();
      await loadIncomeSources();
      await refreshBudgetHero();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setIncomeSourceBusy(false);
    }
  }

  return {
    incomeSources,
    incomeSourceForm,
    incomeSourceBusy,
    editingIncomeSourceId,
    loadIncomeSources,
    handleIncomeSourceChange,
    handleIncomeSourceSubmit,
    handleEditIncomeSource,
    handleDeleteIncomeSource,
    cancelIncomeSourceEdit: resetIncomeSourceEditor,
  };
}
