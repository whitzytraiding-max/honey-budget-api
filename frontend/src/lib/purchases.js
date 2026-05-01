/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

/**
 * RevenueCat in-app purchase wrapper.
 * All functions are safe to call on web — they no-op gracefully.
 */

import { isNative, getPlatform } from "./native.js";

const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY || "";
const PRO_ENTITLEMENT = "pro";
const OFFERINGS_TIMEOUT_MS = 15_000;
const PURCHASE_TIMEOUT_MS = 60_000;

function isIOS() {
  return isNative() && getPlatform() === "ios";
}

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
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms),
    ),
  ]);
}

export async function initPurchases(userId) {
  const Purchases = await getPurchases();
  if (!Purchases) return;
  try {
    await Purchases.configure({ apiKey: IOS_KEY, appUserID: String(userId) });
  } catch {
    // ignore — already configured or unsupported
  }
}

export async function getMonthlyPackage() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  try {
    const { current } = await withTimeout(
      Purchases.getOfferings(),
      OFFERINGS_TIMEOUT_MS,
      "getOfferings",
    );
    return current?.monthly ?? null;
  } catch {
    return null;
  }
}

export async function purchaseMonthly() {
  const Purchases = await getPurchases();
  if (!Purchases) throw new Error("Purchases not available on this platform.");
  const pkg = await getMonthlyPackage();
  if (!pkg) throw new Error("Subscription not available right now. Please check your connection and try again.");
  const { customerInfo } = await withTimeout(
    Purchases.purchasePackage({ aPackage: pkg }),
    PURCHASE_TIMEOUT_MS,
    "purchasePackage",
  );
  return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
}

export async function restorePurchases() {
  const Purchases = await getPurchases();
  if (!Purchases) return false;
  try {
    const { customerInfo } = await withTimeout(
      Purchases.restorePurchases(),
      PURCHASE_TIMEOUT_MS,
      "restorePurchases",
    );
    return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
  } catch {
    return false;
  }
}
