import { CheckCircle2, XCircle, Sparkles, Crown, AlertCircle } from "lucide-react";

const FREE_FEATURES = [
  { label: "Track expenses", included: true },
  { label: "Combined household income", included: true },
  { label: "Spending split breakdown", included: true },
  { label: "History & calendar view", included: true },
  { label: "Link a partner", included: true },
  { label: "Savings goals", included: false },
  { label: "Hunny AI Coach", included: false },
  { label: "Spending insights & trends", included: false },
  { label: "Ad-free experience", included: false },
];

const PRO_FEATURES = [
  "Everything in Free",
  "Savings goals with progress tracking",
  "Hunny AI Coach — personalized advice",
  "Deep spending insights & trends",
  "Recurring bill planner",
  "Ad-free experience",
  "Your partner gets Pro free",
];

function PaywallPage({ onSubscribe, onContinueFree, onRestore, busy, restoreBusy, purchaseError, offeringReady }) {
  const canPurchase = offeringReady !== false;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          <Crown className="h-4 w-4" />
          Honey Budget Pro
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight" style={{ color: "var(--hb-ink)" }}>
          Unlock the full experience
        </h1>
        <p className="mt-3 text-base leading-7" style={{ color: "var(--hb-ink-soft)" }}>
          Get your Hunny AI Coach, savings goals, and deep insights — everything you need to actually win with money.
        </p>

        <div className="hb-panel-highlight mt-6 rounded-[1.5rem] border border-amber-200/40 p-6">
          <p className="text-4xl font-bold" style={{ color: "var(--hb-ink)" }}>
            $4.99
            <span className="text-lg font-medium" style={{ color: "var(--hb-ink-soft)" }}> / month</span>
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--hb-ink-soft)" }}>One subscription covers both partners</p>

          <button
            className="mt-5 w-full rounded-[1.2rem] bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-amber-500 disabled:opacity-50"
            onClick={onSubscribe}
            disabled={busy || restoreBusy || !canPurchase}
            type="button"
          >
            {busy ? "Processing…" : !canPurchase ? "Checking availability…" : "Subscribe — $4.99 / month"}
          </button>

          {purchaseError ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-left">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <p className="text-xs text-rose-400">{purchaseError}</p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs" style={{ color: "var(--hb-ink-soft)" }}>
                Cancel anytime · Billed monthly · Partner rides free
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--hb-ink-soft)", opacity: 0.6 }}>
                Payment processed securely by Apple
              </p>
            </>
          )}
        </div>

        {onRestore && (
          <button
            className="mt-4 text-sm underline-offset-4 hover:underline disabled:opacity-50"
            style={{ color: "var(--hb-ink-soft)" }}
            onClick={onRestore}
            disabled={busy || restoreBusy}
            type="button"
          >
            {restoreBusy ? "Restoring…" : "Restore previous purchase"}
          </button>
        )}
      </section>

      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <h2 className="text-lg font-semibold" style={{ color: "var(--hb-ink)" }}>What's included with Pro</h2>
        <ul className="mt-4 space-y-3">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm" style={{ color: "var(--hb-ink)" }}>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <h2 className="text-lg font-semibold" style={{ color: "var(--hb-ink)" }}>Free vs Pro</h2>
        <div className="mt-4 space-y-3">
          {FREE_FEATURES.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span style={{ color: item.included ? "var(--hb-ink)" : "var(--hb-ink-soft)" }}>
                {item.label}
              </span>
              {item.included ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: "var(--hb-ink-soft)", opacity: 0.4 }} />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="pb-6 text-center space-y-3">
        <button
          className="text-sm underline-offset-4 hover:underline"
          style={{ color: "var(--hb-ink-soft)" }}
          onClick={onContinueFree}
          type="button"
        >
          Continue with Free — I'll upgrade later
        </button>
        <p className="text-xs leading-5" style={{ color: "var(--hb-ink-soft)", opacity: 0.6 }}>
          Honey Budget Pro · $4.99/month · Auto-renewing subscription · Cancel anytime
        </p>
        <p className="text-xs leading-5" style={{ color: "var(--hb-ink-soft)", opacity: 0.6 }}>
          Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple ID Account Settings.
        </p>
        <div className="flex justify-center gap-4">
          <a
            className="text-xs underline underline-offset-2 hover:opacity-80"
            style={{ color: "var(--hb-ink-soft)" }}
            href="https://honey-budget.com/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            Privacy Policy
          </a>
          <a
            className="text-xs underline underline-offset-2 hover:opacity-80"
            style={{ color: "var(--hb-ink-soft)" }}
            href="https://honey-budget.com/terms-of-service"
            target="_blank"
            rel="noreferrer"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
}

export default PaywallPage;
