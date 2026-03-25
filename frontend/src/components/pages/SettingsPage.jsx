import { Settings2, Users } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { ActionButton, Input, Select } from "../ui.jsx";

function SettingsPage({
  session,
  incomeProfileForm,
  onIncomeProfileChange,
  onIncomeProfileSubmit,
  incomeProfileBusy,
  theme,
  currencyCode,
  baseCurrencyCode,
  exchangeRateLabel,
  onThemeChange,
  onCurrencyChange,
  onBaseCurrencyChange,
}) {
  const { locale, setLocale, supportedLocales, t } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const user = session?.user;
  const partner =
    session?.couple && session.couple.userOne.id === session.user.id
      ? session.couple.userTwo
      : session?.couple?.userOne;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-slate-700" />
          <div>
            <h2 className="text-2xl font-semibold">{t("settings.title")}</h2>
            <p className="text-sm text-slate-600">{t("settings.subtitle")}</p>
          </div>
        </div>

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

          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("settings.totalMonthlySalary")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {currency(
                Number(incomeProfileForm.salaryCashAmount || 0) +
                  Number(incomeProfileForm.salaryCardAmount || 0),
              )}
            </p>
          </div>

          <ActionButton busy={incomeProfileBusy} className="sm:w-auto">
            {t("settings.save")}
          </ActionButton>
        </form>

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
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
            label={t("settings.baseCurrency")}
            value={baseCurrencyCode}
            onChange={onBaseCurrencyChange}
            options={currencyOptions}
          />
          <Select
            label={t("settings.displayCurrency")}
            value={currencyCode}
            onChange={onCurrencyChange}
            options={currencyOptions}
          />
          <Select
            label={t("settings.theme")}
            value={theme}
            onChange={onThemeChange}
            options={[
              { value: "system", label: t("settings.systemMode") },
              { value: "light", label: t("settings.lightMode") },
              { value: "dark", label: t("settings.darkMode") },
            ]}
          />
        </div>
        <div className="mt-4 rounded-3xl bg-slate-50 px-4 py-4">
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
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-emerald-700" />
          <div>
            <h2 className="text-2xl font-semibold">{t("settings.household")}</h2>
            <p className="text-sm text-slate-600">{t("settings.householdSubtitle")}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("settings.you")}
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{user?.name}</p>
            <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
            <p className="mt-3 text-sm text-slate-600">
              Cash {currency(user?.salaryCashAmount ?? 0)} · Card{" "}
              {currency(user?.salaryCardAmount ?? 0)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("settings.incomeDayOfMonth")}: {user?.incomeDayOfMonth ?? 1}
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("settings.partner")}
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{partner?.name || t("settings.notLinked")}</p>
            <p className="mt-1 text-sm text-slate-500">{partner?.email || t("settings.partnerHint")}</p>
            <p className="mt-3 text-sm text-slate-600">
              Cash {currency(partner?.salaryCashAmount ?? 0)} · Card{" "}
              {currency(partner?.salaryCardAmount ?? 0)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("settings.incomeDayOfMonth")}: {partner?.incomeDayOfMonth ?? 1}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
