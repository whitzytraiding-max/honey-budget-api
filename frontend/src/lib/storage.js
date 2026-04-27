export const STORAGE_KEYS = {
  TOKEN: "budget_token",
  THEME: "budget_theme",
  CURRENCY: "budget_currency",
  BASE_CURRENCY: "budget_base_currency",
  SOLO_MODE: "budget_solo_mode",
  HIDDEN_NAV: "hb-hidden-nav",
};

export function readStorage(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore — storage full or unavailable
  }
}

export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
