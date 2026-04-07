/*
 * MoneyCat — mascot based on Honey Budget brand mark.
 * Mood driven by remainingPct (budget remaining percentage).
 *
 * happy  >= 50 %  : floating, original happy expression, gold coin
 * worried 15–49 % : worried brows + sweat drop, subtle pulse
 * panic  < 15 %   : wide eyes, wavy mouth, shake animation
 */

const MOOD_LABELS = {
  happy: "Doing great!",
  worried: "Keep an eye out…",
  panic: "Uh oh!!",
};

function getMood(pct) {
  if (pct >= 50) return "happy";
  if (pct >= 15) return "worried";
  return "panic";
}

/* ── Facial expression overlays (512 × 512 space matching brand mark) ── */

function HappyFace() {
  return (
    <>
      {/* Original brand-mark eye arcs */}
      <path d="M176 222c12-14 40-16 52 0" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      <path d="M284 222c12-14 40-16 52 0" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      {/* Original brand-mark smile */}
      <path d="M204 256c14 12 42 12 56 0" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      <path d="M252 256c14 12 42 12 56 0" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      {/* Rosy cheeks */}
      <ellipse cx="190" cy="270" rx="24" ry="16" fill="#fca5a5" opacity="0.4" />
      <ellipse cx="322" cy="270" rx="24" ry="16" fill="#fca5a5" opacity="0.4" />
    </>
  );
}

function WorriedFace() {
  return (
    <>
      {/* Inner worry brows */}
      <path d="M170 200 Q202 188 232 204" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      <path d="M280 204 Q310 188 342 200" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      {/* Open oval eyes */}
      <ellipse cx="202" cy="230" rx="28" ry="30" fill="#5a2626" />
      <ellipse cx="310" cy="230" rx="28" ry="30" fill="#5a2626" />
      <ellipse cx="210" cy="222" rx="10" ry="10" fill="white" />
      <ellipse cx="318" cy="222" rx="10" ry="10" fill="white" />
      {/* Flat tight mouth */}
      <path d="M214 268 Q256 264 298 268" fill="none" stroke="#5a2626" strokeLinecap="round" strokeWidth="10" />
      {/* Sweat drop */}
      <ellipse cx="350" cy="210" rx="13" ry="20" fill="#93c5fd" opacity="0.9" />
      <path d="M342 192 Q350 180 358 192" fill="none" stroke="#93c5fd" strokeWidth="5" />
      {/* Rosy cheeks */}
      <ellipse cx="190" cy="270" rx="24" ry="16" fill="#fca5a5" opacity="0.3" />
      <ellipse cx="322" cy="270" rx="24" ry="16" fill="#fca5a5" opacity="0.3" />
    </>
  );
}

function PanicFace() {
  return (
    <>
      {/* Wide scared eyes */}
      <ellipse cx="202" cy="226" rx="52" ry="54" fill="white" stroke="#5a2626" strokeWidth="8" />
      <ellipse cx="310" cy="226" rx="52" ry="54" fill="white" stroke="#5a2626" strokeWidth="8" />
      <ellipse cx="202" cy="232" rx="28" ry="30" fill="#5a2626" />
      <ellipse cx="310" cy="232" rx="28" ry="30" fill="#5a2626" />
      <ellipse cx="212" cy="222" rx="10" ry="10" fill="white" />
      <ellipse cx="320" cy="222" rx="10" ry="10" fill="white" />
      {/* Wavy stressed mouth */}
      <path
        d="M200 280 Q218 266 236 280 Q254 294 272 280 Q290 266 310 280"
        fill="none"
        stroke="#5a2626"
        strokeLinecap="round"
        strokeWidth="10"
      />
      {/* Sweat drops */}
      <ellipse cx="354" cy="195" rx="11" ry="18" fill="#93c5fd" opacity="0.9" />
      <path d="M346 178 Q354 166 362 178" fill="none" stroke="#93c5fd" strokeWidth="5" />
      <ellipse cx="374" cy="238" rx="9" ry="14" fill="#93c5fd" opacity="0.8" />
      {/* !! alert */}
      <text x="345" y="155" fontSize="70" fontWeight="bold" fill="#ef4444" fontFamily="sans-serif">!!</text>
    </>
  );
}

