// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { Crosshair, Flame, Gauge, Info, Sparkles, Target, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { pct } from "../lib/format";
import { useT } from "../lib/useT";
import { Card, EmptyState, Pill, ProgressBar, SectionTitle } from "../components/ui";
import { Glyph, Portrait, basePortraitId } from "../lib/art";
import type { AlmostThere, Bottleneck, DeadGodEta, EvAction, OptimizerReport } from "../lib/types";

/** Probability color: red (hard) -> gold -> green (safe). */
function probTone(p: number): "blood" | "gold" | "done" {
  if (p >= 0.6) return "done";
  if (p >= 0.4) return "gold";
  return "blood";
}

function EtaHero({ eta }: { eta: DeadGodEta }) {
  const t = useT();
  const done = eta.total - eta.remaining;
  return (
    <Card>
      <SectionTitle hint={t("opt.ultimate")}>
        <span className="inline-flex items-center gap-1">
          <Gauge className="h-4 w-4 text-isaac-gold" /> {t("road.route")}
        </span>
      </SectionTitle>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-bold">
            <span className="text-isaac-gold">{done}</span>
            <span className="text-isaac-muted"> / {eta.total}</span>
          </div>
          <div className="mt-1 text-sm text-isaac-muted">
            {t("road.goldMarks")} · <span className="text-isaac-blood">{eta.remaining} {t("dash.remaining")}</span>
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs uppercase tracking-widest text-isaac-muted">{t("opt.winRuns")}</div>
            <div className="text-xl font-bold">{eta.estimated_winning_runs ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-isaac-muted">{t("opt.attempts")}</div>
            <div className="text-xl font-bold text-isaac-blood">{eta.estimated_attempts ?? "—"}</div>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={done} max={eta.total} tone="gold" />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-isaac-muted">
        <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
        {eta.note}
      </p>
    </Card>
  );
}

function ActionRow({ action, rank, maxEv }: { action: EvAction; rank: number; maxEv: number }) {
  const t = useT();
  const tone = probTone(action.probability);
  const barColor =
    tone === "done" ? "bg-isaac-done" : tone === "gold" ? "bg-isaac-gold" : "bg-isaac-blood";
  return (
    <div className="rounded-lg border border-isaac-border bg-isaac-surface2/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Portrait id={basePortraitId(action.character_id)} size={30} tainted={action.character_id.startsWith("tainted_")} />
          <span className="text-sm font-bold text-isaac-gold">#{rank}</span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{action.character_name}</div>
            <div className="text-xs text-isaac-muted">{action.route_note}</div>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
          {action.mark_gain > 0 && (
            <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">
              +{action.mark_gain} {t("opt.marks")}
            </Pill>
          )}
          {action.ach_gain > 0 && (
            <Pill className="border-isaac-done/40 bg-isaac-done/10 text-isaac-done">
              +{action.ach_gain} {t("dash.newAch")}
            </Pill>
          )}
          {action.reward_gain > 0 && (
            <Pill className="border-isaac-blood/30 bg-isaac-blood/10 text-isaac-blood-light">
              +{action.reward_gain} {t("opt.items")}
            </Pill>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-isaac-muted">{action.why}</p>

      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className="w-16 flex-shrink-0 text-isaac-muted">
          EV <span className="font-semibold text-isaac-text">{action.ev.toFixed(1)}</span>
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-isaac-surface2">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(action.ev / maxEv) * 100}%` }} />
        </div>
        <span className="w-24 flex-shrink-0 text-right text-isaac-muted">
          {t("opt.success")}{" "}
          <span className={tone === "done" ? "text-isaac-done" : tone === "gold" ? "text-isaac-gold" : "text-isaac-blood"}>
            {pct(action.probability)}
          </span>
        </span>
      </div>
      {action.based_on_runs === 0 && (
        <div className="mt-1 text-[0.7rem] text-isaac-muted/80">
          {t("opt.defaultProb")}
        </div>
      )}
    </div>
  );
}

function BottleneckList({ items }: { items: Bottleneck[] }) {
  const t = useT();
  if (items.length === 0)
    return <p className="text-sm text-isaac-done">{t("opt.noBottle")}</p>;
  const max = Math.max(...items.map((b) => b.chars_missing), 1);
  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div key={b.ending_id} className="text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <span className="flex text-isaac-faint">
                <Glyph id={b.ending_id} size={15} />
              </span>
              {b.ending_name}
            </span>
            <span className="text-xs text-isaac-muted">
              {b.chars_missing} {t("opt.charsMissing")} · ~{pct(b.difficulty_default)} {t("opt.success")}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-isaac-surface2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-isaac-gold to-isaac-blood"
              style={{ width: `${(b.chars_missing / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AlmostList({ items }: { items: AlmostThere[] }) {
  const t = useT();
  if (items.length === 0)
    return <p className="text-sm text-isaac-muted">{t("opt.noAlmost")}</p>;
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.character_id}
          className="flex items-center justify-between gap-3 rounded-lg border border-isaac-border bg-isaac-surface2/40 px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Portrait id={basePortraitId(a.character_id)} size={26} tainted={a.character_id.startsWith("tainted_")} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{a.character_name}</div>
              <div className="truncate text-xs text-isaac-muted">{a.missing_names.join(", ")}</div>
            </div>
          </div>
          <Pill className="flex-shrink-0 border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">
            {a.missing_marks} {t("opt.remainingF")}
          </Pill>
        </div>
      ))}
    </div>
  );
}

export function OptimizerView() {
  const t = useT();
  const [report, setReport] = useState<OptimizerReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getOptimizer(12)
      .then(setReport)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <EmptyState title={t("opt.unavailable")}>{error}</EmptyState>
      </div>
    );
  }
  if (!report) return null;

  const maxEv = Math.max(...report.actions.map((a) => a.ev), 0.001);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
          <Target className="h-6 w-6 text-isaac-dried" /> {t("nav.optimizer")}
        </h1>
        <p className="mt-1 text-sm text-isaac-muted">
          {t("opt.sub")}
        </p>
      </div>

      <EtaHero eta={report.eta} />

      {report.based_on_runs === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-3 text-sm text-isaac-text">
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-isaac-gold" />
          <span>
            {t("opt.coldStart")}
          </span>
        </div>
      )}

      <Card>
        <SectionTitle hint={t("opt.byEv")}>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-isaac-gold" /> {t("opt.nextActions")}
          </span>
        </SectionTitle>
        {report.actions.length === 0 ? (
          <p className="text-sm text-isaac-done">{t("opt.nothingLeft")}</p>
        ) : (
          <div className="space-y-2">
            {report.actions.map((a, i) => (
              <ActionRow key={`${a.character_id}-${a.route_id}`} action={a} rank={i + 1} maxEv={maxEv} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle hint={t("opt.bottleHint")}>
            <span className="inline-flex items-center gap-1">
              <Flame className="h-4 w-4 text-isaac-blood" /> {t("opt.bottlenecks")}
            </span>
          </SectionTitle>
          <BottleneckList items={report.bottlenecks} />
        </Card>
        <Card>
          <SectionTitle hint={t("opt.almostHint")}>
            <span className="inline-flex items-center gap-1">
              <Crosshair className="h-4 w-4 text-isaac-gold" /> {t("opt.almost")}
            </span>
          </SectionTitle>
          <AlmostList items={report.almost_there} />
        </Card>
      </div>
    </div>
  );
}
