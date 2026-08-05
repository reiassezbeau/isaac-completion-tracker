// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Info, Skull, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { Card, EmptyState, Pill, SectionTitle } from "../components/ui";
import type { Character, Ending, Prediction, TargetSuggestion } from "../lib/types";

export function PredictorView() {
  const [chars, setChars] = useState<Character[]>([]);
  const [endings, setEndings] = useState<Ending[]>([]);
  const [charId, setCharId] = useState("isaac");
  const [targetId, setTargetId] = useState("mother");
  const [result, setResult] = useState<Prediction | null>(null);
  const [best, setBest] = useState<TargetSuggestion[]>([]);

  useEffect(() => {
    api.getCharactersStatic().then(setChars);
    api.getEndings().then(setEndings);
    api.nextTargets(12).then(setBest);
  }, []);

  useEffect(() => {
    if (charId && targetId) api.predict(charId, targetId).then(setResult).catch(() => setResult(null));
  }, [charId, targetId]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <SectionTitle>« Si je fais X avec Y »</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={charId}
            onChange={(e) => setCharId(e.target.value)}
            className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2 text-sm outline-none focus:border-isaac-blood/60"
          >
            {chars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ArrowRight className="h-4 w-4 text-isaac-muted" />
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2 text-sm outline-none focus:border-isaac-blood/60"
          >
            {endings.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {result && (
          <div className="mt-4 space-y-3">
            <div
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                result.new_unlocks.length > 0
                  ? "border-isaac-done/40 bg-isaac-done/10"
                  : "border-isaac-border bg-isaac-surface2/50"
              }`}
            >
              {result.new_unlocks.length > 0 ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-done" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-muted" />
              )}
              <span>{result.note}</span>
            </div>

            {result.new_unlocks.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-isaac-muted">
                  Débloque
                </div>
                <ul className="space-y-1 text-sm">
                  {result.new_unlocks.map((u) => (
                    <li key={u.id} className="flex items-baseline gap-2">
                      <span className="text-isaac-gold">✦</span>
                      <span>
                        <strong>{u.name}</strong> — {u.reward}
                        <span className="text-isaac-muted"> · {u.unlock_text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.already_unlocked.length > 0 && (
              <div className="text-xs text-isaac-muted">
                Déjà débloqué via ce combo : {result.already_unlocked.map((a) => a.name).join(", ")}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Skull className="h-4 w-4 text-isaac-blood" />
              {result.advances_dead_god ? (
                <span>
                  Rapproche de <strong className="text-isaac-gold">Dead God</strong> — marque «{" "}
                  {result.target_name} » actuellement <em>{result.current_mark}</em>, à passer en Hard.
                </span>
              ) : (
                <span className="text-isaac-muted">Marque déjà en Hard — pas de gain Dead God.</span>
              )}
            </div>
          </div>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-xs text-isaac-muted">
          <Info className="h-3 w-3" /> Les succès cumulatifs / de pickup ne sont pas prédits ici — vois le
          navigateur des succès.
        </p>
      </Card>

      <Card>
        <SectionTitle hint="classé par déblocages">Quoi faire ensuite pour un max de déblocages ?</SectionTitle>
        {best.length === 0 ? (
          <EmptyState title="Rien à suggérer — bien joué !" />
        ) : (
          <div className="space-y-2">
            {best.map((t, i) => (
              <button
                key={i}
                onClick={() => {
                  setCharId(t.character_id);
                  setTargetId(t.target_id);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-isaac-border bg-isaac-surface2/40 px-4 py-2 text-left text-sm transition-colors hover:border-isaac-blood/40"
              >
                <span>
                  <strong>{t.character_name}</strong> → {t.target_name}
                </span>
                <span className="flex items-center gap-2">
                  {t.new_unlocks > 0 && (
                    <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">
                      +{t.new_unlocks}
                    </Pill>
                  )}
                  {t.fills_hard_mark && (
                    <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90">
                      Hard
                    </Pill>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
