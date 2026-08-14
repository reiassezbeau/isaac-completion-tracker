// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";
import { GITHUB_URL } from "../lib/format";
import { Emblem } from "../lib/art";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-isaac-border bg-isaac-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-isaac-faint">{children}</h2>
      {hint && <span className="text-xs text-isaac-faint">{hint}</span>}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "blood",
}: {
  value: number;
  max: number;
  tone?: "blood" | "gold" | "done";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar =
    tone === "gold"
      ? "bg-gold-500 shadow-[0_0_12px_-2px_rgba(201,169,74,0.6)]"
      : tone === "done"
        ? "bg-jade-600"
        : "bg-blood-700";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-isaac-surface2 shadow-[inset_0_0_0_1px_rgb(var(--i-surface3))]">
      <div
        className={`h-full origin-left rounded-full ${bar} animate-barGrow transition-[width] duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-isaac-border bg-isaac-surface/40 p-8 text-center">
      <div className="mb-3 flex justify-center text-isaac-faint/40">
        <Emblem size={30} />
      </div>
      <p className="text-sm font-medium text-isaac-text">{title}</p>
      {children && <div className="mt-2 text-sm text-isaac-muted">{children}</div>}
    </div>
  );
}

export function GitHubLink({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => openUrl(GITHUB_URL)}
      className={`inline-flex items-center gap-1 text-isaac-gold transition-colors hover:text-gold-300 ${className}`}
      title={GITHUB_URL}
    >
      github.com/reiassezbeau
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}
