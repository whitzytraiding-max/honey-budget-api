/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import ExpensesPage from "./components/pages/ExpensesPage.jsx";
import CalendarPage from "./components/pages/CalendarPage.jsx";
import HistoryPage from "./components/pages/HistoryPage.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import InsightsPage from "./components/pages/InsightsPage.jsx";
import MorePage from "./components/pages/MorePage.jsx";
import NotificationsPage from "./components/pages/NotificationsPage.jsx";
import SavingsPage from "./components/pages/SavingsPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import { ActionButton, EmptyState } from "./components/ui.jsx";

const REGISTER_FIELDS = {
  name: "",
  email: "",
  password: "",
  monthlySalary: "",
  salaryPaymentMethod: "card",
};

const LOGIN_FIELDS = {
  email: "",
  password: "",
};

const FORGOT_PASSWORD_FIELDS = {
  email: "",
};

const RESET_PASSWORD_FIELDS = {
  password: "",
  confirmPassword: "",
};

const TRANSACTION_FIELDS = {
  amount: "",
  description: "",
  category: "Dining",
  type: "one-time",
  paymentMethod: "card",
  date: new Date().toISOString().slice(0, 10),
};

const APP_ROUTES = new Set([
  "home",
  "expenses",
  "savings",
  "more",
  "notifications",
  "calendar",
  "insights",
  "history",
  "settings",
  "reset-password",
]);

const SAVINGS_FIELDS = {
  amount: "",
  note: "",
  date: new Date().toISOString().slice(0, 10),
};
const REGISTER_BOOTSTRAP_ERROR =
  "Your account was created, but we couldn't finish signing you in. Please log in once more.";
const LOGIN_BOOTSTRAP_ERROR =
  "We couldn't finish signing you in. Please try logging in again.";
const IS_PRODUCTION_BUILD = import.meta.env.PROD;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

