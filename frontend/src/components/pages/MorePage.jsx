import { Bell, Brain, CalendarDays, ChevronRight, ClipboardList, Settings2 } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";

const MORE_ITEMS = [
  { key: "notifications", icon: Bell },
  { key: "calendar", icon: CalendarDays },
  { key: "insights", icon: Brain },
  { key: "history", icon: ClipboardList },
  { key: "settings", icon: Settings2 },
];

function MorePage({ onNavigate, showNotifications }) {
  const { t } = useLanguage();
  const items = showNotifications ? MORE_ITEMS : MORE_ITEMS.filter((item) => item.key !== "notifications");

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/82 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
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
              className="flex w-full items-center justify-between rounded-[1.2rem] border border-slate-100 bg-slate-50/90 px-4 py-4 text-left transition hover:bg-slate-100"
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-full bg-white p-2 text-slate-700 shadow-sm">
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
