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

// Cached plugin reference — never returned from an async function.
// Returning a Capacitor plugin proxy from async causes the Promise machinery to
// call .then() on the proxy, which the native bridge intercepts and fails with
// "Purchases.then() is not implemented on ios".
let _Purchases = null;
let _purchasesLoadAttempted = false;

async function ensurePurchasesLoaded() {
  if (_purchasesLoadAttempted) return;
  _purchasesLoadAttempted = true;
  if (!isIOS() || !IOS_KEY) return;
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    _Purchases = mod.Purchases;
  } catch {
    // stays null
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

export async function initPurchases(userId) {
  await ensurePurchasesLoaded();
  if (!_Purchases) return;
  try {
    await withTimeout(
      _Purchases.configure({ apiKey: IOS_KEY, appUserID: String(userId) }),
      10_000,
      "configure",
    );
    _configured = true;
    _configuredUserId = String(userId);
    _offeringsPromise = null;
  } catch (err) {
    if (isAlreadyConfiguredError(err)) {
      _configured = true;
    }
  }
}

async function ensureConfigured() {
  if (_configured) return;
  await ensurePurchasesLoaded();
  if (!_Purchases) return;
  try {
    await withTimeout(
      _Purchases.configure({ apiKey: IOS_KEY }),
      10_000,
      "configure",
    );
    _configured = true;
  } catch (err) {
    if (isAlreadyConfiguredError(err)) {
      _configured = true;
    }
  }
}

async function fetchOfferings() {
  await ensurePurchasesLoaded();
  if (!_Purchases) return null;
  await ensureConfigured();
  if (!_configured) throw new Error("RevenueCat could not be initialised. Check your connection and try again.");
  const { current } = await withTimeout(_Purchases.getOfferings(), 15_000, "getOfferings");
  if (!current) throw new Error("No active offering found. Check RevenueCat dashboard configuration.");
  return current.monthly ?? null;
}

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
  await ensurePurchasesLoaded();
  if (!_Purchases) throw new Error("In-app purchases are not available on this device.");

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
      _Purchases.purchasePackage({ aPackage: pkg }),
      60_000,
      "purchasePackage",
    );
    // If purchasePackage returned without throwing, StoreKit confirmed the transaction.
    // Treat it as success regardless of entitlement propagation delay from RevenueCat.
    const isPro = Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
    console.log("[RevenueCat] purchase complete — entitlement active:", isPro);
    return true;
  } catch (err) {
    const msg = String(err?.message ?? err ?? "");
    const isUserCancel =
      msg.toLowerCase().includes("user_cancel") ||
      msg === "The operation couldn't be completed. (SKErrorDomain error 2.)";

    console.error("[RevenueCat] purchasePackage error:", msg, "| userCancel:", isUserCancel);

    if (isUserCancel) {
      throw err;
    }
    throw new Error(`Purchase failed: ${msg || "Unknown StoreKit error"}`);
  }
}

export async function restorePurchases() {
  await ensurePurchasesLoaded();
  if (!_Purchases) return false;
  try {
    await ensureConfigured();
    const { customerInfo } = await withTimeout(
      _Purchases.restorePurchases(),
      30_000,
      "restorePurchases",
    );
    return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
  } catch (err) {
    console.error("[RevenueCat] restorePurchases error:", err?.message ?? err);
    return false;
  }
}
