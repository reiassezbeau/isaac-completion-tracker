// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import type { ReactNode } from "react";
import {
  BarChart3,
  Info,
  LayoutDashboard,
  ListChecks,
  Map,
  RefreshCw,
  Settings,
  Stethoscope,
  Target,
  User,
  Wand2,
} from "lucide-react";
import { useStore, type ViewId } from "../store";
import { GitHubLink } from "./ui";
import { editionLabel } from "../lib/format";

const NAV: { id: ViewId; label: string; icon: typeof User }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "character", label: "Personnage", icon: User },
  { id: "predictor", label: "Prédicteur", icon: Wand2 },
  { id: "achievements", label: "Succès", icon: ListChecks },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "optimizer", label: "Optimiseur", icon: Target },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "diagnostic", label: "Diagnostic", icon: Stethoscope },
  { id: "settings", label: "Corrections", icon: Settings },
  { id: "about", label: "À propos", icon: Info },
];

function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  return (
    <nav className="flex w-52 flex-shrink-0 flex-col border-r border-isaac-border bg-isaac-surface/50">
      <div className="px-4 py-5">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-isaac-gold">
          Isaac
        </div>
        <div className="text-lg font-bold leading-tight">
          Completion <span className="text-isaac-blood">Tracker</span>
        </div>
      </div>
      <div className="flex-1 space-y-1 px-2">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              view === id
                ? "bg-isaac-blood/15 text-isaac-text"
                : "text-isaac-muted hover:bg-isaac-surface2 hover:text-isaac-text"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Header() {
  const { slots, currentSlot, dashboard, selectSlot, refresh } = useStore();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-isaac-border bg-isaac-surface/40 px-6 py-3">
      <div className="flex items-center gap-3">
        {slots && slots.length > 0 && (
          <select
            value={currentSlot?.path ?? ""}
            onChange={(e) => {
              const s = slots.find((x) => x.path === e.target.value);
              if (s) selectSlot(s);
            }}
            className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-text outline-none focus:border-isaac-blood/60"
          >
            {slots.map((s) => (
              <option key={s.path} value={s.path}>
                {s.label} · {s.source}
                {s.unlocked != null ? ` · ${s.unlocked}/641` : ""}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => refresh(false)}
          disabled={!currentSlot}
          className="inline-flex items-center gap-1.5 rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-muted transition-colors hover:text-isaac-text disabled:opacity-40"
          title="Rafraîchir"
        >
          <RefreshCw className="h-4 w-4" />
          Rafraîchir
        </button>
      </div>

      {dashboard && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-isaac-muted">{editionLabel(dashboard.edition)}</span>
          <span className="font-semibold">
            <span className="text-isaac-gold">{dashboard.total_unlocked}</span>
            <span className="text-isaac-muted"> / {dashboard.total}</span>
          </span>
          <span className="rounded-md bg-isaac-surface2 px-2 py-0.5 text-xs text-isaac-muted">
            {dashboard.percent.toFixed(1)}%
          </span>
        </div>
      )}
    </header>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-lg border border-isaac-done/40 bg-isaac-surface px-4 py-2 text-sm text-isaac-text shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
      <footer className="flex items-center justify-between border-t border-isaac-border bg-isaac-surface/60 px-6 py-2 text-xs text-isaac-muted">
        <span>Isaac Completion Tracker · outil communautaire, non affilié à Nicalis / Edmund McMillen</span>
        <GitHubLink />
      </footer>
      <Toasts />
    </div>
  );
}
