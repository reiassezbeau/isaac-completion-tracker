import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { markLabel } from "../lib/format";
import { Card, Pill, SectionTitle } from "../components/ui";
import type { AchievementView, Character, Ending, MarkDifficulty, Overrides } from "../lib/types";

const DIFFS: MarkDifficulty[] = ["none", "normal", "hard"];

export function SettingsView() {
  const toast = useStore((s) => s.toast);
  const reload = useStore((s) => s.reloadAfterOverride);

  const [ach, setAch] = useState<AchievementView[]>([]);
  const [chars, setChars] = useState<Character[]>([]);
  const [endings, setEndings] = useState<Ending[]>([]);
  const [ov, setOv] = useState<Overrides>({ achievements: {}, marks: {} });
  const [q, setQ] = useState("");
  const [charId, setCharId] = useState("bethany");

  async function refreshAll() {
    const [a, o] = await Promise.all([api.getAchievements(), api.getOverrides()]);
    setAch(a);
    setOv(o);
  }
  useEffect(() => {
    api.getCharactersStatic().then(setChars);
    api.getEndings().then(setEndings);
    refreshAll();
  }, []);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return ach.filter((a) => a.name.toLowerCase().includes(n)).slice(0, 12);
  }, [q, ach]);

  async function setAchOverride(id: number, value: boolean | null) {
    await api.setOverrideAchievement(id, value);
    await refreshAll();
    await reload();
    toast("Correction enregistrée");
  }
  async function setMarkOverride(mark: number, value: string | null) {
    await api.setOverrideMark(charId, mark, value);
    await refreshAll();
    await reload();
    toast("Correction enregistrée");
  }
  async function reset() {
    await api.resetOverrides();
    await refreshAll();
    await reload();
    toast("Corrections réinitialisées");
  }

  const overrideCount = Object.keys(ov.achievements).length + Object.keys(ov.marks).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-isaac-border bg-isaac-surface px-4 py-3 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
        <div className="text-isaac-muted">
          Filet de sécurité : force le statut d'un succès ou d'une mark si le parsing se trompe. Stocké dans
          l'appdata de l'app, <strong className="text-isaac-text">jamais dans la save du jeu</strong>. Les
          corrections s'appliquent par-dessus les données lues.
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-isaac-muted">
          {overrideCount} correction{overrideCount > 1 ? "s" : ""} active{overrideCount > 1 ? "s" : ""}
        </span>
        <button
          onClick={reset}
          disabled={overrideCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-muted transition-colors hover:text-isaac-text disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" /> Réinitialiser les corrections
        </button>
      </div>

      <Card>
        <SectionTitle>Corriger un succès</SectionTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-isaac-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom du succès…"
            className="w-full rounded-lg border border-isaac-border bg-isaac-surface2 py-2 pl-9 pr-3 text-sm outline-none focus:border-isaac-blood/60"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          {results.map((a) => {
            const forced = ov.achievements[a.id];
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-isaac-border bg-isaac-surface2/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {a.name}
                  {a.overridden && <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">corrigé</Pill>}
                  <span className="text-xs text-isaac-muted">({a.unlocked ? "débloqué" : "verrouillé"})</span>
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setAchOverride(a.id, true)} className={`rounded px-2 py-1 text-xs ${forced === true ? "bg-isaac-done/20 text-isaac-done" : "bg-isaac-surface text-isaac-muted hover:text-isaac-text"}`}>Débloqué</button>
                  <button onClick={() => setAchOverride(a.id, false)} className={`rounded px-2 py-1 text-xs ${forced === false ? "bg-isaac-blood/20 text-isaac-blood" : "bg-isaac-surface text-isaac-muted hover:text-isaac-text"}`}>Verrouillé</button>
                  <button onClick={() => setAchOverride(a.id, null)} className="rounded px-2 py-1 text-xs text-isaac-muted hover:text-isaac-text">Auto</button>
                </div>
              </div>
            );
          })}
          {q && results.length === 0 && <p className="text-sm text-isaac-muted">Aucun succès trouvé.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle>Corriger les completion marks</SectionTitle>
        <select
          value={charId}
          onChange={(e) => setCharId(e.target.value)}
          className="mb-3 rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2 text-sm"
        >
          {chars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="space-y-1.5">
          {endings.map((e) => {
            const forced = ov.marks[`${charId}:${e.mark_index}`];
            return (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-isaac-border bg-isaac-surface2/40 px-3 py-2 text-sm">
                <span>{e.name}</span>
                <div className="flex gap-1">
                  {DIFFS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setMarkOverride(e.mark_index, d)}
                      className={`rounded px-2 py-1 text-xs ${forced === d ? "bg-isaac-gold/20 text-isaac-gold" : "bg-isaac-surface text-isaac-muted hover:text-isaac-text"}`}
                    >
                      {markLabel(d)}
                    </button>
                  ))}
                  <button onClick={() => setMarkOverride(e.mark_index, null)} className="rounded px-2 py-1 text-xs text-isaac-muted hover:text-isaac-text">Auto</button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
