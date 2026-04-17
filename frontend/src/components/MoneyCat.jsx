/*
 * MoneyCat — Honey Budget mascot.
 * Mood driven by remainingPct (budget remaining percentage).
 *
 * happy  >= 50 %  : floating, normal colours
 * worried 15–49 % : pulse, warm muted filter + sweat emoji
 * panic  < 15 %   : shake, red-tinted filter + alert emoji
 */

const MOOD_LABELS = {
  happy: "Doing great!",
  worried: "Keep an eye out…",
  panic: "Uh oh!!",
};

const MOOD_OVERLAY = {
  happy: null,
  worried: "😰",
  panic: "🚨",
};

const MOOD_FILTER = {
  happy: "none",
  worried: "saturate(0.75) sepia(0.25) brightness(0.95)",
  panic: "saturate(1.6) hue-rotate(-15deg) brightness(1.05)",
};

const KEYFRAMES = `
  @keyframes hb-cat-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  @keyframes hb-cat-shake {
    0%, 100% { transform: translateX(0px); }
    15% { transform: translateX(-8px); }
    35% { transform: translateX(8px); }
    55% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  @keyframes hb-cat-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(0.96); }
  }
`;

const ANIM_STYLE = {
  happy: { animation: "hb-cat-float 2.8s ease-in-out infinite" },
  worried: { animation: "hb-cat-pulse 3s ease-in-out infinite" },
  panic: { animation: "hb-cat-shake 0.5s ease-in-out infinite" },
};

function getMood(pct) {
  if (pct >= 50) return "happy";
  if (pct >= 15) return "worried";
  return "panic";
}

let keyframesInjected = false;

export function MoneyCat({ remainingPct = 50, size = 88 }) {
  if (typeof document !== "undefined" && !keyframesInjected) {
    const style = document.createElement("style");
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
    keyframesInjected = true;
  }

  const mood = getMood(remainingPct);

  return (
    <div className="flex flex-col items-center gap-1 select-none flex-shrink-0">
      <div className="relative" style={ANIM_STYLE[mood]}>
        <img
          src="/icons/money-cat.png"
          alt={`Money cat: ${MOOD_LABELS[mood]}`}
          width={size}
          height={Math.round(size * 1.5)}
          style={{
            filter: MOOD_FILTER[mood],
            transition: "filter 0.6s ease",
            objectFit: "contain",
          }}
          draggable={false}
        />
        {MOOD_OVERLAY[mood] && (
          <span
            className="absolute -right-2 -top-2 text-xl leading-none"
            aria-hidden="true"
          >
            {MOOD_OVERLAY[mood]}
          </span>
        )}
      </div>
      <p className="text-[10px] font-semibold text-white/70 tracking-wide text-center leading-tight" style={{ maxWidth: size }}>
        {MOOD_LABELS[mood]}
      </p>
    </div>
  );
}
