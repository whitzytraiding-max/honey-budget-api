/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

/**
 * Native platform utilities — wraps Capacitor plugins with web-safe fallbacks.
 * All exports are safe to call on web (they no-op gracefully).
 */

import { Capacitor } from "@capacitor/core";

export function isNative() {
  return Capacitor.isNativePlatform();
}

export function getPlatform() {
  return Capacitor.getPlatform(); // "ios" | "android" | "web"
}

// ─── Haptics ─────────────────────────────────────────────────────────────────

// Cached module reference — never returned from an async function.
// Returning a Capacitor plugin proxy from async causes the Promise machinery to
// call .then() on the proxy, which fails with "Haptics.then() is not implemented on ios".
let _hapticsModule = null;
let _hapticsLoadAttempted = false;

async function ensureHapticsLoaded() {
  if (_hapticsLoadAttempted) return;
  _hapticsLoadAttempted = true;
  if (!isNative()) return;
  try {
    _hapticsModule = await import("@capacitor/haptics");
  } catch {
    // stays null
  }
}

export async function hapticLight() {
  await ensureHapticsLoaded();
  if (!_hapticsModule) return;
  try {
    await _hapticsModule.Haptics.impact({ style: _hapticsModule.ImpactStyle.Light });
  } catch {
    // ignore
  }
}

export async function hapticMedium() {
  await ensureHapticsLoaded();
  if (!_hapticsModule) return;
  try {
    await _hapticsModule.Haptics.impact({ style: _hapticsModule.ImpactStyle.Medium });
  } catch {
    // ignore
  }
}

export async function hapticSuccess() {
  await ensureHapticsLoaded();
  if (!_hapticsModule) return;
  try {
    await _hapticsModule.Haptics.notification({ type: _hapticsModule.NotificationType.Success });
  } catch {
    // ignore
  }
}

export async function hapticError() {
  await ensureHapticsLoaded();
  if (!_hapticsModule) return;
  try {
    await _hapticsModule.Haptics.notification({ type: _hapticsModule.NotificationType.Error });
  } catch {
    // ignore
  }
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

export async function setStatusBarForTheme(resolvedTheme) {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const isDark = resolvedTheme === "dark";
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: isDark ? "#071225" : "#10253f" });
    }
  } catch {
    // ignore
  }
}

export async function initStatusBar(resolvedTheme) {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const isDark = resolvedTheme === "dark";
    // Let the web content sit under the status bar — CSS safe-area handles the gap
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
  } catch {
    // ignore
  }
}

// ─── Splash Screen ───────────────────────────────────────────────────────────

export async function hideSplash() {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    // ignore
  }
}

// ─── Keyboard ────────────────────────────────────────────────────────────────

export async function initKeyboard() {
  if (!isNative()) return;
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    // Don't show the accessory bar (done/next toolbar above keyboard)
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
    // Resize only the body (not the whole viewport) so bottom nav stays put
    await Keyboard.setResizeMode({ mode: "body" });
  } catch {
    // ignore
  }
}

// ─── App (back button) ───────────────────────────────────────────────────────

export async function addBackButtonListener(handler) {
  if (!isNative() || getPlatform() !== "android") return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", handler);
    return () => listener.remove();
  } catch {
    return () => {};
  }
}

// ─── Deep links ──────────────────────────────────────────────────────────────

export async function addUrlOpenListener(handler) {
  if (!isNative()) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("appUrlOpen", handler);

    // Also check if the app was launched via a URL (e.g. app was killed)
    const launch = await App.getLaunchUrl().catch(() => null);
    if (launch?.url) handler({ url: launch.url });

    return () => listener.remove();
  } catch {
    return () => {};
  }
}

// ─── Sign in with Apple ───────────────────────────────────────────────────────

export async function signInWithApple() {
  if (!isNative() || getPlatform() !== "ios") {
    throw new Error("Sign in with Apple is only available on iOS.");
  }
  const { registerPlugin } = await import("@capacitor/core");
  const AppleSignIn = registerPlugin("SignInWithApple");
  const result = await AppleSignIn.authorize();
  return result.response;
}

// ─── Init ────────────────────────────────────────────────────────────────────

export async function initNative({ resolvedTheme = "light" } = {}) {
  if (!isNative()) return;
  await Promise.allSettled([
    initStatusBar(resolvedTheme),
    initKeyboard(),
    hideSplash(),
  ]);
}
