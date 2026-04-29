/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Bell, Brain, CalendarDays, ClipboardList, CreditCard,
  House, ListTodo, Map, MessageCircle, PiggyBank, Plus,
  Settings2, ShieldCheck, Sparkles, Target, Wallet,
} from "lucide-react";

import AppShell from "./components/AppShell.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import CoachSetupPage from "./components/pages/CoachSetupPage.jsx";
import CoachPage from "./components/pages/CoachPage.jsx";
import ExpensesPage from "./components/pages/ExpensesPage.jsx";
import CalendarPage from "./components/pages/CalendarPage.jsx";
import HistoryPage from "./components/pages/HistoryPage.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import InsightsPage from "./components/pages/InsightsPage.jsx";
import MorePage from "./components/pages/MorePage.jsx";
import NotificationsPage from "./components/pages/NotificationsPage.jsx";
import PlannerPage from "./components/pages/PlannerPage.jsx";
import BudgetPlannerPage from "./components/pages/BudgetPlannerPage.jsx";
import SavingsPage from "./components/pages/SavingsPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import SetupFlowPage from "./components/pages/SetupFlowPage.jsx";
import PaywallPage from "./components/pages/PaywallPage.jsx";
import DebtPage from "./components/pages/DebtPage.jsx";
import PrivacyPolicyPage from "./components/pages/PrivacyPolicyPage.jsx";
import TermsOfServicePage from "./components/pages/TermsOfServicePage.jsx";
import { ActionButton, ConfirmDialog, EmptyState } from "./components/ui.jsx";
import { setCurrencyConversionPreferences } from "./lib/format.js";
import { addBackButtonListener, addUrlOpenListener } from "./lib/native.js";
import { apiFetch, API_BASE_URL } from "./lib/api.js";
import { STORAGE_KEYS, readStorage, writeStorage } from "./lib/storage.js";
import { useLanguage } from "./i18n/LanguageProvider.jsx";

import { useNavigation } from "./hooks/useNavigation.js";
import { useConfirm } from "./hooks/useConfirm.js";
import { useTheme } from "./hooks/useTheme.js";
import { useAuth } from "./hooks/useAuth.js";
import { useAppData } from "./hooks/useAppData.js";
import { useExpenses } from "./hooks/useExpenses.js";
import { useSavings } from "./hooks/useSavings.js";
import { usePlanner } from "./hooks/usePlanner.js";
import { useSettings } from "./hooks/useSettings.js";
import { useCoach } from "./hooks/useCoach.js";
import { useDebt } from "./hooks/useDebt.js";
import { usePaywall } from "./hooks/usePaywall.js";

const SUPPORTED_CURRENCIES = new Set(["USD", "EUR", "GBP", "CAD", "AUD", "MMK"]);

function getInitialCurrency(key) {
  const saved = readStorage(key);
  return saved && SUPPORTED_CURRENCIES.has(saved) ? saved : "USD";
}

const ALL_NAV_ITEMS = [
  { key: "home", icon: House },
  { key: "expenses", icon: Wallet },
  { key: "savings", icon: PiggyBank },
  { key: "notifications", icon: Bell },
  { key: "insights", icon: Brain },
  { key: "calendar", icon: CalendarDays },
  { key: "history", icon: ClipboardList },
  { key: "planner", icon: ShieldCheck },
  { key: "budget-planner", icon: Map },
  { key: "debt", icon: CreditCard },
  { key: "coach", icon: Sparkles },
  { key: "setup", icon: ListTodo },
  { key: "settings", icon: Settings2 },
];

const PAGE_TABS = {
  expenses: [
    { key: "log", label: "Log", icon: Plus },
    { key: "recent", label: "Recent", icon: Wallet },
    { key: "history", label: "History", icon: ClipboardList },
  ],
  savings: [
    { key: "goals", label: "Goals", icon: Target },
    { key: "log", label: "Log", icon: PiggyBank },
    { key: "history", label: "History", icon: ClipboardList },
  ],
  debt: [
    { key: "debts", label: "Debts", icon: CreditCard },
    { key: "add", label: "Add Debt", icon: Plus },
    { key: "payments", label: "Payments", icon: ClipboardList },
  ],
  coach: [
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "tips", label: "Tips", icon: Brain },
  ],
};

