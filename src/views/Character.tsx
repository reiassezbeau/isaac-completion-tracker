// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { Crosshair, Lock, Route } from "lucide-react";
import { api } from "../lib/api";
import { markClasses, markLabel, pct } from "../lib/format";
import { useT } from "../lib/useT";
import { Card, EmptyState, Pill, SectionTitle } from "../components/ui";
import { Glyph, Portrait, basePortraitId } from "../lib/art";
import type { CharacterDetail, CharacterListItem, CharacterStats } from "../lib/types";

function CharGrid({
  chars,
  selected,
  onSelect,
}: {
  chars: CharacterListItem[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const groups: [string, CharacterListItem[]][] = [
    [t("grid.characters"), chars.filter((c) => c.kind === "regular")],
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
                    ? "border-isaac-dried/60 bg-isaac-dried/10"
                    : "border-isaac-border bg-isaac-surface hover:border-isaac-border-strong"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Portrait id={basePortraitId(c.id)} size={22} tainted={c.kind === "tainted"} />
                  <span className="truncate font-medium">{c.name}</span>
                  {!c.unlocked && <Lock className="ml-auto h-3 w-3 flex-shrink-0 text-isaac-faint" />}
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
  const t = useT();
  const [chars, setChars] = useState<CharacterListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [stats, setStats] = useState<CharacterStats | null>(null);

  useEffect(() => {
    api.getCharacters().then((c) => {
      setChars(c);
      if (!selected && c.length) setSelected(c[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) {
      api.getCharacter(selected).then(setDetail);
      api.getCharacterStats(selected).then(setStats).catch(() => setStats(null));
    }
  }, [selected]);

  if (!chars) return null;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_1fr]">
      <div>
        <SectionTitle>{t("grid.characters")}</SectionTitle>
        <CharGrid chars={chars} selected={selected} onSelect={setSelected} />
      </div>

      <div>
        {!detail ? (
          <EmptyState title={t("char.select")} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="flex items-center gap-3 font-display text-3xl text-isaac-text">
                  <Portrait id={basePortraitId(detail.id)} size={38} tainted={detail.kind === "tainted"} />
                  {detail.name}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <Pill className="border-isaac-border bg-isaac-surface2 text-isaac-muted">
                    {detail.kind === "tainted" ? "Tainted" : t("char.regular")}
                  </Pill>
                  {!detail.character_unlocked && (
                    <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90">
                      <Lock className="h-3 w-3" /> {t("char.locked")}
                    </Pill>
                  )}
                </div>
              </div>
            </div>

            {stats && stats.runs > 0 && (
              <Card>
                <SectionTitle hint={t("char.fromMod")}>
                  <span className="inline-flex items-center gap-1">
                    <Crosshair className="h-4 w-4 text-isaac-blood" /> {t("char.gameStats")}
                  </span>
                </SectionTitle>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-isaac-muted">{t("char.runs")}</div>
                    <div className="text-lg font-bold">{stats.runs}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-isaac-muted">{t("char.winrate")}</div>
                    <div className="text-lg font-bold text-isaac-done">{pct(stats.winrate)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-isaac-muted">{t("char.hitsPerRun")}</div>
                    <div className="text-lg font-bold text-isaac-blood">{stats.avg_hits.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-isaac-muted">{t("char.record")}</div>
                    <div className="text-lg font-bold text-isaac-gold">{stats.min_hits ?? "—"}</div>
                  </div>
                </div>
              </Card>
            )}

            {!detail.marks_reliable && (
              <div className="rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-2 text-sm text-isaac-text">
                {t("char.marksUnreliable")}
              </div>
            )}

            <Card>
              <SectionTitle hint={t("char.marksLegend")}>{t("char.completionMarks")}</SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {detail.marks.map((m) => (
                  <div
                    key={m.ending_id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${markClasses(
                      m.status,
                    )}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex flex-shrink-0">
                        <Glyph id={m.ending_id} size={16} />
                      </span>
                      <span className="truncate">{m.ending_name}</span>
                    </span>
                    <span className="ml-2 flex-shrink-0 text-xs font-semibold">
                      {markLabel(m.status, t)}
                      {m.overridden && " *"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>{t("char.todoTitle")}</SectionTitle>
              {detail.todo.length === 0 ? (
                <p className="text-sm text-isaac-done">{t("char.allHard")}</p>
              ) : (
                <div className="space-y-3">
                  {detail.todo.map((td) => (
                    <div
                      key={td.ending_id}
                      className="rounded-lg border border-isaac-border bg-isaac-surface2/40 p-3"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <strong>{td.ending_name}</strong>
                        <span className="text-xs text-isaac-muted">
                          {td.needs_hard ? t("char.redoHard") : t("char.markToGet")}
                        </span>
                      </div>
                      {td.unlocks.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-isaac-muted">
                          {td.unlocks.map((u) => (
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
                    <Route className="h-4 w-4" /> {t("char.routingTips")}
                  </span>
                </SectionTitle>
                <div className="space-y-2">
                  {detail.routing_tips.map((rt) => (
                    <div key={rt.id} className="text-sm">
                      <div className="font-medium text-isaac-text">{rt.title}</div>
                      <div className="text-isaac-muted">{rt.text}</div>
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
