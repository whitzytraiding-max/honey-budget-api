import { useEffect, useState } from "react";
import { setStatusBarForTheme } from "../lib/native.js";
import { STORAGE_KEYS, readStorage, writeStorage } from "../lib/storage.js";

const SUPPORTED_THEMES = new Set(["light", "dark", "system"]);

function getInitialTheme() {
  const saved = readStorage(STORAGE_KEYS.THEME);
  return saved && SUPPORTED_THEMES.has(saved) ? saved : "system";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const resolved = theme === "system" ? (mq?.matches ? "dark" : "light") : theme;

    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    writeStorage(STORAGE_KEYS.THEME, theme);

    if (theme !== "system" || !mq) return;

    const onChange = (e) => {
      const next = e.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const resolved = theme === "system" ? (mq?.matches ? "dark" : "light") : theme;
    setStatusBarForTheme(resolved);
  }, [theme]);

  return { theme, setTheme };
}
