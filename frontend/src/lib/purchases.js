/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

import { isNative, getPlatform } from "./native.js";

const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY || "";
const PRO_ENTITLEMENT = "pro";
const OFFERINGS_TIMEOUT_MS = 10_000;
const PURCHASE_TIMEOUT_MS = 25_000;

function isIOS() {
  return isNative() && getPlatform() === "ios";
}

let _configurePromise = null;

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
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

export async function initPurchases(userId) {
  const Purchases = await getPurchases();
  if (!Purchases) return;
  _configurePromise = withTimeout(
    Purchases.configure({ apiKey: IOS_KEY, appUserID: String(userId) }),
    8_000,
    "configure",
  ).catch(() => {});
  await _configurePromise;
}

async function waitForConfigure() {
  if (_configurePromise) await _configurePromise.catch(() => {});
}

export async function getMonthlyPackage() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  try {
    await waitForConfigure();
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
  if (!Purchases) throw new Error("In-app purchases are not available on this device.");
  await waitForConfigure();
  const pkg = await getMonthlyPackage();
  if (!pkg) throw new Error("Subscription product unavailable. Please check your connection and try again.");
  try {
    const { customerInfo } = await withTimeout(
      Purchases.purchasePackage({ aPackage: pkg }),
      PURCHASE_TIMEOUT_MS,
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
    await waitForConfigure();
    const { customerInfo } = await withTimeout(
      Purchases.restorePurchases(),
      PURCHASE_TIMEOUT_MS,
      "restore",
    );
    return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
  } catch {
    return false;
  }
}