if (IS_PRODUCTION_BUILD && !API_BASE_URL) {
  console.error("VITE_API_BASE_URL is required in production.");
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getHashLocation() {
  if (typeof window === "undefined") {
    return {
      route: "home",
      query: "",
    };
  }

  const normalizedHash = window.location.hash.replace(/^#\/?/, "").trim();
  const [rawRoute, query = ""] = normalizedHash.split("?");
  const normalizedRoute = rawRoute.trim().toLowerCase();

  return {
    route: APP_ROUTES.has(normalizedRoute) ? normalizedRoute : "home",
    query,
  };
}

function setRouteHash(route) {
  if (typeof window === "undefined") {
    return;
  }

  const nextHash = `#/${route}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

function readExpenseDraft(formElement) {
  const formData = new FormData(formElement);

  return {
    amount: String(formData.get("amount") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    category: String(formData.get("category") ?? "Dining"),
    type: String(formData.get("type") ?? "one-time"),
    paymentMethod: String(formData.get("paymentMethod") ?? "card"),
    date: String(formData.get("date") ?? "").trim(),
  };
}

function createIncomeProfileDraft(user) {
  return {
    salaryCashAmount: String(user?.salaryCashAmount ?? 0),
    salaryCardAmount: String(user?.salaryCardAmount ?? user?.monthlySalary ?? 0),
    incomeDayOfMonth: String(user?.incomeDayOfMonth ?? 1),
    monthlySavingsTarget: String(user?.monthlySavingsTarget ?? 0),
  };
}

async function apiFetch(path, options = {}) {
  if (!path.startsWith("http") && !API_BASE_URL) {
    if (IS_PRODUCTION_BUILD) {
      throw new Error("VITE_API_BASE_URL is required in production.");
    }

    console.warn(
      "VITE_API_BASE_URL is not set. Falling back to same-origin API requests.",
    );
  }

  const requestUrl = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(requestUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Request failed.");
  }

  return data.data;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("budget_token") || "");
  const [hashLocation, setHashLocation] = useState(() => getHashLocation());
  const [authMode, setAuthMode] = useState("register");
  const [registerForm, setRegisterForm] = useState(REGISTER_FIELDS);
  const [loginForm, setLoginForm] = useState(LOGIN_FIELDS);
  const [forgotPasswordForm, setForgotPasswordForm] = useState(FORGOT_PASSWORD_FIELDS);
  const [resetPasswordForm, setResetPasswordForm] = useState(RESET_PASSWORD_FIELDS);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [expenseForm, setExpenseForm] = useState(TRANSACTION_FIELDS);
  const [session, setSession] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [insightData, setInsightData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [incomeProfileForm, setIncomeProfileForm] = useState(() =>
    createIncomeProfileDraft(null),
  );
  const [pageError, setPageError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [previewResetUrl, setPreviewResetUrl] = useState("");
  const [postAuthFailureMessage, setPostAuthFailureMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [incomeProfileBusy, setIncomeProfileBusy] = useState(false);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const [savingsTargetBusy, setSavingsTargetBusy] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [householdIncome, setHouseholdIncome] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [savingsData, setSavingsData] = useState(null);
  const [notificationsData, setNotificationsData] = useState({
    incoming: [],
    outgoing: [],
  });
  const [savingsForm, setSavingsForm] = useState(SAVINGS_FIELDS);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [monthSummary, setMonthSummary] = useState(null);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const route = hashLocation.route;
  const resetToken = useMemo(() => {
    return new URLSearchParams(hashLocation.query).get("token")?.trim() || "";
  }, [hashLocation.query]);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncRoute = () => {
      setHashLocation(getHashLocation());
    };

    if (!window.location.hash) {
      setRouteHash("home");
    }

    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (token) {
      return;
    }

    if (route === "reset-password") {
      setAuthMode("reset");
      return;
    }

    setAuthMode((current) => (current === "reset" ? "login" : current));
  }, [route, token]);

  async function fetchHouseholdData() {
    const data = await apiFetch("/api/auth/me", {
      headers: authHeaders,
    });
    setSession(data);

    const partner = data.couple
      ? data.couple.userOne.id === data.user.id
        ? data.couple.userTwo
        : data.couple.userOne
      : null;

    setHouseholdIncome(
      Number(data.user?.monthlySalary || 0) + Number(partner?.monthlySalary || 0),
    );
    setIncomeProfileForm(createIncomeProfileDraft(data.user));
    setNotificationsData(
      data.notifications ?? {
        incoming: [],
        outgoing: [],
      },
    );

    return data;
  }

  function calculateRemaining(totalIncome, totalExpenses) {
    const nextRemaining = Number(totalIncome || 0) - Number(totalExpenses || 0);
    setRemainingBudget(Number(nextRemaining.toFixed(2)));
  }

  async function loadDashboard() {
    setDashboardBusy(true);
    setPageError("");

    try {
      const data = await apiFetch("/api/dashboard", {
        headers: authHeaders,
      });
      setDashboardData(data);
    } catch (error) {
      setDashboardData(null);
      setPageError(error.message);
    } finally {
      setDashboardBusy(false);
    }
  }

  async function loadInsights() {
    setInsightsBusy(true);

    try {
      const data = await apiFetch("/api/insights", {
        headers: authHeaders,
      });
      setInsightData(data);
    } catch (error) {
      setInsightData(null);
      setPageError(error.message);
    } finally {
      setInsightsBusy(false);
    }
  }

  async function loadSummary() {
    try {
      const data = await apiFetch("/api/summary", {
        headers: authHeaders,
      });
      setSummaryData(data);
      setHouseholdIncome(Number(data.householdIncome || 0));
      calculateRemaining(data.householdIncome, data.totalExpenses);
    } catch (error) {
      setSummaryData(null);
      calculateRemaining(householdIncome, 0);
      setPageError(error.message);
    }
  }

  async function loadMonthView(monthKey) {
    try {
      const [summary, transactionsResponse] = await Promise.all([
        apiFetch(`/api/summary?month=${encodeURIComponent(monthKey)}`, {
          headers: authHeaders,
        }),
        apiFetch(`/api/transactions?month=${encodeURIComponent(monthKey)}`, {
          headers: authHeaders,
        }),
      ]);
      setMonthSummary(summary);
      setMonthTransactions(transactionsResponse.transactions ?? []);
    } catch (error) {
      setMonthSummary(null);
      setMonthTransactions([]);
      setPageError(error.message);
    }
  }

  async function loadSavings() {
    try {
      const data = await apiFetch("/api/savings", {
        headers: authHeaders,
      });
      setSavingsData(data);
    } catch (error) {
      setSavingsData(null);
      setPageError(error.message);
    }
  }

  async function loadNotifications() {
    setNotificationsBusy(true);

    try {
      const data = await apiFetch("/api/notifications", {
        headers: authHeaders,
      });
      setNotificationsData(data);
    } catch (error) {
      setNotificationsData({
        incoming: [],
        outgoing: [],
      });
      setPageError(error.message);
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function refreshDashboardBundle() {
    const me = await fetchHouseholdData();

    if (me.couple) {
      await Promise.all([
        loadDashboard(),
        loadSummary(),
      ]);
    } else {
      setDashboardData(null);
      setInsightData(null);
      setSummaryData(null);
      setSavingsData(null);
      setMonthSummary(null);
      setMonthTransactions([]);
      setRemainingBudget(0);
    }

    setPostAuthFailureMessage("");
    setAuthInfo("");
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    refreshDashboardBundle().catch((error) => {
      setAuthError(postAuthFailureMessage || error.message);
      setAuthInfo("");
      setPreviewResetUrl("");
      setPageError("");
      localStorage.removeItem("budget_token");
      setToken("");
      setSession(null);
      setDashboardData(null);
      setInsightData(null);
      setSummaryData(null);
      setMonthSummary(null);
      setMonthTransactions([]);
      setSavingsData(null);
      setNotificationsData({
        incoming: [],
        outgoing: [],
      });
    });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (route === "notifications" && !notificationsBusy) {
      loadNotifications().catch((error) => {
        setPageError(error.message);
      });
    }

    if (!session?.couple) {
      return;
    }

    if (route === "insights" && !insightData && !insightsBusy) {
      loadInsights().catch((error) => {
        setPageError(error.message);
      });
    }

    if (route === "savings" && !savingsData) {
      loadSavings().catch((error) => {
        setPageError(error.message);
      });
    }
  }, [
    token,
    route,
    session?.couple?.id,
    selectedMonth,
    insightData,
    insightsBusy,
    savingsData,
    notificationsBusy,
  ]);

  useEffect(() => {
    if (!token || !session?.couple) {
      return;
    }

    if (route !== "calendar" && route !== "history") {
      return;
    }

    loadMonthView(selectedMonth).catch((error) => {
      setPageError(error.message);
    });
  }, [token, route, selectedMonth, session?.couple?.id]);

  function navigate(routeKey) {
    setHashLocation({ route: routeKey, query: "" });
    setRouteHash(routeKey);
  }

  function updateAuthMode(nextMode) {
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");
    setPostAuthFailureMessage("");
    setAuthMode(nextMode);

    if (nextMode === "login" && route === "reset-password") {
      navigate("home");
    }
  }

  function updateRegisterForm(event) {
    setRegisterForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateLoginForm(event) {
    setAuthError("");
    setAuthInfo("");
    setLoginForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateForgotPasswordForm(event) {
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");
    setForgotPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateResetPasswordForm(event) {
    setAuthError("");
    setAuthInfo("");
    setResetPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateExpenseForm(event) {
    setPageError("");
    setExpenseForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateIncomeProfileForm(event) {
    setPageError("");
    setIncomeProfileForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateSavingsForm(event) {
    setPageError("");
    setSavingsForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");
    setPostAuthFailureMessage("");

    const normalizedEmail = registerForm.email.trim().toLowerCase();

    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...registerForm,
          email: normalizedEmail,
          monthlySalary: Number(registerForm.monthlySalary),
        }),
      });

      setPostAuthFailureMessage(REGISTER_BOOTSTRAP_ERROR);
      setLoginForm({
        email: normalizedEmail,
        password: registerForm.password,
      });
      setAuthMode("login");
      localStorage.setItem("budget_token", data.accessToken);
      setToken(data.accessToken);
      setRegisterForm(REGISTER_FIELDS);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");
    setPostAuthFailureMessage("");

    const normalizedEmail = loginForm.email.trim().toLowerCase();

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          ...loginForm,
          email: normalizedEmail,
        }),
      });

      setPostAuthFailureMessage(LOGIN_BOOTSTRAP_ERROR);
      localStorage.setItem("budget_token", data.accessToken);
      setToken(data.accessToken);
      setLoginForm(LOGIN_FIELDS);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");

    const normalizedEmail = forgotPasswordForm.email.trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError("Enter your email address.");
      setAuthBusy(false);
      return;
    }

    try {
      const data = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      setAuthInfo(data.message || "If that email exists, we sent a reset link.");
      setPreviewResetUrl(data.previewResetUrl || "");
      setForgotPasswordForm(FORGOT_PASSWORD_FIELDS);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthInfo("");

    if (!resetToken) {
      setAuthError("This reset link is missing its token.");
      setAuthBusy(false);
      return;
    }

    if (!resetPasswordForm.password || resetPasswordForm.password.length < 8) {
      setAuthError("Enter a new password with at least 8 characters.");
      setAuthBusy(false);
      return;
    }

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setAuthError("The passwords do not match.");
      setAuthBusy(false);
      return;
    }

    try {
      const data = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: resetToken,
          password: resetPasswordForm.password,
        }),
      });

      localStorage.setItem("budget_token", data.accessToken);
      setToken(data.accessToken);
      setResetPasswordForm(RESET_PASSWORD_FIELDS);
      setAuthMode("login");
      navigate("home");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLinkPartner(event) {
    event.preventDefault();
    setLinkBusy(true);
    setPageError("");

    const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();

    if (!normalizedPartnerEmail) {
      setPageError("Enter your partner's email address.");
      setLinkBusy(false);
      return;
    }

    try {
      await apiFetch("/api/couples/link", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partnerEmail: normalizedPartnerEmail,
        }),
      });

      setPartnerEmail("");
      await Promise.all([fetchHouseholdData(), loadNotifications()]);
      navigate("notifications");
    } catch (error) {
      setPageError(error.message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleInviteResponse(inviteId, action) {
    setNotificationsBusy(true);
    setPageError("");

    try {
      await apiFetch(`/api/couples/invites/${inviteId}/respond`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      await Promise.all([refreshDashboardBundle(), loadNotifications()]);

      if (action === "accept") {
        navigate("home");
      }
    } catch (error) {
      setPageError(error.message);
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function handleIncomeProfileSubmit(event) {
    event.preventDefault();
    setIncomeProfileBusy(true);
    setPageError("");

    const nextCashAmount = Number.parseFloat(incomeProfileForm.salaryCashAmount);
    const nextCardAmount = Number.parseFloat(incomeProfileForm.salaryCardAmount);
    const nextIncomeDay = Number.parseInt(incomeProfileForm.incomeDayOfMonth, 10);

    if (!Number.isFinite(nextCashAmount) || nextCashAmount < 0) {
      setPageError("Enter a valid cash income amount.");
      setIncomeProfileBusy(false);
      return;
    }

    if (!Number.isFinite(nextCardAmount) || nextCardAmount < 0) {
      setPageError("Enter a valid card income amount.");
      setIncomeProfileBusy(false);
      return;
    }

    if (!Number.isInteger(nextIncomeDay) || nextIncomeDay < 1 || nextIncomeDay > 28) {
      setPageError("Choose an income day between 1 and 28.");
      setIncomeProfileBusy(false);
      return;
    }

    try {
      await apiFetch("/api/profile/income", {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salaryCashAmount: nextCashAmount,
          salaryCardAmount: nextCardAmount,
          incomeDayOfMonth: nextIncomeDay,
          monthlySavingsTarget: Number.parseFloat(incomeProfileForm.monthlySavingsTarget || 0),
        }),
      });

      await refreshDashboardBundle();
    } catch (error) {
      setPageError(error.message);
    } finally {
      setIncomeProfileBusy(false);
    }
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    setExpenseBusy(true);
    setPageError("");

    const nextExpenseDraft = readExpenseDraft(event.currentTarget);
    const finalAmount = Number.parseFloat(nextExpenseDraft.amount);
    const normalizedDate = nextExpenseDraft.date;
    const expenseMonthKey = normalizedDate ? normalizedDate.slice(0, 7) : getCurrentMonthKey();

    setExpenseForm({
      amount: nextExpenseDraft.amount,
      description: nextExpenseDraft.description,
      category: nextExpenseDraft.category,
      type: nextExpenseDraft.type,
      paymentMethod: nextExpenseDraft.paymentMethod,
      date: nextExpenseDraft.date,
    });

    if (!nextExpenseDraft.amount || Number.isNaN(finalAmount) || finalAmount <= 0) {
      setPageError("Enter a valid amount greater than zero.");
      setExpenseBusy(false);
      return;
    }

    if (!normalizedDate) {
      setPageError("Pick the date you spent the money.");
      setExpenseBusy(false);
      return;
    }

    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: finalAmount,
          description:
            nextExpenseDraft.description || `${nextExpenseDraft.category} expense`,
          category: nextExpenseDraft.category,
          type: nextExpenseDraft.type,
          paymentMethod: nextExpenseDraft.paymentMethod,
          date: normalizedDate,
        }),
      });

      setExpenseForm({
        ...TRANSACTION_FIELDS,
        date: new Date().toISOString().slice(0, 10),
      });
      setSelectedMonth(expenseMonthKey);
      const refreshTasks = [loadDashboard(), loadSummary()];

      if (insightData) {
        refreshTasks.push(loadInsights());
      }

      if (savingsData) {
        refreshTasks.push(loadSavings());
      }

      refreshTasks.push(loadMonthView(expenseMonthKey));

      await Promise.all(refreshTasks);
      navigate("history");
    } catch (error) {
      setPageError(error.message);
    } finally {
      setExpenseBusy(false);
    }
  }

  async function handleSavingsTargetSubmit(event) {
    event.preventDefault();
    setSavingsTargetBusy(true);
    setPageError("");

    const nextTarget = Number.parseFloat(incomeProfileForm.monthlySavingsTarget);

    if (!Number.isFinite(nextTarget) || nextTarget < 0) {
      setPageError("Enter a valid savings target.");
      setSavingsTargetBusy(false);
      return;
    }

    try {
      await apiFetch("/api/profile/income", {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salaryCashAmount: Number.parseFloat(incomeProfileForm.salaryCashAmount || 0),
          salaryCardAmount: Number.parseFloat(incomeProfileForm.salaryCardAmount || 0),
          incomeDayOfMonth: Number.parseInt(incomeProfileForm.incomeDayOfMonth || "1", 10),
          monthlySavingsTarget: nextTarget,
        }),
      });

      const refreshTasks = [fetchHouseholdData(), loadSummary(), loadSavings()];

      if (dashboardData) {
        refreshTasks.push(loadDashboard());
      }

      if (route === "calendar" || route === "history" || monthSummary) {
        refreshTasks.push(loadMonthView(selectedMonth));
      }

      await Promise.all(refreshTasks);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingsTargetBusy(false);
    }
  }

  async function handleSavingsSubmit(event) {
    event.preventDefault();
    setSavingsBusy(true);
    setPageError("");

    const amount = Number.parseFloat(savingsForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid savings amount greater than zero.");
      setSavingsBusy(false);
      return;
    }

    if (!savingsForm.note.trim()) {
      setPageError("Add a note for this savings entry.");
      setSavingsBusy(false);
      return;
    }

    if (!savingsForm.date) {
      setPageError("Pick the savings date.");
      setSavingsBusy(false);
      return;
    }

    try {
      await apiFetch("/api/savings", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          note: savingsForm.note.trim(),
          date: savingsForm.date,
        }),
      });

      setSavingsForm(SAVINGS_FIELDS);
      const refreshTasks = [loadSavings(), loadSummary()];

      if (route === "calendar" || route === "history" || monthSummary) {
        refreshTasks.push(loadMonthView(selectedMonth));
      }

      await Promise.all(refreshTasks);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingsBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("budget_token");
    setToken("");
    setSession(null);
    setDashboardData(null);
    setInsightData(null);
      setSummaryData(null);
      setSavingsData(null);
      setMonthSummary(null);
      setMonthTransactions([]);
      setHouseholdIncome(0);
    setRemainingBudget(0);
    setPageError("");
    setAuthError("");
    navigate("home");
  }

  if (!token) {
    return (
        <AuthPanel
          authMode={authMode}
          setAuthMode={updateAuthMode}
        registerForm={registerForm}
        loginForm={loginForm}
        forgotPasswordForm={forgotPasswordForm}
        resetPasswordForm={resetPasswordForm}
        onRegisterChange={updateRegisterForm}
        onLoginChange={updateLoginForm}
        onForgotPasswordChange={updateForgotPasswordForm}
        onResetPasswordChange={updateResetPasswordForm}
        onRegister={handleRegister}
        onLogin={handleLogin}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        isSubmitting={authBusy}
        error={authError}
        info={authInfo}
        previewResetUrl={previewResetUrl}
        resetToken={resetToken}
      />
    );
  }

  const couple = session?.couple || dashboardData?.couple;
  const dashboard = dashboardData?.dashboard;
  const insights = insightData?.insights;
  const transactions = dashboard?.transactions ?? [];
  const householdUsers = couple ? [couple.userOne, couple.userTwo] : session?.user ? [session.user] : [];
  const coupleNames = couple
    ? `${couple.userOne.name} + ${couple.userTwo.name}`
    : session?.user?.name;

  function renderCurrentPage() {
    if (!couple && route !== "settings" && route !== "more" && route !== "notifications") {
      return (
        <EmptyState
          title="Invite your partner to unlock the shared dashboard"
          body="Send an invite to your partner's email. They will need to accept it from Notifications before your accounts are linked."
          action={
            <form
              className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={handleLinkPartner}
            >
              <input
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                autoComplete="email"
                inputMode="email"
                placeholder="partner@example.com"
                type="email"
                value={partnerEmail}
                onChange={(event) => setPartnerEmail(event.target.value)}
              />
              <ActionButton busy={linkBusy} className="sm:w-auto">
                Send invite
              </ActionButton>
            </form>
          }
        />
      );
    }

    switch (route) {
      case "expenses":
        return (
          <ExpensesPage
            expenseForm={expenseForm}
            onExpenseChange={updateExpenseForm}
            onExpenseSubmit={handleExpenseSubmit}
            expenseBusy={expenseBusy}
            transactions={transactions}
          />
        );
      case "insights":
        return (
          <InsightsPage
            insightsBusy={insightsBusy}
            insights={insights}
            dashboard={dashboard}
          />
        );
      case "calendar":
        return (
          <CalendarPage
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            monthSummary={monthSummary}
            monthTransactions={monthTransactions}
            householdUsers={householdUsers}
          />
        );
      case "more":
        return <MorePage onNavigate={navigate} />;
      case "notifications":
        return (
          <NotificationsPage
            notifications={notificationsData}
            notificationsBusy={notificationsBusy}
            onRespond={handleInviteResponse}
          />
        );
      case "savings":
        return (
          <SavingsPage
            savingsData={savingsData}
            savingsForm={savingsForm}
            savingsTargetForm={incomeProfileForm}
            onSavingsChange={updateSavingsForm}
            onSavingsTargetChange={updateIncomeProfileForm}
            onSavingsSubmit={handleSavingsSubmit}
            onSavingsTargetSubmit={handleSavingsTargetSubmit}
            savingsBusy={savingsBusy}
            savingsTargetBusy={savingsTargetBusy}
          />
        );
      case "history":
        return (
          <HistoryPage
            transactions={monthTransactions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            monthSummary={monthSummary}
          />
        );
      case "settings":
        return (
          <SettingsPage
            session={session}
            incomeProfileForm={incomeProfileForm}
            onIncomeProfileChange={updateIncomeProfileForm}
            onIncomeProfileSubmit={handleIncomeProfileSubmit}
            incomeProfileBusy={incomeProfileBusy}
          />
        );
      case "home":
      default:
        return (
          <HomePage
            summaryData={summaryData}
            dashboard={dashboard}
            dashboardBusy={dashboardBusy}
          />
        );
    }
  }

  return (
    <AppShell
      route={route}
      onNavigate={navigate}
      coupleNames={coupleNames}
      remainingBudget={remainingBudget}
      onLogout={handleLogout}
      pageError={pageError}
    >
      {renderCurrentPage()}
    </AppShell>
  );
}
