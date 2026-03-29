import { CalendarDays, ReceiptText, Wallet } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, formatShortDate } from "../../lib/format.js";
import { Input } from "../ui.jsx";

function buildMonthGrid(selectedMonth, transactions, users) {
  const [yearText, monthText] = selectedMonth.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const spendingDays = new Set(
    transactions.map((transaction) => Number(transaction.date.slice(8, 10))),
  );
  const incomeDays = new Set(users.map((user) => Number(user.incomeDayOfMonth ?? 1)));
  const cells = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      hasIncome: incomeDays.has(day),
      hasSpend: spendingDays.has(day),
    });
  }

  return {
    label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay),
    cells,
  };
}

function CalendarPage({
  selectedMonth,
  onMonthChange,
  monthSummary,
  monthTransactions,
  householdUsers,
}) {
  const { t } = useLanguage();
  const grid = buildMonthGrid(selectedMonth, monthTransactions, householdUsers);
  const featuredEvents = [
    ...householdUsers.map((user) => ({
      key: `income-${user.id}`,
      kind: "income",
      label: `${user.name} ${t("calendar.income").toLowerCase()}`,
      amount: Number(user.monthlySalary ?? 0),
      originalAmount: Number(user.originalMonthlySalary ?? user.monthlySalary ?? 0),
      currencyCode: user.incomeCurrencyCode ?? null,
      date: `${selectedMonth}-${String(user.incomeDayOfMonth ?? 1).padStart(2, "0")}`,
    })),
    ...monthTransactions.slice(0, 8).map((transaction) => ({
      key: `expense-${transaction.id}`,
      kind: "expense",
      label: transaction.description,
      amount: Number(transaction.displayAmount ?? transaction.amount ?? 0),
      originalAmount: Number(transaction.amount ?? 0),
      currencyCode: transaction.currencyCode ?? null,
      date: transaction.date,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr] xl:gap-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/82 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-sky-700" />
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{t("calendar.title")}</h2>
            <p className="text-sm text-slate-600">{t("calendar.subtitle")}</p>
          </div>
        </div>

        <div className="mt-4">
          <Input
            label={t("calendar.month")}
            type="month"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
          />
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-slate-100 bg-slate-50/90 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{grid.label}</p>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t("calendar.incomeDays")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {t("calendar.spendingDays")}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center">
            {grid.cells.map((cell, index) =>
              cell ? (
                <div
                  key={`${cell.day}-${index}`}
                  className="rounded-xl bg-white px-1 py-2 text-sm text-slate-700"
                >
                  <div>{cell.day}</div>
                  <div className="mt-1 flex justify-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        cell.hasIncome ? "bg-emerald-500" : "bg-transparent"
                      }`}
                    />
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        cell.hasSpend ? "bg-sky-500" : "bg-transparent"
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <div key={`empty-${index}`} />
              ),
            )}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("calendar.spentThisMonth")}
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
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">Events</h3>
          <div className="mt-4 space-y-3">
            {featuredEvents.length ? (
              featuredEvents.map((event) => (
                <div
                  key={event.key}
                  className="flex items-center justify-between rounded-[1.2rem] border border-slate-100 bg-slate-50/90 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex rounded-full bg-white p-2 text-slate-700">
                      {event.kind === "income" ? (
                        <Wallet className="h-4 w-4 text-emerald-700" />
                      ) : (
                        <ReceiptText className="h-4 w-4 text-sky-700" />
                      )}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{event.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatShortDate(event.date)}</p>
                    </div>
                  </div>
                  <p className={`text-base font-semibold ${event.kind === "income" ? "text-emerald-700" : "text-slate-900"}`}>
                    {event.kind === "income" ? "+" : "-"}
                    {currency(event.amount)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-slate-100 bg-slate-50/90 px-4 py-6 text-sm text-slate-500">
                {t("calendar.noEvents")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CalendarPage;
