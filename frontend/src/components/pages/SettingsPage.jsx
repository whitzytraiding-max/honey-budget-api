import { useState } from "react";
import { STORAGE_KEYS, readStorage, writeStorage } from "../../lib/storage.js";
import { Check, Lock, LogOut, Settings2, Sparkles, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { isNative } from "../../lib/native.js";
import { ActionButton, Input, Select, ToggleGroup } from "../ui.jsx";

const MMK_UNLOCK_CODE = "YANGON-2026";

// Representative swatches for the theme picker — keep in sync with styles.css.
const THEME_OPTIONS = [
  { key: "honey", name: "Honey Cream", swatches: ["#FBF6EC", "#FFFFFF", "#E0991A", "#1FA971"] },
  { key: "midnight", name: "Midnight Honey", swatches: ["#17140F", "#2A2620", "#E8A92C", "#36C588"] },
  { key: "mint", name: "Fresh Mint", swatches: ["#F4FAF6", "#FFFFFF", "#10A37A", "#15A34A"] },
  { key: "rose", name: "Rose Berry", swatches: ["#FCF4F6", "#FFFFFF", "#D6457E", "#1FA971"] },
  { key: "ocean", name: "Ocean Slate", swatches: ["#F1F5F9", "#FFFFFF", "#2C7BB8", "#16A34A"] },
  { key: "system", name: "Match device", swatches: ["#FBF6EC", "#17140F", "#E0991A", "#36C588"] },
];

function ThemePicker({ value, onChange }) {
  return (
    <div className="hb-theme-grid">
      {THEME_OPTIONS.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            className="hb-theme-card"
            data-active={active}
            aria-pressed={active}
            onClick={() => onChange(option.key)}
          >
            {active ? (
              <span className="hb-theme-check">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            ) : null}
            <span className="hb-theme-swatches">
              {option.swatches.map((color, i) => (
                <span key={i} className="hb-theme-swatch" style={{ background: color }} />
              ))}
            </span>
            <span className="hb-theme-name">{option.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function SettingsPage({
  session,
  soloMode = false,
  incomeProfileForm,
  onIncomeProfileChange,
  onIncomeProfileSubmit,
  incomeProfileBusy,
  theme,
  simpleMode = false,
  onExperienceModeChange,
  currencyCode,
  baseCurrencyCode,
  exchangeRateLabel,
  mmkRateData,
  mmkRateForm,
  mmkRateBusy,
  onThemeChange,
  onCurrencyChange,
  onBaseCurrencyChange,
  onMmkRateChange,
  onMmkRateSubmit,
  isPro,
  onInvitePartner,
  onUnlinkPartner,
  inviteBusy,
  onNavigate,
  onLogout,
  onDeleteAccount,
}) {
  const [mmkUnlocked, setMmkUnlocked] = useState(() => localStorage.getItem("hb-mmk-unlocked") === "true");
  const [defaultExpenseCurrency, setDefaultExpenseCurrency] = useState(
    () => readStorage(STORAGE_KEYS.DEFAULT_EXPENSE_CURRENCY, "") || baseCurrencyCode || "USD",
  );
  const [mmkCodeInput, setMmkCodeInput] = useState("");
  const [mmkCodeError, setMmkCodeError] = useState("");
  const SETTINGS_TABS = mmkUnlocked ? ["profile", "display", "mmk"] : ["profile", "display"];
  const [activeTab, setActiveTab] = useState("profile");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState(null); // { ok: bool, message: string }
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { locale, setLocale, supportedLocales, t } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const user = session?.user;
  const partner =
    session?.couple && session.couple.userOne.id === session.user.id
      ? session.couple.userTwo
      : session?.couple?.userOne;

  const tabLabels = {
    profile: t("settings.title"),
    display: t("settings.displayCurrency"),
    mmk: "MMK Rate",
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-slate-700" />
          <div>
            <h2 className="text-2xl font-semibold">{t("settings.title")}</h2>
            <p className="text-sm text-slate-600">{t("settings.subtitle")}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="hb-panel-soft mt-5 grid grid-cols-3 rounded-2xl p-1">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-[0.85rem] px-3 py-2.5 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "profile" ? t("settings.title") : tab === "display" ? "Display" : "MMK Rate"}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === "profile" && (
          <form className="mt-6 grid gap-4" onSubmit={onIncomeProfileSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("settings.cashIncome")}
                name="salaryCashAmount"
                type="number"
                min="0"
                step="0.01"
                value={incomeProfileForm.salaryCashAmount}
                onChange={onIncomeProfileChange}
                placeholder="0.00"
              />
              <Input
                label={t("settings.cardIncome")}
                name="salaryCardAmount"
                type="number"
                min="0"
                step="0.01"
                value={incomeProfileForm.salaryCardAmount}
                onChange={onIncomeProfileChange}
                placeholder="4200.00"
              />
            </div>

            <Select
              label={t("settings.incomeCurrency")}
              name="incomeCurrencyCode"
              value={incomeProfileForm.incomeCurrencyCode}
              onChange={onIncomeProfileChange}
              options={currencyOptions}
            />

            <Input
              label={t("settings.incomeDayOfMonth")}
              name="incomeDayOfMonth"
              type="number"
              min="1"
              max="28"
              step="1"
              value={incomeProfileForm.incomeDayOfMonth}
              onChange={onIncomeProfileChange}
              placeholder="1"
            />

            <div className="hb-panel-soft rounded-3xl px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("settings.totalMonthlySalary")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currency(Number(incomeProfileForm.salaryCashAmount || 0) + Number(incomeProfileForm.salaryCardAmount || 0), {
                  sourceCurrency: incomeProfileForm.incomeCurrencyCode,
                  convert: false,
                })}
              </p>
            </div>

            <ActionButton busy={incomeProfileBusy} className="sm:w-auto">
              {t("settings.save")}
            </ActionButton>
          </form>
        )}

        {/* Display tab */}
        {activeTab === "display" && (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t("settings.language")}
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                options={supportedLocales.map((entry) => ({
                  value: entry,
                  label: entry === "en" ? "English" : "Español",
                }))}
              />
              <Select
                label={t("settings.displayCurrency")}
                value={currencyCode}
                onChange={onCurrencyChange}
                options={currencyOptions}
              />
              <Select
                label={t("settings.referenceCurrency")}
                value={baseCurrencyCode}
                onChange={onBaseCurrencyChange}
                options={currencyOptions}
              />
              <Select
                label="Default expense currency"
                value={defaultExpenseCurrency}
                onChange={(e) => {
                  setDefaultExpenseCurrency(e.target.value);
                  writeStorage(STORAGE_KEYS.DEFAULT_EXPENSE_CURRENCY, e.target.value);
                }}
                options={currencyOptions}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{t("settings.theme")}</p>
              <ThemePicker value={theme} onChange={onThemeChange} />
            </div>

            <div>
              <ToggleGroup
                label="App experience"
                name="experienceMode"
                value={simpleMode ? "simple" : "advanced"}
                onChange={(e) => onExperienceModeChange?.(e.target.value)}
                options={[
                  { value: "simple", label: "Simple" },
                  { value: "advanced", label: "Advanced" },
                ]}
              />
              <p className="mt-2 text-sm text-slate-600">
                {simpleMode
                  ? "Showing just the essentials — Home, Expenses, Savings and Hunny. Switch to Advanced to unlock insights, planners, debt tracking and more."
                  : "Showing every tool. Switch to Simple for a cleaner, easier view with just the essentials."}
              </p>
            </div>

            <div className="hb-panel-soft rounded-3xl px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("settings.exchangeRate")}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {baseCurrencyCode === currencyCode
                  ? t("settings.noConversionNeeded")
                  : exchangeRateLabel || t("settings.loadingRate")}
              </p>
              <p className="mt-2 text-sm text-slate-600">{t("settings.currencyHint")}</p>
            </div>

            <div className="hb-panel-soft rounded-3xl px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("settings.howItWorks")}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">{t("settings.homeCurrencyLabel")}:</span>{" "}
                  {incomeProfileForm.incomeCurrencyCode} {t("settings.howItWorksLineOne")}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">{t("settings.displayCurrencyLabel")}:</span>{" "}
                  {currencyCode} {t("settings.howItWorksLineTwo")}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">{t("settings.referenceCurrencyLabel")}:</span>{" "}
                  {baseCurrencyCode} {t("settings.referenceCurrencyHelp")}
                </p>
                <p>{t("settings.howItWorksLineThree")}</p>
                <p className="hb-surface-strong rounded-2xl px-3 py-3 text-slate-700">
                  {t("settings.howItWorksPlainEnglish")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MMK Rate tab */}
        {activeTab === "mmk" && (
          <div className="mt-6">
            <p className="text-sm text-slate-600">{t("settings.mmkMonthlyRateHelp")}</p>

            {session?.couple || soloMode ? (
              <>
                <div className="hb-panel-soft mt-4 rounded-3xl px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t("settings.mmkMonthlyRate")}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {mmkRateData?.rate
                      ? `1 USD = ${Number(mmkRateData.rate.rate).toFixed(2)} MMK · ${String(
                          mmkRateData.rate.rateSource ?? "custom",
                        ).toUpperCase()} · ${String(mmkRateData.month).padStart(2, "0")}/${mmkRateData.year}`
                      : t("settings.mmkMissingRate")}
                  </p>
                </div>

                <form className="mt-4 grid gap-4" onSubmit={onMmkRateSubmit}>
                  <Input
                    label="MMK rate month"
                    name="monthKey"
                    type="month"
                    value={`${mmkRateForm.year}-${String(mmkRateForm.month).padStart(2, "0")}`}
                    onChange={onMmkRateChange}
                  />
                  <Select
                    label={t("settings.mmkRateSource")}
                    name="rateSource"
                    value={mmkRateForm.rateSource}
                    onChange={onMmkRateChange}
                    options={[
                      { value: "kbz", label: t("settings.mmkKbzOption") },
                      { value: "custom", label: t("settings.mmkCustomOption") },
                    ]}
                  />
                  {mmkRateForm.rateSource === "custom" ? (
                    <Input
                      label={t("settings.mmkCustomRateInput")}
                      name="rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={mmkRateForm.rate}
                      onChange={onMmkRateChange}
                      placeholder="4500.00"
                    />
                  ) : (
                    <div className="hb-surface-strong rounded-2xl px-3 py-3 text-sm text-slate-700">
                      {t("settings.mmkKbzAutoFetch")}
                    </div>
                  )}
                  <div className="hb-surface-strong rounded-2xl px-3 py-3 text-sm text-slate-700">
                    {t("settings.mmkPlainEnglish")}
                  </div>
                  <ActionButton busy={mmkRateBusy} className="sm:w-auto">
                    {t("settings.saveMmkRate")}
                  </ActionButton>
                </form>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">{t("settings.mmkCoupleRequired")}</p>
            )}
          </div>
        )}
      </section>

      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-emerald-700" />
          <div>
            <h2 className="text-2xl font-semibold">{t("settings.household")}</h2>
            <p className="text-sm text-slate-600">{t("settings.householdSubtitle")}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="hb-panel-soft rounded-3xl px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("settings.you")}
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{user?.name}</p>
            <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
            <p className="mt-3 text-sm text-slate-600">
              Cash {currency(user?.salaryCashAmount ?? 0, {
                sourceCurrency: user?.incomeCurrencyCode || "USD",
                convert: false,
              })}{" "}
              · Card{" "}
              {currency(user?.salaryCardAmount ?? 0, {
                sourceCurrency: user?.incomeCurrencyCode || "USD",
                convert: false,
              })}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("settings.incomeDayOfMonth")}: {user?.incomeDayOfMonth ?? 1}
            </p>
          </div>

          <div className="hb-panel-mint rounded-3xl px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("settings.partner")}
            </p>
            {partner ? (
              <>
                <p className="mt-2 text-xl font-semibold text-slate-900">{partner.name}</p>
                <p className="mt-1 text-sm text-slate-500">{partner.email}</p>
                <p className="mt-3 text-sm text-slate-600">
                  Cash {currency(partner.salaryCashAmount ?? 0, {
                    sourceCurrency: partner.incomeCurrencyCode || "USD",
                    convert: false,
                  })}{" "}
                  · Card{" "}
                  {currency(partner.salaryCardAmount ?? 0, {
                    sourceCurrency: partner.incomeCurrencyCode || "USD",
                    convert: false,
                  })}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {t("settings.incomeDayOfMonth")}: {partner.incomeDayOfMonth ?? 1}
                </p>
                <div className="mt-4 border-t border-slate-200/60 pt-4">
                  {confirmUnlink ? (
                    <div className="space-y-2">
                      <p className="text-xs text-rose-600 font-medium">
                        This will unlink your partner and delete all shared data (bills, rules, MMK rates). Are you sure?
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:opacity-50"
                          disabled={inviteBusy}
                          onClick={onUnlinkPartner}
                          type="button"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Yes, remove partner
                        </button>
                        <button
                          className="rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700"
                          onClick={() => setConfirmUnlink(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setConfirmUnlink(true)}
                      type="button"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Remove partner
                    </button>
                  )}
                </div>
              </>
            ) : soloMode ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600">Invite a partner</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Got a partner? Send them an invite to share this dashboard.
                </p>
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!inviteEmail.trim()) return;
                    setInviteResult(null);
                    try {
                      await onInvitePartner(inviteEmail);
                    } catch (err) {
                      setInviteResult({ ok: false, message: err.message || "Failed to send invite." });
                    }
                  }}
                >
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    type="email"
                    placeholder="partner@example.com"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteResult(null);
                    }}
                    disabled={inviteBusy}
                  />
                  <ActionButton busy={inviteBusy} className="w-full">
                    Send invite
                  </ActionButton>
                </form>
                {inviteResult && !inviteResult.ok && (
                  <p className="mt-2 text-xs font-medium text-rose-600">{inviteResult.message}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-xl font-semibold text-slate-900">{t("settings.notLinked")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("settings.partnerHint")}</p>
              </>
            )}
          </div>
        </div>
      </section>

      {!isPro && onNavigate && (
        <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="text-2xl font-semibold">Honey Budget Pro</h2>
              <p className="text-sm text-slate-600">$4.99/month · Unlock AI Coach, savings goals &amp; insights</p>
            </div>
          </div>
          <button
            className="mt-5 w-full rounded-[1.2rem] bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-amber-500"
            type="button"
            onClick={() => onNavigate("paywall")}
          >
            Upgrade to Pro
          </button>
        </section>
      )}


      {!mmkUnlocked && (
        <div className="hb-surface-card rounded-[2rem] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-medium text-slate-400">Feature unlock</p>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-[1rem] border border-slate-200 bg-white/92 px-4 py-3 text-sm font-mono uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal focus:border-amber-300 focus:ring-4 focus:ring-amber-100/20"
              placeholder="Enter code"
              value={mmkCodeInput}
              maxLength={20}
              onChange={(e) => { setMmkCodeInput(e.target.value.toUpperCase()); setMmkCodeError(""); }}
            />
            <button
              className="hb-button-primary rounded-[1rem] px-4 py-3 text-sm font-medium"
              type="button"
              onClick={() => {
                if (mmkCodeInput.trim() === MMK_UNLOCK_CODE) {
                  localStorage.setItem("hb-mmk-unlocked", "true");
                  setMmkUnlocked(true);
                  setMmkCodeInput("");
                  setMmkCodeError("");
                } else {
                  setMmkCodeError("Invalid code.");
                }
              }}
            >
              Unlock
            </button>
          </div>
          {mmkCodeError && <p className="mt-2 text-xs text-rose-400">{mmkCodeError}</p>}
        </div>
      )}

      {/* Logout — shown on native (desktop has it in the header) */}
      {onLogout && isNative() && (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-slate-200/40 bg-white/10 px-4 py-4 text-sm font-medium text-slate-300 transition hover:bg-white/20"
          onClick={onLogout}
          type="button"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      )}

      {/* Delete account */}
      {onDeleteAccount && (
        <section className="hb-surface-card rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <Trash2 className="h-4 w-4 text-rose-500" />
            <h2 className="text-base font-semibold text-slate-900">Delete Account</h2>
          </div>

          {confirmDelete ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-rose-700">
                This will permanently delete your account and all data — transactions, savings, debts, and partner links. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  disabled={deleteBusy}
                  onClick={async () => {
                    setDeleteBusy(true);
                    await onDeleteAccount();
                  }}
                  type="button"
                >
                  {deleteBusy ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              onClick={() => setConfirmDelete(true)}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete my account
            </button>
          )}
        </section>
      )}

      {onNavigate && (
        <div className="flex justify-center gap-4 pb-2">
          <button
            className="text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-600"
            onClick={() => onNavigate("privacy-policy")}
            type="button"
          >
            Privacy Policy
          </button>
          <button
            className="text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-600"
            onClick={() => onNavigate("terms-of-service")}
            type="button"
          >
            Terms of Service
          </button>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
