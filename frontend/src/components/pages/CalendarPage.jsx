import { useState } from "react";
import { CalendarDays, ReceiptText, Wallet, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency, formatShortDate } from "../../lib/format.js";
import { Input } from "../ui.jsx";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthGrid(selectedMonth, transactions, users) {
  const [yearText, monthText] = selectedMonth.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const spendingDays = new Set(
    transactions.map((t) => Number(t.date.slice(8, 10))),
  );
  const incomeDays = new Set(users.map((u) => Number(u.incomeDayOfMonth ?? 1)));
  const cells = [];

  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, hasIncome: incomeDays.has(day), hasSpend: spendingDays.has(day) });
  }

  return {
    label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay),
    cells,
  };
}

function DayModal({ day, selectedMonth, transactions, users, onClose }) {
  const [yearText, monthText] = selectedMonth.split("-");
  const dayTransactions = transactions.filter(
    (t) => Number(t.date.slice(8, 10)) === day,
  );
  const incomeUsers = users.filter(
    (u) => Number(u.incomeDayOfMonth ?? 1) === day,
  );
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(new Date(Number(yearText), Number(monthText) - 1, day));
  const totalSpent = dayTransactions.reduce(
    (sum, t) => sum + Number(t.displayAmount ?? t.amount ?? 0),
    0,
  );
  const hasActivity = incomeUsers.length > 0 || dayTransactions.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[80vh] overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-8 pt-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-semibold text-slate-900">{dayLabel}</p>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Income rows */}
        {incomeUsers.map((u) => (
          <div
            key={u.id}
            className="mb-2 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white p-2 shadow-sm">
                <Wallet className="h-4 w-4 text-emerald-600" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {u.name}&rsquo;s income
                </p>
                <p className="text-xs text-slate-500">Monthly salary</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-emerald-600">
              +{currency(u.monthlySalary ?? 0)}
            </p>
          </div>
        ))}

        {/* Transaction rows */}
        {dayTransactions.map((t) => (
          <div
            key={t.id}
            className="mb-2 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white p-2 shadow-sm">
                <ReceiptText className="h-4 w-4 text-sky-600" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t.description}
                </p>
                <p className="text-xs text-slate-500">
                  {t.category} · {t.paymentMethod}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              -{currency(t.displayAmount ?? t.amount ?? 0)}
            </p>
          </div>
        ))}

        {/* Empty state */}
        {!hasActivity && (
          <p className="py-8 text-center text-sm text-slate-400">
            No activity on this day.
          </p>
        )}

        {/* Day total */}
        {dayTransactions.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total spent
            </p>
            <p className="text-base font-bold text-slate-900">
              {currency(totalSpent)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarPage({
  selectedMonth,
  onMonthChange,
  monthSummary,
  monthTransactions,
  householdUsers,
}) {
  const { t } = useLanguage();
  const [selectedDay, setSelectedDay] = useState(null);
  const grid = buildMonthGrid(selectedMonth, monthTransactions, householdUsers);

  // Determine today's day number if we're viewing the current month
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const todayDay = selectedMonth === currentMonthStr ? today.getDate() : null;

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
      <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
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

        <div className="hb-panel-soft mt-4 rounded-[1.25rem] border border-sky-100 p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-900">{grid.label}</p>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
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

          {/* Day name headers */}
          <div className="mb-1 grid grid-cols-7 gap-1.5 text-center sm:gap-2">
            {DAY_NAMES.map((name) => (
              <div key={name} className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {name}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
            {grid.cells.map((cell, index) =>
              cell ? (
                <button
                  key={`${cell.day}-${index}`}
                  type="button"
                  onClick={() => setSelectedDay(cell.day)}
                  className={`rounded-[0.85rem] px-1 py-2 text-xs shadow-sm transition-transform active:scale-95 sm:rounded-xl sm:text-sm ${
                    todayDay === cell.day
                      ? "bg-sky-500 text-white font-semibold"
                      : "bg-white/96 text-slate-700 hover:bg-sky-50"
                  }`}
                >
                  <div>{cell.day}</div>
                  <div className="mt-1 flex justify-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        cell.hasIncome
                          ? todayDay === cell.day ? "bg-white" : "bg-emerald-500"
                          : "bg-transparent"
                      }`}
                    />
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        cell.hasSpend
                          ? todayDay === cell.day ? "bg-sky-200" : "bg-sky-500"
                          : "bg-transparent"
                      }`}
                    />
                  </div>
                </button>
              ) : (
                <div key={`empty-${index}`} />
              ),
            )}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="hb-panel-soft rounded-[1.2rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("calendar.spentThisMonth")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.totalExpenses ?? 0)}
              </p>
            </div>
            <div className="hb-panel-soft rounded-[1.2rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.cashSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.cashSpent ?? 0)}
              </p>
            </div>
            <div className="hb-panel-soft rounded-[1.2rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("history.cardSpent")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {currency(monthSummary?.cardSpent ?? 0)}
              </p>
            </div>
          </div>
        </section>

        <section className="hb-surface-card rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">Events</h3>
          <div className="mt-4 space-y-3">
            {featuredEvents.length ? (
              featuredEvents.map((event) => (
                <div
                  key={event.key}
                  className="hb-panel-soft flex flex-col gap-3 rounded-[1.2rem] border border-sky-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex rounded-full bg-white/95 p-2 text-slate-700 shadow-sm">
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
              <div className="hb-panel-soft rounded-[1.2rem] border border-sky-100 px-4 py-6 text-sm text-slate-500">
                {t("calendar.noEvents")}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Day detail modal */}
      {selectedDay !== null && (
        <DayModal
          day={selectedDay}
          selectedMonth={selectedMonth}
          transactions={monthTransactions}
          users={householdUsers}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

export default CalendarPage;
