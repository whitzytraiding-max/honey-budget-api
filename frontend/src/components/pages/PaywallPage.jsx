import { CheckCircle2, XCircle, Sparkles, Crown } from "lucide-react";

const FREE_FEATURES = [
  { label: "Track expenses", included: true },
  { label: "Combined household income", included: true },
  { label: "Spending split breakdown", included: true },
  { label: "History & calendar view", included: true },
  { label: "Link a partner", included: true },
  { label: "Savings goals", included: false },
  { label: "AI Finance Coach", included: false },
  { label: "Spending insights & trends", included: false },
  { label: "Ad-free experience", included: false },
];

const PRO_FEATURES = [
  "Everything in Free",
  "Savings goals with progress tracking",
  "AI Finance Coach — personalized advice",
  "Deep spending insights & trends",
  "Recurring bill planner",
  "Ad-free experience",
  "Your partner gets Pro free",
];

function PaywallPage({ onSubscribe, onContinueFree, busy }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          <Crown className="h-4 w-4" />
          Honey Budget Pro
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Unlock the full experience
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Get your AI Finance Coach, savings goals, and deep insights — everything you need to actually win with money.
        </p>

        <div className="hb-panel-highlight mt-6 rounded-[1.5rem] border border-amber-200/40 p-6">
          <p className="text-4xl font-bold text-slate-900">
            $5
            <span className="text-lg font-medium text-slate-500"> / month</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">One subscription covers both partners</p>

          <button
            className="mt-5 w-full rounded-[1.2rem] bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-amber-500 disabled:opacity-60"
            onClick={onSubscribe}
            disabled={busy}
            type="button"
          >
            {busy ? "Loading…" : "Subscribe — $5 / month"}
          </button>

          <p className="mt-3 text-xs text-slate-500">
            Cancel anytime · Billed monthly · Partner rides free
          </p>
        </div>
      </section>

      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">What's included with Pro</h2>
        <ul className="mt-4 space-y-3">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Free vs Pro</h2>
        <div className="mt-4 space-y-3">
          {FREE_FEATURES.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className={item.included ? "text-slate-700" : "text-slate-400"}>
                {item.label}
              </span>
              {item.included ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="pb-6 text-center">
        <button
          className="text-sm text-slate-500 underline-offset-4 hover:underline"
          onClick={onContinueFree}
          type="button"
        >
          Continue with Free — I'll upgrade later
        </button>
      </div>
    </div>
  );
}

export default PaywallPage;
