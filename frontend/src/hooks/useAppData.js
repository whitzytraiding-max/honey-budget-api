import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api.js";
import { initPurchases } from "../lib/purchases.js";
import { getCurrentMonthKey } from "../lib/date.js";

const EMPTY_NOTIFICATIONS = { incoming: [], outgoing: [], activity: [] };

export function createCoachProfileDraft(profile) {
  return {
    primaryGoal: String(profile?.primaryGoal ?? ""),
    goalHorizon: String(profile?.goalHorizon ?? ""),
    biggestMoneyStress: String(profile?.biggestMoneyStress ?? ""),
    hardestCategory: String(profile?.hardestCategory ?? ""),
    conflictTrigger: String(profile?.conflictTrigger ?? ""),
    coachingFocus: String(profile?.coachingFocus ?? ""),
    notes: String(profile?.notes ?? ""),
    monthlyBudgetTarget: profile?.monthlyBudgetTarget != null ? String(profile.monthlyBudgetTarget) : "",
    paySchedule: String(profile?.paySchedule ?? ""),
    personalAllowance: profile?.personalAllowance != null ? String(profile.personalAllowance) : "",
    totalDebtAmount: profile?.totalDebtAmount != null ? String(profile.totalDebtAmount) : "",
  };
}

export function createIncomeProfileDraft(user) {
  return {
    salaryCashAmount: String(user?.salaryCashAmount ?? 0),
    salaryCardAmount: String(user?.salaryCardAmount ?? user?.monthlySalary ?? 0),
    incomeCurrencyCode: String(user?.incomeCurrencyCode ?? "USD"),
    incomeDayOfMonth: String(user?.incomeDayOfMonth ?? 1),
    monthlySavingsTarget: String(user?.monthlySavingsTarget ?? 0),
  };
}

