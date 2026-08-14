// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useMemo, useState } from "react";
import { Activity, Crosshair, Skull, Swords, Trophy } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { pct, stageKeyLabel } from "../lib/format";
import { Card, EmptyState, Pill, ProgressBar, SectionTitle } from "../components/ui";
import type { CharacterStats, Insights, Run, StatsOverview } from "../lib/types";

type Tab = "overview" | "runs" | "insights";

function useCharNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    api.getCharactersStatic().then((cs) => {
      setNames(Object.fromEntries(cs.map((c) => [c.id, c.name])));
    });
  }, []);
  return (id: string) => names[id] ?? id;
}

function outcomePill(outcome: string | null) {
  if (outcome === "win")
    return <Pill className="border-isaac-done/40 bg-isaac-done/10 text-isaac-done">win</Pill>;
  if (outcome === "death")
    return <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90">death</Pill>;
  return <Pill className="border-isaac-border bg-isaac-surface2 text-isaac-muted">{outcome ?? "en cours"}</Pill>;
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gold" | "blood" | "done" }) {
  const color = tone === "gold" ? "text-isaac-gold" : tone === "blood" ? "text-isaac-blood" : tone === "done" ? "text-isaac-done" : "text-isaac-text";
  return (
    <Card className="!p-4">
      <div className="text-xs uppercase tracking-widest text-isaac-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-isaac-muted">{hint}</div>}
    </Card>
  );
}

