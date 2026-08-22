// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "../store";
import { Card, ProgressBar, SectionTitle, Pill } from "../components/ui";
import { ModStatusCard } from "../components/ModStatus";
import { categoryLabel } from "../lib/format";
import { useT } from "../lib/useT";
import { DeadGodGauge, Glyph, Icon, Sigil, baseSigilId } from "../lib/art";

const CATEGORY_ICON: Record<string, string> = {
  item: "pedestal",
  character: "heart",
  trinket: "star",
  pill: "pill",
  card: "card",
  coop_baby: "fly",
  challenge: "spikes",
  completion_mark: "chest",
  boss: "skull",
  misc: "coin",
};

function HeroTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "gold" | "done" | "text" }) {
  const color = tone === "gold" ? "text-isaac-gold" : tone === "done" ? "text-isaac-done" : "text-isaac-text";
  return (
    <div className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2.5">
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-isaac-faint">{label}</div>
      <div className={`mt-1 font-display text-xl ${color}`}>
        {value}
        <span className="text-xs font-normal text-isaac-faint"> {sub}</span>
      </div>
    </div>
  );
}

export function DashboardView() {
  const t = useT();
  const dashboard = useStore((s) => s.dashboard);
  const setView = useStore((s) => s.setView);

  const perEnding = useMemo(
    () => (dashboard?.dead_god_by_ending ?? []).map((e) => ({ hard: e.hard, normal: e.normal })),
    [dashboard],
  );
  if (!dashboard) return null;

  const done = dashboard.dead_god_total - dashboard.dead_god_remaining;
  const normalTotal = dashboard.dead_god_by_ending.reduce((a, e) => a + e.normal, 0);
  const achLeft = dashboard.total - dashboard.total_unlocked;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModStatusCard />

      {!dashboard.marks_reliable && (
        <div className="flex items-start gap-3 rounded-xl border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
          <div>
            <strong>{t("dash.marksUnreliable")}</strong> {t("dash.marksUnreliableBody")}{" "}
            <button className="text-isaac-gold underline" onClick={() => setView("settings")}>
              {t("dash.manualOverrides")}
            </button>
            .
          </div>
        </div>
      )}
      {!dashboard.checksum_ok && (
        <div className="rounded-xl border border-isaac-blood/40 bg-isaac-blood/10 px-4 py-3 text-sm text-isaac-text">
          {t("dash.checksumWarn")}
        </div>
      )}

      {/* ── HERO: the Dead God gauge (stone artifact) + the counters ── */}
      <div className="grid overflow-hidden rounded-xl border border-isaac-border bg-isaac-surface md:grid-cols-[300px_1fr]">
        <div
          className="flex flex-col items-center border-b border-isaac-border px-5 py-5 md:border-b-0 md:border-r"
          style={{ background: "radial-gradient(80% 70% at 50% 42%, rgba(201,169,74,.07), transparent 70%)" }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-isaac-faint">{t("dash.distanceDeadGod")}</div>
          <div className="relative mt-2 animate-gaugeReveal">
            <DeadGodGauge perEnding={perEnding} size={238} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-5xl leading-none text-isaac-text" style={{ letterSpacing: "-.03em" }}>
                {dashboard.dead_god_remaining}
              </div>
              <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-isaac-faint">{t("dash.remaining")}</div>
            </div>
          </div>
          <div className="mt-1 font-mono text-xs text-isaac-gold">
            {done} / {dashboard.dead_god_total} <span className="text-isaac-faint">{t("dash.hardMarks")}</span>
          </div>
          <div className="mt-1.5 text-center text-[0.65rem] leading-snug text-isaac-faint">
            {t("dash.ringsHint")}
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-5">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-isaac-faint">{t("dash.unlockedAch")}</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-5xl text-isaac-gold" style={{ letterSpacing: "-.03em" }}>
                  {dashboard.total_unlocked}
                </span>
                <span className="text-lg text-isaac-faint">/ {dashboard.total}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl text-isaac-text">
                {dashboard.percent.toFixed(1)}
                <span className="text-base text-isaac-faint"> %</span>
              </div>
              <div className="mt-0.5 text-xs text-isaac-faint">{achLeft} {t("dash.left")}</div>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={dashboard.total_unlocked} max={dashboard.total} tone="gold" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <HeroTile label={t("dash.hardMarks")} value={String(done)} sub={`/ ${dashboard.dead_god_total}`} tone="gold" />
            <HeroTile label={t("dash.normalMarks")} value={String(normalTotal)} sub={t("dash.toRedo")} tone="done" />
            <HeroTile label={t("dash.fullChars")} value={String(dashboard.full_characters)} sub="/ 34" tone="text" />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint={t("dash.unlockedTotal")}>{t("dash.byCategory")}</SectionTitle>
          <div className="space-y-2.5">
            {dashboard.categories.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex text-isaac-faint">
                      <Icon name={CATEGORY_ICON[c.category] ?? "coin"} size={15} />
                    </span>
                    {categoryLabel(c.category)}
                  </span>
                  <span className="font-mono text-xs text-isaac-faint">
                    {c.unlocked}/{c.total}
                  </span>
                </div>
                <ProgressBar value={c.unlocked} max={c.total} tone={c.unlocked === c.total ? "gold" : "done"} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle hint={t("dash.fromSave")}>{t("dash.nextTargets")}</SectionTitle>
          {dashboard.next_targets.length === 0 ? (
            <p className="text-sm text-isaac-done">{t("dash.allDone")}</p>
          ) : (
            <div className="space-y-2">
              {dashboard.next_targets.map((tg, i) => (
                <button
                  key={i}
                  onClick={() => setView("predictor")}
                  className="flex w-full items-center gap-3 rounded-lg border border-isaac-border bg-isaac-surface2/60 px-3 py-2.5 text-left text-sm transition-colors hover:border-isaac-dried/50"
                >
                  <Sigil id={baseSigilId(tg.character_id)} size={28} tainted={tg.character_id.startsWith("tainted_")} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="font-semibold text-isaac-text">{tg.character_name}</span>
                    <br />
                    <span className="text-isaac-muted">{tg.target_name}</span>
                  </span>
                  <span className="flex flex-shrink-0 text-isaac-faint">
                    <Glyph id={tg.target_id} size={18} />
                  </span>
                  <span className="flex flex-shrink-0 flex-col items-end gap-1">
                    {tg.new_unlocks > 0 && (
                      <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">+{tg.new_unlocks} {t("dash.newAch")}</Pill>
                    )}
                    {tg.fills_hard_mark && (
                      <Pill className="border-isaac-dried/40 bg-isaac-dried/10 text-isaac-blood-light">{t("dash.hardMark")}</Pill>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
