import { ClipboardList } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";
import { Input } from "../ui.jsx";

function HistoryPage({ transactions, selectedMonth, onMonthChange, monthSummary }) {
  const { t } = useLanguage();

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-8">
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
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.totalSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.totalExpenses ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.cashSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.cashSpent ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.cardSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.cardSpent ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 overflow-hidden rounded-3xl border border-slate-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.description")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.person")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.category")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.type")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.method")}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t("history.amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
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
                        {currency(transaction.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-slate-500" colSpan="6">
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
