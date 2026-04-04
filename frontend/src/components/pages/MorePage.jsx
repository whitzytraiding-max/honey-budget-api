import {
  Bell,
  Brain,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  ListTodo,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";

const MORE_ITEMS = [
  { key: "setup", icon: ListTodo },
  { key: "planner", icon: ShieldCheck },
  { key: "coach", icon: Sparkles },
  { key: "notifications", icon: Bell },
  { key: "calendar", icon: CalendarDays },
  { key: "insights", icon: Brain },
  { key: "history", icon: ClipboardList },
  { key: "settings", icon: Settings2 },
];

function MorePage({ onNavigate, onLogout, showNotifications, showCoach, showPlanner, showSetup }) {
  const { t } = useLanguage();
  const items = MORE_ITEMS.filter((item) => {
    if (item.key === "notifications" && !showNotifications) {
      return false;
    }

    if (item.key === "coach" && !showCoach) {
      return false;
    }

    if (item.key === "planner" && !showPlanner) {
      return false;
    }

    if (item.key === "setup" && !showSetup) {
      return false;
    }

    return true;
  });

  return (
    <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
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
              className="hb-panel-soft flex w-full items-start justify-between rounded-[1.2rem] border border-sky-100 px-4 py-4 text-left transition"
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex shrink-0 rounded-full bg-white/95 p-2 text-slate-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{t(`more.${item.key}`)}</p>
                  <p className="text-sm text-slate-600">{t(`more.${item.key}Body`)}</p>
                </div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
            </button>
          );
        })}
      </div>

      {onLogout && (
        <div className="mt-4 sm:hidden">
          <button
            className="hb-button-secondary flex w-full items-center justify-center gap-2 rounded-[1.2rem] px-4 py-4 text-sm font-medium transition"
            onClick={onLogout}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </section>
  );
}

export default MorePage;
