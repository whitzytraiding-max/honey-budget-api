/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { Bell, Brain, CalendarDays, ClipboardList, Ellipsis, House, Settings2, Wallet } from "lucide-react";
import { PiggyBank } from "lucide-react";
import { currency } from "../lib/format.js";
import { hapticLight } from "../lib/native.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: House },
  { key: "expenses", label: "Expenses", icon: Wallet },
  { key: "savings", label: "Savings", icon: PiggyBank },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "insights", label: "Insights", icon: Brain },
  { key: "history", label: "History", icon: ClipboardList },
  { key: "settings", label: "Settings", icon: Settings2 },
];

function AppShell({
  route,
  onNavigate,
  coupleNames,
  remainingBudget,
  showNotifications,
  onLogout,
  children,
  pageError,
  onDismissError,
  onRetryLoad,
}) {
  function handleNavTap(key) {
    hapticLight();
    onNavigate(key);
  }
  const { t } = useLanguage();
  const localizedNavItems = [
    { ...NAV_ITEMS[0], label: t("nav.home") },
    { ...NAV_ITEMS[1], label: t("nav.expenses") },
    { ...NAV_ITEMS[2], label: t("nav.savings") },
    { ...NAV_ITEMS[4], label: t("nav.calendar") },
    { ...NAV_ITEMS[5], label: t("nav.insights") },
    { ...NAV_ITEMS[6], label: t("nav.history") },
    { ...NAV_ITEMS[7], label: t("nav.settings") },
  ];
  const desktopNavItems = showNotifications
    ? [
        ...localizedNavItems.slice(0, 3),
        { ...NAV_ITEMS[3], label: t("nav.notifications") },
        ...localizedNavItems.slice(3),
      ]
    : localizedNavItems;
  const mobileNavItems = [
    { key: "home", label: t("nav.home"), icon: House },
    { key: "expenses", label: t("nav.expenses"), icon: Wallet },
    { key: "savings", label: t("nav.savings"), icon: PiggyBank },
    { key: "more", label: t("nav.more"), icon: Ellipsis },
  ];
  const isMoreRoute =
    route === "more" || ["coach", "notifications", "calendar", "insights", "history", "settings"].includes(route);

  return (
    <div className="min-h-screen bg-transparent px-2.5 py-3 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10">
        <header className="hb-surface-card hb-header-panel rounded-[1.5rem] p-3.5 sm:rounded-[1.75rem] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="hb-brand-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs">
                <img alt="Honey Budget" className="h-4 w-4" src="/icons/brand-mark.svg" />
                {t("shell.title")}
              </div>
              <h1 className="mt-3 max-w-4xl text-[1.9rem] font-semibold leading-tight tracking-tight sm:mt-4 sm:text-4xl">
                {coupleNames || "Shared Money Mode"}
              </h1>
              <p className="mt-1 hidden text-sm leading-6 text-slate-600 sm:block sm:text-base">
                {t("shell.subtitle")}
              </p>
            </div>

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
          </div>

          <nav className={`mt-5 hidden gap-3 md:grid ${showNotifications ? "grid-cols-8" : "grid-cols-7"}`}>
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = route === item.key;

              return (
                <button
                  key={item.key}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive ? "hb-nav-active" : "hb-nav-idle"
                  }`}
                  onClick={() => handleNavTap(item.key)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {pageError ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{pageError}</span>
            <div className="flex shrink-0 items-center gap-2">
              {onRetryLoad ? (
                <button
                  className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-200"
                  onClick={onRetryLoad}
                  type="button"
                >
                  Retry
                </button>
              ) : null}
              {onDismissError ? (
                <button
                  className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-200"
                  onClick={onDismissError}
                  type="button"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 sm:mt-6">{children}</div>

        <footer className="mt-6 px-2 text-center text-xs leading-5 text-slate-500">
          <p>{t("legal.ownership")}</p>
          <p>{t("legal.rightsReserved")}</p>
        </footer>
      </div>

      <nav className="hb-surface-strong fixed inset-x-2.5 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-20 rounded-[1.35rem] p-1.5 md:hidden">
        <div className="grid grid-cols-4 gap-1.5">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === "more" ? isMoreRoute : route === item.key;

            return (
              <button
                key={item.key}
                className={`flex min-h-[56px] flex-col items-center justify-center rounded-[0.95rem] px-1.5 py-2 text-[10px] font-medium transition ${
                  isActive ? "hb-nav-active" : "text-slate-600"
                }`}
                onClick={() => handleNavTap(item.key)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span className="mt-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default AppShell;
