import { Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { ActionButton, Select, Textarea } from "../ui.jsx";

const GOAL_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Build an emergency fund", label: "Build an emergency fund" },
  { value: "Pay off debt", label: "Pay off debt" },
  { value: "Save for a home", label: "Save for a home" },
  { value: "Save for travel", label: "Save for travel" },
  { value: "Feel more stable month to month", label: "Feel more stable month to month" },
  { value: "Stop fighting about money", label: "Stop fighting about money" },
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
  { value: "One of us spending more than expected", label: "One of us spending more than expected" },
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
  { value: "One person feels like they carry more", label: "One person feels like they carry more" },
  { value: "We do not check in before bigger spending", label: "We do not check in before bigger spending" },
  { value: "We have different priorities", label: "We have different priorities" },
  { value: "Cash disappears too easily", label: "Cash disappears too easily" },
];

const FOCUS_OPTIONS = [
  { value: "", label: "Choose one" },
  { value: "Help us spend less in weak categories", label: "Help us spend less in weak categories" },
  { value: "Help us save consistently", label: "Help us save consistently" },
  { value: "Help us reduce money arguments", label: "Help us reduce money arguments" },
  { value: "Help us pay off debt faster", label: "Help us pay off debt faster" },
  { value: "Help us stick to weekly limits", label: "Help us stick to weekly limits" },
];

function CoachSetupPage({ coachProfileForm, onChange, onSubmit, busy, completed }) {
  const { t } = useLanguage();

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/82 p-6 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-8">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-600" />
        <div>
          <h2 className="text-2xl font-semibold">{t("coach.title")}</h2>
          <p className="text-sm text-slate-600">{t("coach.subtitle")}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
        <p className="font-semibold">{t("coach.whyTitle")}</p>
        <p className="mt-1">{t("coach.whyBody")}</p>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("coach.primaryGoal")}
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
            options={STRESS_OPTIONS}
          />
          <Select
            label={t("coach.hardestCategory")}
            name="hardestCategory"
            value={coachProfileForm.hardestCategory}
            onChange={onChange}
            options={CATEGORY_OPTIONS}
          />
          <Select
            label={t("coach.conflictTrigger")}
            name="conflictTrigger"
            value={coachProfileForm.conflictTrigger}
            onChange={onChange}
            options={CONFLICT_OPTIONS}
          />
          <Select
            label={t("coach.coachingFocus")}
            name="coachingFocus"
            value={coachProfileForm.coachingFocus}
            onChange={onChange}
            options={FOCUS_OPTIONS}
          />
        </div>

        <Textarea
          label={t("coach.notes")}
          name="notes"
          value={coachProfileForm.notes}
          onChange={onChange}
          placeholder={t("coach.notesPlaceholder")}
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