export function useAppData({
  token,
  route,
  navigate,
  onUnauthorized,
  currencyCode,
  baseCurrencyCode,
  soloMode,
  setSoloMode,
}) {
  // Keep onUnauthorized ref fresh so the effect always calls the latest version
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => { onUnauthorizedRef.current = onUnauthorized; });

  const [session, setSession] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [insightData, setInsightData] = useState(null);
  const [savingsData, setSavingsData] = useState(null);
  const [plannerData, setPlannerData] = useState(null);
  const [notificationsData, setNotificationsData] = useState({ ...EMPTY_NOTIFICATIONS });
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [monthSummary, setMonthSummary] = useState(null);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [coachProfile, setCoachProfile] = useState(null);
  const [coachProfileForm, setCoachProfileForm] = useState(() => createCoachProfileDraft(null));
  const [incomeProfileForm, setIncomeProfileForm] = useState(() => createIncomeProfileDraft(null));
  const [householdIncome, setHouseholdIncome] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [pageError, setPageError] = useState("");
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [suppressNextInsightsError, setSuppressNextInsightsError] = useState(false);

  function calculateRemaining(income, expenses) {
    setRemainingBudget(Number((Number(income || 0) - Number(expenses || 0)).toFixed(2)));
  }

  async function fetchHouseholdData() {
    const data = await apiFetch("/api/auth/me");
    setSession(data);

    const partner = data.couple
      ? data.couple.userOne.id === data.user.id ? data.couple.userTwo : data.couple.userOne
      : null;

    setHouseholdIncome(Number(data.user?.monthlySalary || 0) + Number(partner?.monthlySalary || 0));
    setIncomeProfileForm(createIncomeProfileDraft(data.user));
    setCoachProfile(data.coachProfile ?? null);
    setCoachProfileForm(createCoachProfileDraft(data.coachProfile));
    setPlannerData((prev) =>
      prev ? { ...prev, setupChecklist: data.setupChecklist ?? prev.setupChecklist ?? [] } : prev,
    );
    setNotificationsData(data.notifications ?? { ...EMPTY_NOTIFICATIONS });
    setNotificationsLoaded(true);
    return data;
  }

  async function loadDashboard() {
    setDashboardBusy(true);
    setPageError("");
    const url = `/api/dashboard?displayCurrency=${encodeURIComponent(currencyCode)}`;
    try {
      setDashboardData(await apiFetch(url));
    } catch (firstErr) {
      const isNetwork = firstErr instanceof TypeError || firstErr.message === "Failed to fetch";
      if (isNetwork) {
        setPageError("Connecting to server…");
        await new Promise((r) => setTimeout(r, 8000));
        try {
          setDashboardData(await apiFetch(url));
          setPageError("");
          return;
        } catch { /* fall through */ }
      }
      setDashboardData(null);
      setPageError("Couldn't connect to the server. Please tap Retry.");
    } finally {
      setDashboardBusy(false);
    }
  }

  async function loadSummary() {
    try {
      const data = await apiFetch(`/api/summary?displayCurrency=${encodeURIComponent(currencyCode)}`);
      setSummaryData(data);
      setHouseholdIncome(Number(data.householdIncome || 0));
      calculateRemaining(data.householdIncome, data.totalExpenses);
    } catch (err) {
      setSummaryData(null);
      calculateRemaining(householdIncome, 0);
      const isNetwork = err instanceof TypeError || err.message === "Failed to fetch";
      if (!isNetwork) setPageError(err.message);
    }
  }

  async function loadInsights({ suppressError = false } = {}) {
    setInsightsBusy(true);
    try {
      const data = await apiFetch(`/api/insights?displayCurrency=${encodeURIComponent(currencyCode)}`);
      setInsightData(data);
      return data;
    } catch (err) {
      setInsightData(null);
      if (!suppressError) setPageError(err.message);
      return null;
    } finally {
      setInsightsBusy(false);
    }
  }

  async function loadSavings() {
    try {
      const data = await apiFetch(`/api/savings?displayCurrency=${encodeURIComponent(currencyCode)}`);
      setSavingsData(data);
      return data;
    } catch (err) {
      setSavingsData(null);
      setPageError(err.message);
      return null;
    }
  }

  async function loadPlanner() {
    if (!session?.couple && !soloMode) { setPlannerData(null); return; }
    setPlannerBusy(true);
    try {
      const data = await apiFetch(`/api/planner?displayCurrency=${encodeURIComponent(currencyCode)}`);
      setPlannerData(data);
    } catch (err) {
      setPlannerData(null);
      setPageError(err.message);
    } finally {
      setPlannerBusy(false);
    }
  }

  async function loadNotifications() {
    setNotificationsBusy(true);
    try {
      const data = await apiFetch("/api/notifications");
      setNotificationsData(data);
      setNotificationsLoaded(true);
    } catch (err) {
      console.error("Notifications load failed:", err);
      setNotificationsData({ ...EMPTY_NOTIFICATIONS });
      setNotificationsLoaded(false);
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function loadMonthView(monthKey) {
    try {
      const [summary, txRes] = await Promise.all([
        apiFetch(`/api/summary?month=${encodeURIComponent(monthKey)}&displayCurrency=${encodeURIComponent(currencyCode)}`),
        apiFetch(`/api/transactions?month=${encodeURIComponent(monthKey)}&displayCurrency=${encodeURIComponent(currencyCode)}`),
      ]);
      setMonthSummary(summary);
      setMonthTransactions(txRes.transactions ?? []);
    } catch (err) {
      setMonthSummary(null);
      setMonthTransactions([]);
      setPageError(err.message);
    }
  }

  async function refreshBudgetViews({
    monthKey = selectedMonth,
    includeMonth = route === "calendar" || route === "history" || Boolean(monthSummary),
    includeInsights = Boolean((route === "insights" || insightData) && coachProfile?.completed),
    includeSavings = Boolean(route === "savings" || savingsData),
    includeNotifications = notificationsLoaded,
    includePlanner = Boolean(route === "planner" || route === "setup" || plannerData),
  } = {}) {
    setPageError("");
    const tasks = [loadDashboard(), loadSummary()];
    if (includeMonth) tasks.push(loadMonthView(monthKey));
    if (includeInsights) tasks.push(loadInsights());
    if (includeSavings) tasks.push(loadSavings());
    if (includeNotifications) tasks.push(loadNotifications());
    if (includePlanner) tasks.push(loadPlanner());
    await Promise.all(tasks);
  }

  async function refreshDashboardBundle() {
    const me = await fetchHouseholdData();
    initPurchases(me.user.id).catch(() => {});
    const isSolo = !me.couple && soloMode;
    if (me.couple || isSolo) {
      await refreshBudgetViews({
        includeMonth: false, includeInsights: false,
        includeSavings: false, includeNotifications: false,
      });
    } else {
      resetCoupleData();
    }
    return me;
  }

  function resetAll() {
    setSession(null);
    setDashboardData(null);
    setInsightData(null);
    setSummaryData(null);
    setSavingsData(null);
    setPlannerData(null);
    setCoachProfile(null);
    setCoachProfileForm(createCoachProfileDraft(null));
    setMonthSummary(null);
    setMonthTransactions([]);
    setHouseholdIncome(0);
    setNotificationsData({ ...EMPTY_NOTIFICATIONS });
    setNotificationsLoaded(false);
    setRemainingBudget(0);
  }

  function resetCoupleData() {
    setDashboardData(null);
    setInsightData(null);
    setSummaryData(null);
    setSavingsData(null);
    setPlannerData(null);
    setCoachProfile(null);
    setCoachProfileForm(createCoachProfileDraft(null));
    setMonthSummary(null);
    setMonthTransactions([]);
    setRemainingBudget(0);
  }

  // Bootstrap on login
  useEffect(() => {
    if (!token) return;
    refreshDashboardBundle().catch((err) => {
      if (err.status === 401) {
        onUnauthorizedRef.current?.();
      } else {
        setPageError("Couldn't connect to the server. Please refresh the page.");
      }
    });
  }, [token]);

  // Load data lazily on route change
  useEffect(() => {
    if (!token) return;
    if (route === "notifications" && !notificationsBusy && !notificationsLoaded) {
      loadNotifications().catch(() => {});
    }
    if (!session?.couple && !soloMode) return;
    if (!coachProfile?.completed && route === "insights") return;
    if (route === "insights" && !insightData && !insightsBusy) {
      loadInsights({ suppressError: suppressNextInsightsError })
        .finally(() => { if (suppressNextInsightsError) setSuppressNextInsightsError(false); })
        .catch((err) => setPageError(err.message));
    }
    if (route === "savings" && !savingsData) loadSavings().catch((err) => setPageError(err.message));
    if (session?.couple && (route === "planner" || route === "setup") && !plannerData && !plannerBusy) {
      loadPlanner().catch((err) => setPageError(err.message));
    }
  }, [token, route, session?.couple?.id, insightData, insightsBusy, savingsData, plannerData, plannerBusy, coachProfile?.completed, notificationsBusy, notificationsLoaded]);

  // Calendar / history
  useEffect(() => {
    if (!token || (!session?.couple && !soloMode)) return;
    if (route !== "calendar" && route !== "history") return;
    loadMonthView(selectedMonth).catch((err) => setPageError(err.message));
  }, [token, route, selectedMonth, session?.couple?.id, soloMode, currencyCode]);

  return {
    session, setSession,
    dashboardData, summaryData, insightData, savingsData, setSavingsData,
    plannerData, notificationsData, setNotificationsData, notificationsLoaded, setNotificationsLoaded,
    monthSummary, monthTransactions, selectedMonth, setSelectedMonth,
    coachProfile, setCoachProfile, coachProfileForm, setCoachProfileForm,
    incomeProfileForm, setIncomeProfileForm,
    householdIncome, setHouseholdIncome, remainingBudget,
    pageError, setPageError,
    dashboardBusy, insightsBusy, plannerBusy, notificationsBusy, setNotificationsBusy,
    suppressNextInsightsError, setSuppressNextInsightsError,
    fetchHouseholdData,
    loadDashboard, loadSummary, loadInsights, loadSavings, loadPlanner,
    loadNotifications, loadMonthView,
    refreshBudgetViews, refreshDashboardBundle,
    resetAll, resetCoupleData,
  };
}
