import { Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { ActionButton, Input, Select, Textarea } from "../ui.jsx";

const PAY_SCHEDULE_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "monthly", label: "Monthly (once a month)" },
  { value: "twice-monthly", label: "Twice a month" },
  { value: "bi-weekly", label: "Every two weeks" },
  { value: "weekly", label: "Weekly" },
];

const GOAL_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Build an emergency fund", label: "Build an emergency fund" },
  { value: "Pay off debt", label: "Pay off debt" },
  { value: "Save for a home", label: "Save for a home" },
  { value: "Save for travel", label: "Save for travel" },
  { value: "Feel more stable month to month", label: "Feel more stable month to month" },
  { value: "Stop fighting about money", label: "Stop fighting about money", couplesOnly: true },
];

const HORIZON_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "In the next 3 months", label: "In the next 3 months" },
  { value: "In the next 6 months", label: "In the next 6 months" },
  { value: "Within 1 year", label: "Within 1 year" },
  { value: "Over the next few years", label: "Over the next few years" },
];

const STRESS_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Overspending without noticing", label: "Overspending without noticing" },
  { value: "Not saving enough", label: "Not saving enough" },
  { value: "Debt pressure", label: "Debt pressure" },
  { value: "Cash flow between paydays", label: "Cash flow between paydays" },
  { value: "Unexpected expenses", label: "Unexpected expenses" },
  { value: "One of us spending more than expected", label: "One of us spending more than expected", couplesOnly: true },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Dining", label: "Dining" },
  { value: "Groceries", label: "Groceries" },
  { value: "Shopping", label: "Shopping" },
  { value: "Transport", label: "Transport" },
  { value: "Entertainment", label: "Entertainment" },
  { value: "Cash spending", label: "Cash spending" },
  { value: "Subscriptions", label: "Subscriptions" },
  { value: "Debt Payment", label: "Debt Payment" },
];

const CONFLICT_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Surprise purchases", label: "Surprise purchases" },
  { value: "One person feels like they carry more", label: "One person feels like they carry more", couplesOnly: true },
  { value: "We do not check in before bigger spending", label: "We do not check in before bigger spending", couplesOnly: true },
  { value: "We have different priorities", label: "We have different priorities", couplesOnly: true },
  { value: "Cash disappears too easily", label: "Cash disappears too easily" },
  { value: "I spend impulsively", label: "I spend impulsively" },
  { value: "I avoid checking my finances", label: "I avoid checking my finances" },
];

const FOCUS_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Help us spend less in weak categories", label: "Help us spend less in weak categories", couplesOnly: true },
  { value: "Help me spend less in weak categories", label: "Help me spend less in weak categories", soloOnly: true },
  { value: "Help us save consistently", label: "Help us save consistently", couplesOnly: true },
  { value: "Help me save consistently", label: "Help me save consistently", soloOnly: true },
  { value: "Help us reduce money arguments", label: "Help us reduce money arguments", couplesOnly: true },
  { value: "Help us pay off debt faster", label: "Help us pay off debt faster", couplesOnly: true },
  { value: "Help me pay off debt faster", label: "Help me pay off debt faster", soloOnly: true },
  { value: "Help us stick to weekly limits", label: "Help us stick to weekly limits", couplesOnly: true },
  { value: "Help me stick to a budget", label: "Help me stick to a budget", soloOnly: true },
  { value: "Help me build better money habits", label: "Help me build better money habits", soloOnly: true },
];

function filterOptions(options, soloMode) {
  return options.filter((opt) => {
    if (soloMode && opt.couplesOnly) return false;
    if (!soloMode && opt.soloOnly) return false;
    return true;
  });
}

function CoachSetupPage({ coachProfileForm, onChange, onSubmit, busy, completed, soloMode = false }) {
  const { t } = useLanguage();

  const stressOptions = filterOptions(STRESS_OPTIONS, soloMode);
  const conflictOptions = filterOptions(CONFLICT_OPTIONS, soloMode);
  const focusOptions = filterOptions(FOCUS_OPTIONS, soloMode);

  return (
    <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-600" />
        <div>
          <h2 className="text-2xl font-semibold">{soloMode ? t("coach.soloTitle") : t("coach.title")}</h2>
          <p className="text-sm text-slate-600">{soloMode ? t("coach.soloSubtitle") : t("coach.subtitle")}</p>
        </div>
      </div>

      <div className="hb-panel-highlight mt-4 rounded-3xl px-4 py-4 text-sm leading-6 text-amber-900">
        <p className="font-semibold">{t("coach.whyTitle")}</p>
        <p className="mt-1">{soloMode ? t("coach.soloWhyBody") : t("coach.whyBody")}</p>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={soloMode ? t("coach.soloPrimaryGoal") : t("coach.primaryGoal")}
            name="primaryGoal"
            value={coachProfileForm.primaryGoal}
            onChange={onChange}
            options={GOAL_OPTIONS}
          />
          <Select
            label={t("coach.goalHorizon")}
            name="goalHorizon"
            value={coachProfileForm.goalHorizon}
            onChange={onChange}
            options={HORIZON_OPTIONS}
          />
          <Select
            label={t("coach.biggestMoneyStress")}
            name="biggestMoneyStress"
            value={coachProfileForm.biggestMoneyStress}
            onChange={onChange}
            options={stressOptions}
          />
          <Select
            label={t("coach.hardestCategory")}
            name="hardestCategory"
            value={coachProfileForm.hardestCategory}
            onChange={onChange}
            options={CATEGORY_OPTIONS}
          />
          <Select
            label={soloMode ? t("coach.soloConflictTrigger") : t("coach.conflictTrigger")}
            name="conflictTrigger"
            value={coachProfileForm.conflictTrigger}
            onChange={onChange}
            options={conflictOptions}
          />
          <Select
            label={t("coach.coachingFocus")}
            name="coachingFocus"
            value={coachProfileForm.coachingFocus}
            onChange={onChange}
            options={focusOptions}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Monthly budget target"
            name="monthlyBudgetTarget"
            type="number"
            min="0"
            step="0.01"
            value={coachProfileForm.monthlyBudgetTarget}
            onChange={onChange}
            placeholder="e.g. 3000.00"
          />
          <Select
            label="Pay schedule"
            name="paySchedule"
            value={coachProfileForm.paySchedule}
            onChange={onChange}
            options={PAY_SCHEDULE_OPTIONS}
          />
          <Input
            label={soloMode ? "Personal spending allowance" : "Personal allowance per person"}
            name="personalAllowance"
            type="number"
            min="0"
            step="0.01"
            value={coachProfileForm.personalAllowance}
            onChange={onChange}
            placeholder="e.g. 200.00"
          />
          <Input
            label="Total debt to pay off (optional)"
            name="totalDebtAmount"
            type="number"
            min="0"
            step="0.01"
            value={coachProfileForm.totalDebtAmount}
            onChange={onChange}
            placeholder="e.g. 5000.00"
          />
        </div>

        <Textarea
          label={t("coach.notes")}
          name="notes"
          value={coachProfileForm.notes}
          onChange={onChange}
          placeholder={soloMode ? t("coach.soloNotesPlaceholder") : t("coach.notesPlaceholder")}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {completed ? t("coach.completedHelp") : t("coach.requiredHelp")}
          </p>
          <ActionButton busy={busy} className="sm:w-auto">
            {completed ? t("coach.update") : t("coach.save")}
          </ActionButton>
        </div>
      </form>
    </section>
  );
}

export default CoachSetupPage;
