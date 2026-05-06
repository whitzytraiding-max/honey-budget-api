/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

import { isNative, getPlatform } from "./native.js";

const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY || "";
const PRO_ENTITLEMENT = "pro";

function isIOS() {
  return isNative() && getPlatform() === "ios";
}

let _configured = false;
let _configuredUserId = null;
let _offeringsPromise = null;

async function getPurchases() {
  if (!isIOS() || !IOS_KEY) return null;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    return Purchases;
  } catch {
    return null;
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function isAlreadyConfiguredError(err) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("already configured") || msg.includes("already been configured");
}

// Called once user session loads — configures RevenueCat with the real user ID.
export async function initPurchases(userId) {
  const Purchases = await getPurchases();
  if (!Purchases) return;
  try {
    await withTimeout(
      Purchases.configure({ apiKey: IOS_KEY, appUserID: String(userId) }),
      10_000,
      "configure",
    );
    _configured = true;
    _configuredUserId = String(userId);
    _offeringsPromise = null; // reset cache so next fetch uses the correct user
  } catch (err) {
    if (isAlreadyConfiguredError(err)) {
      // SDK is already running — treat as success
      _configured = true;
    }
    // Any other error (timeout, network, bad key) — leave _configured false
    // so ensureConfigured() can retry before the next purchase attempt.
  }
}

// Ensures RevenueCat is configured before any StoreKit call.
// Falls back to anonymous configure if initPurchases hasn't run yet.
async function ensureConfigured() {
  if (_configured) return;
  const Purchases = await getPurchases();
  if (!Purchases) return;
  try {
    await withTimeout(
      Purchases.configure({ apiKey: IOS_KEY }),
      10_000,
      "configure",
    );
    _configured = true;
  } catch (err) {
    if (isAlreadyConfiguredError(err)) {
      _configured = true;
    }
    // On any other failure, leave _configured false so the next call retries.
  }
}

async function fetchOfferings() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  await ensureConfigured();
  if (!_configured) throw new Error("RevenueCat could not be initialised. Check your connection and try again.");
  const { current } = await withTimeout(Purchases.getOfferings(), 15_000, "getOfferings");
  if (!current) throw new Error("No active offering found. Check RevenueCat dashboard configuration.");
  return current.monthly ?? null;
}

// Preload on paywall mount so the package is ready before the user taps.
export async function preloadOfferings() {
  if (!isIOS() || !IOS_KEY) return;
  if (!_offeringsPromise) {
    _offeringsPromise = fetchOfferings().catch((err) => {
      console.error("[RevenueCat] preloadOfferings failed:", err?.message ?? err);
      _offeringsPromise = null;
      return null;
    });
  }
  await _offeringsPromise;
}

export async function purchaseMonthly() {
  const Purchases = await getPurchases();
  if (!Purchases) throw new Error("In-app purchases are not available on this device.");

  // Ensure we have offerings (fetch if preload hasn't run or failed)
  if (!_offeringsPromise) {
    _offeringsPromise = fetchOfferings().catch((err) => {
      console.error("[RevenueCat] fetchOfferings failed:", err?.message ?? err);
      _offeringsPromise = null;
      return null;
    });
  }

  let pkg;
  try {
    pkg = await _offeringsPromise;
  } catch (err) {
    console.error("[RevenueCat] awaiting offerings failed:", err?.message ?? err);
    throw new Error("Could not load subscription products. Check your connection and try again.");
  }

  if (!pkg) {
    throw new Error(
      "Subscription product not available. Make sure the product is approved in App Store Connect and the offering is configured in RevenueCat.",
    );
  }

  try {
    const { customerInfo } = await withTimeout(
      Purchases.purchasePackage({ aPackage: pkg }),
      60_000, // 60s — user may take time to authenticate with Face ID / Apple ID
      "purchasePackage",
    );
    const isPro = Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
    return isPro;
  } catch (err) {
    const msg = String(err?.message ?? err ?? "");
    const isUserCancel =
      msg.toLowerCase().includes("user_cancel") ||
      msg === "The operation couldn't be completed. (SKErrorDomain error 2.)";

    console.error("[RevenueCat] purchasePackage error:", msg, "| userCancel:", isUserCancel);

    if (isUserCancel) {
      throw err; // caller will suppress the error UI for genuine cancels
    }
    throw new Error(`Purchase failed: ${msg || "Unknown StoreKit error"}`);
  }
}

export async function restorePurchases() {
  const Purchases = await getPurchases();
  if (!Purchases) return false;
  try {
    await ensureConfigured();
    const { customerInfo } = await withTimeout(
      Purchases.restorePurchases(),
      30_000,
      "restorePurchases",
    );
    return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
  } catch (err) {
    console.error("[RevenueCat] restorePurchases error:", err?.message ?? err);
    return false;
  }
}
