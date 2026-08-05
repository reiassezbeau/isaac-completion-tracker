// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { Lock, Route } from "lucide-react";
import { api } from "../lib/api";
import { markClasses, markLabel } from "../lib/format";
import { Card, EmptyState, Pill, SectionTitle } from "../components/ui";
import type { CharacterDetail, CharacterListItem } from "../lib/types";

function CharGrid({
  chars,
  selected,
  onSelect,
}: {
  chars: CharacterListItem[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const groups: [string, CharacterListItem[]][] = [
    ["Personnages", chars.filter((c) => c.kind === "regular")],
    ["Tainted", chars.filter((c) => c.kind === "tainted")],
  ];
  return (
    <div className="space-y-4">
      {groups.map(([label, list]) => (
        <div key={label}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-isaac-muted">
            {label}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected === c.id
                    ? "border-isaac-blood/60 bg-isaac-blood/10"
                    : "border-isaac-border bg-isaac-surface hover:border-isaac-border/80"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">{c.name}</span>
                  {!c.unlocked && <Lock className="h-3 w-3 flex-shrink-0 text-isaac-muted" />}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-isaac-surface2">
                    <div
                      className="h-full rounded-full bg-isaac-gold"
                      style={{ width: `${(c.marks_hard / c.marks_total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[0.65rem] text-isaac-muted">
                    {c.marks_hard}/{c.marks_total}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CharacterView() {
  const [chars, setChars] = useState<CharacterListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);

  useEffect(() => {
    api.getCharacters().then((c) => {
      setChars(c);
      if (!selected && c.length) setSelected(c[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) api.getCharacter(selected).then(setDetail);
  }, [selected]);

  if (!chars) return null;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_1fr]">
      <div>
        <SectionTitle>Personnages</SectionTitle>
        <CharGrid chars={chars} selected={selected} onSelect={setSelected} />
      </div>

      <div>
        {!detail ? (
          <EmptyState title="Sélectionne un personnage." />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{detail.name}</h1>
                <div className="mt-1 flex items-center gap-2">
                  <Pill className="border-isaac-border bg-isaac-surface2 text-isaac-muted">
                    {detail.kind === "tainted" ? "Tainted" : "Régulier"}
                  </Pill>
                  {!detail.character_unlocked && (
                    <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90">
                      <Lock className="h-3 w-3" /> Perso verrouillé
                    </Pill>
                  )}
                </div>
              </div>
            </div>

            {!detail.marks_reliable && (
              <div className="rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-2 text-sm text-isaac-text">
                Marks non fiables pour cette save — corrige-les manuellement dans ⚙️ Corrections.
              </div>
            )}

            <Card>
              <SectionTitle hint="vert = Normal · or = Hard">Completion marks</SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {detail.marks.map((m) => (
                  <div
                    key={m.ending_id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${markClasses(
                      m.status,
                    )}`}
                  >
                    <span className="truncate">{m.ending_name}</span>
                    <span className="ml-2 flex-shrink-0 text-xs font-semibold">
                      {markLabel(m.status)}
                      {m.overridden && " *"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>Ce qu'il te reste à faire</SectionTitle>
              {detail.todo.length === 0 ? (
                <p className="text-sm text-isaac-done">Tout est en Hard pour ce perso 🎉</p>
              ) : (
                <div className="space-y-3">
                  {detail.todo.map((t) => (
                    <div
                      key={t.ending_id}
                      className="rounded-lg border border-isaac-border bg-isaac-surface2/40 p-3"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <strong>{t.ending_name}</strong>
                        <span className="text-xs text-isaac-muted">
                          {t.needs_hard ? "Refaire en Hard (marque dorée)" : "Marque à obtenir"}
                        </span>
                      </div>
                      {t.unlocks.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-isaac-muted">
                          {t.unlocks.map((u) => (
                            <li key={u.id} className="flex items-baseline gap-2">
                              <span className="text-isaac-gold">→</span>
                              <span>
                                <span className="text-isaac-text">{u.name}</span> — {u.reward}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {detail.routing_tips.length > 0 && (
              <Card>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-4 w-4" /> Conseils de routing
                  </span>
                </SectionTitle>
                <div className="space-y-2">
                  {detail.routing_tips.map((t) => (
                    <div key={t.id} className="text-sm">
                      <div className="font-medium text-isaac-text">{t.title}</div>
                      <div className="text-isaac-muted">{t.text}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
