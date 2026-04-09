/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useEffect, useMemo, useState } from "react";
import { Bell, Brain, CalendarDays, ClipboardList, House, ListTodo, PiggyBank, Settings2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import AppShell from "./components/AppShell.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import CoachSetupPage from "./components/pages/CoachSetupPage.jsx";
import ExpensesPage from "./components/pages/ExpensesPage.jsx";
import CalendarPage from "./components/pages/CalendarPage.jsx";
import HistoryPage from "./components/pages/HistoryPage.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import InsightsPage from "./components/pages/InsightsPage.jsx";
import MorePage from "./components/pages/MorePage.jsx";
import NotificationsPage from "./components/pages/NotificationsPage.jsx";
import PlannerPage from "./components/pages/PlannerPage.jsx";
import SavingsPage from "./components/pages/SavingsPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import SetupFlowPage from "./components/pages/SetupFlowPage.jsx";
import PaywallPage from "./components/pages/PaywallPage.jsx";
import { ActionButton, EmptyState } from "./components/ui.jsx";
import { setCurrencyConversionPreferences } from "./lib/format.js";
import { addBackButtonListener, setStatusBarForTheme } from "./lib/native.js";
import { useLanguage } from "./i18n/LanguageProvider.jsx";

function getTodayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentLocalMonthParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

const REGISTER_FIELDS = {
  name: "",
  email: "",
  password: "",
  monthlySalary: "",
  incomeCurrencyCode: "USD",
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
  currencyCode: "USD",
  type: "one-time",
  paymentMethod: "card",
  date: getTodayLocalIso(),
};

const ALL_NAV_ITEMS = [
  { key: "home", icon: House },
  { key: "expenses", icon: Wallet },
  { key: "savings", icon: PiggyBank },
  { key: "notifications", icon: Bell },
  { key: "insights", icon: Brain },
  { key: "calendar", icon: CalendarDays },
  { key: "history", icon: ClipboardList },
  { key: "planner", icon: ShieldCheck },
  { key: "coach", icon: Sparkles },
  { key: "setup", icon: ListTodo },
  { key: "settings", icon: Settings2 },
];

const APP_ROUTES = new Set([
  "home",
  "expenses",
  "savings",
  "more",
  "planner",
  "setup",
  "coach",
  "notifications",
  "calendar",
  "insights",
  "history",
  "settings",
  "paywall",
  "reset-password",
]);

const SAVINGS_FIELDS = {
  amount: "",
  note: "",
  currencyCode: "USD",
  savingsGoalId: "",
  date: getTodayLocalIso(),
};
const EMPTY_NOTIFICATIONS = {
  incoming: [],
  outgoing: [],
  activity: [],
};
const MMK_SETTINGS_FIELDS = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  rateSource: "kbz",
  rate: "",
};
const COACH_PROFILE_FIELDS = {
  primaryGoal: "",
  goalHorizon: "",
  biggestMoneyStress: "",
  hardestCategory: "",
  conflictTrigger: "",
  coachingFocus: "",
  notes: "",
};
const RECURRING_BILL_FIELDS = {
  title: "",
  amount: "",
  currencyCode: "USD",
  category: "Housing",
  paymentMethod: "card",
  dayOfMonth: "1",
  notes: "",
  autoCreate: true,
  startDate: getTodayLocalIso(),
  endDate: "",
};
const HOUSEHOLD_RULE_FIELDS = {
  title: "",
  details: "",
  thresholdAmount: "",
  currencyCode: "USD",
};
const REGISTER_BOOTSTRAP_ERROR =
  "Your account was created, but we couldn't finish signing you in. Please log in once more.";
const LOGIN_BOOTSTRAP_ERROR =
  "We couldn't finish signing you in. Please try logging in again.";
const IS_PRODUCTION_BUILD = import.meta.env.PROD;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SUPPORTED_THEMES = new Set(["light", "dark", "system"]);
const SUPPORTED_CURRENCIES = new Set(["USD", "EUR", "GBP", "CAD", "AUD", "MMK"]);

if (IS_PRODUCTION_BUILD && !API_BASE_URL) {
  console.error("VITE_API_BASE_URL is required in production.");
}

function getCurrentMonthKey() {
  const { year, month } = getCurrentLocalMonthParts();
  return `${year}-${String(month).padStart(2, "0")}`;
}

function createDefaultMmkRateForm() {
  return {
    ...MMK_SETTINGS_FIELDS,
    ...getCurrentLocalMonthParts(),
  };
}

function createEmptyNotificationsState() {
  return {
    ...EMPTY_NOTIFICATIONS,
  };
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
    currencyCode: String(formData.get("currencyCode") ?? "USD"),
    type: String(formData.get("type") ?? "one-time"),
    paymentMethod: String(formData.get("paymentMethod") ?? "card"),
    date: String(formData.get("date") ?? "").trim(),
  };
}

function createIncomeProfileDraft(user) {
  return {
    salaryCashAmount: String(user?.salaryCashAmount ?? 0),
    salaryCardAmount: String(user?.salaryCardAmount ?? user?.monthlySalary ?? 0),
    incomeCurrencyCode: String(user?.incomeCurrencyCode ?? "USD"),
    incomeDayOfMonth: String(user?.incomeDayOfMonth ?? 1),
    monthlySavingsTarget: String(user?.monthlySavingsTarget ?? 0),
  };
}

function createSavingsGoalDraft(goal) {
  return {
    title: String(goal?.title ?? ""),
    targetAmount: String(goal?.targetAmount ?? ""),
    targetDate: String(goal?.targetDate ?? ""),
  };
}

