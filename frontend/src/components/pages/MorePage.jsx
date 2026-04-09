import { Eye, LogOut, Menu } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";

function MorePage({ onNavigate, onLogout, items, onUnhideItem }) {
  const { t } = useLanguage();

  return (
    <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">{t("more.title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("more.subtitle")}</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          <Menu className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            All features are visible in the sidebar.
          </p>
          <p className="text-xs text-slate-400">
            Open the sidebar and tap the eye icon on any item to move it here.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.key}
                className="hb-panel-soft flex w-full items-center justify-between rounded-[1.2rem] border border-sky-100 px-4 py-4 transition"
              >
                <button
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => onNavigate(item.key)}
                  type="button"
                >
                  <span className="inline-flex shrink-0 rounded-full bg-white/95 p-2 text-slate-700 shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{t(`more.${item.key}`)}</p>
                    <p className="text-sm text-slate-600">{t(`more.${item.key}Body`)}</p>
                  </div>
                </button>
                <button
                  className="ml-3 shrink-0 rounded-xl p-2 text-slate-400 transition hover:text-emerald-600"
                  onClick={() => onUnhideItem(item.key)}
                  title="Move back to sidebar"
                  type="button"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
