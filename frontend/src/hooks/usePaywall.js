import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { purchaseMonthly, restorePurchases } from "../lib/purchases.js";

export function usePaywall({ appData, navigate }) {
  const { refreshDashboardBundle } = appData;

  const [paywallBusy, setPaywallBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  async function handleSubscribeIAP() {
    setPaywallBusy(true);
    setPurchaseError("");
    try {
      const confirmed = await purchaseMonthly();
      if (confirmed) {
        await refreshDashboardBundle().catch(() => {});
        navigate("insights");
      }
    } catch (err) {
      const msg = err?.message || "";
      const cancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user_cancel");
      if (!cancelled) setPurchaseError(msg || "Purchase failed. Please try again.");
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
    await refreshDashboardBundle().catch(() => {});
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
