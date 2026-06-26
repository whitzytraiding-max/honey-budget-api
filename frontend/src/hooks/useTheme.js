import { useEffect, useState } from "react";
import { setStatusBarForTheme } from "../lib/native.js";
import { STORAGE_KEYS, readStorage, writeStorage } from "../lib/storage.js";

// Theme keys map to [data-theme="..."] blocks in styles.css.
export const THEME_KEYS = [
  "honey", "midnight",
  "mint", "mint-dark",
  "rose", "rose-dark",
  "ocean", "ocean-dark",
];

// Dark themes drive the native status bar style + system fallback.
const DARK_THEMES = new Set(["midnight", "mint-dark", "rose-dark", "ocean-dark"]);

const SUPPORTED = new Set([...THEME_KEYS, "system"]);

// Migrate legacy saved values from the old light/dark-only system.
const LEGACY_MAP = { light: "honey", dark: "midnight" };

function normalizeTheme(value) {
  if (!value) return "system";
  if (LEGACY_MAP[value]) return LEGACY_MAP[value];
  return SUPPORTED.has(value) ? value : "system";
}

function getInitialTheme() {
  return normalizeTheme(readStorage(STORAGE_KEYS.THEME));
}

function resolveTheme(theme) {
  if (theme !== "system") return theme;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "midnight" : "honey";
}

export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme);

  const setTheme = (value) => setThemeState(normalizeTheme(value));

  useEffect(() => {
    if (typeof document === "undefined") return;

    const apply = (resolved) => {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = DARK_THEMES.has(resolved) ? "dark" : "light";
    };

    apply(resolveTheme(theme));
    writeStorage(STORAGE_KEYS.THEME, theme);

    if (theme !== "system") return;

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;

    const onChange = (e) => apply(e.matches ? "midnight" : "honey");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setStatusBarForTheme(DARK_THEMES.has(resolved) ? "dark" : "light");
  }, [theme]);

  return { theme, setTheme };
}