/* ── Animation keyframes injected once ── */
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
    50% { transform: scale(0.97); }
  }
`;

const ANIM_STYLE = {
  happy: { animation: "hb-cat-float 2.8s ease-in-out infinite" },
  worried: { animation: "hb-cat-pulse 3s ease-in-out infinite" },
  panic: { animation: "hb-cat-shake 0.5s ease-in-out infinite" },
};

const GLOW = {
  happy: "#6ee7b7",
  worried: "#fcd34d",
  panic: "#fca5a5",
};

let keyframesInjected = false;

export function MoneyCat({ remainingPct = 50, size = 88 }) {
  if (!keyframesInjected) {
    const style = document.createElement("style");
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
    keyframesInjected = true;
  }

  const mood = getMood(remainingPct);
  const height = Math.round(size * 1.15);

  return (
    <div className="flex flex-col items-center gap-1 select-none flex-shrink-0">
      <div style={ANIM_STYLE[mood]}>
        <svg
          viewBox="0 0 512 512"
          width={size}
          height={height}
          aria-label={`Money cat: ${MOOD_LABELS[mood]}`}
        >
          <defs>
            <linearGradient id="mc-honey" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffcd4d" />
              <stop offset="100%" stopColor="#ff8d62" />
            </linearGradient>
            <linearGradient id="mc-coin" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffd84f" />
              <stop offset="100%" stopColor="#f6a500" />
            </linearGradient>
          </defs>

          {/* Soft mood glow */}
          <circle cx="256" cy="280" r="200" fill={GLOW[mood]} opacity="0.18" />

          {/* Brand mark body — honey drop / heart shape */}
          <path
            d="M256 416c-40-34-79-63-108-96-33-37-46-76-36-117 11-44 47-72 89-72 25 0 45 8 55 20 10-12 30-20 55-20 42 0 78 28 89 72 10 41-3 80-36 117-29 33-68 62-108 96Z"
            fill="url(#mc-honey)"
            stroke="#7a3b30"
            strokeWidth="12"
            strokeLinejoin="round"
          />

          {/* Ear lines (brand mark style) */}
          <path d="M176 158l24-30 32 28" fill="none" stroke="#b55a1b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12" />
          <path d="M336 158l-24-30-32 28" fill="none" stroke="#7a3b30" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12" />

          {/* Eye backgrounds */}
          <circle cx="202" cy="226" r="64" fill="#ffd976" opacity="0.92" />
          <circle cx="310" cy="226" r="64" fill="#fff9f5" opacity="0.96" />

          {/* Mood face */}
          {mood === "happy" && <HappyFace />}
          {mood === "worried" && <WorriedFace />}
          {mood === "panic" && <PanicFace />}

          {/* Coin — always show, but gold/gleaming for happy, dim for others */}
          <circle
            cx="256"
            cy="306"
            r="46"
            fill={mood === "happy" ? "url(#mc-coin)" : "#d1d5db"}
            stroke={mood === "happy" ? "#c97e00" : "#9ca3af"}
            strokeWidth="10"
          />
          <path
            d="M256 282v48M240 292c0-8 7-14 16-14h8c8 0 14 5 14 12 0 8-6 11-18 14s-18 6-18 14c0 7 6 12 14 12h10c9 0 16-6 16-14"
            fill="none"
            stroke={mood === "happy" ? "#fff3b0" : "#6b7280"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="10"
          />
        </svg>
      </div>

      <p className="text-[10px] font-semibold text-white/70 tracking-wide text-center leading-tight max-w-[84px]">
        {MOOD_LABELS[mood]}
      </p>
    </div>
  );
}
