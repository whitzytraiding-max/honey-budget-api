import { Pencil, Trash2, Wallet, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, getCurrencyOptions } from "../../lib/format.js";
import { ActionButton, Input, Select, ToggleGroup } from "../ui.jsx";

const CATEGORIES = [
  "Dining",
  "Housing",
  "Utilities",
  "Streaming",
  "Insurance",
  "Groceries",
  "Transport",
  "Fuel",
  "Debt Payment",
  "Medical",
  "Personal Care",
  "Childcare",
  "Pets",
  "Phone & Internet",
  "Entertainment",
  "Education",
  "Shopping",
  "Gifts",
  "Taxes",
  "Emergency",
  "Travel",
  "Wellness",
];

function ExpensesPage({
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
  const mmkRateText = mmkRateData?.rate
    ? `1 USD = ${Number(mmkRateData.rate.rate).toFixed(2)} MMK · ${String(
        mmkRateData.rate.rateSource ?? "custom",
      ).toUpperCase()} · ${String(mmkRateData.month).padStart(2, "0")}/${mmkRateData.year}`
    : "";
  const showMmkRateHelper =
    expenseForm.currencyCode === "MMK" || currencyCode === "MMK" || baseCurrencyCode === "MMK";

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr] xl:gap-6">
      <section className="hb-surface-card rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-sky-700" />
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{t("expenses.title")}</h2>
            <p className="text-sm text-slate-600">{t("expenses.subtitle")}</p>
          </div>
        </div>

        <div className="hb-panel-soft mt-4 rounded-[1.2rem] px-4 py-4 text-sm leading-6 text-slate-600">
          <p>
            <span className="font-semibold text-slate-900">{t("expenses.entryCurrencyLabel")}:</span>{" "}
            {expenseForm.currencyCode || baseCurrencyCode} {t("expenses.entryCurrencyHelp")}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-900">{t("expenses.displayCurrencyLabel")}:</span>{" "}
            {currencyCode} {t("expenses.displayCurrencyHelp")}
          </p>
          <p className="hb-surface-strong mt-2 rounded-2xl px-3 py-3 text-slate-700">
            {t("expenses.dummyProofCurrency")}
          </p>
          {showMmkRateHelper ? (
            <p className="hb-surface-strong mt-2 rounded-2xl px-3 py-3 text-slate-700">
              {mmkRateText || t("expenses.mmkRateMissing")}
            </p>
          ) : null}
        </div>

        {editingTransactionId ? (
          <div className="hb-panel-highlight mt-4 flex items-center justify-between gap-3 rounded-[1.2rem] border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <p>{t("expenses.editingHelp")}</p>
            <button
              className="inline-flex items-center gap-1 font-semibold"
              onClick={onCancelEdit}
              type="button"
            >
              <X className="h-4 w-4" />
              {t("expenses.cancelEdit")}
            </button>
          </div>
        ) : null}

        <form className="mt-4 grid gap-3 sm:mt-6 sm:gap-4" onSubmit={onExpenseSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("expenses.amount")}
              name="amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={expenseForm.amount}
              onChange={onExpenseChange}
              placeholder="86.50"
            />
            <Input
              label={t("expenses.description")}
              name="description"
              value={expenseForm.description}
              onChange={onExpenseChange}
              placeholder={t("expenses.dateNightTacos")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("expenses.category")}
              name="category"
              value={expenseForm.category}
              onChange={onExpenseChange}
              options={CATEGORIES.map((entry) => ({ label: entry, value: entry }))}
            />
            <Select
              label={t("expenses.entryCurrencyLabel")}
              name="currencyCode"
              value={expenseForm.currencyCode}
              onChange={onExpenseChange}
              options={currencyOptions}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("expenses.date")}
              name="date"
              type="date"
              required
              value={expenseForm.date}
              onChange={onExpenseChange}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ToggleGroup
              label={t("expenses.type")}
              name="type"
              value={expenseForm.type}
              onChange={onExpenseChange}
              options={[
                { label: t("expenses.oneTime"), value: "one-time" },
                { label: t("expenses.recurring"), value: "recurring" },
              ]}
            />
            <ToggleGroup
              label={t("expenses.method")}
              name="paymentMethod"
              value={expenseForm.paymentMethod}
              onChange={onExpenseChange}
              options={[
                { label: "Card", value: "card" },
                { label: "Cash", value: "cash" },
              ]}
            />
          </div>

          {/* Log on behalf of partner — only shown for couples, hidden when editing */}
          {!editingTransactionId && householdUsers?.length >= 2 && (() => {
            const partner = householdUsers.find((u) => u.id !== currentUserId);
            const me = householdUsers.find((u) => u.id === currentUserId);
            if (!partner) return null;
            const activeId = expenseForm.logAsUserId
              ? String(expenseForm.logAsUserId)
              : String(currentUserId);
            return (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Log expense under
                </p>
                <div className="flex gap-2">
                  {[
                    { id: currentUserId, label: `${me?.name ?? "You"} (you)` },
                    { id: partner.id, label: partner.name },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        onExpenseChange({
                          target: { name: "logAsUserId", value: String(id) },
                        })
                      }
                      className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        activeId === String(id)
                          ? "border-sky-400 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <ActionButton busy={expenseBusy} className="sm:w-auto">
            {editingTransactionId ? t("expenses.saveChanges") : t("expenses.save")}
          </ActionButton>
        </form>
      </section>

      <section className="hb-surface-card rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-slate-700" />
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{t("expenses.latest")}</h2>
            <p className="text-sm text-slate-600">{t("expenses.latestSubtitle")}</p>
          </div>
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-[1.5rem] border border-sky-100 sm:mt-6 sm:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="hb-table-head">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.description")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.category")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.method")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.amount")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/92">
                {recentTransactions.length ? (
                  recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{transaction.description}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {transaction.date}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{transaction.category}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {transaction.paymentMethod === "cash" ? "Cash" : "Card"}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {currency(transaction.displayAmount ?? transaction.amount)}
                        {transaction.currencyCode && transaction.currencyCode !== transaction.displayCurrencyCode ? (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {currency(transaction.amount, {
                              sourceCurrency: transaction.currencyCode,
                              convert: false,
                            })} {transaction.currencyCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {transaction.userId === currentUserId ? (
                          <div className="inline-flex gap-2">
                            <button
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-amber-400/20 dark:text-amber-300"
                              onClick={() => onEditTransaction(transaction)}
                              type="button"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("expenses.edit")}
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                              onClick={() => onDeleteTransaction(transaction)}
                              type="button"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("expenses.delete")}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-slate-500" colSpan="5">
                      {t("expenses.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 space-y-3 sm:hidden">
          {recentTransactions.length ? (
            recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="hb-panel-soft rounded-[1.35rem] border border-sky-100 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{transaction.description}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {transaction.date}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    {currency(transaction.displayAmount ?? transaction.amount)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white/95 px-2.5 py-1">{transaction.category}</span>
                  <span className="rounded-full bg-white/95 px-2.5 py-1">{transaction.currencyCode}</span>
                  <span className="rounded-full bg-white/95 px-2.5 py-1">
                    {transaction.paymentMethod === "cash" ? "Cash" : "Card"}
                  </span>
                </div>
                {transaction.userId === currentUserId ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-amber-400/20 dark:text-amber-300"
                      onClick={() => onEditTransaction(transaction)}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t("expenses.edit")}
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                      onClick={() => onDeleteTransaction(transaction)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("expenses.delete")}
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="hb-panel-soft rounded-[1.35rem] border border-sky-100 px-4 py-6 text-sm text-slate-500">
              {t("expenses.empty")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ExpensesPage;
