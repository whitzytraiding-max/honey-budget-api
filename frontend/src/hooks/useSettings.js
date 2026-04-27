import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";
import { STORAGE_KEYS, writeStorage } from "../lib/storage.js";
import { getCurrentLocalMonthParts } from "../lib/date.js";

const MMK_DEFAULTS = {
  rateSource: "kbz",
  rate: "",
};

function buildDefaultMmkForm() {
  return { ...MMK_DEFAULTS, ...getCurrentLocalMonthParts() };
}

export function useSettings({
  currencyCode,
  setCurrencyCode,
  baseCurrencyCode,
  setBaseCurrencyCode,
  session,
  setPageError,
  refreshBudgetViews,
}) {
  const [exchangeRate, setExchangeRate] = useState(1);
  const [exchangeRateLabel, setExchangeRateLabel] = useState("");
  const [mmkRateData, setMmkRateData] = useState(null);
  const [mmkRateForm, setMmkRateForm] = useState(buildDefaultMmkForm);
  const [mmkRateBusy, setMmkRateBusy] = useState(false);

  // Persist currency prefs
  useEffect(() => { writeStorage(STORAGE_KEYS.CURRENCY, currencyCode); }, [currencyCode]);
  useEffect(() => { writeStorage(STORAGE_KEYS.BASE_CURRENCY, baseCurrencyCode); }, [baseCurrencyCode]);

  async function loadMmkRate(year = null, month = null) {
    if (!session?.couple) {
      setMmkRateData(null);
      setMmkRateForm(buildDefaultMmkForm());
      return null;
    }
    const parts = year && month ? { year, month } : getCurrentLocalMonthParts();
    const data = await apiFetch(`/api/mmk-rate?year=${parts.year}&month=${parts.month}`);
    setMmkRateData(data);
    setMmkRateForm({
      ...getCurrentLocalMonthParts(),
      year: data.year,
      month: data.month,
      rateSource: data.rate?.rateSource ?? "kbz",
      rate: data.rate?.rate ? String(data.rate.rate) : "",
    });
    return data;
  }

  useEffect(() => {
    if (!session?.couple) { setMmkRateData(null); return; }
    loadMmkRate().catch((err) => { console.error("MMK rate lookup failed:", err); setMmkRateData(null); });
  }, [session?.couple?.id]);

  // Resolve exchange rate whenever the currency pair or MMK data changes
  useEffect(() => {
    let active = true;

    if (currencyCode === baseCurrencyCode) {
      setExchangeRate(1);
      setExchangeRateLabel("");
      return;
    }

    async function resolve() {
      try {
        if (baseCurrencyCode === "MMK" || currencyCode === "MMK") {
          const rate = Number(mmkRateData?.rate?.rate ?? 0);
          if (!active || !Number.isFinite(rate) || rate <= 0) {
            setExchangeRate(1);
            setExchangeRateLabel("Set this month's MMK rate to use MMK conversions.");
            return;
          }
          const monthLabel = `${String(mmkRateData.month).padStart(2, "0")}/${mmkRateData.year}`;
          const source = String(mmkRateData.rate?.rateSource ?? "custom").toUpperCase();
          const next =
            baseCurrencyCode === "MMK" && currencyCode === "USD" ? 1 / rate :
            baseCurrencyCode === "USD" && currencyCode === "MMK" ? rate : 1;
          setExchangeRate(next);
          setExchangeRateLabel(`This month's MMK rate: 1 USD = ${rate.toFixed(2)} MMK · ${source} · ${monthLabel}`);
          return;
        }

        const data = await apiFetch(
          `/api/exchange-rate?from=${baseCurrencyCode}&to=${currencyCode}`,
          { auth: false },
        );
        const next = Number(data?.rate ?? 0);
        if (!active || !Number.isFinite(next) || next <= 0) return;
        setExchangeRate(next);
        setExchangeRateLabel(
          data?.date
            ? `1 ${baseCurrencyCode} = ${next.toFixed(4)} ${currencyCode} · ${data.cached ? "cached" : "live"} · ${data.date}`
            : "",
        );
      } catch (err) {
        console.error("Exchange rate lookup failed:", err);
        if (active) { setExchangeRate(1); setExchangeRateLabel("Latest exchange rate unavailable"); }
      }
    }

    resolve();
    return () => { active = false; };
  }, [baseCurrencyCode, currencyCode, mmkRateData]);

  function handleCurrencyChange(event) { setCurrencyCode(event.target.value); }
  function handleBaseCurrencyChange(event) { setBaseCurrencyCode(event.target.value); }

  function handleMmkRateChange(event) {
    setPageError("");
    if (event.target.name === "monthKey") {
      const [y, m] = String(event.target.value ?? "").split("-");
      const year = Number.parseInt(y, 10);
      const month = Number.parseInt(m, 10);
      setMmkRateForm((prev) => ({
        ...prev,
        year: Number.isInteger(year) ? year : prev.year,
        month: Number.isInteger(month) ? month : prev.month,
      }));
      return;
    }
    setMmkRateForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleMmkRateSubmit(event) {
    event.preventDefault();
    setMmkRateBusy(true);
    setPageError("");
    const rate = Number.parseFloat(String(mmkRateForm.rate ?? "").trim());
    if (mmkRateForm.rateSource === "custom" && (!Number.isFinite(rate) || rate <= 0)) {
      setPageError("Enter a valid monthly MMK rate greater than zero.");
      setMmkRateBusy(false);
      return;
    }
    try {
      await apiFetch("/api/mmk-rate", {
        method: "PUT",
        body: JSON.stringify({
          year: mmkRateForm.year,
          month: mmkRateForm.month,
          rateSource: mmkRateForm.rateSource,
          ...(mmkRateForm.rateSource === "custom" ? { rate } : {}),
        }),
      });
      await Promise.all([
        loadMmkRate(Number(mmkRateForm.year), Number(mmkRateForm.month)),
        refreshBudgetViews({ includeNotifications: false }),
      ]);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setMmkRateBusy(false);
    }
  }

  function resetMmkRate() {
    setMmkRateData(null);
    setMmkRateForm(buildDefaultMmkForm());
  }

  return {
    exchangeRate,
    exchangeRateLabel,
    mmkRateData,
    mmkRateForm,
    mmkRateBusy,
    loadMmkRate,
    resetMmkRate,
    handleCurrencyChange,
    handleBaseCurrencyChange,
    handleMmkRateChange,
    handleMmkRateSubmit,
  };
}
