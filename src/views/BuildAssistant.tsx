// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Feather, Heart, Plus, Search, Sparkles, Wand2, X } from "lucide-react";
import { api } from "../lib/api";
import { roleLabel, statDimLabel, tearFlagLabel, VERDICT_META } from "../lib/format";
import { Card, EmptyState, Pill, SectionTitle } from "../components/ui";
import type { BuildAnalysis, ItemKb, Run, SynergyResult } from "../lib/types";

const DIMS = ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"] as const;

/** Radar original (6 axes) — data-viz maison, aucun asset du jeu. */
function Radar({
  before,
  after,
}: {
  before: [string, number][];
  after: [string, number][];
}) {
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
              {statDimLabel(d)}
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
      return "border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90";
    default:
      return "border-isaac-border bg-isaac-surface2 text-isaac-muted";
  }
}

function noteToneClass(kind: string): string {
  if (kind === "strong") return "border-isaac-done/40 bg-isaac-done/10 text-isaac-done";
  if (kind === "dangerous") return "border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90";
  return "border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold";
}

function SynergyPanel({ result }: { result: SynergyResult }) {
  const meta = VERDICT_META[result.verdict] ?? VERDICT_META.situational;
  const deltas = result.stat_deltas.filter((d) => d.direction !== 0);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>
          <span className="inline-flex items-center gap-1">
            <Wand2 className="h-4 w-4 text-isaac-gold" /> Test : {result.candidate_name}
          </span>
        </SectionTitle>
        <Pill className={toneClass(meta.tone)}>{meta.label}</Pill>
      </div>

      <p className="mb-3 text-sm text-isaac-text">{result.verdict_text}</p>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <div>
          <Radar before={result.radar_before} after={result.radar_after} />
          <div className="mt-1 flex items-center justify-center gap-4 text-[0.7rem] text-isaac-muted">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-isaac-muted/40" /> avant
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-isaac-gold/60" /> après
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {result.adds_tear_flags.map((f) => (
              <Pill key={f} className="border-isaac-done/40 bg-isaac-done/10 text-isaac-done">
                + {tearFlagLabel(f)}
              </Pill>
            ))}
            {result.adds_flight && (
              <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">
                <Feather className="h-3 w-3" /> + vol
              </Pill>
            )}
            {result.hearts_delta > 0 && (
              <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90">
                <Heart className="h-3 w-3" /> +{result.hearts_delta}
              </Pill>
            )}
          </div>

          {deltas.length > 0 && (
            <div className="space-y-1 text-sm">
              {deltas.map((d) => (
                <div key={d.dim} className="flex items-center gap-2">
                  <span className="w-20 text-isaac-muted">{statDimLabel(d.dim)}</span>
                  <span className={d.direction > 0 ? "text-isaac-done" : "text-isaac-blood/90"}>
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
              Delta de stats <strong>approximatif</strong> (item multiplicatif / à proc / conditionnel —
              la formule de dégâts d'Isaac est non triviale).
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function AnalysisPanel({ analysis }: { analysis: BuildAnalysis }) {
  const { composition: c } = analysis;
  return (
    <Card>
      <SectionTitle hint={`${c.total} item(s)`}>Composition & analyse</SectionTitle>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {c.by_role.map(([role, n]) => (
          <Pill key={role} className="border-isaac-border bg-isaac-surface2 text-isaac-text">
            {roleLabel(role)} · {n}
          </Pill>
        ))}
        {c.tear_flags.map(([f, n]) => (
          <Pill key={f} className="border-isaac-gold/30 bg-isaac-gold/10 text-isaac-gold">
            {tearFlagLabel(f)} ×{n}
          </Pill>
        ))}
      </div>

      {analysis.unknown_ids.length > 0 && (
        <p className="mb-3 text-xs text-isaac-muted">
          {analysis.unknown_ids.length} item(s) hors base de connaissances (comptés dans le total, non détaillés).
        </p>
      )}

      {analysis.archetypes.map((a) => (
        <div key={a} className="mb-2 rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-3 py-1.5 text-sm text-isaac-text">
          {a}
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-isaac-done">Forces</div>
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
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-isaac-blood/90">Faiblesses</div>
          {analysis.weaknesses.length === 0 ? (
            <p className="text-sm text-isaac-muted">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {analysis.weaknesses.map((w, i) => (
                <li key={i} className="flex items-baseline gap-1.5">
                  <span className="text-isaac-blood/90">•</span> {w}
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
  const [kb, setKb] = useState<ItemKb[] | null>(null);
  const [build, setBuild] = useState<number[]>([]);
  const [candidate, setCandidate] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState<BuildAnalysis | null>(null);
  const [synergy, setSynergy] = useState<SynergyResult | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.getItemKb().then(setKb);
    // Runs recents ayant un snapshot de build (§7) -> chargeables dans le simulateur.
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

  const byId = useMemo(() => Object.fromEntries((kb ?? []).map((i) => [i.id, i])), [kb]);
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
          <Wand2 className="h-6 w-6 text-isaac-gold" /> Assistant de build
        </h1>
        <p className="mt-1 text-sm text-isaac-muted">
          Simulateur : compose ton build, puis « teste » un item candidat pour voir le delta, la
          synergie et le verdict. Hors-ligne, factuel — pas d'EID, aucun asset du jeu.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Sélecteur d'items */}
        <div className="space-y-3">
          <Card className="!p-3">
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-2.5 py-1.5">
              <Search className="h-4 w-4 text-isaac-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chercher un item…"
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
                      {it.is_tears_replacement && <span className="ml-1 text-isaac-blood/80" title="remplacement de larmes">⟳</span>}
                    </span>
                    <span className="flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => setCandidate(it.id)}
                        disabled={inBuild}
                        className="rounded-md border border-isaac-gold/30 px-1.5 py-0.5 text-[0.7rem] text-isaac-gold transition-colors hover:bg-isaac-gold/10 disabled:opacity-30"
                        title="Tester comme candidat"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => addToBuild(it.id)}
                        disabled={inBuild}
                        className="rounded-md border border-isaac-border px-1.5 py-0.5 text-[0.7rem] text-isaac-muted transition-colors hover:text-isaac-text disabled:opacity-30"
                        title="Ajouter au build"
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
              <h2 className="text-sm font-semibold uppercase tracking-widest text-isaac-muted">Ton build</h2>
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
                    title="Charger le build d'un run récent (mod)"
                  >
                    <option value="">Charger un run…</option>
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
                    Vider
                  </button>
                )}
              </div>
            </div>
            {build.length === 0 ? (
              <p className="text-sm text-isaac-muted">
                Ajoute des items depuis la liste (bouton <Plus className="inline h-3 w-3" />), charge le build d'un
                run récent, puis « Test » un candidat.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {build.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-lg border border-isaac-border bg-isaac-surface2 px-2 py-1 text-sm"
                  >
                    {byId[id]?.name ?? `#${id}`}
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
            <EmptyState title="Choisis un item candidat.">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-isaac-gold" /> Clique « Test » sur un item pour voir son effet
                sur ce build.
              </span>
            </EmptyState>
          )}

          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>
      </div>
    </div>
  );
}
