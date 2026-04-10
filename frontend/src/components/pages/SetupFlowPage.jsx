import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { ActionButton } from "../ui.jsx";

function SetupFlowPage({ checklist = [], onNavigate, soloMode }) {
  const completedCount = checklist.filter((item) => item.completed).length;
  const completionPct = checklist.length
    ? Math.round((completedCount / checklist.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex rounded-full bg-white/90 p-2 text-amber-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="hb-kicker">First-time setup</p>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
              Get your household fully ready
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {soloMode
                ? "Complete these steps to get fully set up — save your income, add bills, set savings goals, and personalise your experience."
                : "Complete these steps to get your household fully set up — link your partner, save your income, add bills, set savings goals, and personalise your experience."}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="hb-progress-track h-3 overflow-hidden rounded-full shadow-inner">
            <div
              className="hb-progress-fill h-full rounded-full bg-gradient-to-r transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {completedCount} of {checklist.length} setup steps finished
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {checklist.map((item) => (
          <article
            key={item.key}
            className="hb-surface-card flex flex-col gap-4 rounded-[1.35rem] p-4 sm:rounded-[1.5rem] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex rounded-full p-1.5 ${
                  item.completed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <CircleDashed className="h-4 w-4" />
                )}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            </div>

            <ActionButton
              className="sm:w-auto"
              onClick={() => onNavigate(item.route)}
              type="button"
            >
              {item.completed ? "Review" : "Complete"}
            </ActionButton>
          </article>
        ))}
      </section>
    </div>
  );
}

export default SetupFlowPage;
