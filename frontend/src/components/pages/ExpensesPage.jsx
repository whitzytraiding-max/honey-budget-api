import { useEffect, useRef, useState } from "react";
import {
  CalendarDays, Camera, Car, ChevronDown, Coffee, Cookie, Delete,
  Heart, Home, Loader2, Pencil, Plane, ShoppingBag, ShoppingBasket,
  SlidersHorizontal, Sparkles, Trash2, Utensils, Wallet, X,
} from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { hapticLight, hapticSuccess } from "../../lib/native.js";

/* Full category list kept for advanced picker / existing data display */
const CATEGORIES = [
  "Dining", "Housing", "Utilities", "Streaming", "Insurance", "Groceries",
  "Transport", "Fuel", "Debt Payment", "Medical", "Personal Care", "Childcare",
  "Pets", "Phone & Internet", "Entertainment", "Education", "Shopping",
  "Gifts", "Taxes", "Emergency", "Travel", "Wellness", "Drinks", "Snacks",
  "Others",
];

/* Quick-pick grid shown on the add form */
const CATEGORY_GRID = [
  { label: "Others",    icon: Sparkles,       value: "Others" },
  { label: "Dining",    icon: Utensils,        value: "Dining" },
  { label: "Transport", icon: Car,             value: "Transport" },
  { label: "Drinks",    icon: Coffee,          value: "Drinks" },
  { label: "Groceries", icon: ShoppingBasket,  value: "Groceries" },
  { label: "Snacks",    icon: Cookie,          value: "Snacks" },
  { label: "Shopping",  icon: ShoppingBag,     value: "Shopping" },
  { label: "Housing",   icon: Home,            value: "Housing" },
  { label: "Medical",   icon: Heart,           value: "Medical" },
  { label: "Travel",    icon: Plane,           value: "Travel" },
];

/* Resize + JPEG-compress an image File to keep the OCR upload small */
function fileToCompressedBase64(file, maxDim = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width >= height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
      else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't load that image.")); };
    img.src = url;
  });
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return "Select date";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/* ─── Numpad for mobile add form ─────────────────────────────────────── */
function NumpadKey({ label, onPress, wide, tall, amber }) {
  return (
    <button
      type="button"
      className={`flex items-center justify-center rounded-2xl text-lg font-semibold transition active:scale-95 ${
        wide ? "col-span-2" : ""
      } ${tall ? "row-span-3" : ""}`}
      style={{
        minHeight: tall ? undefined : "52px",
        background: amber
          ? "var(--hb-accent-strong)"
          : "var(--hb-surface-soft)",
        color: amber ? "var(--hb-accent-contrast)" : "var(--hb-text)",
        border: amber ? "none" : "1px solid var(--hb-border)",
        boxShadow: amber ? "0 6px 20px -6px var(--hb-accent-glow)" : "none",
      }}
      onClick={() => { hapticLight(); onPress(label); }}
    >
      {label === "⌫" ? <Delete className="h-5 w-5" /> : label}
    </button>
  );
}

