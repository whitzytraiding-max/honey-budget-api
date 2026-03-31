import { Bell, Brain, CalendarDays, ChevronRight, ClipboardList, Settings2, Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";

const MORE_ITEMS = [
  { key: "coach", icon: Sparkles },
  { key: "notifications", icon: Bell },
  { key: "calendar", icon: CalendarDays },
  { key: "insights", icon: Brain },
  { key: "history", icon: ClipboardList },
  { key: "settings", icon: Settings2 },
];

function MorePage({ onNavigate, showNotifications, showCoach }) {
  const { t } = useLanguage();
  const items = MORE_ITEMS.filter((item) => {
    if (item.key === "notifications" && !showNotifications) {
      return false;
    }

    if (item.key === "coach" && !showCoach) {
      return false;
    }

    return true;
  });

  return (
    <section className="hb-surface-card rounded-[1.75rem] p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">{t("more.title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("more.subtitle")}</p>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              className="flex w-full items-center justify-between rounded-[1.2rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(239,247,255,0.88))] px-4 py-4 text-left transition hover:bg-amber-50/75"
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-full bg-white/95 p-2 text-slate-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{t(`more.${item.key}`)}</p>
                  <p className="text-sm text-slate-600">{t(`more.${item.key}Body`)}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default MorePage;
