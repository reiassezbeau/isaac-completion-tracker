// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Feather, Heart, Plus, Search, Sparkles, Wand2, X } from "lucide-react";
import { api } from "../lib/api";
import { roleLabel, statDimLabel, tearFlagLabel, verdictLabel, VERDICT_META } from "../lib/format";
import { useT } from "../lib/useT";
import { useItemName } from "../lib/useItemName";
import { Card, EmptyState, Pill, SectionTitle } from "../components/ui";
import type { BuildAnalysis, ItemKb, Run, SynergyResult } from "../lib/types";

const DIMS = ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"] as const;

/** Original radar (6 axes) - hand-rolled data-viz, no game asset. */
function Radar({
  before,
  after,
}: {
  before: [string, number][];
  after: [string, number][];
}) {
  const t = useT();
  const size = 220;
  const c = size / 2;
  const R = size / 2 - 26;
  const bmap = Object.fromEntries(before);
  const amap = Object.fromEntries(after);
  const pt = (i: number, v: number): [number, number] => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / DIMS.length;
    return [c + R * v * Math.cos(ang), c + R * v * Math.sin(ang)];
  };
  const poly = (map: Record<string, number>) =>
    DIMS.map((d, i) => pt(i, map[d] ?? 0).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-56 w-56">
      {rings.map((r) => (
        <polygon
          key={r}
          points={DIMS.map((_, i) => pt(i, r).join(",")).join(" ")}
          className="fill-none stroke-isaac-border"
          strokeWidth={0.5}
        />
      ))}
      {DIMS.map((d, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.2);
        return (
          <g key={d}>
            <line x1={c} y1={c} x2={x} y2={y} className="stroke-isaac-border" strokeWidth={0.5} />
            <text
              x={lx}
              y={ly}
              className="fill-isaac-muted text-[8px]"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {statDimLabel(d, t)}
            </text>
          </g>
        );
      })}
      <polygon points={poly(bmap)} className="fill-isaac-muted/15 stroke-isaac-muted" strokeWidth={1} />
      <polygon points={poly(amap)} className="fill-isaac-gold/20 stroke-isaac-gold" strokeWidth={1.5} />
    </svg>
  );
}

function toneClass(tone: "done" | "gold" | "blood" | "muted"): string {
  switch (tone) {
    case "done":
      return "border-isaac-done/40 bg-isaac-done/10 text-isaac-done";
    case "gold":
      return "border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold";
    case "blood":
      return "border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood-light";
    default:
      return "border-isaac-border bg-isaac-surface2 text-isaac-muted";
  }
}

function noteToneClass(kind: string): string {
  if (kind === "strong") return "border-isaac-done/40 bg-isaac-done/10 text-isaac-done";
  if (kind === "dangerous") return "border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood-light";
  return "border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold";
}

