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

async function getHaptics() {
  if (!isNative()) return null;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    return Haptics;
  } catch {
    return null;
  }
}

export async function hapticLight() {
  const Haptics = await getHaptics();
  if (!Haptics) return;
  try {
    const { ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // ignore
  }
}

export async function hapticMedium() {
  const Haptics = await getHaptics();
  if (!Haptics) return;
  try {
    const { ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // ignore
  }
}

export async function hapticSuccess() {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // ignore
  }
}

export async function hapticError() {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Error });
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
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
  const result = await SignInWithApple.authorize({
    clientId: "com.whitzy.honeybudget",
    redirectURI: "https://honey-budget.com",
    scopes: "email name",
  });
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
