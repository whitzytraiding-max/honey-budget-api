import { useState, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { hapticSuccess } from "../lib/native.js";

const THRESHOLD = 72;
const MAX_PULL = 100;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const pullYRef = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    const root = document.getElementById("root");
    if ((root ? root.scrollTop : window.scrollY) > 2) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pullingRef.current || startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) {
      pullingRef.current = false;
      setPullY(0);
      pullYRef.current = 0;
      return;
    }
    // Rubber-band: full speed to threshold, then slow
    const clamped = dy < THRESHOLD
      ? dy * 0.6
      : THRESHOLD * 0.6 + (dy - THRESHOLD) * 0.15;
    const final = Math.min(clamped, MAX_PULL);
    setPullY(final);
    pullYRef.current = final;
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    const captured = pullYRef.current;
    startYRef.current = null;

    if (captured >= THRESHOLD * 0.6) {
      hapticSuccess().catch(() => {});
      setRefreshing(true);
      setPullY(44);
      pullYRef.current = 44;
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
        pullYRef.current = 0;
      }
    } else {
      setPullY(0);
      pullYRef.current = 0;
    }
  }, [onRefresh]);

  const show = pullY > 4 || refreshing;
  const progress = Math.min(pullY / (THRESHOLD * 0.6), 1);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: refreshing ? 44 : pullY,
          transition: pullingRef.current ? "none" : "height 0.25s ease",
        }}
      >
        {show && (
          <RefreshCw
            className={`h-5 w-5 text-slate-400 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${progress * 360}deg)` }}
          />
        )}
      </div>

      {children}
    </div>
  );
}