function SynergyPanel({ result }: { result: SynergyResult }) {
  const t = useT();
  const meta = VERDICT_META[result.verdict] ?? VERDICT_META.situational;
  const deltas = result.stat_deltas.filter((d) => d.direction !== 0);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>
          <span className="inline-flex items-center gap-1">
            <Wand2 className="h-4 w-4 text-isaac-gold" /> {t("bld.testOf")} {result.candidate_name}
          </span>
        </SectionTitle>
        <Pill className={toneClass(meta.tone)}>{verdictLabel(result.verdict, t)}</Pill>
      </div>

      <p className="mb-3 text-sm text-isaac-text">{result.verdict_text}</p>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <div>
          <Radar before={result.radar_before} after={result.radar_after} />
          <div className="mt-1 flex items-center justify-center gap-4 text-[0.7rem] text-isaac-muted">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-isaac-muted/40" /> {t("bld.before")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-isaac-gold/60" /> {t("bld.after")}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {result.adds_tear_flags.map((f) => (
              <Pill key={f} className="border-isaac-done/40 bg-isaac-done/10 text-isaac-done">
                + {tearFlagLabel(f, t)}
              </Pill>
            ))}
            {result.adds_flight && (
              <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">
                <Feather className="h-3 w-3" /> + {t("bld.flight")}
              </Pill>
            )}
            {result.hearts_delta > 0 && (
              <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood-light">
                <Heart className="h-3 w-3" /> +{result.hearts_delta}
              </Pill>
            )}
          </div>

          {deltas.length > 0 && (
            <div className="space-y-1 text-sm">
              {deltas.map((d) => (
                <div key={d.dim} className="flex items-center gap-2">
                  <span className="w-20 text-isaac-muted">{statDimLabel(d.dim, t)}</span>
                  <span className={d.direction > 0 ? "text-isaac-done" : "text-isaac-blood-light"}>
                    {d.direction > 0 ? "↑" : "↓"} {d.before.toFixed(1)} → {d.after.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.synergy_notes.length > 0 && (
            <div className="space-y-1.5">
              {result.synergy_notes.map((n, i) => (
                <div key={i} className={`rounded-lg border px-3 py-1.5 text-sm ${noteToneClass(n.kind)}`}>
                  {n.text}
                </div>
              ))}
            </div>
          )}

          {result.estimate_approximate && (
            <p className="flex items-start gap-1.5 text-xs text-isaac-muted">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-isaac-gold" />
              {t("bld.approx")} 
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function AnalysisPanel({ analysis }: { analysis: BuildAnalysis }) {
  const t = useT();
  const { composition: c } = analysis;
  return (
    <Card>
      {/* A build of 15 unknown items used to show a bare "0" here, which read as
          broken. Showing analysed-of-loaded makes the gap explicit instead. */}
      <SectionTitle
        hint={
          analysis.unknown_ids.length > 0
            ? `${c.total}/${c.total + analysis.unknown_ids.length}`
            : `${c.total}`
        }
      >
        {t("bld.composition")}
      </SectionTitle>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {c.by_role.map(([role, n]) => (
          <Pill key={role} className="border-isaac-border bg-isaac-surface2 text-isaac-text">
            {roleLabel(role, t)} · {n}
          </Pill>
        ))}
        {c.tear_flags.map(([f, n]) => (
          <Pill key={f} className="border-isaac-gold/30 bg-isaac-gold/10 text-isaac-gold">
            {tearFlagLabel(f, t)} ×{n}
          </Pill>
        ))}
      </div>

      {analysis.unknown_ids.length > 0 && (
        <p className="mb-3 text-xs text-isaac-muted" title={analysis.unknown_names.join(", ")}>
          {analysis.unknown_ids.length} {t("bld.unknownItems")}
          {analysis.unknown_names.length > 0 && (
            <span className="text-isaac-faint"> — {analysis.unknown_names.slice(0, 4).join(", ")}
              {analysis.unknown_names.length > 4 ? "…" : ""}
            </span>
          )}
        </p>
      )}

      {analysis.archetypes.map((a) => (
        <div key={a} className="mb-2 rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-3 py-1.5 text-sm text-isaac-text">
          {a}
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-isaac-done">{t("bld.strengths")}</div>
          {analysis.strengths.length === 0 ? (
            <p className="text-sm text-isaac-muted">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex items-baseline gap-1.5">
                  <span className="text-isaac-done">✓</span> {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-isaac-blood-light">{t("bld.weaknesses")}</div>
          {analysis.weaknesses.length === 0 ? (
            <p className="text-sm text-isaac-muted">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {analysis.weaknesses.map((w, i) => (
                <li key={i} className="flex items-baseline gap-1.5">
                  <span className="text-isaac-blood-light">•</span> {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

export function BuildAssistantView() {
  const t = useT();
  const itemName = useItemName();
  const [kb, setKb] = useState<ItemKb[] | null>(null);
  const [build, setBuild] = useState<number[]>([]);
  const [candidate, setCandidate] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState<BuildAnalysis | null>(null);
  const [synergy, setSynergy] = useState<SynergyResult | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.getItemKb().then(setKb);
    // Recent runs that carry a build snapshot (§7) -> loadable into the simulator.
    api.getRunHistory(40).then((rs) => setRuns(rs.filter((r) => r.final_build.length > 0))).catch(() => setRuns([]));
  }, []);

  useEffect(() => {
    if (build.length > 0) api.analyzeBuild(build).then(setAnalysis);
    else setAnalysis(null);
  }, [build]);

  useEffect(() => {
    if (candidate != null) api.trySynergy(build, candidate).then(setSynergy).catch(() => setSynergy(null));
    else setSynergy(null);
  }, [build, candidate]);

  const filtered = useMemo(() => {
    if (!kb) return [];
    const q = query.trim().toLowerCase();
    const list = q ? kb.filter((i) => i.name.toLowerCase().includes(q)) : kb;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [kb, query]);

  if (!kb) return null;

  const addToBuild = (id: number) => {
    setBuild((b) => (b.includes(id) ? b : [...b, id]));
    if (candidate === id) setCandidate(null);
  };
  const removeFromBuild = (id: number) => setBuild((b) => b.filter((x) => x !== id));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
          <Wand2 className="h-6 w-6 text-isaac-gold" /> {t("nav.build")}
        </h1>
        <p className="mt-1 text-sm text-isaac-muted">
          {t("bld.sub")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Item picker */}
        <div className="space-y-3">
          <Card className="!p-3">
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-2.5 py-1.5">
              <Search className="h-4 w-4 text-isaac-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("bld.searchItem")}
                className="w-full bg-transparent text-sm text-isaac-text outline-none placeholder:text-isaac-muted"
              />
            </div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {filtered.map((it) => {
                const inBuild = build.includes(it.id);
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-isaac-border bg-isaac-surface2/40 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-sm" title={it.note || it.name}>
                      {it.name}
                      {it.is_tears_replacement && <span className="ml-1 text-isaac-blood/80" title={t("bld.tearReplacement")}>⟳</span>}
                    </span>
                    <span className="flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => setCandidate(it.id)}
                        disabled={inBuild}
                        className="rounded-md border border-isaac-gold/30 px-1.5 py-0.5 text-[0.7rem] text-isaac-gold transition-colors hover:bg-isaac-gold/10 disabled:opacity-30"
                        title={t("bld.testTitle")}
                      >
                        {t("bld.test")}
                      </button>
                      <button
                        onClick={() => addToBuild(it.id)}
                        disabled={inBuild}
                        className="rounded-md border border-isaac-border px-1.5 py-0.5 text-[0.7rem] text-isaac-muted transition-colors hover:text-isaac-text disabled:opacity-30"
                        title={t("bld.addToBuild")}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Build courant + analyses */}
        <div className="space-y-5">
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-isaac-muted">{t("bld.yourBuild")}</h2>
              <div className="flex items-center gap-2">
                {runs.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const r = runs[Number(e.target.value)];
                      if (r) {
                        setBuild(r.final_build);
                        setCandidate(null);
                      }
                    }}
                    className="rounded-lg border border-isaac-border bg-isaac-surface2 px-2.5 py-1 text-xs text-isaac-text outline-none focus:border-isaac-gold/60"
                    title={t("bld.loadRunTitle")}
                  >
                    <option value="">{t("bld.loadRun")}</option>
                    {runs.map((r, i) => (
                      <option key={r.run_id} value={i}>
                        {r.character} · {r.final_build.length} items · {r.outcome ?? "en cours"}
                      </option>
                    ))}
                  </select>
                )}
                {build.length > 0 && (
                  <button
                    onClick={() => {
                      setBuild([]);
                      setCandidate(null);
                    }}
                    className="rounded-lg border border-isaac-border px-2.5 py-1 text-xs text-isaac-muted transition-colors hover:text-isaac-blood"
                  >
                    {t("bld.clear")}
                  </button>
                )}
              </div>
            </div>
            {build.length === 0 ? (
              <p className="text-sm text-isaac-muted">
                {t("bld.emptyBuild")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {build.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-lg border border-isaac-border bg-isaac-surface2 px-2 py-1 text-sm"
                  >
                    {itemName(id)}
                    <button onClick={() => removeFromBuild(id)} className="text-isaac-muted hover:text-isaac-blood">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {candidate != null && synergy ? (
            <SynergyPanel result={synergy} />
          ) : (
            <EmptyState title={t("bld.pickCandidate")}>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-isaac-gold" /> {t("bld.clickTest")}
              </span>
            </EmptyState>
          )}

          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>
      </div>
    </div>
  );
}