function createCoachProfileDraft(profile) {
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

function createRecurringBillDraft(bill, fallbackCurrency = "USD") {
  return {
    title: String(bill?.title ?? ""),
    amount: String(bill?.amount ?? ""),
    currencyCode: String(bill?.currencyCode ?? fallbackCurrency),
    category: String(bill?.category ?? "Housing"),
    paymentMethod: String(bill?.paymentMethod ?? "card"),
    dayOfMonth: String(bill?.dayOfMonth ?? 1),
    notes: String(bill?.notes ?? ""),
    autoCreate: bill?.autoCreate ?? true,
    startDate: String(bill?.startDate ?? getTodayLocalIso()),
    endDate: String(bill?.endDate ?? ""),
  };
}

function createHouseholdRuleDraft(rule, fallbackCurrency = "USD") {
  return {
    title: String(rule?.title ?? ""),
    details: String(rule?.details ?? ""),
    thresholdAmount:
      rule?.thresholdAmount === null || rule?.thresholdAmount === undefined
        ? ""
        : String(rule.thresholdAmount),
    currencyCode: String(rule?.currencyCode ?? fallbackCurrency),
  };
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "system";
  }

  const savedTheme = window.localStorage.getItem("budget_theme");
  if (savedTheme && SUPPORTED_THEMES.has(savedTheme)) {
    return savedTheme;
  }

  return "system";
}

function getInitialCurrency() {
  if (typeof window === "undefined") {
    return "USD";
  }

  const savedCurrency = window.localStorage.getItem("budget_currency");
  return savedCurrency && SUPPORTED_CURRENCIES.has(savedCurrency) ? savedCurrency : "USD";
}

function getInitialBaseCurrency() {
  if (typeof window === "undefined") {
    return "USD";
  }

  const savedCurrency = window.localStorage.getItem("budget_base_currency");
  return savedCurrency && SUPPORTED_CURRENCIES.has(savedCurrency) ? savedCurrency : "USD";
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

  const { headers: optHeaders, ...restOptions } = options;
  const requestUrl = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(requestUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(optHeaders || {}),
    },
    ...restOptions,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data?.error?.message || "Request failed.");
    err.status = response.status;
    throw err;
  }

  return data.data;
}

