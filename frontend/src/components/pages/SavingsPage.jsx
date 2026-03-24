import { PiggyBank, Target } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";
import { ActionButton, Input } from "../ui.jsx";

function SavingsPage({
  savingsData,
  savingsForm,
  savingsTargetForm,
  onSavingsChange,
  onSavingsTargetChange,
  onSavingsSubmit,
  onSavingsTargetSubmit,
  savingsBusy,
  savingsTargetBusy,
}) {
  const { t } = useLanguage();
  const entries = savingsData?.entries ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr] xl:gap-6">
      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <div className="flex items-center gap-3">
            <PiggyBank className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">{t("savings.title")}</h2>
              <p className="text-sm text-slate-600">{t("savings.subtitle")}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("savings.householdTarget")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(savingsData?.householdSavingsTarget ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("savings.savedThisWindow")}
              </p>
              <p className="mt-2 text-xl font-semibold text-emerald-700">
                {currency(savingsData?.totalSavedThisWindow ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("savings.remainingToGoal")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(savingsData?.remainingToGoal ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("savings.dailySave")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(savingsData?.suggestedDailySave ?? 0)}
              </p>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 transition-all duration-500"
              style={{ width: `${savingsData?.targetProgressPct ?? 0}%` }}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-sky-700" />
            <div>
              <h3 className="text-lg font-semibold">{t("savings.yourTarget")}</h3>
            </div>
          </div>

          <form className="mt-4 space-y-4" onSubmit={onSavingsTargetSubmit}>
            <Input
              label={t("savings.yourTarget")}
              name="monthlySavingsTarget"
              type="number"
              min="0"
              step="0.01"
              value={savingsTargetForm.monthlySavingsTarget}
              onChange={onSavingsTargetChange}
              placeholder="300.00"
            />
            <ActionButton busy={savingsTargetBusy} className="sm:w-auto">
              {t("savings.saveTarget")}
            </ActionButton>
          </form>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <h3 className="text-lg font-semibold">{t("savings.addEntry")}</h3>

          <form className="mt-4 grid gap-4" onSubmit={onSavingsSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("savings.amount")}
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={savingsForm.amount}
                onChange={onSavingsChange}
                placeholder="125.00"
              />
              <Input
                label="Date"
                name="date"
                type="date"
                value={savingsForm.date}
                onChange={onSavingsChange}
              />
            </div>
            <Input
              label={t("savings.note")}
              name="note"
              value={savingsForm.note}
              onChange={onSavingsChange}
              placeholder={t("savings.notePlaceholder")}
            />
            <ActionButton busy={savingsBusy} className="sm:w-auto">
              {t("savings.saveEntry")}
            </ActionButton>
          </form>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <h3 className="text-lg font-semibold">{t("savings.recent")}</h3>

          <div className="mt-4 space-y-3">
            {entries.length ? (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.2rem] border border-slate-100 bg-slate-50/85 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{entry.note}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {entry.userName} · {entry.date}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-emerald-700">
                      {currency(entry.amount)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-slate-100 bg-slate-50/85 px-4 py-6 text-sm text-slate-500">
                {t("savings.empty")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default SavingsPage;
