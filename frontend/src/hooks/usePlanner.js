import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { getTodayLocalIso } from "../lib/date.js";

const RECURRING_BILL_FIELDS = {
  title: "", amount: "", currencyCode: "USD", category: "Housing",
  paymentMethod: "card", dayOfMonth: "1", notes: "", paidBy: "joint",
  autoCreate: true, startDate: "", endDate: "",
};

const HOUSEHOLD_RULE_FIELDS = { title: "", details: "", thresholdAmount: "", currencyCode: "USD" };

function createRecurringBillDraft(bill, fallbackCurrency = "USD") {
  return {
    title: String(bill?.title ?? ""),
    amount: String(bill?.amount ?? ""),
    currencyCode: String(bill?.currencyCode ?? fallbackCurrency),
    category: String(bill?.category ?? "Housing"),
    paymentMethod: String(bill?.paymentMethod ?? "card"),
    dayOfMonth: String(bill?.dayOfMonth ?? 1),
    notes: String(bill?.notes ?? ""),
    paidBy: String(bill?.paidBy ?? "joint"),
    autoCreate: bill?.autoCreate ?? true,
    startDate: String(bill?.startDate ?? getTodayLocalIso()),
    endDate: String(bill?.endDate ?? ""),
  };
}

function createHouseholdRuleDraft(rule, fallbackCurrency = "USD") {
  return {
    title: String(rule?.title ?? ""),
    details: String(rule?.details ?? ""),
    thresholdAmount: rule?.thresholdAmount == null ? "" : String(rule.thresholdAmount),
    currencyCode: String(rule?.currencyCode ?? fallbackCurrency),
  };
}

export function usePlanner({ appData, showConfirm, route }) {
  const { baseCurrencyCode, loadPlanner, refreshBudgetViews, setPageError } = appData;

  const [recurringBillForm, setRecurringBillForm] = useState(() => createRecurringBillDraft(null, baseCurrencyCode));
  const [editingRecurringBillId, setEditingRecurringBillId] = useState(null);
  const [recurringBillBusy, setRecurringBillBusy] = useState(false);

  const [householdRuleForm, setHouseholdRuleForm] = useState(() => createHouseholdRuleDraft(null, baseCurrencyCode));
  const [editingHouseholdRuleId, setEditingHouseholdRuleId] = useState(null);
  const [householdRuleBusy, setHouseholdRuleBusy] = useState(false);

  function updateRecurringBillForm(event) {
    const { name, type, checked, value } = event.target;
    setPageError("");
    setRecurringBillForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function updateHouseholdRuleForm(event) {
    setPageError("");
    setHouseholdRuleForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function resetRecurringBillEditor() {
    setEditingRecurringBillId(null);
    setRecurringBillForm(createRecurringBillDraft(null, baseCurrencyCode));
  }

  function resetHouseholdRuleEditor() {
    setEditingHouseholdRuleId(null);
    setHouseholdRuleForm(createHouseholdRuleDraft(null, baseCurrencyCode));
  }

  function handleEditRecurringBill(bill) {
    setPageError("");
    setEditingRecurringBillId(bill.id);
    setRecurringBillForm(createRecurringBillDraft(bill, baseCurrencyCode));
  }

  function handleEditHouseholdRule(rule) {
    setPageError("");
    setEditingHouseholdRuleId(rule.id);
    setHouseholdRuleForm(createHouseholdRuleDraft(rule, baseCurrencyCode));
  }

  async function handleRecurringBillSubmit(event) {
    event.preventDefault();
    setRecurringBillBusy(true);
    setPageError("");
    const amount = Number.parseFloat(recurringBillForm.amount);
    const dayOfMonth = Number.parseInt(recurringBillForm.dayOfMonth, 10);

    if (!recurringBillForm.title.trim()) { setPageError("Enter a recurring bill name."); setRecurringBillBusy(false); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setPageError("Enter a valid recurring bill amount."); setRecurringBillBusy(false); return; }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) { setPageError("Choose a bill day between 1 and 28."); setRecurringBillBusy(false); return; }
    if (!recurringBillForm.startDate) { setPageError("Pick the bill start date."); setRecurringBillBusy(false); return; }

    try {
      const url = editingRecurringBillId ? `/api/recurring-bills/${editingRecurringBillId}` : "/api/recurring-bills";
      await apiFetch(url, {
        method: editingRecurringBillId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...recurringBillForm,
          title: recurringBillForm.title.trim(),
          amount,
          dayOfMonth,
          notes: recurringBillForm.notes.trim(),
          endDate: recurringBillForm.endDate || null,
        }),
      });
      resetRecurringBillEditor();
      await refreshBudgetViews({ includeMonth: true, includeNotifications: false, includeInsights: route === "insights" });
    } catch (err) {
      setPageError(err.message);
    } finally {
      setRecurringBillBusy(false);
    }
  }

  async function handleDeleteRecurringBill(bill) {
    if (!await showConfirm(`Delete recurring bill "${bill.title}"?`)) return;
    setRecurringBillBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/recurring-bills/${bill.id}`, { method: "DELETE" });
      if (editingRecurringBillId === bill.id) resetRecurringBillEditor();
      await refreshBudgetViews({ includeMonth: true, includeNotifications: false, includeInsights: route === "insights" });
    } catch (err) {
      setPageError(err.message);
    } finally {
      setRecurringBillBusy(false);
    }
  }

  async function handleHouseholdRuleSubmit(event) {
    event.preventDefault();
    setHouseholdRuleBusy(true);
    setPageError("");
    const threshold = householdRuleForm.thresholdAmount ? Number.parseFloat(householdRuleForm.thresholdAmount) : null;
    if (!householdRuleForm.title.trim()) { setPageError("Enter a rule name."); setHouseholdRuleBusy(false); return; }
    if (!householdRuleForm.details.trim()) { setPageError("Add the actual rule so both partners know what it means."); setHouseholdRuleBusy(false); return; }
    if (threshold !== null && (!Number.isFinite(threshold) || threshold <= 0)) { setPageError("If you use a threshold, it must be a valid amount."); setHouseholdRuleBusy(false); return; }
    try {
      const url = editingHouseholdRuleId ? `/api/household-rules/${editingHouseholdRuleId}` : "/api/household-rules";
      await apiFetch(url, {
        method: editingHouseholdRuleId ? "PATCH" : "POST",
        body: JSON.stringify({
          title: householdRuleForm.title.trim(),
          details: householdRuleForm.details.trim(),
          thresholdAmount: threshold,
          currencyCode: householdRuleForm.currencyCode || baseCurrencyCode,
        }),
      });
      resetHouseholdRuleEditor();
      await loadPlanner();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setHouseholdRuleBusy(false);
    }
  }

  async function handleDeleteHouseholdRule(rule) {
    if (!await showConfirm(`Delete rule "${rule.title}"?`)) return;
    setHouseholdRuleBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/household-rules/${rule.id}`, { method: "DELETE" });
      if (editingHouseholdRuleId === rule.id) resetHouseholdRuleEditor();
      await loadPlanner();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setHouseholdRuleBusy(false);
    }
  }

  return {
    recurringBillForm,
    editingRecurringBillId,
    recurringBillBusy,
    householdRuleForm,
    editingHouseholdRuleId,
    householdRuleBusy,
    updateRecurringBillForm,
    updateHouseholdRuleForm,
    resetRecurringBillEditor,
    resetHouseholdRuleEditor,
    handleEditRecurringBill,
    handleEditHouseholdRule,
    handleRecurringBillSubmit,
    handleDeleteRecurringBill,
    handleHouseholdRuleSubmit,
    handleDeleteHouseholdRule,
  };
}
