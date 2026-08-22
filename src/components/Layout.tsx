// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useStore, type ViewId } from "../store";
import { GitHubLink } from "./ui";
import { Defs } from "./Defs";
import { ThemeBackdrop } from "./ThemeBackdrop";
import { PageBackdrop } from "./PageBackdrop";
import { ThemePicker } from "./ThemePicker";
import { LanguagePicker } from "./LanguagePicker";
import { Emblem, NavGlyph } from "../lib/art";
import { editionLabel } from "../lib/format";
import { useT } from "../lib/useT";

const NAV: { id: ViewId; tkey: string; glyph: string }[] = [
  { id: "dashboard", tkey: "nav.dashboard", glyph: "dash" },
  { id: "character", tkey: "nav.character", glyph: "user" },
  { id: "grid", tkey: "nav.grid", glyph: "grid" },
  { id: "predictor", tkey: "nav.predictor", glyph: "wand" },
  { id: "achievements", tkey: "nav.achievements", glyph: "list" },
  { id: "roadmap", tkey: "nav.roadmap", glyph: "map" },
  { id: "optimizer", tkey: "nav.optimizer", glyph: "target" },
  { id: "build", tkey: "nav.build", glyph: "flask" },
  { id: "stats", tkey: "nav.stats", glyph: "chart" },
  { id: "card", tkey: "nav.card", glyph: "image" },
  { id: "diagnostic", tkey: "nav.diagnostic", glyph: "steth" },
  { id: "settings", tkey: "nav.settings", glyph: "gear" },
  { id: "about", tkey: "nav.about", glyph: "info" },
];

/** Soot-grain veil - chrome texture (never behind the data). */
function Grain({ opacity = 0.08 }: { opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ opacity }} aria-hidden="true">
      <svg width="100%" height="100%">
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}

function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const t = useT();
  return (
    <nav className="relative flex w-52 flex-shrink-0 flex-col border-r border-isaac-border bg-isaac-surface">
      <Grain opacity={0.09} />
      <div className="relative flex items-center gap-2.5 border-b border-isaac-border px-4 py-4">
        <span className="flex text-isaac-dried">
          <Emblem size={26} />
        </span>
        <div className="leading-none">
          <div className="font-display text-[1.05rem] text-isaac-text">Completion</div>
          <div className="font-display text-[1.05rem] tracking-wide text-isaac-dried">Tracker</div>
        </div>
      </div>
      <div className="relative flex-1 space-y-0.5 px-2 py-2">
        {NAV.map(({ id, tkey, glyph }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`relative flex w-full items-center gap-3 overflow-hidden rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "text-isaac-text" : "text-isaac-muted hover:text-isaac-text"
              }`}
            >
              {active && (
                <span
                  className="absolute inset-0"
                  aria-hidden="true"
                  style={{
                    background: "linear-gradient(90deg,rgb(var(--i-accent)/.42),rgb(var(--i-accent)/.1))",
                    boxShadow: "inset 2px 0 0 rgb(var(--i-accent))",
                    filter: "url(#etch)",
                  }}
                />
              )}
              <span className="relative flex flex-shrink-0">
                <NavGlyph kind={glyph} size={16} />
              </span>
              <span className="relative">{t(tkey)}</span>
            </button>
          );
        })}
      </div>
      <div className="relative border-t border-isaac-border px-4 py-3 font-mono text-[10px] tracking-wider text-isaac-faint">
        v0.1.0 · hors-ligne
      </div>
    </nav>
  );
}

function Header() {
  const { slots, currentSlot, dashboard, selectSlot, refresh } = useStore();
  const t = useT();
  return (
    <header className="relative flex items-center justify-between gap-4 border-b border-isaac-border bg-isaac-surface px-6 py-3">
      <Grain opacity={0.07} />
      <div className="relative flex items-center gap-3">
        {slots && slots.length > 0 && (
          <select
            value={currentSlot?.path ?? ""}
            onChange={(e) => {
              const s = slots.find((x) => x.path === e.target.value);
              if (s) selectSlot(s);
            }}
            className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-text outline-none focus:border-isaac-gold/60"
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
          title={t("common.refresh")}
        >
          <RefreshCw className="h-4 w-4" />
          {t("common.refresh")}
        </button>
      </div>

      <div className="relative flex items-center gap-4 text-sm">
        {dashboard && (
          <>
            <span className="hidden text-isaac-muted sm:inline">{editionLabel(dashboard.edition)}</span>
            <span className="font-display text-base">
              <span className="text-isaac-gold">{dashboard.total_unlocked}</span>
              <span className="text-isaac-muted"> / {dashboard.total}</span>
            </span>
            <span className="rounded-md border border-isaac-border bg-isaac-surface2 px-2 py-0.5 text-xs text-isaac-muted">
              {dashboard.percent.toFixed(1)}%
            </span>
          </>
        )}
        <span className="h-5 w-px bg-isaac-border" />
        <ThemePicker />
        <span className="h-5 w-px bg-isaac-border" />
        <LanguagePicker />
      </div>
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
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const t = useT();
  return (
    <div className="relative flex h-screen flex-col">
      <Defs />
      <ThemeBackdrop theme={theme} />
      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <PageBackdrop />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 overflow-y-auto px-6 py-6">
              <div key={view} className="view-enter">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
      <footer className="relative z-10 flex items-center justify-between border-t border-isaac-border bg-isaac-surface px-6 py-2 text-xs text-isaac-faint">
        <span>{t("app.disclaimer")}</span>
        <GitHubLink />
      </footer>
      <Toasts />
    </div>
  );
}
