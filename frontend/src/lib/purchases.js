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

// Track configure state so we never double-configure
let _configured = false;
let _configuredUserId = null;

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
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

// Called when user data loads — sets up RevenueCat with the real user ID
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
  } catch {
    // Already configured, or key error — mark as done either way
    _configured = true;
  }
}

// Ensures RevenueCat is configured before any StoreKit calls.
// If initPurchases hasn't been called yet, configures anonymously
// so getOfferings() can still work (user ID gets merged on logIn later).
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
  } catch {
    // ignore — already configured or network issue
  }
  _configured = true;
}

export async function purchaseMonthly() {
  const Purchases = await getPurchases();
  if (!Purchases) throw new Error("In-app purchases are not available on this device.");

  await ensureConfigured();

  let pkg;
  try {
    const { current } = await withTimeout(
      Purchases.getOfferings(),
      15_000,
      "getOfferings",
    );
    pkg = current?.monthly ?? null;
  } catch {
    throw new Error("Could not load subscription. Check your connection and try again.");
  }

  if (!pkg) {
    throw new Error("Subscription product not available. Please try again later.");
  }

  try {
    const { customerInfo } = await withTimeout(
      Purchases.purchasePackage({ aPackage: pkg }),
      90_000,
      "purchase",
    );
    return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
  } catch (err) {
    const msg = String(err?.message ?? err ?? "");
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user_cancel")) {
      throw err;
    }
    throw new Error("Purchase could not be completed. Please try again.");
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
      "restore",
    );
    return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
  } catch {
    return false;
  }
}