const TAB_DEFAULTS = { expenses: "log", savings: "goals", debt: "debts", coach: "chat" };

export default function App() {
  const { locale } = useLanguage();

  // ─── Core hooks (must all be called unconditionally) ──────────────────────
  const { route, query, navigate } = useNavigation();
  const { confirmDialog, showConfirm, handleConfirmYes, handleConfirmNo } = useConfirm();

  const [activeTab, setActiveTab] = useState(TAB_DEFAULTS[route] ?? "");
  useEffect(() => { setActiveTab(TAB_DEFAULTS[route] ?? ""); }, [route]);
  const { theme, setTheme } = useTheme();
  const auth = useAuth({ navigate });

  // Currency state lives here so both useAppData and useSettings can share it
  const [currencyCode, setCurrencyCode] = useState(() => getInitialCurrency(STORAGE_KEYS.CURRENCY));
  const [baseCurrencyCode, setBaseCurrencyCode] = useState(() => getInitialCurrency(STORAGE_KEYS.BASE_CURRENCY));

  // Persistent UI preferences
  const [soloMode, setSoloMode] = useState(() => readStorage(STORAGE_KEYS.SOLO_MODE) === "true");
  const [hiddenNavItems, setHiddenNavItems] = useState(() => {
    try { return new Set(JSON.parse(readStorage(STORAGE_KEYS.HIDDEN_NAV) || "[]")); }
    catch { return new Set(); }
  });

  // Partner invite form (lives at App level — cross-cutting concern)
  const [partnerEmail, setPartnerEmail] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [incomeProfileBusy, setIncomeProfileBusy] = useState(false);

  const resetToken = useMemo(
    () => new URLSearchParams(query).get("token")?.trim() || "",
    [query],
  );

  // ─── Data layer ───────────────────────────────────────────────────────────
  const dataBundle = useAppData({
    token: auth.token,
    route,
    navigate,
    onUnauthorized: handleUnauthorized,
    currencyCode,
    baseCurrencyCode,
    soloMode,
    setSoloMode,
  });

  const { session, pageError, setPageError } = dataBundle;

  const settings = useSettings({
    currencyCode,
    setCurrencyCode,
    baseCurrencyCode,
    setBaseCurrencyCode,
    session,
    setPageError,
    refreshBudgetViews: dataBundle.refreshBudgetViews,
  });

  // Compose enriched appData for domain hooks (adds currency + MMK from settings)
  const appData = {
    ...dataBundle,
    currencyCode,
    baseCurrencyCode,
    mmkRateData: settings.mmkRateData,
    loadMmkRate: settings.loadMmkRate,
  };

  // ─── Domain hooks ─────────────────────────────────────────────────────────
  const expenses = useExpenses({ appData, showConfirm, navigate });
  const savings = useSavings({ appData, showConfirm });
  const planner = usePlanner({ appData, showConfirm, route });
  const coach = useCoach({ appData, navigate });
  const debt = useDebt({ appData, showConfirm });
  const paywall = usePaywall({ appData, navigate });

  const isPro = session?.isPro ?? false;

  // Sync format lib with current currency prefs on every render
  setCurrencyConversionPreferences({
    displayCurrency: currencyCode,
    baseCurrency: baseCurrencyCode,
    locale,
    exchangeRate: settings.exchangeRate,
  });

  // Refresh budget views when display currency or coach completion changes
  useEffect(() => {
    if (!auth.token || !session?.couple) return;
    dataBundle.refreshBudgetViews({ includeNotifications: false }).catch(() => {});
  }, [currencyCode, dataBundle.coachProfile?.completed]);

  // Load debts on first visit to the debt page
  useEffect(() => {
    if (!auth.token || route !== "debt" || debt.debtData) return;
    debt.loadDebts().catch(() => {});
  }, [auth.token, route]);

  // Deep link handler (iOS external URL open)
  useEffect(() => {
    const cleanup = addUrlOpenListener(({ url }) => {
      if (!url) return;
      if (url.startsWith("honeybudget://expenses")) {
        auth.token ? navigate("expenses") : null;
      }
    });
    return () => { cleanup.then?.((fn) => fn?.()); };
  }, [auth.token]);

  // Hardware back button
  useEffect(() => {
    const TOP_LEVEL = ["home", "expenses", "savings", "more", "notifications", "calendar", "insights", "history", "settings", "planner", "budget-planner", "setup", "coach"];
    const cleanup = addBackButtonListener(({ canGoBack }) => {
      if (canGoBack) { window.history.back(); return; }
      if (TOP_LEVEL.indexOf(route) > 0) navigate(TOP_LEVEL[0]);
    });
    return () => { cleanup.then?.((fn) => fn?.()); };
  }, [route]);

  // Keep Render free-tier backend alive
  useEffect(() => {
    const url = API_BASE_URL ? `${API_BASE_URL}/health` : "/health";
    fetch(url).catch(() => {});
    const id = setInterval(() => fetch(url).catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, []);

  // ─── Cross-cutting handlers ───────────────────────────────────────────────

  function handleUnauthorized() {
    auth.logout();
    dataBundle.resetAll();
    settings.resetMmkRate();
    setPageError("");
  }

  function handleLogout() {
    auth.logout();
    dataBundle.resetAll();
    settings.resetMmkRate();
    setPageError("");
    navigate("home");
  }

  function enableSoloMode() {
    writeStorage(STORAGE_KEYS.SOLO_MODE, "true");
    setSoloMode(true);
    dataBundle.refreshBudgetViews({
      includeMonth: false, includeInsights: false,
      includeSavings: false, includeNotifications: false,
    }).catch(() => {});
  }

  function toggleHideNavItem(key) {
    setHiddenNavItems((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      writeStorage(STORAGE_KEYS.HIDDEN_NAV, JSON.stringify([...next]));
      return next;
    });
  }

  async function handleLinkPartner(event) {
    event.preventDefault();
    setLinkBusy(true);
    setPageError("");
    const email = partnerEmail.trim().toLowerCase();
    if (!email) { setPageError("Enter your partner's email address."); setLinkBusy(false); return; }
    try {
      await apiFetch("/api/couples/link", { method: "POST", body: JSON.stringify({ partnerEmail: email }) });
      setPartnerEmail("");
      await Promise.all([dataBundle.fetchHouseholdData(), dataBundle.loadNotifications()]);
      navigate("notifications");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleInvitePartnerFromSettings(email) {
    setLinkBusy(true);
    try {
      await apiFetch("/api/couples/link", { method: "POST", body: JSON.stringify({ partnerEmail: email.trim().toLowerCase() }) });
      await Promise.all([dataBundle.fetchHouseholdData(), dataBundle.loadNotifications()]);
      navigate("notifications");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleUnlinkPartner() {
    setLinkBusy(true);
    try {
      await apiFetch("/api/couples/me", { method: "DELETE" });
      setSoloMode(true);
      writeStorage(STORAGE_KEYS.SOLO_MODE, "true");
      await dataBundle.refreshDashboardBundle();
      navigate("home");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleInviteResponse(inviteId, action) {
    dataBundle.setNotificationsBusy(true);
    setPageError("");
    try {
      await apiFetch(`/api/couples/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await Promise.all([dataBundle.refreshDashboardBundle(), dataBundle.loadNotifications()]);
      if (action === "accept") navigate("home");
    } catch (err) {
      setPageError(err.message);
    } finally {
      dataBundle.setNotificationsBusy(false);
    }
  }

  async function handleIncomeProfileSubmit(event) {
    event.preventDefault();
    setIncomeProfileBusy(true);
    setPageError("");
    const { incomeProfileForm } = dataBundle;
    const cash = Number.parseFloat(incomeProfileForm.salaryCashAmount);
    const card = Number.parseFloat(incomeProfileForm.salaryCardAmount);
    const day = Number.parseInt(incomeProfileForm.incomeDayOfMonth, 10);
    if (!Number.isFinite(cash) || cash < 0) { setPageError("Enter a valid cash income amount."); setIncomeProfileBusy(false); return; }
    if (!Number.isFinite(card) || card < 0) { setPageError("Enter a valid card income amount."); setIncomeProfileBusy(false); return; }
    if (!Number.isInteger(day) || day < 1 || day > 28) { setPageError("Choose an income day between 1 and 28."); setIncomeProfileBusy(false); return; }
    try {
      await apiFetch("/api/profile/income", {
        method: "PATCH",
        body: JSON.stringify({
          salaryCashAmount: cash, salaryCardAmount: card,
          incomeCurrencyCode: incomeProfileForm.incomeCurrencyCode,
          incomeDayOfMonth: day,
          monthlySavingsTarget: Number.parseFloat(incomeProfileForm.monthlySavingsTarget || 0),
        }),
      });
      await dataBundle.refreshDashboardBundle();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setIncomeProfileBusy(false);
    }
  }

  async function handleSavingsTargetSubmit(event) {
    event.preventDefault();
    setPageError("");
    const { incomeProfileForm } = dataBundle;
    const target = Number.parseFloat(incomeProfileForm.monthlySavingsTarget);
    if (!Number.isFinite(target) || target < 0) { setPageError("Enter a valid savings target."); return; }
    try {
      await apiFetch("/api/profile/income", {
        method: "PATCH",
        body: JSON.stringify({
          salaryCashAmount: Number.parseFloat(incomeProfileForm.salaryCashAmount || 0),
          salaryCardAmount: Number.parseFloat(incomeProfileForm.salaryCardAmount || 0),
          incomeDayOfMonth: Number.parseInt(incomeProfileForm.incomeDayOfMonth || "1", 10),
          monthlySavingsTarget: target,
          incomeCurrencyCode: incomeProfileForm.incomeCurrencyCode,
        }),
      });
      await Promise.all([
        dataBundle.fetchHouseholdData(),
        dataBundle.refreshBudgetViews({ includeSavings: true, includeNotifications: false }),
      ]);
    } catch (err) {
      setPageError(err.message);
    }
  }

  // ─── Public routes (no auth required) ────────────────────────────────────
  if (route === "privacy-policy" && !auth.token) return <PrivacyPolicyPage />;
  if (route === "terms-of-service" && !auth.token) return <TermsOfServicePage />;

  // ─── Auth screen ──────────────────────────────────────────────────────────
  if (!auth.token) {
    return (
      <AuthPanel
        authMode={auth.authMode}
        setAuthMode={auth.updateAuthMode}
        registerForm={auth.registerForm}
        loginForm={auth.loginForm}
        forgotPasswordForm={auth.forgotPasswordForm}
        resetPasswordForm={auth.resetPasswordForm}
        onRegisterChange={auth.onRegisterChange}
        onLoginChange={auth.onLoginChange}
        onForgotPasswordChange={auth.onForgotPasswordChange}
        onResetPasswordChange={auth.onResetPasswordChange}
        onRegister={auth.handleRegister}
        onLogin={auth.handleLogin}
        onGoogleAuth={auth.handleGoogleAuth}
        onAppleAuth={auth.handleAppleAuth}
        onForgotPassword={auth.handleForgotPassword}
        onResetPassword={(e) => auth.handleResetPassword(e, resetToken)}
        isSubmitting={auth.authBusy}
        error={auth.authError}
        info={auth.authInfo}
        previewResetUrl={auth.previewResetUrl}
        resetToken={resetToken}
      />
    );
  }

  // ─── Derived display values ───────────────────────────────────────────────
  const couple = session?.couple || dataBundle.dashboardData?.couple;
  const showCoach = Boolean(couple);
  const showPlanner = Boolean(couple) || soloMode;
  const showSetup = Boolean(couple) || soloMode;
  const coachRequired = !dataBundle.coachProfile?.completed && (Boolean(couple) || soloMode);

  const availableNavItems = ALL_NAV_ITEMS.filter(({ key }) => {
    if (key === "coach") return showCoach;
    if (key === "planner") return showPlanner;
    if (key === "setup") return showSetup;
    return true;
  });

  const dashboard = dataBundle.dashboardData?.dashboard;
  const transactions = dashboard?.transactions ?? [];
  const householdUsers = dashboard?.users?.length
    ? dashboard.users
    : couple
      ? [couple.userOne, couple.userTwo]
      : session?.user ? [session.user] : [];
  const coupleNames = couple
    ? `${couple.userOne.name} + ${couple.userTwo.name}`
    : session?.user?.name;

  const rawChecklist = dataBundle.plannerData?.setupChecklist ?? session?.setupChecklist ?? [];
  const setupChecklist = soloMode ? rawChecklist.filter((i) => i.key !== "partner") : rawChecklist;
  const moreNavItems = availableNavItems.filter((i) => hiddenNavItems.has(i.key));

  // ─── Page renderer ────────────────────────────────────────────────────────
  function renderPage() {
    if (!session) {
      return (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-amber-400" />
          <p className="text-sm text-slate-500">{pageError ? "See the error above." : "Connecting to server…"}</p>
        </div>
      );
    }

    if (!couple && !soloMode && !["settings", "more", "notifications", "setup"].includes(route)) {
      return (
        <EmptyState
          title="Link a partner or use solo"
          body="Send an invite to your partner's email to share your dashboard, or continue using the app on your own."
          action={
            <div className="mx-auto mt-6 flex max-w-md flex-col gap-4">
              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleLinkPartner}>
                <input
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  autoComplete="email" inputMode="email" placeholder="partner@example.com"
                  type="email" value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                />
                <ActionButton busy={linkBusy} className="sm:w-auto">Send invite</ActionButton>
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
            activeTab={activeTab}
            expenseForm={expenses.expenseForm}
            onExpenseChange={expenses.updateExpenseForm}
            onExpenseSubmit={expenses.handleExpenseSubmit}
            expenseBusy={expenses.expenseBusy}
            transactions={transactions}
            baseCurrencyCode={baseCurrencyCode}
            currencyCode={currencyCode}
            mmkRateData={settings.mmkRateData}
            editingTransactionId={expenses.editingTransactionId}
            currentUserId={session?.user?.id}
            householdUsers={householdUsers}
            onEditTransaction={(t) => { expenses.handleEditTransaction(t); setActiveTab("log"); }}
            onDeleteTransaction={expenses.handleDeleteTransaction}
            onCancelEdit={expenses.resetExpenseEditor}
          />
        );
      case "savings":
        return (
          <SavingsPage
            activeTab={activeTab}
            savingsData={dataBundle.savingsData}
            savingsForm={savings.savingsForm}
            savingsTargetForm={dataBundle.incomeProfileForm}
            savingsGoalForm={savings.savingsGoalForm}
            editingSavingsGoalId={savings.editingSavingsGoalId}
            editingSavingsEntryId={savings.editingSavingsEntryId}
            onSavingsChange={savings.updateSavingsForm}
            onSavingsTargetChange={(e) => {
              setPageError("");
              dataBundle.setIncomeProfileForm((p) => ({ ...p, [e.target.name]: e.target.value }));
            }}
            onSavingsGoalChange={savings.updateSavingsGoalForm}
            onSavingsSubmit={savings.handleSavingsSubmit}
            onSavingsTargetSubmit={handleSavingsTargetSubmit}
            onSavingsGoalSubmit={savings.handleSavingsGoalSubmit}
            onEditSavingsGoal={savings.handleEditSavingsGoal}
            onDeleteSavingsGoal={savings.handleDeleteSavingsGoal}
            onCancelSavingsGoalEdit={savings.resetSavingsGoalEditor}
            onEditSavingsEntry={savings.handleEditSavingsEntry}
            onDeleteSavingsEntry={savings.handleDeleteSavingsEntry}
            onCancelSavingsEntryEdit={savings.resetSavingsEntryEditor}
            onSavingsWithdraw={savings.handleSavingsWithdraw}
            savingsBusy={savings.savingsBusy}
            savingsTargetBusy={savings.savingsTargetBusy}
            isPro={isPro}
            onUpgrade={() => navigate("paywall")}
          />
        );
      case "insights":
        if (coachRequired) {
          return <CoachSetupPage coachProfileForm={dataBundle.coachProfileForm} onChange={coach.updateCoachProfileForm} onSubmit={(e) => coach.handleCoachProfileSubmit(e, { isPro })} busy={coach.coachProfileBusy} completed={Boolean(dataBundle.coachProfile?.completed)} soloMode={soloMode} />;
        }
        if (!isPro) {
          return <PaywallPage onSubscribe={paywall.handleSubscribeIAP} onContinueFree={() => navigate("home")} onRestore={paywall.handleRestorePurchases} busy={paywall.paywallBusy} restoreBusy={paywall.restoreBusy} />;
        }
        return <InsightsPage insightsBusy={dataBundle.insightsBusy} insights={dataBundle.insightData?.insights} dashboard={dashboard} />;
      case "coach":
        if (!dataBundle.coachProfile?.completed) {
          return <CoachSetupPage coachProfileForm={dataBundle.coachProfileForm} onChange={coach.updateCoachProfileForm} onSubmit={(e) => coach.handleCoachProfileSubmit(e, { isPro })} busy={coach.coachProfileBusy} completed={false} soloMode={soloMode} />;
        }
        if (coach.coachEditingProfile) {
          return <CoachSetupPage coachProfileForm={dataBundle.coachProfileForm} onChange={coach.updateCoachProfileForm} onSubmit={async (e) => { await coach.handleCoachProfileSubmit(e, { isPro }); coach.setCoachEditingProfile(false); }} busy={coach.coachProfileBusy} completed soloMode={soloMode} />;
        }
        return <CoachPage activeTab={activeTab} onSendMessage={coach.handleCoachChat} onEditProfile={() => coach.setCoachEditingProfile(true)} />;
      case "planner":
        return (
          <PlannerPage
            plannerData={dataBundle.plannerData}
            plannerBusy={dataBundle.plannerBusy}
            recurringBillForm={planner.recurringBillForm}
            recurringBillBusy={planner.recurringBillBusy}
            editingRecurringBillId={planner.editingRecurringBillId}
            onRecurringBillChange={planner.updateRecurringBillForm}
            onRecurringBillSubmit={planner.handleRecurringBillSubmit}
            onEditRecurringBill={planner.handleEditRecurringBill}
            onDeleteRecurringBill={planner.handleDeleteRecurringBill}
            onCancelRecurringBillEdit={planner.resetRecurringBillEditor}
            ruleForm={planner.householdRuleForm}
            ruleBusy={planner.householdRuleBusy}
            editingRuleId={planner.editingHouseholdRuleId}
            onRuleChange={planner.updateHouseholdRuleForm}
            onRuleSubmit={planner.handleHouseholdRuleSubmit}
            onEditRule={planner.handleEditHouseholdRule}
            onDeleteRule={planner.handleDeleteHouseholdRule}
            onCancelRuleEdit={planner.resetHouseholdRuleEditor}
            onNavigate={navigate}
            soloMode={soloMode}
          />
        );
      case "budget-planner":
        return <BudgetPlannerPage apiBase={API_BASE_URL} token={auth.token} displayCurrency={currencyCode} />;
      case "debt":
        return (
          <DebtPage
            activeTab={activeTab}
            debtData={debt.debtData}
            debtBusy={debt.debtBusy}
            debtForm={debt.debtForm}
            editingDebtId={debt.editingDebtId}
            payingDebtId={debt.payingDebtId}
            paymentForm={debt.paymentForm}
            currentUserId={session?.user?.id}
            baseCurrencyCode={baseCurrencyCode}
            onDebtChange={debt.updateDebtForm}
            onDebtSubmit={debt.handleDebtSubmit}
            onEditDebt={(d) => { debt.startEditingDebt(d); setActiveTab("add"); }}
            onDeleteDebt={debt.handleDeleteDebt}
            onCancelDebtEdit={() => { debt.resetDebtEditor(); setActiveTab("debts"); }}
            onPaymentChange={debt.updatePaymentForm}
            onPaymentSubmit={debt.handlePaymentSubmit}
            onOpenPayment={debt.openPaymentForm}
            onClosePayment={debt.closePaymentForm}
            onDeletePayment={debt.handleDeletePayment}
          />
        );
      case "calendar":
        return <CalendarPage selectedMonth={dataBundle.selectedMonth} onMonthChange={dataBundle.setSelectedMonth} monthSummary={dataBundle.monthSummary} monthTransactions={dataBundle.monthTransactions} householdUsers={householdUsers} />;
      case "history":
        return <HistoryPage transactions={dataBundle.monthTransactions} selectedMonth={dataBundle.selectedMonth} onMonthChange={dataBundle.setSelectedMonth} monthSummary={dataBundle.monthSummary} currentUserId={session?.user?.id} onEditTransaction={expenses.handleEditTransaction} onDeleteTransaction={expenses.handleDeleteTransaction} actionBusy={expenses.expenseBusy} />;
      case "notifications":
        return <NotificationsPage notifications={dataBundle.notificationsData} notificationsBusy={dataBundle.notificationsBusy} onRespond={handleInviteResponse} />;
      case "setup":
        return <SetupFlowPage checklist={setupChecklist} onNavigate={navigate} soloMode={soloMode} />;
      case "more":
        return <MorePage onNavigate={navigate} onLogout={handleLogout} items={moreNavItems} onUnhideItem={toggleHideNavItem} />;
      case "settings":
        return (
          <SettingsPage
            session={session}
            soloMode={soloMode}
            incomeProfileForm={dataBundle.incomeProfileForm}
            onIncomeProfileChange={(e) => {
              setPageError("");
              dataBundle.setIncomeProfileForm((p) => ({ ...p, [e.target.name]: e.target.value }));
            }}
            onIncomeProfileSubmit={handleIncomeProfileSubmit}
            incomeProfileBusy={incomeProfileBusy}
            theme={theme}
            currencyCode={currencyCode}
            baseCurrencyCode={baseCurrencyCode}
            exchangeRateLabel={settings.exchangeRateLabel}
            mmkRateData={settings.mmkRateData}
            mmkRateForm={settings.mmkRateForm}
            mmkRateBusy={settings.mmkRateBusy}
            onThemeChange={(e) => setTheme(e.target.value)}
            onCurrencyChange={settings.handleCurrencyChange}
            onBaseCurrencyChange={settings.handleBaseCurrencyChange}
            onMmkRateChange={settings.handleMmkRateChange}
            onMmkRateSubmit={settings.handleMmkRateSubmit}
            onRedeemCoupon={paywall.handleRedeemCoupon}
            isPro={isPro}
            onInvitePartner={handleInvitePartnerFromSettings}
            onUnlinkPartner={handleUnlinkPartner}
            inviteBusy={linkBusy}
            onNavigate={navigate}
          />
        );
      case "paywall":
        return <PaywallPage onSubscribe={paywall.handleSubscribeIAP} onContinueFree={() => navigate("home")} onRestore={paywall.handleRestorePurchases} busy={paywall.paywallBusy} restoreBusy={paywall.restoreBusy} />;
      case "privacy-policy":
        return <PrivacyPolicyPage onBack={() => navigate("settings")} />;
      case "terms-of-service":
        return <TermsOfServicePage onBack={() => navigate("settings")} />;
      default:
        return (
          <HomePage
            summaryData={dataBundle.summaryData}
            dashboard={dashboard}
            dashboardBusy={dataBundle.dashboardBusy}
            coachProfile={dataBundle.coachProfile}
            soloMode={soloMode}
            couple={couple}
            onNavigateToCoach={() => navigate("coach")}
            setupChecklist={setupChecklist}
            onNavigateToSetup={() => navigate("setup")}
            onSendMessage={coach.handleCoachChat}
          />
        );
    }
  }

  return (
    <>
      <AppShell
        route={route}
        onNavigate={navigate}
        coupleNames={coupleNames}
        remainingBudget={dataBundle.remainingBudget}
        showNotifications
        showCoach={showCoach}
        showPlanner={showPlanner}
        showSetup={showSetup}
        hiddenNavItems={hiddenNavItems}
        onHideNavItem={toggleHideNavItem}
        onLogout={handleLogout}
        pageError={pageError}
        onDismissError={() => setPageError("")}
        onRetryLoad={
          !session
            ? () => dataBundle.refreshDashboardBundle().catch((e) => setPageError(e.message))
            : undefined
        }
        pageTabs={PAGE_TABS[route] ?? []}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div key={route} className="hb-page-enter">{renderPage()}</div>
      </AppShell>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      )}
    </>
  );
}
