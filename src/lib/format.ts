// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import type { MarkDifficulty } from "./types";

/** The translation function returned by `useT()` (optional on every label helper). */
type Tr = (k: string) => string;

/** App version shown in the UI. Keep in sync with package.json, Cargo.toml and tauri.conf.json. */
export const APP_VERSION = "0.5.0";

export const GITHUB_URL = "https://github.com/reiassezbeau";
export const GITHUB_HANDLE = "reiassezbeau";
/** Community server: help, bug reports, and completion talk. */
export const DISCORD_URL = "https://discord.gg/53NyaVUE73";

export const DLC_LABELS: Record<string, string> = {
  rebirth: "Rebirth",
  afterbirth: "Afterbirth",
  afterbirth_plus: "Afterbirth †",
  repentance: "Repentance",
  repentance_plus: "Repentance+",
};

export const CATEGORY_LABELS: Record<string, string> = {
  character: "Characters",
  item: "Items",
  trinket: "Trinkets",
  pill: "Pills",
  card: "Cards / Runes",
  coop_baby: "Co-op babies",
  challenge: "Challenges",
  completion_mark: "Completion marks",
  boss: "Boss",
  misc: "Misc",
};

export function dlcLabel(dlc: string): string {
  return DLC_LABELS[dlc] ?? dlc;
}

/** Translated label, falling back to the English map then to the raw key. */
function tr(t: Tr | undefined, key: string, fallback: string): string {
  if (!t) return fallback;
  const s = t(key);
  return s === key ? fallback : s;
}

export function categoryLabel(cat: string, t?: Tr): string {
  return tr(t, `cat.${cat}`, CATEGORY_LABELS[cat] ?? cat);
}

export function markLabel(d: MarkDifficulty, t?: Tr): string {
  const key = d === "hard" ? "mark.hard" : d === "normal" ? "mark.normal" : "mark.todo";
  if (t) return t(key);
  return d === "hard" ? "Hard" : d === "normal" ? "Normal" : "To do";
}

/** Tailwind classes for a mark badge (gold = Hard, jade = Normal, hollow = to do). */
export function markClasses(d: MarkDifficulty): string {
  switch (d) {
    case "hard":
      return "bg-isaac-gold/10 text-isaac-gold border-isaac-gold/40";
    case "normal":
      return "bg-jade-500/10 text-isaac-done border-jade-600/50";
    default:
      // "to do" = hollow and discreet (never a wall of red), see art direction v2
      return "bg-isaac-surface2 text-isaac-faint border-isaac-border";
  }
}

const STAGE_NAMES: Record<number, string> = {
  1: "Basement I",
  2: "Basement II",
  3: "Caves I",
  4: "Caves II",
  5: "Depths I",
  6: "Depths II",
  7: "Womb I",
  8: "Womb II",
  9: "Blue Womb",
  10: "Sheol / Cathedral",
  11: "Dark Room / Chest",
  12: "The Void",
  13: "Home",
};

export function stageLabel(stage: number, t?: Tr): string {
  return STAGE_NAMES[stage] ?? `${tr(t, "stage.floor", "Floor")} ${stage}`;
}

/** "stage-type" key (e.g. "2-2") -> readable name. */
export function stageKeyLabel(key: string, t?: Tr): string {
  const n = parseInt(key.split("-")[0] ?? "", 10);
  return Number.isFinite(n) ? stageLabel(n, t) : key;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function editionLabel(e: string | null): string {
  if (e === "repentanceplus") return "Repentance+";
  if (e === "repentance") return "Repentance";
  return "—";
}

// -- Build assistant -----------------------------------------------------

export const ROLE_LABELS: Record<string, string> = {
  offensive: "Offensive",
  defensive: "Defensive",
  mobility: "Mobility",
  tear_mod: "Tear modifier",
  utility: "Utility",
  familiar: "Familiar",
};

export const TEAR_FLAG_LABELS: Record<string, string> = {
  homing: "homing",
  piercing: "piercing",
  spectral: "spectral",
  explosive: "explosive",
};

export const STAT_DIM_LABELS: Record<string, string> = {
  damage: "Damage",
  fire_rate: "Fire rate",
  range: "Range",
  shot_speed: "Shot speed",
  speed: "Speed",
  luck: "Luck",
};

export function roleLabel(r: string, t?: Tr): string {
  return tr(t, `role.${r}`, ROLE_LABELS[r] ?? r);
}
export function tearFlagLabel(f: string, t?: Tr): string {
  return tr(t, `tflag.${f}`, TEAR_FLAG_LABELS[f] ?? f);
}
export function statDimLabel(d: string, t?: Tr): string {
  return tr(t, `stat.${d}`, STAT_DIM_LABELS[d] ?? d);
}

/**
 * Render a backend `Note` into a sentence in the user's language.
 *
 * The analysis used to arrive from Rust as finished English prose, which the view
 * printed as-is - so the strengths/weaknesses panel stayed English in all 13
 * languages. The backend now sends a code plus its values and the wording lives in
 * the catalogue; this puts the two back together.
 *
 * `flag` / `flags` carry raw tear-flag ids and are translated on the way in, so
 * "homing" becomes the localized word rather than leaking the id.
 */
export function noteText(note: { code: string; params?: Record<string, string> }, t: Tr): string {
  let s = t(`bldn.${note.code}`);
  for (const [k, raw] of Object.entries(note.params ?? {})) {
    const v =
      k === "flag" || k === "flags"
        ? raw.split(", ").map((f) => tearFlagLabel(f, t)).join(", ")
        : raw;
    s = s.split(`{${k}}`).join(v);
  }
  return s;
}

export function verdictLabel(verdict: string, t?: Tr): string {
  const meta = VERDICT_META[verdict] ?? VERDICT_META.situational;
  return tr(t, `verdict.${verdict}`, meta.label);
}

export const VERDICT_META: Record<string, { label: string; tone: "done" | "gold" | "blood" | "muted" }> = {
  strong_pickup: { label: "Strong pick", tone: "done" },
  fills_gap: { label: "Fills a gap", tone: "gold" },
  situational: { label: "Situational", tone: "muted" },
  redundant_or_conflict: { label: "Conflict / redundant", tone: "blood" },
};
