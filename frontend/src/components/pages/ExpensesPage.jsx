import { useEffect, useState } from "react";
import {
  CalendarDays, Car, ChevronDown, Coffee, Cookie, Delete,
  Heart, Home, Pencil, Plane, ShoppingBag, ShoppingBasket,
  Sparkles, Trash2, Utensils, Wallet, X,
} from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { hapticLight } from "../../lib/native.js";

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
          ? "#D4870A"
          : "rgba(50, 30, 8, 0.75)",
        color: amber ? "#fff" : "#f0e0c0",
        border: amber ? "none" : "1px solid rgba(100, 65, 20, 0.3)",
        boxShadow: amber ? "0 6px 20px -6px rgba(180, 100, 5, 0.5)" : "none",
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
      style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" style={{ color: "#f0e0c0" }}>{transaction.description}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
            {transaction.date}
          </p>
        </div>
        <p className="text-base font-semibold" style={{ color: "#D4870A" }}>
          {currency(transaction.displayAmount ?? transaction.amount)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "rgba(212, 135, 10, 0.7)" }}>
        <span className="rounded-full px-2.5 py-1" style={{ background: "rgba(60, 36, 8, 0.8)" }}>
          {transaction.category}
        </span>
        <span className="rounded-full px-2.5 py-1" style={{ background: "rgba(60, 36, 8, 0.8)" }}>
          {transaction.currencyCode}
        </span>
        <span className="rounded-full px-2.5 py-1" style={{ background: "rgba(60, 36, 8, 0.8)" }}>
          {transaction.paymentMethod === "cash" ? "Cash" : "Card"}
        </span>
      </div>
      {transaction.userId === currentUserId ? (
        <div className="mt-3 flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{ background: "rgba(60, 36, 8, 0.8)", color: "#D4870A" }}
            onClick={() => onEdit(transaction)}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("expenses.edit")}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{ background: "rgba(60, 14, 18, 0.8)", color: "#f87171" }}
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
  expenseBusy,
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

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

  /* ── Recent tab ─────────────────────────────────────────────────────── */
  if (activeTab === "recent") {
    return (
      <section className="hb-surface-card rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-5 w-5" style={{ color: "#D4870A" }} />
          <div>
            <h2 className="text-xl font-semibold">{t("expenses.latest")}</h2>
            <p className="text-sm" style={{ color: "rgba(156, 120, 85, 0.8)" }}>{t("expenses.latestSubtitle")}</p>
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
            <div className="rounded-[1.35rem] px-4 py-8 text-center text-sm" style={{ background: "rgba(42, 26, 8, 0.7)", color: "rgba(156, 120, 85, 0.8)" }}>
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
          <Wallet className="h-5 w-5" style={{ color: "#D4870A" }} />
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
            <div className="rounded-[1.35rem] px-4 py-8 text-center text-sm" style={{ background: "rgba(42, 26, 8, 0.7)", color: "rgba(156, 120, 85, 0.8)" }}>
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

      {/* Editing banner */}
      {editingTransactionId ? (
        <div
          className="flex items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-sm"
          style={{ background: "rgba(50, 30, 8, 0.85)", border: "1px solid rgba(212, 135, 10, 0.35)", color: "#fde68a" }}
        >
          <p>{t("expenses.editingHelp")}</p>
          <button className="inline-flex items-center gap-1 font-semibold" onClick={onCancelEdit} type="button">
            <X className="h-4 w-4" />
            {t("expenses.cancelEdit")}
          </button>
        </div>
      ) : null}

      {/* Card / Cash toggle */}
      <div
        className="flex gap-1 p-1 rounded-full"
        style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}
      >
        {[{ label: "Card", value: "card" }, { label: "Cash", value: "cash" }].map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className="flex-1 py-2.5 rounded-full text-sm font-semibold transition"
            style={{
              background: (expenseForm.paymentMethod || "card") === value ? "#D4870A" : "transparent",
              color: (expenseForm.paymentMethod || "card") === value ? "#fff" : "rgba(212, 135, 10, 0.5)",
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
            style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}
          >
            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#D4870A" }} />
            <span className="flex-1 text-sm font-medium" style={{ color: "#f0e0c0" }}>
              {formatDateDisplay(expenseForm.date)}
            </span>
            <ChevronDown className="h-4 w-4" style={{ color: "rgba(212, 135, 10, 0.5)" }} />
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
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
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
                      background: isSelected ? "rgba(212, 135, 10, 0.2)" : "rgba(42, 26, 8, 0.85)",
                      border: isSelected ? "1px solid #D4870A" : "1px solid rgba(100, 65, 20, 0.3)",
                    }}
                    onClick={() => {
                      hapticLight();
                      onExpenseChange({ target: { name: "category", value: cat.value } });
                    }}
                  >
                    <cat.icon
                      className="h-5 w-5"
                      style={{ color: isSelected ? "#D4870A" : "rgba(212, 135, 10, 0.55)", strokeWidth: 1.75 }}
                    />
                    <span
                      className="text-[9px] font-medium leading-none text-center"
                      style={{ color: isSelected ? "#D4870A" : "rgba(212, 135, 10, 0.6)" }}
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
            style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}
          >
            <div className="flex items-baseline gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1 text-lg font-medium transition active:opacity-60"
                style={{ color: "rgba(212, 135, 10, 0.8)", background: "none", border: "none", padding: 0 }}
                onClick={() => { hapticLight(); setShowCurrencyPicker((v) => !v); }}
              >
                {activeCurrency}
                <ChevronDown className="h-3.5 w-3.5" style={{ color: "rgba(212, 135, 10, 0.5)", marginBottom: "-2px" }} />
              </button>
              {/* Currency dropdown */}
              {showCurrencyPicker && (
                <div
                  className="absolute left-0 top-full mt-2 z-30 rounded-2xl overflow-y-auto"
                  style={{ background: "rgba(28, 16, 4, 0.97)", border: "1px solid rgba(212, 135, 10, 0.35)", minWidth: "160px", maxHeight: "220px", boxShadow: "0 8px 32px -8px rgba(0,0,0,0.6)" }}
                >
                  {currencyOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-white/5"
                      style={{
                        color: activeCurrency === opt.value ? "#D4870A" : "#f0e0c0",
                        fontWeight: activeCurrency === opt.value ? 600 : 400,
                      }}
                      onClick={() => {
                        hapticLight();
                        onExpenseChange({ target: { name: "currencyCode", value: opt.value } });
                        setShowCurrencyPicker(false);
                      }}
                    >
                      <span>{opt.value}</span>
                      {activeCurrency === opt.value && <span style={{ color: "#D4870A" }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <span
                className="text-4xl font-bold tracking-tight"
                style={{ color: numStr ? "#f0e0c0" : "rgba(240, 210, 160, 0.3)" }}
              >
                {numStr ? displayAmount() : "0.00"}
              </span>
            </div>
            {showMmkHelper && mmkRateText ? (
              <span className="text-[10px]" style={{ color: "rgba(156, 120, 85, 0.6)" }}>{mmkRateText}</span>
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
              className="rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-40"
              style={{
                gridRow: "2 / span 3",
                gridColumn: "4",
                background: "#D4870A",
                boxShadow: "0 8px 24px -6px rgba(180, 100, 5, 0.55)",
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

          {/* Advanced options (collapsed) */}
          <button
            type="button"
            className="text-xs font-medium text-center py-1 transition"
            style={{ color: "rgba(156, 120, 85, 0.6)" }}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "▲ Hide options" : "▼ More options"}
          </button>

          {showAdvanced && (
            <div
              className="rounded-[1.35rem] p-4 space-y-4"
              style={{ background: "rgba(42, 26, 8, 0.85)", border: "1px solid rgba(100, 65, 20, 0.3)" }}
            >
              {/* Note */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
                  Note
                </span>
                <input
                  name="description"
                  value={expenseForm.description}
                  onChange={onExpenseChange}
                  placeholder="e.g. Date night tacos"
                  className="w-full rounded-[0.9rem] px-3 py-2.5 text-sm outline-none"
                  style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)", color: "#f0e0c0" }}
                />
              </label>

              {/* Full category select */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
                  Category (full list)
                </span>
                <select
                  name="category"
                  value={expenseForm.category}
                  onChange={onExpenseChange}
                  className="w-full rounded-[0.9rem] px-3 py-2.5 text-sm outline-none"
                  style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)", color: "#f0e0c0" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              {/* Currency */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
                  Currency
                </span>
                <select
                  name="currencyCode"
                  value={expenseForm.currencyCode}
                  onChange={onExpenseChange}
                  className="w-full rounded-[0.9rem] px-3 py-2.5 text-sm outline-none"
                  style={{ background: "rgba(30, 16, 4, 0.9)", border: "1px solid rgba(100, 65, 20, 0.35)", color: "#f0e0c0" }}
                >
                  {currencyOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              {/* Type + Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Type</p>
                  <div className="flex gap-1">
                    {[{ label: t("expenses.oneTime"), value: "one-time" }, { label: t("expenses.recurring"), value: "recurring" }].map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="flex-1 rounded-xl py-2 text-xs font-medium transition"
                        style={{
                          background: expenseForm.type === o.value ? "#D4870A" : "rgba(30, 16, 4, 0.9)",
                          color: expenseForm.type === o.value ? "#fff" : "rgba(212, 135, 10, 0.6)",
                          border: "1px solid rgba(100, 65, 20, 0.35)",
                        }}
                        onClick={() => onExpenseChange({ target: { name: "type", value: o.value } })}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>Method</p>
                  <div className="flex gap-1">
                    {[{ label: "Card", value: "card" }, { label: "Cash", value: "cash" }].map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="flex-1 rounded-xl py-2 text-xs font-medium transition"
                        style={{
                          background: expenseForm.paymentMethod === o.value ? "#D4870A" : "rgba(30, 16, 4, 0.9)",
                          color: expenseForm.paymentMethod === o.value ? "#fff" : "rgba(212, 135, 10, 0.6)",
                          border: "1px solid rgba(100, 65, 20, 0.35)",
                        }}
                        onClick={() => onExpenseChange({ target: { name: "paymentMethod", value: o.value } })}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
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
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(156, 120, 85, 0.7)" }}>
                      Log under
                    </p>
                    <div className="flex gap-2">
                      {options.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          className="flex-1 rounded-xl py-2 text-xs font-medium transition"
                          style={{
                            background: activeId === id ? "#D4870A" : "rgba(30, 16, 4, 0.9)",
                            color: activeId === id ? "#fff" : "rgba(212, 135, 10, 0.6)",
                            border: "1px solid rgba(100, 65, 20, 0.35)",
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
            </div>
          )}
    </form>
  );
}

export default ExpensesPage;