export default function App() {
  const { locale } = useLanguage();
  const [token, setToken] = useState(() => localStorage.getItem("budget_token") || "");
  const [soloMode, setSoloMode] = useState(() => localStorage.getItem("budget_solo_mode") === "true");
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
  const [coachProfile, setCoachProfile] = useState(null);
  const [coachProfileForm, setCoachProfileForm] = useState(() =>
    createCoachProfileDraft(null),
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
  const [coachProfileBusy, setCoachProfileBusy] = useState(false);
  const [suppressNextInsightsError, setSuppressNextInsightsError] = useState(false);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const [savingsTargetBusy, setSavingsTargetBusy] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [householdIncome, setHouseholdIncome] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [savingsData, setSavingsData] = useState(null);
  const [notificationsData, setNotificationsData] = useState(createEmptyNotificationsState);
  const [savingsForm, setSavingsForm] = useState(SAVINGS_FIELDS);
  const [savingsGoalForm, setSavingsGoalForm] = useState(() => createSavingsGoalDraft(null));
  const [editingSavingsGoalId, setEditingSavingsGoalId] = useState(null);
  const [plannerData, setPlannerData] = useState(null);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [recurringBillForm, setRecurringBillForm] = useState(() =>
    createRecurringBillDraft(null),
  );
  const [editingRecurringBillId, setEditingRecurringBillId] = useState(null);
  const [recurringBillBusy, setRecurringBillBusy] = useState(false);
  const [householdRuleForm, setHouseholdRuleForm] = useState(() =>
    createHouseholdRuleDraft(null),
  );
  const [editingHouseholdRuleId, setEditingHouseholdRuleId] = useState(null);
  const [householdRuleBusy, setHouseholdRuleBusy] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [monthSummary, setMonthSummary] = useState(null);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [theme, setTheme] = useState(getInitialTheme);
  const [currencyCode, setCurrencyCode] = useState(getInitialCurrency);
  const [baseCurrencyCode, setBaseCurrencyCode] = useState(getInitialBaseCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [exchangeRateLabel, setExchangeRateLabel] = useState("");
  const [mmkRateData, setMmkRateData] = useState(null);
  const [mmkRateForm, setMmkRateForm] = useState(createDefaultMmkRateForm);
  const [mmkRateBusy, setMmkRateBusy] = useState(false);
  const [hiddenNavItems, setHiddenNavItems] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("hb-hidden-nav") || "[]"));
    } catch {
      return new Set();
    }
  });
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
    if (typeof document === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const resolvedTheme =
      theme === "system" ? (mediaQuery?.matches ? "dark" : "light") : theme;

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    window.localStorage.setItem("budget_theme", theme);

    if (theme !== "system" || !mediaQuery) {
      return undefined;
    }

    const handleThemeChange = (event) => {
      const nextTheme = event.matches ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const resolvedTheme =
      theme === "system" ? (mediaQuery?.matches ? "dark" : "light") : theme;
    setStatusBarForTheme(resolvedTheme);
  }, [theme]);

  useEffect(() => {
    const BACK_STACK = [
      "home",
      "expenses",
      "savings",
      "more",
      "notifications",
      "calendar",
      "insights",
      "history",
      "settings",
      "planner",
      "setup",
      "coach",
    ];
    const removeListener = addBackButtonListener(({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      const idx = BACK_STACK.indexOf(route);
      if (idx > 0) {
        navigate(BACK_STACK[0]);
      }
    });
    return () => {
      removeListener.then?.((fn) => fn?.());
    };
  }, [route]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("budget_currency", currencyCode);
    }
  }, [currencyCode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("budget_base_currency", baseCurrencyCode);
    }
  }, [baseCurrencyCode]);

  async function loadMmkRate(year = null, month = null) {
    if (!token || !session?.couple) {
      setMmkRateData(null);
      setMmkRateForm(createDefaultMmkRateForm());
      return null;
    }

    const monthParts =
      year && month ? { year, month } : getCurrentLocalMonthParts();
    const data = await apiFetch(
      `/api/mmk-rate?year=${monthParts.year}&month=${monthParts.month}`,
      {
        headers: authHeaders,
      },
    );

    setMmkRateData(data);
    setMmkRateForm({
      year: data.year,
      month: data.month,
      rateSource: data.rate?.rateSource ?? "kbz",
      rate: data.rate?.rate ? String(data.rate.rate) : "",
    });
    return data;
  }

  useEffect(() => {
    if (!token || !session?.couple) {
      setMmkRateData(null);
      return;
    }

    loadMmkRate().catch((error) => {
      console.error("MMK monthly rate lookup failed:", error);
      setMmkRateData(null);
    });
  }, [token, session?.couple?.id]);

  useEffect(() => {
    let active = true;

    if (currencyCode === baseCurrencyCode) {
      setExchangeRate(1);
      setExchangeRateLabel("");
      return undefined;
    }

    async function loadExchangeRate() {
      try {
        if (baseCurrencyCode === "MMK" || currencyCode === "MMK") {
          const activeMmkRate = Number(mmkRateData?.rate?.rate ?? 0);

          if (!active || !Number.isFinite(activeMmkRate) || activeMmkRate <= 0) {
            setExchangeRate(1);
            setExchangeRateLabel("Set this month’s MMK rate to use MMK conversions.");
            return;
          }

          const monthLabel = `${String(mmkRateData.month).padStart(2, "0")}/${mmkRateData.year}`;
          const sourceLabel = String(mmkRateData.rate?.rateSource ?? "custom").toUpperCase();
          const nextRate =
            baseCurrencyCode === "MMK" && currencyCode === "USD"
              ? 1 / activeMmkRate
              : baseCurrencyCode === "USD" && currencyCode === "MMK"
                ? activeMmkRate
                : 1;

          setExchangeRate(nextRate);
          setExchangeRateLabel(
            `This month’s MMK rate: 1 USD = ${activeMmkRate.toFixed(2)} MMK · ${sourceLabel} · ${monthLabel}`,
          );
          return;
        }

        const data = await apiFetch(
          `/api/exchange-rate?from=${baseCurrencyCode}&to=${currencyCode}`,
        );
        const nextRate = Number(data?.rate ?? 0);

        if (!active || !Number.isFinite(nextRate) || nextRate <= 0) {
          return;
        }

        setExchangeRate(nextRate);
        setExchangeRateLabel(
          data?.date
            ? `1 ${baseCurrencyCode} = ${nextRate.toFixed(4)} ${currencyCode} · ${data.cached ? "cached" : "live"} · ${data.date}`
            : "",
        );
      } catch (error) {
        console.error("Exchange rate lookup failed:", error);
        if (active) {
          setExchangeRate(1);
          setExchangeRateLabel("Latest exchange rate unavailable");
        }
      }
    }

    loadExchangeRate();

    return () => {
      active = false;
    };
  }, [baseCurrencyCode, currencyCode, mmkRateData]);

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

  function clearAuthFeedback() {
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");
  }

  function resetAuthenticatedState() {
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
    setNotificationsData(createEmptyNotificationsState());
    setNotificationsLoaded(false);
    setMmkRateData(null);
    setMmkRateForm(createDefaultMmkRateForm());
    setRemainingBudget(0);
    setRecurringBillForm(createRecurringBillDraft(null));
    setEditingRecurringBillId(null);
    setHouseholdRuleForm(createHouseholdRuleDraft(null));
    setEditingHouseholdRuleId(null);
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
    setMmkRateData(null);
    setMmkRateForm(createDefaultMmkRateForm());
    setRemainingBudget(0);
    setRecurringBillForm(createRecurringBillDraft(null));
    setEditingRecurringBillId(null);
    setHouseholdRuleForm(createHouseholdRuleDraft(null));
    setEditingHouseholdRuleId(null);
  }

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
    setCoachProfile(data.coachProfile ?? null);
    setCoachProfileForm(createCoachProfileDraft(data.coachProfile));
    setPlannerData((current) =>
      current
        ? {
            ...current,
            setupChecklist: data.setupChecklist ?? current.setupChecklist ?? [],
          }
        : current,
    );
    setBaseCurrencyCode(data.user?.incomeCurrencyCode || "USD");
    setExpenseForm((current) => ({
      ...current,
      currencyCode:
        editingTransactionId !== null
          ? current.currencyCode
          : data.user?.incomeCurrencyCode || "USD",
    }));
    setSavingsForm((current) => ({
      ...current,
      currencyCode: data.user?.incomeCurrencyCode || "USD",
    }));
    setRecurringBillForm((current) =>
      editingRecurringBillId !== null
        ? current
        : {
            ...current,
            currencyCode: data.user?.incomeCurrencyCode || "USD",
          },
    );
    setHouseholdRuleForm((current) =>
      editingHouseholdRuleId !== null
        ? current
        : {
            ...current,
            currencyCode: data.user?.incomeCurrencyCode || "USD",
          },
    );
    setNotificationsData(
      data.notifications ?? {
        incoming: [],
        outgoing: [],
        activity: [],
      },
    );
    setNotificationsLoaded(true);
    if (!data.couple) {
      setMmkRateData(null);
      setMmkRateForm({
        ...MMK_SETTINGS_FIELDS,
        ...getCurrentLocalMonthParts(),
      });
    }

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
      const data = await apiFetch(
        `/api/dashboard?displayCurrency=${encodeURIComponent(currencyCode)}`,
        {
        headers: authHeaders,
        },
      );
      setDashboardData(data);
    } catch (error) {
      setDashboardData(null);
      setPageError(error.message);
    } finally {
      setDashboardBusy(false);
    }
  }

  async function loadInsights({ suppressError = false } = {}) {
    setInsightsBusy(true);

    try {
      const data = await apiFetch(
        `/api/insights?displayCurrency=${encodeURIComponent(currencyCode)}`,
        {
        headers: authHeaders,
        },
      );
      setInsightData(data);
      return data;
    } catch (error) {
      setInsightData(null);
      if (!suppressError) {
        setPageError(error.message);
      }
      return null;
    } finally {
      setInsightsBusy(false);
    }
  }

  async function loadSummary() {
    try {
      const data = await apiFetch(
        `/api/summary?displayCurrency=${encodeURIComponent(currencyCode)}`,
        {
        headers: authHeaders,
        },
      );
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
        apiFetch(
          `/api/summary?month=${encodeURIComponent(monthKey)}&displayCurrency=${encodeURIComponent(currencyCode)}`,
          {
          headers: authHeaders,
          },
        ),
        apiFetch(
          `/api/transactions?month=${encodeURIComponent(monthKey)}&displayCurrency=${encodeURIComponent(currencyCode)}`,
          {
          headers: authHeaders,
          },
        ),
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
      const data = await apiFetch(
        `/api/savings?displayCurrency=${encodeURIComponent(currencyCode)}`,
        {
        headers: authHeaders,
        },
      );
      setSavingsData(data);
      setSavingsForm((current) => {
        const goalStillExists = data.goals?.some(
          (goal) => String(goal.id) === String(current.savingsGoalId),
        );
        const defaultGoalId =
          !goalStillExists && !current.savingsGoalId && data.goals?.length === 1
            ? String(data.goals[0].id)
            : "";

        return {
          ...current,
          savingsGoalId: goalStillExists ? current.savingsGoalId : defaultGoalId,
        };
      });
    } catch (error) {
      setSavingsData(null);
      setPageError(error.message);
    }
  }

  async function loadPlanner() {
    if (!session?.couple && !soloMode) {
      setPlannerData(null);
      return;
    }

    setPlannerBusy(true);

    try {
      const data = await apiFetch(
        `/api/planner?displayCurrency=${encodeURIComponent(currencyCode)}`,
        {
          headers: authHeaders,
        },
      );
      setPlannerData(data);
    } catch (error) {
      setPlannerData(null);
      setPageError(error.message);
    } finally {
      setPlannerBusy(false);
    }
  }

  async function loadNotifications() {
    setNotificationsBusy(true);

    try {
      const data = await apiFetch("/api/notifications", {
        headers: authHeaders,
      });
      setNotificationsData(data);
      setNotificationsLoaded(true);
    } catch (error) {
      console.error("Notifications load failed:", error);
      setNotificationsData(createEmptyNotificationsState());
      setNotificationsLoaded(false);
    } finally {
      setNotificationsBusy(false);
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
    const refreshTasks = [loadDashboard(), loadSummary()];

    if (includeMonth) {
      refreshTasks.push(loadMonthView(monthKey));
    }

    if (includeInsights) {
      refreshTasks.push(loadInsights());
    }

    if (includeSavings) {
      refreshTasks.push(loadSavings());
    }

    if (includeNotifications) {
      refreshTasks.push(loadNotifications());
    }

    if (includePlanner) {
      refreshTasks.push(loadPlanner());
    }

    await Promise.all(refreshTasks);
  }

  async function refreshDashboardBundle() {
    const me = await fetchHouseholdData();
    const isSolo = !me.couple && soloMode;

    if (me.couple || isSolo) {
      await refreshBudgetViews({
        includeMonth: false,
        includeInsights: false,
        includeSavings: isSolo ? false : false,
        includeNotifications: false,
      });
    } else {
      resetCoupleData();
    }

    setPostAuthFailureMessage("");
    setAuthInfo("");
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    refreshDashboardBundle().catch((error) => {
      if (error.status === 401) {
        setAuthError(postAuthFailureMessage || error.message);
        clearAuthFeedback();
        setPageError("");
        localStorage.removeItem("budget_token");
        setToken("");
        resetAuthenticatedState();
      } else {
        setPageError("Couldn't connect to the server. Please refresh the page.");
      }
    });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (route === "notifications" && !notificationsBusy && !notificationsLoaded) {
      loadNotifications().catch(() => {});
    }

    if (!session?.couple && !soloMode) {
      return;
    }

    if (!coachProfile?.completed && route === "insights") {
      return;
    }

    if (route === "insights" && !insightData && !insightsBusy) {
      loadInsights({ suppressError: suppressNextInsightsError })
        .catch((error) => {
          setPageError(error.message);
        })
        .finally(() => {
          if (suppressNextInsightsError) {
            setSuppressNextInsightsError(false);
          }
        });
    }

    if (route === "savings" && !savingsData) {
      loadSavings().catch((error) => {
        setPageError(error.message);
      });
    }

    if (
      session?.couple &&
      (route === "planner" || route === "setup") &&
      !plannerData &&
      !plannerBusy
    ) {
      loadPlanner().catch((error) => {
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
    plannerData,
    plannerBusy,
    coachProfile?.completed,
    notificationsBusy,
    notificationsLoaded,
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
  }, [token, route, selectedMonth, session?.couple?.id, currencyCode]);

  useEffect(() => {
    if (!token || !session?.couple) {
      return;
    }

    refreshBudgetViews({
      includeNotifications: false,
    }).catch((error) => {
      setPageError(error.message);
    });
  }, [currencyCode, coachProfile?.completed]);

  function navigate(routeKey) {
    setHashLocation({ route: routeKey, query: "" });
    setRouteHash(routeKey);
  }

  function toggleHideNavItem(key) {
    setHiddenNavItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem("hb-hidden-nav", JSON.stringify([...next]));
      return next;
    });
  }

  function updateAuthMode(nextMode) {
    clearAuthFeedback();
    setPostAuthFailureMessage("");
    setAuthMode(nextMode);

    if (nextMode === "login" && route === "reset-password") {
      navigate("home");
    }
  }

  function handleThemeChange(event) {
    setTheme(event.target.value);
  }

  function handleCurrencyChange(event) {
    setCurrencyCode(event.target.value);
  }

  function handleBaseCurrencyChange(event) {
    setBaseCurrencyCode(event.target.value);
  }

  function handleMmkRateChange(event) {
    setPageError("");
    if (event.target.name === "monthKey") {
      const [yearText, monthText] = String(event.target.value ?? "").split("-");
      const nextYear = Number.parseInt(yearText, 10);
      const nextMonth = Number.parseInt(monthText, 10);

      setMmkRateForm((current) => ({
        ...current,
        year: Number.isInteger(nextYear) ? nextYear : current.year,
        month: Number.isInteger(nextMonth) ? nextMonth : current.month,
      }));
      return;
    }

    setMmkRateForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateRegisterForm(event) {
    setRegisterForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateLoginForm(event) {
    clearAuthFeedback();
    setLoginForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateForgotPasswordForm(event) {
    clearAuthFeedback();
    setForgotPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateResetPasswordForm(event) {
    clearAuthFeedback();
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

  function resetExpenseEditor() {
    setEditingTransactionId(null);
    setExpenseForm({
      ...TRANSACTION_FIELDS,
      currencyCode: baseCurrencyCode,
      date: getTodayLocalIso(),
    });
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

  function updateSavingsGoalForm(event) {
    setPageError("");
    setSavingsGoalForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateCoachProfileForm(event) {
    setPageError("");
    setCoachProfileForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateRecurringBillForm(event) {
    const { name, type, checked, value } = event.target;
    setPageError("");
    setRecurringBillForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function updateHouseholdRuleForm(event) {
    setPageError("");
    setHouseholdRuleForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
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

  async function handleMmkRateSubmit(event) {
    event.preventDefault();
    setMmkRateBusy(true);
    setPageError("");

    const numericRate = Number.parseFloat(String(mmkRateForm.rate ?? "").trim());

    if (
      mmkRateForm.rateSource === "custom" &&
      (!Number.isFinite(numericRate) || numericRate <= 0)
    ) {
      setPageError("Enter a valid monthly MMK rate greater than zero.");
      setMmkRateBusy(false);
      return;
    }

    try {
      await apiFetch("/api/mmk-rate", {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: mmkRateForm.year,
          month: mmkRateForm.month,
          rateSource: mmkRateForm.rateSource,
          ...(mmkRateForm.rateSource === "custom" ? { rate: numericRate } : {}),
        }),
      });

      await Promise.all([
        loadMmkRate(Number(mmkRateForm.year), Number(mmkRateForm.month)),
        refreshBudgetViews({
          includeNotifications: false,
        }),
      ]);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setMmkRateBusy(false);
    }
  }

  async function handleCoachChat(message) {
    const data = await apiFetch("/api/coach/chat", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        message,
        displayCurrency: currencyCode,
      }),
    });
    return data.reply;
  }

  async function handleRedeemCoupon(code) {
    const data = await apiFetch("/api/coupons/redeem", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ code }),
    });
    // Refresh session so isPro updates immediately
    await refreshDashboardBundle().catch(() => {});
    return data;
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthBusy(true);
    clearAuthFeedback();
    setPostAuthFailureMessage("");

    const normalizedEmail = registerForm.email.trim().toLowerCase();

    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...registerForm,
          email: normalizedEmail,
          monthlySalary: Number(registerForm.monthlySalary),
          incomeCurrencyCode: registerForm.incomeCurrencyCode,
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
    clearAuthFeedback();
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
    clearAuthFeedback();

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
    clearAuthFeedback();

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

  async function handleDeleteTransaction(transaction) {
    const confirmed = window.confirm(
      `Delete "${transaction.description}" from ${transaction.date}?`,
    );

    if (!confirmed) {
      return;
    }

    setExpenseBusy(true);
    setPageError("");

    try {
      await apiFetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (editingTransactionId === transaction.id) {
        resetExpenseEditor();
      }

      await refreshBudgetViews({
        includeMonth: true,
      });
    } catch (error) {
      setPageError(error.message);
    } finally {
      setExpenseBusy(false);
    }
  }

  async function handleRecurringBillSubmit(event) {
    event.preventDefault();
    setRecurringBillBusy(true);
    setPageError("");

    const amount = Number.parseFloat(recurringBillForm.amount);
    const dayOfMonth = Number.parseInt(recurringBillForm.dayOfMonth, 10);

    if (!recurringBillForm.title.trim()) {
      setPageError("Enter a recurring bill name.");
      setRecurringBillBusy(false);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid recurring bill amount.");
      setRecurringBillBusy(false);
      return;
    }

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      setPageError("Choose a bill day between 1 and 28.");
      setRecurringBillBusy(false);
      return;
    }

    if (!recurringBillForm.startDate) {
      setPageError("Pick the bill start date.");
      setRecurringBillBusy(false);
      return;
    }

    try {
      await apiFetch(
        editingRecurringBillId
          ? `/api/recurring-bills/${editingRecurringBillId}`
          : "/api/recurring-bills",
        {
          method: editingRecurringBillId ? "PATCH" : "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...recurringBillForm,
            title: recurringBillForm.title.trim(),
            amount,
            dayOfMonth,
            notes: recurringBillForm.notes.trim(),
            endDate: recurringBillForm.endDate || null,
          }),
        },
      );

      resetRecurringBillEditor();
      await refreshBudgetViews({
        includeMonth: true,
        includeNotifications: false,
        includeInsights: route === "insights",
      });
    } catch (error) {
      setPageError(error.message);
    } finally {
      setRecurringBillBusy(false);
    }
  }

  async function handleDeleteRecurringBill(bill) {
    const confirmed = window.confirm(`Delete recurring bill "${bill.title}"?`);
    if (!confirmed) {
      return;
    }

    setRecurringBillBusy(true);
    setPageError("");

    try {
      await apiFetch(`/api/recurring-bills/${bill.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (editingRecurringBillId === bill.id) {
        resetRecurringBillEditor();
      }
      await refreshBudgetViews({
        includeMonth: true,
        includeNotifications: false,
        includeInsights: route === "insights",
      });
    } catch (error) {
      setPageError(error.message);
    } finally {
      setRecurringBillBusy(false);
    }
  }

  async function handleHouseholdRuleSubmit(event) {
    event.preventDefault();
    setHouseholdRuleBusy(true);
    setPageError("");

    const thresholdAmount = householdRuleForm.thresholdAmount
      ? Number.parseFloat(householdRuleForm.thresholdAmount)
      : null;

    if (!householdRuleForm.title.trim()) {
      setPageError("Enter a rule name.");
      setHouseholdRuleBusy(false);
      return;
    }

    if (!householdRuleForm.details.trim()) {
      setPageError("Add the actual rule so both partners know what it means.");
      setHouseholdRuleBusy(false);
      return;
    }

    if (
      thresholdAmount !== null &&
      (!Number.isFinite(thresholdAmount) || thresholdAmount <= 0)
    ) {
      setPageError("If you use a threshold, it must be a valid amount.");
      setHouseholdRuleBusy(false);
      return;
    }

    try {
      await apiFetch(
        editingHouseholdRuleId
          ? `/api/household-rules/${editingHouseholdRuleId}`
          : "/api/household-rules",
        {
          method: editingHouseholdRuleId ? "PATCH" : "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: householdRuleForm.title.trim(),
            details: householdRuleForm.details.trim(),
            thresholdAmount,
            currencyCode: householdRuleForm.currencyCode || baseCurrencyCode,
          }),
        },
      );

      resetHouseholdRuleEditor();
      await loadPlanner();
    } catch (error) {
      setPageError(error.message);
    } finally {
      setHouseholdRuleBusy(false);
    }
  }

  async function handleDeleteHouseholdRule(rule) {
    const confirmed = window.confirm(`Delete rule "${rule.title}"?`);
    if (!confirmed) {
      return;
    }

    setHouseholdRuleBusy(true);
    setPageError("");

    try {
      await apiFetch(`/api/household-rules/${rule.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (editingHouseholdRuleId === rule.id) {
        resetHouseholdRuleEditor();
      }
      await loadPlanner();
    } catch (error) {
      setPageError(error.message);
    } finally {
      setHouseholdRuleBusy(false);
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
          incomeCurrencyCode: incomeProfileForm.incomeCurrencyCode,
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
      currencyCode: nextExpenseDraft.currencyCode,
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
      const mmkInvolved =
        nextExpenseDraft.currencyCode === "MMK" ||
        currencyCode === "MMK" ||
        baseCurrencyCode === "MMK";

      if (mmkInvolved && session?.couple) {
        const expenseYear = Number(normalizedDate.slice(0, 4));
        const expenseMonth = Number(normalizedDate.slice(5, 7));
        const activeRate =
          mmkRateData?.year === expenseYear && mmkRateData?.month === expenseMonth
            ? mmkRateData
            : await loadMmkRate(expenseYear, expenseMonth);

        if (!activeRate?.rate?.rate) {
          setPageError(
            `Save an MMK monthly rate for ${String(expenseMonth).padStart(2, "0")}/${expenseYear} before logging MMK-related expenses.`,
          );
          setExpenseBusy(false);
          return;
        }
      }

      await apiFetch(
        editingTransactionId
          ? `/api/transactions/${editingTransactionId}`
          : "/api/transactions",
        {
          method: editingTransactionId ? "PATCH" : "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: finalAmount,
            description:
              nextExpenseDraft.description || `${nextExpenseDraft.category} expense`,
            category: nextExpenseDraft.category,
            currencyCode: nextExpenseDraft.currencyCode || baseCurrencyCode,
            displayCurrencyCode: currencyCode,
            type: nextExpenseDraft.type,
            paymentMethod: nextExpenseDraft.paymentMethod,
            date: normalizedDate,
          }),
        },
      );

      resetExpenseEditor();
      setSelectedMonth(expenseMonthKey);
      await refreshBudgetViews({
        monthKey: expenseMonthKey,
        includeMonth: true,
      });
      navigate("notifications");
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
          incomeCurrencyCode: incomeProfileForm.incomeCurrencyCode,
        }),
      });

      await Promise.all([
        fetchHouseholdData(),
        refreshBudgetViews({
          includeSavings: true,
          includeNotifications: false,
        }),
      ]);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingsTargetBusy(false);
    }
  }

  async function handleSavingsGoalSubmit(event) {
    event.preventDefault();
    setSavingsTargetBusy(true);
    setPageError("");

    const targetAmount = Number.parseFloat(savingsGoalForm.targetAmount);
    const title = savingsGoalForm.title.trim();

    if (!title) {
      setPageError("Enter a name for the shared savings goal.");
      setSavingsTargetBusy(false);
      return;
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setPageError("Enter a valid savings goal amount.");
      setSavingsTargetBusy(false);
      return;
    }

    try {
      await apiFetch(editingSavingsGoalId ? `/api/savings/goal/${editingSavingsGoalId}` : "/api/savings/goal", {
        method: editingSavingsGoalId ? "PATCH" : "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          targetAmount,
          currencyCode: incomeProfileForm.incomeCurrencyCode || baseCurrencyCode,
          targetDate: savingsGoalForm.targetDate || null,
        }),
      });

      await loadSavings();
      resetSavingsGoalEditor();
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingsTargetBusy(false);
    }
  }

  async function handleDeleteSavingsGoal(goal) {
    const confirmed = window.confirm(`Delete the savings goal "${goal.title}"?`);
    if (!confirmed) {
      return;
    }

    setSavingsTargetBusy(true);
    setPageError("");

    try {
      await apiFetch(`/api/savings/goal/${goal.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (editingSavingsGoalId === goal.id) {
        resetSavingsGoalEditor();
      }

      await loadSavings();
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
          currencyCode: savingsForm.currencyCode || baseCurrencyCode,
          savingsGoalId: savingsForm.savingsGoalId || null,
          note: savingsForm.note.trim(),
          date: savingsForm.date,
        }),
      });

      setSavingsForm({
        ...SAVINGS_FIELDS,
        currencyCode: incomeProfileForm.incomeCurrencyCode || baseCurrencyCode,
        savingsGoalId: "",
      });
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

  async function handleCoachProfileSubmit(event) {
    event.preventDefault();
    setCoachProfileBusy(true);
    setPageError("");

    try {
      const data = await apiFetch("/api/coach-profile", {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...coachProfileForm,
          notes: coachProfileForm.notes.trim(),
        }),
      });

      setCoachProfile(data.profile);
      setCoachProfileForm(createCoachProfileDraft(data.profile));
      await fetchHouseholdData();
      if (!isPro) {
        navigate("paywall");
        return;
      }
      const nextInsights = await loadInsights({ suppressError: true });
      if (!nextInsights) {
        setPageError("Your coach answers were saved. Insights are taking a little longer to load.");
      }
      setSuppressNextInsightsError(false);
      navigate("insights");
    } catch (error) {
      setPageError(error.message);
    } finally {
      setCoachProfileBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("budget_token");
    setToken("");
    resetAuthenticatedState();
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
  const isPro = session?.isPro ?? false;
  const showCoach = Boolean(couple);
  const showPlanner = Boolean(couple) || soloMode;
  const showSetup = Boolean(couple) || soloMode;
  const availableNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.key === "notifications") return true;
    if (item.key === "coach") return showCoach;
    if (item.key === "planner") return showPlanner;
    if (item.key === "setup") return showSetup;
    return true;
  });
  const moreNavItems = availableNavItems.filter((item) => hiddenNavItems.has(item.key));
  const dashboard = dashboardData?.dashboard;
  const insights = insightData?.insights;
  const transactions = dashboard?.transactions ?? [];
  const householdUsers = dashboard?.users?.length
    ? dashboard.users
    : couple
      ? [couple.userOne, couple.userTwo]
      : session?.user
        ? [session.user]
        : [];
  const coupleNames = couple
    ? `${couple.userOne.name} + ${couple.userTwo.name}`
    : session?.user?.name;
  // Coach setup is required for couples (always) and for solo users who have opted in via the home card.
  // We only gate the insights route behind coach completion, not the coach page itself.
  const coachRequired = !coachProfile?.completed && (Boolean(couple) || soloMode);

  const rawChecklist = plannerData?.setupChecklist ?? session?.setupChecklist ?? [];
  const setupChecklist = soloMode
    ? rawChecklist.filter((item) => item.key !== "partner")
    : rawChecklist;

  setCurrencyConversionPreferences({
    displayCurrency: currencyCode,
    baseCurrency: baseCurrencyCode,
    locale,
    exchangeRate,
  });

  function enableSoloMode() {
    localStorage.setItem("budget_solo_mode", "true");
    setSoloMode(true);
    refreshBudgetViews({
      includeMonth: false,
      includeInsights: false,
      includeSavings: false,
      includeNotifications: false,
    }).catch(() => {});
  }

  function renderCurrentPage() {
    if (!session) {
      return (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-amber-400" />
          <p className="text-sm text-slate-500">
            {pageError ? "See the error above." : "Connecting to server…"}
          </p>
        </div>
      );
    }

    if (
      !couple &&
      !soloMode &&
      route !== "settings" &&
      route !== "more" &&
      route !== "notifications" &&
      route !== "setup"
    ) {
      return (
        <EmptyState
          title="Link a partner or use solo"
          body="Send an invite to your partner's email to share your dashboard, or continue using the app on your own."
          action={
            <div className="mx-auto mt-6 flex max-w-md flex-col gap-4">
              <form
                className="flex flex-col gap-3 sm:flex-row"
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
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                type="button"
                onClick={enableSoloMode}
              >
                Continue without a partner
              </button>
            </div>
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
            baseCurrencyCode={baseCurrencyCode}
            currencyCode={currencyCode}
            mmkRateData={mmkRateData}
            editingTransactionId={editingTransactionId}
            currentUserId={session?.user?.id}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onCancelEdit={resetExpenseEditor}
          />
        );
      case "insights":
        if (coachRequired) {
          return (
            <CoachSetupPage
              coachProfileForm={coachProfileForm}
              onChange={updateCoachProfileForm}
              onSubmit={handleCoachProfileSubmit}
              busy={coachProfileBusy}
              completed={Boolean(coachProfile?.completed)}
              soloMode={soloMode}
            />
          );
        }
        if (!isPro) {
          return (
            <PaywallPage
              onSubscribe={() => navigate("paywall")}
              onContinueFree={() => navigate("home")}
            />
          );
        }
        return (
          <InsightsPage
            insightsBusy={insightsBusy}
            insights={insights}
            dashboard={dashboard}
            onChatMessage={handleCoachChat}
          />
        );
      case "coach":
        return (
          <CoachSetupPage
            coachProfileForm={coachProfileForm}
            onChange={updateCoachProfileForm}
            onSubmit={handleCoachProfileSubmit}
            busy={coachProfileBusy}
            completed={Boolean(coachProfile?.completed)}
          />
        );
      case "setup":
        return (
          <SetupFlowPage
            checklist={setupChecklist}
            onNavigate={navigate}
          />
        );
      case "planner":
        return (
          <PlannerPage
            plannerData={plannerData}
            plannerBusy={plannerBusy}
            recurringBillForm={recurringBillForm}
            recurringBillBusy={recurringBillBusy}
            editingRecurringBillId={editingRecurringBillId}
            onRecurringBillChange={updateRecurringBillForm}
            onRecurringBillSubmit={handleRecurringBillSubmit}
            onEditRecurringBill={handleEditRecurringBill}
            onDeleteRecurringBill={handleDeleteRecurringBill}
            onCancelRecurringBillEdit={resetRecurringBillEditor}
            ruleForm={householdRuleForm}
            ruleBusy={householdRuleBusy}
            editingRuleId={editingHouseholdRuleId}
            onRuleChange={updateHouseholdRuleForm}
            onRuleSubmit={handleHouseholdRuleSubmit}
            onEditRule={handleEditHouseholdRule}
            onDeleteRule={handleDeleteHouseholdRule}
            onCancelRuleEdit={resetHouseholdRuleEditor}
            onNavigate={navigate}
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
        return (
          <MorePage
            onNavigate={navigate}
            onLogout={handleLogout}
            items={moreNavItems}
            onUnhideItem={toggleHideNavItem}
          />
        );
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
            savingsGoalForm={savingsGoalForm}
            editingSavingsGoalId={editingSavingsGoalId}
            onSavingsChange={updateSavingsForm}
            onSavingsTargetChange={updateIncomeProfileForm}
            onSavingsGoalChange={updateSavingsGoalForm}
            onSavingsSubmit={handleSavingsSubmit}
            onSavingsTargetSubmit={handleSavingsTargetSubmit}
            onSavingsGoalSubmit={handleSavingsGoalSubmit}
            onEditSavingsGoal={handleEditSavingsGoal}
            onDeleteSavingsGoal={handleDeleteSavingsGoal}
            onCancelSavingsGoalEdit={resetSavingsGoalEditor}
            savingsBusy={savingsBusy}
            savingsTargetBusy={savingsTargetBusy}
            isPro={isPro}
            onUpgrade={() => navigate("paywall")}
          />
        );
      case "history":
        return (
          <HistoryPage
            transactions={monthTransactions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            monthSummary={monthSummary}
            currentUserId={session?.user?.id}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            actionBusy={expenseBusy}
          />
        );
      case "settings":
        return (
          <SettingsPage
            session={session}
            soloMode={soloMode}
            incomeProfileForm={incomeProfileForm}
            onIncomeProfileChange={updateIncomeProfileForm}
            onIncomeProfileSubmit={handleIncomeProfileSubmit}
            incomeProfileBusy={incomeProfileBusy}
            theme={theme}
            currencyCode={currencyCode}
            baseCurrencyCode={baseCurrencyCode}
            exchangeRateLabel={exchangeRateLabel}
            mmkRateData={mmkRateData}
            mmkRateForm={mmkRateForm}
            mmkRateBusy={mmkRateBusy}
            onThemeChange={handleThemeChange}
            onCurrencyChange={handleCurrencyChange}
            onBaseCurrencyChange={handleBaseCurrencyChange}
            onMmkRateChange={handleMmkRateChange}
            onMmkRateSubmit={handleMmkRateSubmit}
            onRedeemCoupon={handleRedeemCoupon}
            isPro={isPro}
          />
        );
      case "paywall":
        return (
          <PaywallPage
            onSubscribe={() => {
              // IAP integration goes here (Apple/Google)
              // For now, navigate back to insights
              navigate("insights");
            }}
            onContinueFree={() => navigate("home")}
          />
        );
      case "home":
      default:
        return (
          <HomePage
            summaryData={summaryData}
            dashboard={dashboard}
            dashboardBusy={dashboardBusy}
            coachProfile={coachProfile}
            soloMode={soloMode}
            couple={couple}
            onNavigateToCoach={() => navigate("coach")}
            setupChecklist={setupChecklist}
            onNavigateToSetup={() => navigate("setup")}
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
      showNotifications
      showCoach={showCoach}
      showPlanner={showPlanner}
      showSetup={showSetup}
      hiddenNavItems={hiddenNavItems}
      onHideNavItem={toggleHideNavItem}
      onLogout={handleLogout}
      pageError={pageError}
      onDismissError={() => setPageError("")}
      onRetryLoad={!session ? () => refreshDashboardBundle().catch((error) => setPageError(error.message)) : undefined}
    >
      <div key={route} className="hb-page-enter">
        {renderCurrentPage()}
      </div>
    </AppShell>
  );
}
