import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api.js";
import { purchaseMonthly, restorePurchases, preloadOfferings } from "../lib/purchases.js";

export function usePaywall({ appData, navigate }) {
  const { refreshDashboardBundle, setSession } = appData;

  const [paywallBusy, setPaywallBusy] = useState(false);

  useEffect(() => {
    preloadOfferings();
  }, []);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  async function handleSubscribeIAP() {
    setPaywallBusy(true);
    setPurchaseError("");
    try {
      await purchaseMonthly();
      // purchaseMonthly throws on failure/cancel, so reaching here means StoreKit confirmed the transaction
      await apiFetch("/api/subscription/activate", { method: "POST" }).catch(() => {});
      await refreshDashboardBundle().catch(() => {});
      // Optimistic update: set isPro=true after the refresh so Render cold-start latency
      // never leaves the user stuck on the paywall after a confirmed purchase.
      setSession((prev) => (prev ? { ...prev, isPro: true } : prev));
      navigate("insights");
    } catch (err) {
      const msg = err?.message || "";
      const isUserCancel =
        msg.toLowerCase().includes("user_cancel") ||
        msg === "The operation couldn't be completed. (SKErrorDomain error 2.)";
      if (!isUserCancel) {
        setPurchaseError(msg || "Purchase failed. Please try again.");
      }
    } finally {
      setPaywallBusy(false);
    }
  }

  async function handleRestorePurchases() {
    setRestoreBusy(true);
    setPurchaseError("");
    try {
      const confirmed = await restorePurchases();
      if (confirmed) {
        await refreshDashboardBundle().catch(() => {});
        navigate("insights");
      } else {
        setPurchaseError("No previous purchases found for this Apple ID.");
      }
    } catch {
      setPurchaseError("Restore failed. Please try again.");
    } finally {
      setRestoreBusy(false);
    }
  }

  return {
    paywallBusy,
    restoreBusy,
    purchaseError,
    handleSubscribeIAP,
    handleRestorePurchases,
  };
}
