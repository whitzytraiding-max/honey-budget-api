import { useState } from "react";
import { apiFetch } from "../lib/api.js";

export function useCoach({ appData, navigate }) {
  const {
    currencyCode,
    coachProfile, setCoachProfile,
    coachProfileForm, setCoachProfileForm,
    fetchHouseholdData, loadInsights,
    refreshDashboardBundle,
    setSuppressNextInsightsError,
    setPageError,
  } = appData;

  const [coachProfileBusy, setCoachProfileBusy] = useState(false);
  const [coachEditingProfile, setCoachEditingProfile] = useState(false);

  function updateCoachProfileForm(event) {
    setPageError("");
    setCoachProfileForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleCoachChat(message, conversationHistory = []) {
    const data = await apiFetch("/api/coach/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversationHistory, displayCurrency: currencyCode }),
    });
    if (data.actions?.length > 0) refreshDashboardBundle().catch(() => {});
    return { reply: data.reply, actions: data.actions ?? [], history: data.history ?? [] };
  }

  async function handleCoachProfileSubmit(event, { isPro }) {
    event.preventDefault();
    setCoachProfileBusy(true);
    setPageError("");
    try {
      const data = await apiFetch("/api/coach-profile", {
        method: "PUT",
        body: JSON.stringify({ ...coachProfileForm, notes: coachProfileForm.notes.trim() }),
      });
      setCoachProfile(data.profile);
      const { createCoachProfileDraft } = await import("./useAppData.js");
      setCoachProfileForm(createCoachProfileDraft(data.profile));
      await fetchHouseholdData();
      if (!isPro) { navigate("paywall"); return; }
      const nextInsights = await loadInsights({ suppressError: true });
      if (!nextInsights) setPageError("Your coach answers were saved. Insights are taking a little longer to load.");
      setSuppressNextInsightsError(false);
      navigate("insights");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setCoachProfileBusy(false);
    }
  }

  return {
    coachProfileBusy,
    coachEditingProfile,
    setCoachEditingProfile,
    updateCoachProfileForm,
    handleCoachChat,
    handleCoachProfileSubmit,
  };
}