/* ─── Transaction card for recent/history tabs ────────────────────────── */
function TransactionCard({ transaction, currentUserId, onEdit, onDelete, t }) {
  return (
    <div
      className="rounded-[1.35rem] p-4"
      style={{ background: "var(--hb-surface)", border: "1px solid var(--hb-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" style={{ color: "var(--hb-text)" }}>{transaction.description}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--hb-text-muted)" }}>
            {transaction.date}
          </p>
        </div>
        <p className="text-base font-semibold" style={{ color: "var(--hb-accent-text)" }}>
          {currency(transaction.displayAmount ?? transaction.amount)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "var(--hb-accent-text)" }}>
        <span className="rounded-full px-2.5 py-1" style={{ background: "var(--hb-accent-soft-bg)" }}>
          {transaction.category}
        </span>
        <span className="rounded-full px-2.5 py-1" style={{ background: "var(--hb-accent-soft-bg)" }}>
          {transaction.currencyCode}
        </span>
        <span className="rounded-full px-2.5 py-1" style={{ background: "var(--hb-accent-soft-bg)" }}>
          {transaction.paymentMethod === "cash" ? "Cash" : "Card"}
        </span>
      </div>
      {transaction.userId === currentUserId ? (
        <div className="mt-3 flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)" }}
            onClick={() => onEdit(transaction)}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("expenses.edit")}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{ background: "var(--hb-bad-soft-bg)", color: "var(--hb-bad-text)" }}
            onClick={() => onDelete(transaction)}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("expenses.delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */
function ExpensesPage({
  activeTab = "log",
  expenseForm,
  onExpenseChange,
  onExpenseSubmit,
  onScanReceipt,
  expenseBusy,
  expenseSuccessCount = 0,
  transactions,
  baseCurrencyCode,
  currencyCode,
  mmkRateData,
  editingTransactionId,
  currentUserId,
  householdUsers,
  onEditTransaction,
  onDeleteTransaction,
  onCancelEdit,
}) {
  const { t, locale } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const recentTransactions = transactions.slice(0, 10);

  /* Numpad amount state — synced to expenseForm.amount */
  const [numStr, setNumStr] = useState(expenseForm.amount ? String(expenseForm.amount) : "");
  const [showOptions, setShowOptions] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loggedFlash, setLoggedFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const fileInputRef = useRef(null);

  /* Available expense currencies derived from the user's two configured currencies */
  const expenseCurrencies = [...new Set([baseCurrencyCode, currencyCode].filter(Boolean))];
  const activeCurrency = expenseForm.currencyCode || baseCurrencyCode;

  /* Sync numStr from parent when editing a transaction */
  useEffect(() => {
    if (editingTransactionId && expenseForm.amount) {
      setNumStr(String(expenseForm.amount));
    } else if (!editingTransactionId) {
      setNumStr("");
    }
  }, [editingTransactionId]);

  /* Flash success and reset numpad after a new expense is logged */
  useEffect(() => {
    if (expenseSuccessCount === 0) return;
    hapticSuccess();
    setNumStr("");
    setLoggedFlash(true);
    const t = setTimeout(() => setLoggedFlash(false), 1400);
    return () => clearTimeout(t);
  }, [expenseSuccessCount]);

  function handleNumKey(key) {
    let next = numStr;
    if (key === "⌫") {
      next = numStr.slice(0, -1);
    } else if (key === ".") {
      if (!numStr.includes(".")) next = (numStr || "0") + ".";
    } else if (key === "+/-") {
      next = numStr.startsWith("-") ? numStr.slice(1) : numStr ? "-" + numStr : "";
    } else {
      next = numStr === "0" ? key : numStr + key;
    }
    setNumStr(next);
    onExpenseChange({ target: { name: "amount", value: next || "0" } });
  }

  function displayAmount() {
    if (!numStr) return "0.00";
    const n = parseFloat(numStr);
    if (isNaN(n)) return "0.00";
    return n.toFixed(numStr.includes(".") && !numStr.endsWith(".") ? 2 : undefined).replace(/(\.\d?)$/, (m) => m.padEnd(3, "0")).slice(0, 10);
  }

  /* Scan a receipt photo → prefill the form with the parsed total + category */
  async function handleReceiptFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file || !onScanReceipt) return;
    setScanning(true);
    setScanFlash(false);
    try {
      const { base64, mimeType } = await fileToCompressedBase64(file);
      const result = await onScanReceipt(base64, mimeType);
      if (result?.amount) {
        const amt = String(result.amount);
        setNumStr(amt);
        onExpenseChange({ target: { name: "amount", value: amt } });
        if (result.category) onExpenseChange({ target: { name: "category", value: result.category } });
        if (result.description) onExpenseChange({ target: { name: "description", value: result.description } });
        if (result.currencyCode && expenseCurrencies.includes(result.currencyCode)) {
          onExpenseChange({ target: { name: "currencyCode", value: result.currencyCode } });
        }
        if (result.date) onExpenseChange({ target: { name: "date", value: result.date } });
        hapticSuccess();
        setScanFlash(true);
        setTimeout(() => setScanFlash(false), 4000);
      }
    } catch {
      /* onScanReceipt surfaces API errors via pageError; ignore compression hiccups */
    } finally {
      setScanning(false);
    }
  }

  /* ── Recent tab ─────────────────────────────────────────────────────── */
  if (activeTab === "recent") {
    return (
      <section className="hb-surface-card rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
          <div>
            <h2 className="text-xl font-semibold">{t("expenses.latest")}</h2>
            <p className="text-sm" style={{ color: "var(--hb-text-muted)" }}>{t("expenses.latestSubtitle")}</p>
          </div>
        </div>
        <div className="space-y-3">
          {recentTransactions.length ? (
            recentTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                currentUserId={currentUserId}
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
                t={t}
              />
            ))
          ) : (
            <div className="rounded-[1.35rem] px-4 py-8 text-center text-sm" style={{ background: "var(--hb-surface-soft)", color: "var(--hb-text-muted)" }}>
              {t("expenses.empty")}
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ── History tab ────────────────────────────────────────────────────── */
  if (activeTab === "history") {
    return (
      <section className="hb-surface-card rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-5 w-5" style={{ color: "var(--hb-accent-text)" }} />
          <h2 className="text-xl font-semibold">Expense History</h2>
        </div>
        <div className="space-y-3">
          {transactions.length ? (
            transactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                currentUserId={currentUserId}
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
                t={t}
              />
            ))
          ) : (
            <div className="rounded-[1.35rem] px-4 py-8 text-center text-sm" style={{ background: "var(--hb-surface-soft)", color: "var(--hb-text-muted)" }}>
              {t("expenses.empty")}
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ── Log tab — numpad UI ────────────────────────────────────────────── */
  const showMmkHelper =
    expenseForm.currencyCode === "MMK" || currencyCode === "MMK" || baseCurrencyCode === "MMK";
  const mmkRateText = mmkRateData?.rate
    ? `1 USD = ${Number(mmkRateData.rate.rate).toFixed(2)} MMK`
    : "";

  return (
    <form onSubmit={onExpenseSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="amount" value={numStr || "0"} readOnly />
      <input type="hidden" name="currencyCode" value={expenseForm.currencyCode || ""} readOnly />
      <input type="hidden" name="category" value={expenseForm.category || "Dining"} readOnly />
      <input type="hidden" name="description" value={expenseForm.description || ""} readOnly />

      {/* Editing banner */}
      {editingTransactionId ? (
        <div
          className="flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-sm"
          style={{ background: "var(--hb-accent-soft-bg)", border: "1px solid var(--hb-accent-line)", color: "var(--hb-accent-text)" }}
        >
          <p>{t("expenses.editingHelp")}</p>
          <button className="inline-flex items-center gap-1 font-semibold" onClick={onCancelEdit} type="button">
            <X className="h-4 w-4" />
            {t("expenses.cancelEdit")}
          </button>
        </div>
      ) : null}

      {/* Quick actions — Scan receipt + More options (promoted to the top) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { hapticLight(); fileInputRef.current?.click(); }}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-[1.2rem] py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60"
          style={{ background: "var(--hb-accent-soft-bg)", color: "var(--hb-accent-text)", border: "1px solid var(--hb-accent-line)" }}
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {scanning ? "Scanning…" : "Scan receipt"}
        </button>
        <button
          type="button"
          onClick={() => { hapticLight(); setShowOptions(true); }}
          className="flex items-center justify-center gap-2 rounded-[1.2rem] py-3 text-sm font-semibold transition active:scale-[0.98]"
          style={{ background: "var(--hb-surface-soft)", color: "var(--hb-text)", border: "1px solid var(--hb-border)" }}
        >
          <SlidersHorizontal className="h-4 w-4" /> More options
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleReceiptFile}
      />

      {/* Scan success banner */}
      {scanFlash ? (
        <div
          className="flex items-center gap-2 rounded-[1.2rem] px-4 py-2.5 text-sm"
          style={{ background: "var(--hb-good-soft-bg)", border: "1px solid var(--hb-good)", color: "var(--hb-good-text)" }}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Scanned ✓ — check the details below, then tap Add.</span>
        </div>
      ) : null}

      {/* Card / Cash toggle */}
      <div
        className="flex gap-1 p-1 rounded-full"
        style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}
      >
        {[{ label: "Card", value: "card" }, { label: "Cash", value: "cash" }].map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className="flex-1 py-2.5 rounded-full text-sm font-semibold transition"
            style={{
              background: (expenseForm.paymentMethod || "card") === value ? "var(--hb-accent-strong)" : "transparent",
              color: (expenseForm.paymentMethod || "card") === value ? "var(--hb-accent-contrast)" : "var(--hb-text-muted)",
            }}
            onClick={() => { hapticLight(); onExpenseChange({ target: { name: "paymentMethod", value } }); }}
          >
            {label}
          </button>
        ))}
      </div>

          {/* Date row */}
          <label
            className="flex items-center gap-2.5 rounded-[1.2rem] px-4 py-3 cursor-pointer transition"
            style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}
          >
            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--hb-accent-text)" }} />
            <span className="flex-1 text-sm font-medium" style={{ color: "var(--hb-text)" }}>
              {formatDateDisplay(expenseForm.date)}
            </span>
            <ChevronDown className="h-4 w-4" style={{ color: "var(--hb-text-muted)" }} />
            <input
              type="date"
              name="date"
              value={expenseForm.date}
              onChange={onExpenseChange}
              className="sr-only"
              required
            />
          </label>

          {/* Category grid */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hb-text-muted)" }}>
              Category
            </p>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_GRID.map((cat) => {
                const isSelected = expenseForm.category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-xl py-2 px-1 transition active:scale-95"
                    style={{
                      background: isSelected ? "var(--hb-accent-soft-bg)" : "var(--hb-surface-soft)",
                      border: isSelected ? "1px solid var(--hb-accent)" : "1px solid var(--hb-border)",
                    }}
                    onClick={() => {
                      hapticLight();
                      onExpenseChange({ target: { name: "category", value: cat.value } });
                    }}
                  >
                    <cat.icon
                      className="h-5 w-5"
                      style={{ color: isSelected ? "var(--hb-accent-text)" : "var(--hb-text-muted)", strokeWidth: 1.75 }}
                    />
                    <span
                      className="text-[9px] font-medium leading-none text-center"
                      style={{ color: isSelected ? "var(--hb-accent-text)" : "var(--hb-text-muted)" }}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount display */}
          <div
            className="relative flex items-center justify-between rounded-[1.2rem] px-5 py-4"
            style={{ background: "var(--hb-surface-soft)", border: "1px solid var(--hb-border)" }}
          >
            <div className="flex items-baseline gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1 text-lg font-medium transition active:opacity-60"
                style={{ color: "var(--hb-accent-text)", background: "none", border: "none", padding: 0 }}
                onClick={() => { hapticLight(); setShowCurrencyPicker((v) => !v); }}
              >
                {activeCurrency}
                <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--hb-text-muted)", marginBottom: "-2px" }} />
              </button>
              {/* Currency dropdown */}
              {showCurrencyPicker && (
                <div
                  className="absolute left-0 top-full mt-2 z-30 rounded-2xl overflow-y-auto"
                  style={{ background: "var(--hb-surface-strong)", border: "1px solid var(--hb-accent-line)", minWidth: "160px", maxHeight: "220px", boxShadow: "var(--hb-shadow)" }}
                >
                  {currencyOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-white/5"
                      style={{
                        color: activeCurrency === opt.value ? "var(--hb-accent-text)" : "var(--hb-text)",
                        fontWeight: activeCurrency === opt.value ? 600 : 400,
                      }}
                      onClick={() => {
                        hapticLight();
                        onExpenseChange({ target: { name: "currencyCode", value: opt.value } });
                        setShowCurrencyPicker(false);
                      }}
                    >
                      <span>{opt.value}</span>
                      {activeCurrency === opt.value && <span style={{ color: "var(--hb-accent-text)" }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <span
                className="text-4xl font-bold tracking-tight transition-all duration-300"
                style={{ color: loggedFlash ? "var(--hb-good)" : numStr ? "var(--hb-text)" : "var(--hb-text-muted)" }}
              >
                {loggedFlash ? "Logged ✓" : numStr ? displayAmount() : "0.00"}
              </span>
            </div>
            {showMmkHelper && mmkRateText ? (
              <span className="text-[10px]" style={{ color: "var(--hb-text-muted)" }}>{mmkRateText}</span>
            ) : null}
          </div>


          {/* Numpad */}
          <div className="grid grid-cols-4 gap-2" style={{ gridTemplateRows: "repeat(4, 52px)" }}>
            <NumpadKey label="1" onPress={handleNumKey} />
            <NumpadKey label="2" onPress={handleNumKey} />
            <NumpadKey label="3" onPress={handleNumKey} />
            <NumpadKey label="⌫" onPress={handleNumKey} />

            <NumpadKey label="4" onPress={handleNumKey} />
            <NumpadKey label="5" onPress={handleNumKey} />
            <NumpadKey label="6" onPress={handleNumKey} />

            {/* Add button spans rows 2-4 */}
            <button
              type="submit"
              disabled={expenseBusy || !numStr || parseFloat(numStr) === 0}
              className="rounded-2xl font-bold transition active:scale-95 disabled:opacity-40"
              style={{
                gridRow: "2 / span 3",
                gridColumn: "4",
                background: "var(--hb-accent-strong)",
                color: "var(--hb-accent-contrast)",
                boxShadow: "0 8px 24px -6px var(--hb-accent-glow)",
                fontSize: "0.95rem",
              }}
            >
              {expenseBusy ? "…" : editingTransactionId ? "Save" : "Add"}
              {!expenseBusy && <div className="text-base mt-0.5">🐾</div>}
            </button>

            <NumpadKey label="7" onPress={handleNumKey} />
            <NumpadKey label="8" onPress={handleNumKey} />
            <NumpadKey label="9" onPress={handleNumKey} />

            <NumpadKey label="." onPress={handleNumKey} />
            <NumpadKey label="0" onPress={handleNumKey} />
            <NumpadKey label="+/-" onPress={handleNumKey} />
          </div>

          {/* More options — bottom-sheet popup (kept inside <form> so submit reads these fields) */}
          {showOptions && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
              onClick={() => setShowOptions(false)}
            >
              <div
                className="w-full max-w-md rounded-t-[1.75rem] p-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto"
                style={{ background: "var(--hb-surface-strong)", borderTop: "1px solid var(--hb-border)", boxShadow: "var(--hb-shadow)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold" style={{ color: "var(--hb-text)" }}>More options</h3>
                  <button
                    type="button"
                    onClick={() => setShowOptions(false)}
                    className="p-1.5 rounded-full transition"
                    style={{ background: "var(--hb-surface-soft)" }}
                  >
                    <X className="h-4 w-4" style={{ color: "var(--hb-text-muted)" }} />
                  </button>
                </div>

              {/* Note */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>
                  Note
                </span>
                <input
                  name="description"
                  value={expenseForm.description}
                  onChange={onExpenseChange}
                  placeholder="e.g. Date night tacos"
                  className="w-full rounded-[0.9rem] px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--hb-input-bg)", border: "1px solid var(--hb-input-border)", color: "var(--hb-text)" }}
                />
              </label>

              {/* Full category select */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>
                  Category (full list)
                </span>
                <select
                  name="category"
                  value={expenseForm.category}
                  onChange={onExpenseChange}
                  className="w-full rounded-[0.9rem] px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--hb-input-bg)", border: "1px solid var(--hb-input-border)", color: "var(--hb-text)" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              {/* Type */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>Type</p>
                <div className="flex gap-1">
                  {[{ label: t("expenses.oneTime"), value: "one-time" }, { label: t("expenses.recurring"), value: "recurring" }].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="flex-1 rounded-xl py-2 text-xs font-medium transition"
                      style={{
                        background: expenseForm.type === o.value ? "var(--hb-accent-strong)" : "var(--hb-surface)",
                        color: expenseForm.type === o.value ? "var(--hb-accent-contrast)" : "var(--hb-text-muted)",
                        border: "1px solid var(--hb-border)",
                      }}
                      onClick={() => onExpenseChange({ target: { name: "type", value: o.value } })}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Log as (couples) */}
              {!editingTransactionId && householdUsers?.length >= 2 && (() => {
                const partner = householdUsers.find((u) => u.id !== currentUserId);
                const me = householdUsers.find((u) => u.id === currentUserId);
                if (!partner) return null;
                const activeId = expenseForm.logAsUserId ? String(expenseForm.logAsUserId) : String(currentUserId);
                const options = [
                  { id: String(currentUserId), label: me?.name ?? "You" },
                  { id: String(partner.id), label: partner.name },
                  { id: "joint", label: "Joint ½" },
                ];
                return (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--hb-text-muted)" }}>
                      Log under
                    </p>
                    <div className="flex gap-2">
                      {options.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          className="flex-1 rounded-xl py-2 text-xs font-medium transition"
                          style={{
                            background: activeId === id ? "var(--hb-accent-strong)" : "var(--hb-surface)",
                            color: activeId === id ? "var(--hb-accent-contrast)" : "var(--hb-text-muted)",
                            border: "1px solid var(--hb-border)",
                          }}
                          onClick={() => onExpenseChange({ target: { name: "logAsUserId", value: id } })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

                <button
                  type="button"
                  onClick={() => setShowOptions(false)}
                  className="w-full rounded-[1.2rem] py-3 text-sm font-bold transition active:scale-[0.98]"
                  style={{ background: "var(--hb-accent-strong)", color: "var(--hb-accent-contrast)" }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
    </form>
  );
}

export default ExpensesPage;
