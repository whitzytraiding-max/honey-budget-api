import { LoaderCircle } from "lucide-react";
import { currency } from "../lib/format.js";

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-[1.2rem] border border-sky-100 bg-white/92 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100 sm:rounded-2xl"
        {...props}
      />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-[1.2rem] border border-sky-100 bg-white/92 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100 sm:rounded-2xl"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-[120px] w-full rounded-[1.2rem] border border-sky-100 bg-white/92 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100 sm:rounded-2xl"
        {...props}
      />
    </label>
  );
}

function ActionButton({ busy, children, className = "", ...props }) {
  return (
    <button
      className={`hb-button-primary inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] px-5 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-70 sm:rounded-2xl ${className}`}
      disabled={busy}
      {...props}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function ToggleGroup({ label, name, value, onChange, options }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
      <div className="hb-panel-soft grid grid-cols-2 rounded-[1.2rem] p-1 sm:rounded-2xl">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-[0.9rem] px-3 py-3 text-center text-sm font-medium transition sm:rounded-[1rem] ${
              value === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <input
              className="sr-only"
              name={name}
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={onChange}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ label, percentage, salary, cashAmount, cardAmount, tone }) {
  const barTone =
    tone === "mint"
      ? "from-green-400 via-amber-300 to-sky-300"
      : "from-sky-400 via-blue-300 to-amber-200";

  return (
    <div className="hb-panel-soft rounded-[1.35rem] border border-sky-100/80 p-4 sm:rounded-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500 sm:text-sm">
            {currency(salary)} · Cash {currency(cashAmount)} · Card {currency(cardAmount)}
          </p>
        </div>
        <span className="rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
          {percentage}%
        </span>
      </div>
      <div className="hb-progress-track mt-3 h-3 overflow-hidden rounded-full shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barTone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-2/3 animate-pulse rounded-full bg-white/70" />
      <div className="h-4 w-full animate-pulse rounded-full bg-white/70" />
      <div className="h-4 w-5/6 animate-pulse rounded-full bg-white/70" />
      <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/70" />
    </div>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div className="hb-empty-state rounded-[2rem] border border-dashed border-sky-200 p-8 text-center">
      <h3 className="text-2xl font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">{body}</p>
      {action}
    </div>
  );
}

export {
  ActionButton,
  EmptyState,
  InsightSkeleton,
  Input,
  ProgressBar,
  Select,
  Textarea,
  ToggleGroup,
};
