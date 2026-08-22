// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import type { MarkDifficulty } from "./types";

export const GITHUB_URL = "https://github.com/reiassezbeau";
export const GITHUB_HANDLE = "reiassezbeau";

export const DLC_LABELS: Record<string, string> = {
  rebirth: "Rebirth",
  afterbirth: "Afterbirth",
  afterbirth_plus: "Afterbirth †",
  repentance: "Repentance",
  repentance_plus: "Repentance+",
};

export const CATEGORY_LABELS: Record<string, string> = {
  character: "Personnages",
  item: "Objets",
  trinket: "Breloques",
  pill: "Pilules",
  card: "Cartes / Runes",
  coop_baby: "Bébés co-op",
  challenge: "Challenges",
  completion_mark: "Completion marks",
  boss: "Boss",
  misc: "Divers",
};

export function dlcLabel(dlc: string): string {
  return DLC_LABELS[dlc] ?? dlc;
}

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

export function markLabel(d: MarkDifficulty, t?: (k: string) => string): string {
  const key = d === "hard" ? "mark.hard" : d === "normal" ? "mark.normal" : "mark.todo";
  if (t) return t(key);
  return d === "hard" ? "Hard" : d === "normal" ? "Normal" : "To do";
}

/** Classes Tailwind pour un badge de mark (or = Hard, jade = Normal, creux = à faire). */
export function markClasses(d: MarkDifficulty): string {
  switch (d) {
    case "hard":
      return "bg-isaac-gold/10 text-isaac-gold border-isaac-gold/40";
    case "normal":
      return "bg-jade-500/10 text-isaac-done border-jade-600/50";
    default:
      // « à faire » = creux et discret (jamais un mur de rouge), cf. DA v2
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

export function stageLabel(stage: number): string {
  return STAGE_NAMES[stage] ?? `Étage ${stage}`;
}

/** Clé "stage-type" (ex. "2-2") → nom lisible. */
export function stageKeyLabel(key: string): string {
  const n = parseInt(key.split("-")[0] ?? "", 10);
  return Number.isFinite(n) ? stageLabel(n) : key;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function editionLabel(e: string | null): string {
  if (e === "repentanceplus") return "Repentance+";
  if (e === "repentance") return "Repentance";
  return "—";
}

// -- Assistant de build -----------------------------------------------------

export const ROLE_LABELS: Record<string, string> = {
  offensive: "Offensif",
  defensive: "Défensif",
  mobility: "Mobilité",
  tear_mod: "Modif. de tirs",
  utility: "Utilitaire",
  familiar: "Familier",
};

export const TEAR_FLAG_LABELS: Record<string, string> = {
  homing: "homing",
  piercing: "perçant",
  spectral: "spectral",
  explosive: "explosif",
};

export const STAT_DIM_LABELS: Record<string, string> = {
  damage: "Dégâts",
  fire_rate: "Cadence",
  range: "Portée",
  shot_speed: "Vél. tir",
  speed: "Vitesse",
  luck: "Chance",
};

export function roleLabel(r: string): string {
  return ROLE_LABELS[r] ?? r;
}
export function tearFlagLabel(f: string): string {
  return TEAR_FLAG_LABELS[f] ?? f;
}
export function statDimLabel(d: string): string {
  return STAT_DIM_LABELS[d] ?? d;
}

export function complexityLabel(c: string): string {
  if (c === "flat") return "delta fiable";
  if (c === "proc") return "à proc";
  if (c === "conditional") return "conditionnel";
  return c;
}

export const VERDICT_META: Record<string, { label: string; tone: "done" | "gold" | "blood" | "muted" }> = {
  strong_pickup: { label: "Bon pick", tone: "done" },
  fills_gap: { label: "Comble un trou", tone: "gold" },
  situational: { label: "Situationnel", tone: "muted" },
  redundant_or_conflict: { label: "Conflit / redondant", tone: "blood" },
};
