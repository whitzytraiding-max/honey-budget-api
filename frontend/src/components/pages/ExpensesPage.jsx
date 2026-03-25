import { Wallet } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";
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
}) {
  const { t } = useLanguage();
  const recentTransactions = transactions.slice(0, 10);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr] xl:gap-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-sky-700" />
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{t("expenses.title")}</h2>
            <p className="text-sm text-slate-600">{t("expenses.subtitle")}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.2rem] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          <p>
            <span className="font-semibold text-slate-900">{t("expenses.entryCurrencyLabel")}:</span>{" "}
            {baseCurrencyCode} {t("expenses.entryCurrencyHelp")}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-900">{t("expenses.displayCurrencyLabel")}:</span>{" "}
            {currencyCode} {t("expenses.displayCurrencyHelp")}
          </p>
        </div>

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

          <ActionButton busy={expenseBusy} className="sm:w-auto">
            {t("expenses.save")}
          </ActionButton>
        </form>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-slate-700" />
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{t("expenses.latest")}</h2>
            <p className="text-sm text-slate-600">{t("expenses.latestSubtitle")}</p>
          </div>
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-[1.5rem] border border-slate-100 sm:mt-6 sm:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.description")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.category")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.method")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
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
                        {currency(transaction.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-slate-500" colSpan="4">
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
                className="rounded-[1.35rem] border border-slate-100 bg-slate-50/85 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{transaction.description}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {transaction.date}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    {currency(transaction.amount)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white px-2.5 py-1">{transaction.category}</span>
                  <span className="rounded-full bg-white px-2.5 py-1">
                    {transaction.paymentMethod === "cash" ? "Cash" : "Card"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.35rem] border border-slate-100 bg-slate-50/85 px-4 py-6 text-sm text-slate-500">
              {t("expenses.empty")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ExpensesPage;
