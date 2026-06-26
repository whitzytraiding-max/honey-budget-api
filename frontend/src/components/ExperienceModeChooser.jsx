import { useState } from "react";
import { Check, Leaf, Sparkles, SlidersHorizontal } from "lucide-react";
import { hapticLight, hapticSuccess } from "../lib/native.js";

const OPTIONS = [
  {
    value: "simple",
    icon: Leaf,
    title: "Simple",
    tagline: "Just the essentials",
    bullets: ["Home, expenses & savings", "Hunny, your friendly coach", "Nothing extra to learn"],
  },
  {
    value: "advanced",
    icon: SlidersHorizontal,
    title: "Advanced",
    tagline: "Every tool unlocked",
    bullets: ["Insights, calendar & history", "Budget planner & recurring bills", "Debt tracking & more"],
  },
];

export default function ExperienceModeChooser({ onChoose }) {
  const [selected, setSelected] = useState("simple");

  function confirm() {
    hapticSuccess().catch(() => {});
    onChoose(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
      <div
        className="hb-surface-card relative w-full max-w-md rounded-[2rem] p-7 shadow-2xl"
        style={{ animation: "hb-page-enter 0.25s ease" }}
      >
        <div className="flex justify-center">
          <Sparkles className="h-12 w-12" style={{ color: "var(--hb-accent)" }} />
        </div>

        <h2 className="mt-4 text-center text-xl font-semibold text-slate-900">
          How do you want to use Honey Budget?
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-600">
          Pick a starting point — you can switch anytime in Settings.
        </p>

        <div className="mt-6 grid gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  hapticLight().catch(() => {});
                  setSelected(option.value);
                }}
                className="hb-theme-card"
                data-active={active}
                aria-pressed={active}
              >
                {active ? (
                  <span className="hb-theme-check">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : null}
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{option.title}</p>
                    <p className="text-xs text-slate-500">{option.tagline}</p>
                  </div>
                </div>
                <ul className="mt-1 space-y-1.5">
                  {option.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--hb-good)" }} />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <button
          className="hb-button-primary mt-6 flex min-h-[52px] w-full items-center justify-center rounded-[1.2rem] px-6 py-4 text-base font-semibold transition"
          onClick={confirm}
          type="button"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
