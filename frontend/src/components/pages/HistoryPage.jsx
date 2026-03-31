import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";
import { Input } from "../ui.jsx";

function HistoryPage({
  transactions,
  selectedMonth,
  onMonthChange,
  monthSummary,
  currentUserId,
  onEditTransaction,
  onDeleteTransaction,
  actionBusy,
}) {
  const { t } = useLanguage();

  return (
    <section className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-slate-700" />
        <div>
          <h2 className="text-2xl font-semibold">{t("history.title")}</h2>
          <p className="text-sm text-slate-600">{t("history.subtitle")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.32fr_0.68fr]">
        <div className="space-y-4">
          <Input
            label={t("history.month")}
            type="month"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
          />

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(239,247,255,0.88))] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.totalSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.totalExpenses ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(239,247,255,0.88))] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.cashSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.cashSpent ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(239,247,255,0.88))] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.cardSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.cardSpent ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 overflow-hidden rounded-3xl border border-sky-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,rgba(255,250,243,0.98),rgba(239,247,255,0.92))]">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.description")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.person")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.category")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.type")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.method")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.amount")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("expenses.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/92">
                {transactions.length ? (
                  transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{transaction.description}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {transaction.date}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{transaction.userName || t("history.you")}</td>
                      <td className="px-4 py-4 text-slate-600">{transaction.category}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {transaction.type === "one-time" ? "One-time" : "Recurring"}
                      </td>
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
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-70"
                              disabled={actionBusy}
                              onClick={() => onEditTransaction(transaction)}
                              type="button"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("expenses.edit")}
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-70"
                              disabled={actionBusy}
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
                    <td className="px-4 py-8 text-slate-500" colSpan="7">
                      {t("history.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HistoryPage;
