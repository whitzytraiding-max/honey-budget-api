import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { purchaseMonthly, restorePurchases } from "../lib/purchases.js";

export function usePaywall({ appData, navigate }) {
  const { refreshDashboardBundle, setPageError } = appData;

  const [paywallBusy, setPaywallBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  async function handleSubscribeIAP() {
    setPaywallBusy(true);
    setPageError("");
    try {
      const confirmed = await purchaseMonthly();
      if (confirmed) {
        await refreshDashboardBundle().catch(() => {});
        navigate("insights");
      }
    } catch (err) {
      const msg = err?.message || "";
      const cancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user_cancel");
      if (!cancelled) setPageError("Purchase failed. Please try again.");
    } finally {
      setPaywallBusy(false);
    }
  }

  async function handleRestorePurchases() {
    setRestoreBusy(true);
    setPageError("");
    try {
      const confirmed = await restorePurchases();
      if (confirmed) {
        await refreshDashboardBundle().catch(() => {});
        navigate("insights");
      } else {
        setPageError("No previous purchases found to restore.");
      }
    } catch {
      setPageError("Restore failed. Please try again.");
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

  return { paywallBusy, restoreBusy, handleSubscribeIAP, handleRestorePurchases, handleRedeemCoupon };
}