function CharTable({ rows, name }: { rows: CharacterStats[]; name: (id: string) => string }) {
  if (rows.length === 0) return <p className="text-sm text-isaac-muted">Aucune donnée par personnage.</p>;
  const maxAvg = Math.max(...rows.map((r) => r.avg_hits), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-isaac-muted">
            <th className="py-1 pr-3">Perso</th>
            <th className="py-1 pr-3">Runs</th>
            <th className="py-1 pr-3">Winrate</th>
            <th className="py-1 pr-3">Hits/run</th>
            <th className="py-1">Propreté</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.character} className="border-t border-isaac-border/50">
              <td className="py-1.5 pr-3 font-medium">{name(r.character)}</td>
              <td className="py-1.5 pr-3 text-isaac-muted">{r.runs}</td>
              <td className="py-1.5 pr-3">{pct(r.winrate)}</td>
              <td className="py-1.5 pr-3">{r.avg_hits.toFixed(1)}</td>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-isaac-surface2">
                    <div className="h-full rounded-full bg-isaac-blood" style={{ width: `${(r.avg_hits / maxAvg) * 100}%` }} />
                  </div>
                  <span className="text-xs text-isaac-muted">{r.cleanliness.toFixed(2)}/étage</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsView() {
  const [tab, setTab] = useState<Tab>("overview");
  const [ov, setOv] = useState<StatsOverview | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const setView = useStore((s) => s.setView);
  const name = useCharNames();

  useEffect(() => {
    api.getStatsOverview().then(setOv);
    api.getInsights().then(setIns);
    api.getRunHistory(60).then(setRuns);
  }, []);

  const heatMax = useMemo(() => Math.max(1, ...(ov?.hits_heatmap.map(([, n]) => n) ?? [])), [ov]);
  const trendMax = useMemo(() => Math.max(1, ...(ov?.hits_trend ?? [])), [ov]);

  if (!ov) return null;

  if (ov.total_runs === 0) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <EmptyState title="Aucune donnée de stats pour l'instant.">
          Installe le mod compagnon et joue un run — tes hits, winrates et tendances apparaîtront ici.
          <div className="mt-3">
            <button onClick={() => setView("diagnostic")} className="rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-2 text-sm text-isaac-gold">
              Aller au Diagnostic (installer le mod)
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const tabs: [Tab, string][] = [
    ["overview", "Aperçu"],
    ["runs", "Runs"],
    ["insights", "Insights"],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
        <Activity className="h-6 w-6 text-isaac-dried" /> Stats de jeu
      </h1>
      <div className="flex gap-1 rounded-lg border border-isaac-border bg-isaac-surface p-1 text-sm">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${tab === id ? "bg-isaac-blood/15 text-isaac-text" : "text-isaac-muted hover:text-isaac-text"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Runs comptés" value={String(ov.total_runs)} hint={`${ov.total_wins}W / ${ov.total_deaths}D`} />
            <StatTile label="Winrate" value={pct(ov.overall_winrate)} tone="done" />
            <StatTile label="Hits / run" value={ov.avg_hits_per_run.toFixed(1)} tone="blood" />
            <StatTile label="Nemesis" value={ov.nemesis ? ov.nemesis[0] : "—"} hint={ov.nemesis ? `${ov.nemesis[1]} hits` : undefined} tone="gold" />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Ennemis tués" value={ov.total_kills.toLocaleString("fr")} tone="blood" />
            <StatTile label="Boss battus" value={String(ov.total_boss_kills)} tone="gold" />
            <StatTile label="Salles nettoyées" value={ov.total_rooms_cleared.toLocaleString("fr")} />
            <StatTile label="Deals du diable" value={String(ov.total_devil_deals)} tone="blood" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <SectionTitle>Hits par source</SectionTitle>
              {ov.hits_by_source.length === 0 ? (
                <p className="text-sm text-isaac-muted">Aucun hit enregistré.</p>
              ) : (
                <div className="space-y-2">
                  {ov.hits_by_source.map(([src, n]) => (
                    <div key={src}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize">{src}</span>
                        <span className="text-isaac-muted">{n}</span>
                      </div>
                      <ProgressBar value={n} max={ov.hits_by_source[0][1]} tone="blood" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle hint="où tu prends des coups">Heatmap par étage</SectionTitle>
              {ov.hits_heatmap.length === 0 ? (
                <p className="text-sm text-isaac-muted">Aucune donnée.</p>
              ) : (
                <div className="space-y-1.5">
                  {ov.hits_heatmap.map(([key, n]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="w-32 flex-shrink-0 text-isaac-muted">{stageKeyLabel(key)}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-isaac-surface2">
                        <div className="h-full rounded bg-gradient-to-r from-isaac-gold to-isaac-blood" style={{ width: `${(n / heatMax) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right text-xs text-isaac-muted">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <SectionTitle hint="hits/run des derniers runs">Tendance</SectionTitle>
            <div className="flex h-24 items-end gap-1">
              {ov.hits_trend.map((n, i) => (
                <div key={i} className="flex-1 rounded-t bg-isaac-blood/70" style={{ height: `${(n / trendMax) * 100}%` }} title={`${n} hits`} />
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Par personnage</SectionTitle>
            <CharTable rows={ov.per_character} name={name} />
          </Card>
        </>
      )}

      {tab === "runs" && (
        <Card>
          <SectionTitle hint={`${runs.length} runs récents`}>Historique des runs</SectionTitle>
          {runs.length === 0 ? (
            <p className="text-sm text-isaac-muted">Aucun run enregistré.</p>
          ) : (
            <div className="space-y-1.5">
              {runs.map((r) => (
                <div key={r.run_id} className="flex items-center justify-between gap-3 rounded-lg border border-isaac-border bg-isaac-surface2/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{name(r.character)}</span>
                    {outcomePill(r.outcome)}
                    <span className="text-xs text-isaac-muted">slot {r.slot}</span>
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-xs text-isaac-muted">
                    <span className="inline-flex items-center gap-1"><Crosshair className="h-3 w-3 text-isaac-blood" />{r.hits_total} hits</span>
                    <span>étage {r.deepest_stage}</span>
                    {r.kills != null && <span>{r.kills} kills</span>}
                    {r.rooms_cleared != null && <span>{r.rooms_cleared} salles</span>}
                    {r.final_build.length > 0 && <span className="text-isaac-gold/80">{r.final_build.length} items</span>}
                    {r.shielded_hits > 0 && <span>🛡 {r.shielded_hits}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "insights" && ins && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Streak de victoires" value={String(ins.current_win_streak)} hint={`record : ${ins.best_win_streak}`} tone="gold" />
            <StatTile
              label="Corrélation hits↔win"
              value={ins.hits_win_correlation == null ? "—" : ins.hits_win_correlation.toFixed(2)}
              hint={ins.hits_win_correlation != null && ins.hits_win_correlation < 0 ? "moins de hits → plus de wins" : "pas assez de données"}
            />
            <StatTile label="Runs analysés" value={String(ins.total_runs)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <SectionTitle>
                <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4 text-isaac-gold" /> Persos les plus clean</span>
              </SectionTitle>
              <CharTable rows={ins.cleanest_characters} name={name} />
            </Card>
            <Card>
              <SectionTitle>
                <span className="inline-flex items-center gap-1"><Swords className="h-4 w-4 text-isaac-blood" /> Les plus « saignants »</span>
              </SectionTitle>
              <CharTable rows={ins.bloodiest_characters} name={name} />
            </Card>
          </div>

          <Card>
            <SectionTitle hint="tes runs les plus propres">
              <span className="inline-flex items-center gap-1"><Activity className="h-4 w-4" /> Records de propreté</span>
            </SectionTitle>
            <div className="space-y-1.5">
              {ins.best_clean_runs.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-isaac-border bg-isaac-surface2/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-isaac-gold">#{i + 1}</span>
                    <span className="font-medium">{name(r.character)}</span>
                    {outcomePill(r.outcome)}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-isaac-muted">
                    <span className="inline-flex items-center gap-1"><Skull className="h-3 w-3" />{r.hits} hits</span>
                    <span>étage {r.deepest_stage}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
