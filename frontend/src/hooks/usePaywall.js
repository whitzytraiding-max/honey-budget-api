import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api.js";
import { purchaseMonthly, restorePurchases, preloadOfferings } from "../lib/purchases.js";

export function usePaywall({ appData, navigate }) {
  const { refreshDashboardBundle } = appData;

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
      const confirmed = await purchaseMonthly();
      if (confirmed) {
        // Tell the backend immediately — don't wait for the RevenueCat webhook
        await apiFetch("/api/subscription/activate", { method: "POST" }).catch(() => {});
        await refreshDashboardBundle().catch(() => {});
        navigate("insights");
      } else {
        // Purchase completed but entitlement wasn't granted — unusual, surface it
        setPurchaseError("Subscription not activated. Please restore purchases or contact support.");
      }
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

  async function handleRedeemCoupon(code) {
    const data = await apiFetch("/api/coupons/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    try {
      await refreshDashboardBundle();
    } catch {
      // Budget views failed — still navigate so the user sees Pro is active
    }
    navigate("insights");
    return data;
  }

  return {
    paywallBusy,
    restoreBusy,
    purchaseError,
    handleSubscribeIAP,
    handleRestorePurchases,
    handleRedeemCoupon,
  };
}
