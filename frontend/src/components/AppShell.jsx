/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { useState } from "react";
import PullToRefresh from "./PullToRefresh.jsx";
import {
  BarChart2,
  Bell,
  Brain,
  CalendarDays,
  ClipboardList,
  CreditCard,
  House,
  ListTodo,
  Map,
  Menu,
  PiggyBank,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { currency } from "../lib/format.js";
import { hapticLight } from "../lib/native.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";
import Sidebar from "./Sidebar.jsx";

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

function AppShell({
  route,
  onNavigate,
  coupleNames,
  remainingBudget,
  showNotifications,
  showCoach,
  showPlanner,
  showSetup,
  hiddenNavItems,
  onHideNavItem,
  onLogout,
  children,
  pageError,
  onDismissError,
  onRetryLoad,
  onRefresh,
  pageTabs = [],
  activeTab,
  onTabChange,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useLanguage();

  const availableItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.key === "notifications") return showNotifications;
    if (item.key === "coach") return showCoach;
    if (item.key === "planner") return showPlanner;
    if (item.key === "setup") return showSetup;
    return true;
  }).map((item) => ({ ...item, label: t(`nav.${item.key}`) || item.key }));

  const sidebarItems = availableItems.filter((item) => !hiddenNavItems.has(item.key));
  const hiddenCount = availableItems.filter((item) => hiddenNavItems.has(item.key)).length;

  function handleNavTap(key) {
    hapticLight();
    onNavigate(key);
  }

  return (
    <div className="min-h-screen bg-transparent text-[#f0e0c0]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={sidebarItems}
        onNavigate={onNavigate}
        onHideItem={onHideNavItem}
        route={route}
        hiddenCount={hiddenCount}
        onMoreClick={() => onNavigate("more")}
      />

      {/* ── Mobile brand header ─────────────────────────────────────────── */}
      <div
        className="md:hidden flex items-center justify-between px-5"
        style={{ paddingTop: "max(0.75rem, var(--safe-top))", paddingBottom: "0.25rem" }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[1.6rem] font-bold lowercase leading-none"
              style={{ color: "#D4870A", letterSpacing: "-0.02em", fontFamily: "Avenir Next, Trebuchet MS, sans-serif" }}
            >
              honey budget
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(212, 135, 10, 0.5)" }}>
            Save sweetly, live happily. ♥
          </p>
        </div>
        <div className="flex items-center gap-1">
          <img
            src="/icons/money-cat.png"
            alt=""
            className="h-14 w-auto object-contain"
            style={{ imageRendering: "crisp-edges" }}
          />
          <button
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition active:opacity-70"
            style={{
              background: "rgba(42, 26, 8, 0.9)",
              border: "1px solid rgba(212, 135, 10, 0.35)",
              color: "#D4870A",
            }}
            onClick={() => setSidebarOpen(true)}
            type="button"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[9px] font-semibold tracking-wide">More</span>
          </button>
        </div>
      </div>

      {/* ── Desktop header (unchanged) ──────────────────────────────────── */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <header className="hb-surface-card hb-header-panel rounded-[1.5rem] p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <button
                  className="hb-button-secondary mt-0.5 shrink-0 rounded-[1rem] p-2.5 transition"
                  onClick={() => setSidebarOpen(true)}
                  type="button"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <div className="hb-brand-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs">
                    <img alt="Honey Budget" className="h-4 w-4" src="/icons/brand-mark.svg" />
                    {t("shell.title")}
                  </div>
                  <h1 className="mt-3 max-w-4xl text-[1.9rem] font-semibold leading-tight tracking-tight sm:mt-4 sm:text-4xl">
                    {coupleNames || "Your Household"}
                  </h1>
                  <p className="mt-1 hidden text-sm leading-6 sm:block sm:text-base" style={{ color: "rgba(240, 210, 160, 0.6)" }}>
                    {t("shell.subtitle")}
                  </p>
                </div>
              </div>

              {route !== "home" && route !== "paywall" && route !== "insights" && (
                <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
                  <div className="hb-summary-chip min-w-0 flex-1 rounded-[1.35rem] px-4 py-3 shadow-sm sm:min-w-[220px] sm:flex-none sm:rounded-[1.5rem] sm:px-5 sm:py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs">
                      {t("home.remaining")}
                    </p>
                    <p className="mt-1 text-xl font-semibold sm:text-2xl">{currency(remainingBudget)}</p>
                  </div>
                  <button
                    className="hb-button-secondary hidden rounded-[1.15rem] px-4 py-3 text-sm font-medium transition sm:block sm:rounded-[1.25rem]"
                    onClick={onLogout}
                    type="button"
                  >
                    {t("shell.logout")}
                  </button>
                </div>
              )}
            </div>
          </header>
        </div>
      </div>

      {/* ── Mobile sub-tabs (when page has tabs) ───────────────────────── */}
      {pageTabs.length > 0 && (
        <div className="md:hidden px-4 pt-2 pb-1">
          <div
            className="flex gap-1 p-1 rounded-full"
            style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.35)" }}
          >
            {pageTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className="flex-1 py-2 rounded-full text-sm font-medium transition"
                  style={{
                    background: isActive ? "#D4870A" : "transparent",
                    color: isActive ? "#fff" : "rgba(212, 135, 10, 0.5)",
                  }}
                  onClick={() => { hapticLight(); onTabChange(tab.key); }}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div
        className={`mx-auto max-w-6xl px-4 md:px-6 ${
          pageTabs.length > 0
            ? "pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-10"
        }`}
      >
        {pageError ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.5rem] border border-rose-700/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
            <span>{pageError}</span>
            <div className="flex shrink-0 items-center gap-2">
              {onRetryLoad ? (
                <button
                  className="rounded-lg bg-rose-900/60 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-800/60"
                  onClick={onRetryLoad}
                  type="button"
                >
                  Retry
                </button>
              ) : null}
              {onDismissError ? (
                <button
                  className="rounded-lg bg-rose-900/60 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-800/60"
                  onClick={onDismissError}
                  type="button"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-3 md:mt-6">
          {onRefresh ? (
            <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>
          ) : children}
        </div>

        <footer className="hidden md:block mt-6 px-2 text-center text-xs leading-5" style={{ color: "rgba(156, 120, 85, 0.6)" }}>
          <p>{t("legal.ownership")}</p>
          <p>{t("legal.rightsReserved")}</p>
          <button
            className="mt-1 underline underline-offset-2 transition hover:opacity-80"
            onClick={() => onNavigate("privacy-policy")}
            type="button"
          >
            Privacy Policy
          </button>
        </footer>
      </div>

      {/* ── Mobile 3-tab bottom nav ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-center justify-around px-6"
        style={{
          background: "#1e1508",
          borderTop: "1px solid rgba(100, 65, 20, 0.3)",
          paddingTop: "0.5rem",
          paddingBottom: "max(0.75rem, var(--safe-bottom))",
        }}
      >
        {/* Home */}
        <button
          className="flex flex-col items-center gap-1 flex-1 transition"
          style={{ color: route === "home" ? "#D4870A" : "rgba(212, 135, 10, 0.38)" }}
          onClick={() => handleNavTap("home")}
          type="button"
        >
          <House className="h-5 w-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        {/* Add — centre prominent button */}
        <div className="flex-1 flex justify-center">
          <button
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition -mt-5"
            style={{
              background: route === "expenses" ? "#B56A08" : "#D4870A",
              boxShadow: "0 8px 24px -6px rgba(180, 100, 5, 0.55)",
            }}
            onClick={() => handleNavTap("expenses")}
            type="button"
            aria-label="Add expense"
          >
            <Plus className="h-7 w-7 text-white" />
          </button>
        </div>

        {/* Reports */}
        <button
          className="flex flex-col items-center gap-1 flex-1 transition"
          style={{ color: route === "insights" ? "#D4870A" : "rgba(212, 135, 10, 0.38)" }}
          onClick={() => handleNavTap("insights")}
          type="button"
        >
          <BarChart2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Reports</span>
        </button>
      </nav>

      {/* ── Desktop page sub-tabs ───────────────────────────────────────── */}
      {pageTabs.length > 0 && (
        <nav className="hidden md:flex hb-surface-strong fixed inset-x-2.5 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-20 rounded-[1.35rem] p-1.5">
          <div className="flex gap-1.5 w-full">
            {pageTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className={`flex flex-1 min-h-[56px] flex-col items-center justify-center rounded-[0.95rem] px-1 py-2 text-[10px] font-medium transition ${
                    isActive ? "hb-nav-active" : "hb-nav-idle"
                  }`}
                  onClick={() => { hapticLight(); onTabChange(tab.key); }}
                  type="button"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="mt-1 truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export default AppShell;
