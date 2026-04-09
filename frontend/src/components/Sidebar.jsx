/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { EyeOff, X } from "lucide-react";
import { hapticLight } from "../lib/native.js";

function Sidebar({ open, onClose, items, onNavigate, onHideItem, route, hiddenCount, onMoreClick }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`hb-surface-strong fixed inset-y-0 left-0 z-40 flex w-72 flex-col rounded-r-[1.75rem] shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="hb-brand-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
            <img alt="Honey Budget" className="h-4 w-4" src="/icons/brand-mark.svg" />
            Honey Budget
          </div>
          <button
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100/60"
            onClick={onClose}
            type="button"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              All items are in More.
            </p>
          ) : (
            <div className="space-y-1">
              {items.map(({ key, label, icon: Icon }) => (
                <div key={key} className="group flex items-center gap-1">
                  <button
                    className={`flex flex-1 items-center gap-3 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                      route === key ? "hb-nav-active" : "hb-nav-idle"
                    }`}
                    onClick={() => {
                      hapticLight();
                      onNavigate(key);
                      onClose();
                    }}
                    type="button"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                  {key !== "home" && (
                    <button
                      className="shrink-0 rounded-xl p-2 text-slate-300 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                      onClick={() => onHideItem(key)}
                      title="Hide — move to More"
                      type="button"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="space-y-2 p-3">
          {hiddenCount > 0 && (
            <button
              className="hb-nav-idle w-full rounded-[1rem] px-4 py-3 text-left text-sm font-medium transition"
              onClick={() => {
                hapticLight();
                onMoreClick();
                onClose();
              }}
              type="button"
            >
              More — {hiddenCount} hidden item{hiddenCount !== 1 ? "s" : ""}
            </button>
          )}
          <p className="px-2 text-[11px] leading-5 text-slate-400">
            Hover an item then tap <EyeOff className="inline h-3 w-3" /> to hide it — it moves to More.
          </p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
