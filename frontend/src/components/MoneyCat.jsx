function getMood(pct) {
  if (pct >= 50) return "happy";
  if (pct >= 15) return "worried";
  return "panic";
}

const MOOD_LABELS = {
  happy: "Doing great!",
  worried: "Keep an eye out…",
  panic: "Uh oh!!",
};

function CatEyes({ mood }) {
  if (mood === "happy") {
    return (
      <>
        <path d="M 34 54 Q 40 47 46 54" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 54 54 Q 60 47 66 54" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    );
  }

  if (mood === "worried") {
    return (
      <>
        {/* inner brows angled to look worried */}
        <path d="M 30 43 Q 38 38 44 44" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 56 44 Q 62 38 70 43" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="40" cy="54" rx="6" ry="6.5" fill="#1f2937" />
        <ellipse cx="60" cy="54" rx="6" ry="6.5" fill="#1f2937" />
        <circle cx="42" cy="51" r="2" fill="white" />
        <circle cx="62" cy="51" r="2" fill="white" />
      </>
    );
  }

  return (
    <>
      {/* wide scared eyes */}
      <circle cx="38" cy="54" r="9" fill="white" stroke="#1f2937" strokeWidth="1.5" />
      <circle cx="62" cy="54" r="9" fill="white" stroke="#1f2937" strokeWidth="1.5" />
      <circle cx="38" cy="56" r="5" fill="#1f2937" />
      <circle cx="62" cy="56" r="5" fill="#1f2937" />
      <circle cx="39.5" cy="54" r="2" fill="white" />
      <circle cx="63.5" cy="54" r="2" fill="white" />
    </>
  );
}

function CatMouth({ mood }) {
  if (mood === "happy") {
    return (
      <path d="M 43 74 Q 50 83 57 74" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    );
  }

  if (mood === "worried") {
    return (
      <>
        <path d="M 44 75 Q 50 72 56 75" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* sweat drop */}
        <ellipse cx="78" cy="50" rx="4" ry="6" fill="#93c5fd" opacity="0.85" />
        <path d="M 76 44 Q 78 40 80 44" stroke="#93c5fd" strokeWidth="1" fill="none" />
      </>
    );
  }

  return (
    <>
      <path
        d="M 41 74 Q 45 80 49 74 Q 53 68 57 74 Q 61 80 65 74"
        stroke="#1f2937"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* sweat drops */}
      <ellipse cx="78" cy="44" rx="3.5" ry="5.5" fill="#93c5fd" opacity="0.85" />
      <path d="M 76 39 Q 78 35 80 39" stroke="#93c5fd" strokeWidth="1" fill="none" />
      <ellipse cx="85" cy="60" rx="3" ry="4.5" fill="#93c5fd" opacity="0.75" />
      {/* !! alert */}
      <text x="68" y="28" fontSize="14" fontWeight="bold" fill="#ef4444" fontFamily="sans-serif">
        !!
      </text>
    </>
  );
}

function CatAccessory({ mood }) {
  if (mood === "happy") {
    return (
      <g>
        <circle cx="83" cy="28" r="11" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="78" y="33" fontSize="12" fontWeight="bold" fill="white" fontFamily="sans-serif">
          $
        </text>
      </g>
    );
  }
  return null;
}

const ANIM_CLASS = {
  happy: "animate-bounce",
  worried: "",
  panic: "animate-pulse",
};

const GLOW_COLOR = {
  happy: "#6ee7b7",
  worried: "#fcd34d",
  panic: "#fca5a5",
};

export function MoneyCat({ remainingPct = 50, size = 88 }) {
  const mood = getMood(remainingPct);
  const height = Math.round(size * 1.15);

  return (
    <div className="flex flex-col items-center gap-1 select-none flex-shrink-0">
      <div className={ANIM_CLASS[mood]} style={{ animationDuration: mood === "happy" ? "2s" : "0.6s" }}>
        <svg viewBox="0 0 100 110" width={size} height={height} aria-label={`Money cat: ${MOOD_LABELS[mood]}`}>
          {/* Soft glow */}
          <circle cx="50" cy="67" r="40" fill={GLOW_COLOR[mood]} opacity="0.22" />

          {/* Ears */}
          <polygon points="18,52 27,22 43,50" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <polygon points="57,50 73,22 82,52" fill="white" stroke="#d1d5db" strokeWidth="1" />
          {/* Inner ears */}
          <polygon points="23,48 30,28 39,47" fill="#fecdd3" />
          <polygon points="61,47 70,28 77,48" fill="#fecdd3" />

          {/* Head */}
          <circle cx="50" cy="67" r="38" fill="white" stroke="#e5e7eb" strokeWidth="1.5" />

          {/* Eyes */}
          <CatEyes mood={mood} />

          {/* Nose */}
          <path d="M 47 66 L 50 70 L 53 66 L 50 63 Z" fill="#fca5a5" />

          {/* Mouth */}
          <CatMouth mood={mood} />

          {/* Whiskers left */}
          <line x1="11" y1="63" x2="40" y2="67" stroke="#9ca3af" strokeWidth="1" />
          <line x1="9" y1="69" x2="40" y2="69" stroke="#9ca3af" strokeWidth="1" />
          <line x1="11" y1="75" x2="40" y2="71" stroke="#9ca3af" strokeWidth="1" />

          {/* Whiskers right */}
          <line x1="60" y1="67" x2="89" y2="63" stroke="#9ca3af" strokeWidth="1" />
          <line x1="60" y1="69" x2="91" y2="69" stroke="#9ca3af" strokeWidth="1" />
          <line x1="60" y1="71" x2="89" y2="75" stroke="#9ca3af" strokeWidth="1" />

          {/* Cheek blushes */}
          <ellipse cx="27" cy="74" rx="8" ry="5" fill="#fecdd3" opacity="0.55" />
          <ellipse cx="73" cy="74" rx="8" ry="5" fill="#fecdd3" opacity="0.55" />

          {/* Mood accessory */}
          <CatAccessory mood={mood} />
        </svg>
      </div>

      <p className="text-[10px] font-semibold text-white/70 tracking-wide text-center leading-tight max-w-[80px]">
        {MOOD_LABELS[mood]}
      </p>
    </div>
  );
}
