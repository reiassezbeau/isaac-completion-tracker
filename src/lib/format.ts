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

export function markLabel(d: MarkDifficulty): string {
  switch (d) {
    case "hard":
      return "Hard";
    case "normal":
      return "Normal";
    default:
      return "À faire";
  }
}

/** Classes Tailwind pour un badge de mark. */
export function markClasses(d: MarkDifficulty): string {
  switch (d) {
    case "hard":
      return "bg-isaac-gold/15 text-isaac-gold border-isaac-gold/40";
    case "normal":
      return "bg-isaac-done/15 text-isaac-done border-isaac-done/40";
    default:
      return "bg-isaac-blood/10 text-isaac-blood/90 border-isaac-blood/30";
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
