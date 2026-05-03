import { useState } from "react";
import { ChevronRight, X, Wallet, PiggyBank, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import { hapticLight, hapticSuccess } from "../lib/native.js";

const STEPS = [
  {
    icon: <img src="/icons/brand-mark.svg" alt="" className="h-16 w-16" />,
    title: "Welcome to Honey Budget",
    body: "Track spending, share your budget with a partner, and get smarter about money — one month at a time.",
  },
  {
    icon: <Wallet className="h-14 w-14 text-amber-400" />,
    title: "Add expenses in seconds",
    body: "Tap the + button from any page to log cash or card spending. You can tag it to your partner too.",
  },
  {
    icon: <TrendingUp className="h-14 w-14 text-emerald-400" />,
    title: "See what's left",
    body: "Your remaining budget updates live at the top of every page. No spreadsheets, no mental math.",
  },
  {
    icon: <PiggyBank className="h-14 w-14 text-sky-400" />,
    title: "Save toward goals",
    body: "Create savings goals and log contributions. Both partners can track progress together in real time.",
  },
  {
    icon: <Sparkles className="h-14 w-14 text-violet-400" />,
    title: "Meet Hunny, your AI coach",
    body: "Hunny reads your actual spending data and gives personalised money advice. Upgrade to Pro to unlock it.",
  },
  {
    icon: <CheckCircle2 className="h-14 w-14 text-emerald-400" />,
    title: "You're all set!",
    body: "Head to Settings to enter your income and invite a partner — then add your first expense.",
  },
];

export function tourKey(userId) {
  return `hb_tour_v1_${userId}`;
}

export function isTourDone(userId) {
  if (!userId) return true;
  return Boolean(localStorage.getItem(tourKey(userId)));
}

export function markTourDone(userId) {
  if (!userId) return;
  localStorage.setItem(tourKey(userId), "1");
}

export default function OnboardingTour({ userId, onDone }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  function finish() {
    hapticSuccess().catch(() => {});
    markTourDone(userId);
    onDone();
  }

  function next() {
    hapticLight().catch(() => {});
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  function skip() {
    finish();
  }

  const { icon, title, body } = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5">
      <div
        className="hb-surface-card relative w-full max-w-sm rounded-[2rem] p-8 shadow-2xl"
        style={{ animation: "hb-page-enter 0.25s ease" }}
      >
        {/* Skip */}
        <button
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:text-slate-600"
          onClick={skip}
          type="button"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center">{icon}</div>

        {/* Text */}
        <h2
          className="mt-6 text-center text-xl font-semibold leading-snug"
          style={{ color: "var(--hb-ink)" }}
        >
          {title}
        </h2>
        <p
          className="mt-3 text-center text-sm leading-6"
          style={{ color: "var(--hb-ink-soft)" }}
        >
          {body}
        </p>

        {/* Progress dots */}
        <div className="mt-7 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? "1.5rem" : "0.5rem",
                height: "0.5rem",
                background: i === step ? "var(--hb-accent, #f59e0b)" : "var(--hb-ink-soft, #94a3b8)",
                opacity: i === step ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Button */}
        <button
          className="mt-6 w-full rounded-[1.2rem] bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-amber-500 flex items-center justify-center gap-2"
          onClick={next}
          type="button"
        >
          {isLast ? "Let's go" : "Next"}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
