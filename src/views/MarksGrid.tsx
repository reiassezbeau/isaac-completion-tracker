// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api } from "../lib/api";
import { Card } from "../components/ui";
import { Glyph, Sigil, baseSigilId } from "../lib/art";
import { markLabel } from "../lib/format";
import { useT } from "../lib/useT";
import type { MarkDifficulty, MarksMatrix, MatrixChar, MatrixEnding } from "../lib/types";

const SIZE = 22;
const GAP = 4;

function cellStyle(status: MarkDifficulty, locked: boolean): CSSProperties {
  const base: CSSProperties = {
    width: SIZE,
    height: SIZE,
    borderRadius: Math.round(SIZE * 0.28),
    flexShrink: 0,
    opacity: locked ? 0.4 : 1,
  };
  if (status === "hard")
    return { ...base, background: "rgb(var(--i-gold))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.22), 0 0 10px -3px rgb(var(--i-gold) / .85)" };
  if (status === "normal")
    return { ...base, background: "rgb(var(--i-jade) / .08)", boxShadow: "inset 0 0 0 2.2px rgb(var(--i-jade))" };
  return { ...base, background: "rgb(var(--i-surface2))", boxShadow: "inset 0 0 0 1px rgb(var(--i-border))" };
}

function Block({
  title,
  accent,
  chars,
  rows,
  endings,
}: {
  title: string;
  accent: string;
  chars: MatrixChar[];
  rows: MarkDifficulty[][];
  endings: MatrixEnding[];
}) {
  const t = useT();
  const totalHard = chars.reduce((a, c) => a + c.hard, 0);
  const colHard = endings.map((_, j) => rows.reduce((a, r) => a + (r[j] === "hard" ? 1 : 0), 0));
  const cols = `150px repeat(${endings.length}, ${SIZE}px) 30px`;

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-isaac-border pb-2">
        <span className={`text-[0.72rem] font-semibold uppercase tracking-[0.2em] ${accent}`}>{title}</span>
        <span className="font-mono text-xs text-isaac-faint">
          {totalHard} / {chars.length * endings.length} Hard
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: GAP, alignItems: "center", width: "max-content" }}>
        {/* headers: ending glyphs */}
        <div />
        {endings.map((e) => (
          <div key={e.id} title={e.name} className="flex justify-center text-isaac-faint">
            <Glyph id={e.id} size={16} filter="wob2" />
          </div>
        ))}
        <div />

        {/* lignes : sigil + nom + 12 cellules + compte */}
        {chars.map((c, i) => (
          <MatrixRow key={c.id + i} char={c} statuses={rows[i]} endings={endings} />
        ))}

        {/* column totals */}
        <div className="pt-1 text-right font-mono text-[0.6rem] uppercase tracking-wider text-isaac-faint">{t("grid.perCol")}</div>
        {colHard.map((n, j) => {
          const full = n === chars.length;
          const color = full ? "text-isaac-gold" : n >= chars.length * 0.6 ? "text-isaac-muted" : "text-isaac-blood-light";
          return (
            <div key={j} className={`pt-1 text-center font-mono text-[0.62rem] tabular-nums ${color}`} title={`${endings[j].name} — ${n}/${chars.length} Hard`}>
              {n}
            </div>
          );
        })}
        <div />
      </div>
    </div>
  );
}

function MatrixRow({ char, statuses, endings }: { char: MatrixChar; statuses: MarkDifficulty[]; endings: MatrixEnding[] }) {
  const t = useT();
  const full = char.hard === endings.length;
  return (
    <>
      <div className="flex min-w-0 items-center gap-2 pr-2">
        <Sigil id={baseSigilId(char.id)} size={20} tainted={char.kind === "tainted"} />
        <span className={`truncate text-xs ${full ? "text-isaac-gold" : char.unlocked ? "text-isaac-muted" : "text-isaac-faint/70"}`}>{char.name}</span>
      </div>
      {statuses.map((s, j) => (
        <div key={j} style={cellStyle(s, !char.unlocked)} title={`${char.name} · ${endings[j].name} — ${markLabel(s, t)}`} />
      ))}
      <div className={`text-right font-mono text-[0.62rem] tabular-nums ${full ? "text-isaac-gold" : "text-isaac-faint"}`}>
        {String(char.hard).padStart(2, "0")}
      </div>
    </>
  );
}

export function MarksGridView() {
  const t = useT();
  const [matrix, setMatrix] = useState<MarksMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMarksMatrix().then(setMatrix).catch((e) => setError(String(e)));
  }, []);

  const split = useMemo(() => {
    if (!matrix) return null;
    const reg: number[] = [];
    const tai: number[] = [];
    matrix.characters.forEach((c, i) => (c.kind === "tainted" ? tai : reg).push(i));
    const pick = (idx: number[]) => ({
      chars: idx.map((i) => matrix.characters[i]),
      rows: idx.map((i) => matrix.cells[i]),
    });
    return { regular: pick(reg), tainted: pick(tai) };
  }, [matrix]);

  if (error) return <p className="text-sm text-isaac-blood-light">{error}</p>;
  if (!matrix || !split) return null;

  const done = matrix.characters.reduce((a, c) => a + c.hard, 0);
  const total = matrix.characters.length * matrix.endings.length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-isaac-text">{t("nav.grid")}</h1>
        <p className="mt-1 text-sm text-isaac-muted">
          {t("grid.subtitle")} — {done} / {total} Hard. {t("grid.legendHint")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-isaac-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded" style={cellStyle("hard", false)} /> {t("mark.hard")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded" style={cellStyle("normal", false)} /> {t("mark.normal")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded" style={cellStyle("none", false)} /> {t("mark.todo")}
        </span>
        <span className="text-isaac-faint">{t("grid.hoverHint")}</span>
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        <Card>
          <Block title={t("grid.characters")} accent="text-isaac-muted" endings={matrix.endings} {...split.regular} />
        </Card>
        <Card>
          <Block title="Tainted" accent="text-isaac-blood-light" endings={matrix.endings} {...split.tainted} />
        </Card>
      </div>
    </div>
  );
}
