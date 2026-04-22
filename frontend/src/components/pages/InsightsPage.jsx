import { useEffect, useState } from "react";
import { Brain, TrendingUp, Wallet, Users, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { currency } from "../../lib/format.js";

// ─── colour palette ──────────────────────────────────────────────────────────
const CASH_COLOR   = "#0ea5e9"; // sky-500
const CARD_COLOR   = "#6366f1"; // indigo-500
const REC_COLOR    = "#10b981"; // emerald-500
const ONCE_COLOR   = "#f59e0b"; // amber-500
const CAT_COLORS   = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ec4899","#8b5cf6","#f97316"];

// ─── Loading state ────────────────────────────────────────────────────────────
const CALC_STEPS = [
  "Pulling your transaction history",
  "Analysing cash vs card habits",
  "Reviewing your top spending categories",
  "Comparing this month to last month",
  "Calculating your fair bill split",
  "Identifying savings opportunities",
  "Building your personalised coaching tips",
];

function InsightsLoader() {
  const [stepIndex, setStepIndex] = useState(0);
  const [dots, setDots]           = useState(1);

  useEffect(() => {
    const s = setInterval(() => setStepIndex((i) => (i + 1) % CALC_STEPS.length), 1800);
    const d = setInterval(() => setDots((x) => (x % 3) + 1), 500);
    return () => { clearInterval(s); clearInterval(d); };
  }, []);

  const progress = Math.round(((stepIndex + 1) / CALC_STEPS.length) * 100);

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-ping rounded-full bg-sky-200/40" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-blue-200 shadow-lg">
          <Brain className="h-8 w-8 text-[#17385d]" />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-700">
        {CALC_STEPS[stepIndex]}{".".repeat(dots)}
      </p>
      <div className="w-full max-w-xs">
        <div className="hb-progress-track h-2 overflow-hidden rounded-full shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">Your AI coach is reviewing your finances</p>
      </div>
      <div className="w-full space-y-3 pt-2">
        {[1, 2].map((i) => (
          <div key={i} className="hb-panel-soft animate-pulse rounded-3xl px-4 py-5">
            <div className="h-3.5 w-2/5 rounded-full bg-slate-200" />
            <div className="mt-3 h-3 w-full rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut chart with centre label ───────────────────────────────────────────
function DonutChart({ data, label, sublabel }) {
  return (
    <div className="relative flex flex-col items-center">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={68}
            paddingAngle={3}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} strokeWidth={0} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* centre text */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-slate-900">{label}</span>
        {sublabel && <span className="text-[10px] text-slate-500">{sublabel}</span>}
      </div>
    </div>
  );
}

// ─── Category bar chart ───────────────────────────────────────────────────────
function CategoryBar({ name, amount, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 truncate text-xs font-medium text-slate-700">{name}</div>
      <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="w-16 shrink-0 text-right text-xs font-semibold text-slate-900">
        {currency(amount)}
      </div>
    </div>
  );
}

// ─── Collapsible tip card ─────────────────────────────────────────────────────
function TipCard({ emoji, title, action, reason }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left hb-panel-soft rounded-2xl px-4 py-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-snug">
          {emoji} {title}
        </p>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
        )}
      </div>
      {open && (
        <div className="mt-2.5 space-y-1.5 border-t border-slate-200/60 pt-2.5">
          <p className="text-sm leading-6 text-slate-700">{action}</p>
          {reason && <p className="text-xs leading-5 text-slate-500">{reason}</p>}
        </div>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const TIP_EMOJIS = ["🎯", "📅", "🚀"];

export default function InsightsPage({ insightsBusy, insights, dashboard }) {
  const { t } = useLanguage();
  const summary  = dashboard?.summary;
  const cats     = dashboard?.topCategories ?? [];
  const users    = dashboard?.users ?? [];
  const isCouple = users.length >= 2;

  // Donut: cash vs card
  const payMethodData = [
    { name: "Cash",  value: summary?.cashSpent  ?? 0, color: CASH_COLOR },
    { name: "Card",  value: summary?.cardSpent  ?? 0, color: CARD_COLOR },
  ].filter((d) => d.value > 0);

  // Donut: recurring vs one-time
  const typeData = [
    { name: "Bills", value: summary?.recurringSpent ?? 0, color: REC_COLOR },
    { name: "Flex",  value: summary?.oneTimeSpent   ?? 0, color: ONCE_COLOR },
  ].filter((d) => d.value > 0);

  const totalSpent = summary?.totalSpent ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Overview banner ─────────────────────────────────────────────── */}
      <section className="hb-panel-multi rounded-[2rem] border border-sky-200/70 p-5 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)]">
        <div className="flex items-center gap-2.5 mb-3">
          <Brain className="h-5 w-5 text-[#17385d] shrink-0" />
          <h2 className="text-lg font-semibold text-slate-900">{t("insights.title")}</h2>
        </div>

        {insightsBusy || !insights ? (
          <InsightsLoader />
        ) : (
          <>
            {/* Win banner */}
            {insights.win && (
              <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                  🏆 {insights.win.title}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-emerald-900">{insights.win.body}</p>
              </div>
            )}

            {/* Overview */}
            <p className="hb-surface-strong rounded-2xl px-4 py-3 text-sm leading-6 text-slate-700">
              {insights.overview}
            </p>
          </>
        )}
      </section>

      {/* ── Spending donuts ──────────────────────────────────────────────── */}
      {(payMethodData.length > 0 || typeData.length > 0) && (
        <section className="hb-surface-card rounded-[2rem] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-4 w-4 text-[#245188]" />
            <h2 className="text-base font-semibold">{t("insights.mix")}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cash vs Card donut */}
            {payMethodData.length > 0 && (
              <div>
                <DonutChart
                  data={payMethodData}
                  label={`${summary?.cashSharePct ?? 0}%`}
                  sublabel="cash"
                />
                <div className="mt-2 flex justify-center gap-3">
                  {payMethodData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-[10px] text-slate-600">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recurring vs One-time donut */}
            {typeData.length > 0 && (
              <div>
                <DonutChart
                  data={typeData}
                  label={currency(summary?.recurringSpent ?? 0)}
                  sublabel="bills"
                />
                <div className="mt-2 flex justify-center gap-3">
                  {typeData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-[10px] text-slate-600">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-2.5 text-center">
            <p className="text-xs text-slate-500">Total spent · last 30 days</p>
            <p className="text-xl font-bold text-slate-900">{currency(totalSpent)}</p>
          </div>
        </section>
      )}

      {/* ── Top categories ───────────────────────────────────────────────── */}
      {cats.length > 0 && (
        <section className="hb-surface-card rounded-[2rem] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#16995a]" />
            <h2 className="text-base font-semibold">{t("insights.topCategories")}</h2>
          </div>
          <div className="space-y-3">
            {cats.slice(0, 7).map((cat, i) => (
              <CategoryBar
                key={cat.category}
                name={cat.category}
                amount={cat.amount}
                pct={cat.sharePct}
                color={CAT_COLORS[i % CAT_COLORS.length]}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Couple spend split ───────────────────────────────────────────── */}
      {isCouple && (
        <section className="hb-surface-card rounded-[2rem] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[#245188]" />
            <h2 className="text-base font-semibold">Spending by person</h2>
          </div>
          <div className="space-y-3">
            {users.map((u, i) => {
              const spent  = u.spending?.totalSpent ?? 0;
              const pct    = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
              const colors = ["#6366f1", "#ec4899"];
              return (
                <div key={u.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{u.name}</span>
                    <span className="text-slate-500">{currency(spent)} · {pct}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── AI Tips ──────────────────────────────────────────────────────── */}
      {insights?.tips?.length > 0 && !insightsBusy && (
        <section className="hb-panel-multi rounded-[2rem] border border-sky-200/70 p-5 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)]">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-[#17385d]" />
            <h2 className="text-base font-semibold">Coaching tips</h2>
          </div>
          <div className="space-y-2">
            {insights.tips.map((tip, i) => (
              <TipCard
                key={tip.title}
                emoji={TIP_EMOJIS[i] ?? "💡"}
                title={tip.title}
                action={tip.action}
                reason={tip.reason}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
