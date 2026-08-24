// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * tools/build-knowledge/derive-items.ts — DERIVES a knowledge-base entry for every
 * collectible, from the community wiki's Items table (DEV-TIME, internet allowed).
 *
 * WHY THIS EXISTS
 * The hand-curated base covered 59 items out of 719. Measured against 25 real runs,
 * the build assistant could analyse 5.3% of the items actually picked up: it kept
 * answering "30 items not in the knowledge base". Curating 719 by hand is not
 * realistic, so classification is derived and the curated entries stay authoritative.
 *
 * THE RULE THAT SHAPES THIS FILE
 * An invented fact is worse than an absent one, because players act on it. So every
 * pattern below is anchored on explicit wording, and anything ambiguous yields
 * NOTHING rather than a guess. A magnitude is only recorded when the description
 * states it with a sign and a unit; "increases damage" alone sets the role and stops
 * there. Derived entries are marked `curated: false` so the app can say where a
 * number came from.
 *
 * NO ripped asset and no copied prose: the description is READ to classify, and is
 * never stored or shown. Only ids, roles, flags and numbers cross over.
 */
import type { Item, Role, Dim, TearFlag, Complexity, StatEffect } from "./build-item-kb.js";

const WIKI_API =
  "https://bindingofisaacrebirth.wiki.gg/api.php?action=parse&page=Items&prop=text&format=json&formatversion=2";
const UA = "isaac-completion-tracker/0.4 (+https://github.com/reiassezbeau/isaac-completion-tracker)";

export interface WikiRow {
  id: number;
  name: string;
  description: string;
  quality: number | null;
}

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------

/** Strips tags and decodes the handful of entities the table actually uses. */
function text(html: string): string {
  return html
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWikiRows(): Promise<WikiRow[]> {
  const res = await fetch(WIKI_API, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`wiki HTTP ${res.status}`);
  const html: string = (await res.json())?.parse?.text ?? "";

  const rows: WikiRow[] = [];
  const seen = new Set<number>();
  // Only the collectible rows; the page also carries navigation and legend tables.
  for (const rowHtml of html.split(/<tr[^>]*class="row-collectible"[^>]*>/i).slice(1)) {
    // Split BEFORE the tag, not after it: `<td data-sort-value="118">` carries the
    // value we need inside its opening tag, and consuming the tag throws it away.
    const cells = rowHtml
      .split(/<td/i)
      .slice(1)
      .map((c) => "<td" + (c.split(/<\/td>/i)[0] ?? ""));
    if (cells.length < 4) continue;

    let id: number | null = null;
    let name: string | null = null;
    for (const cell of cells) {
      const sort = cell.match(/data-sort-value="([^"]*)"/i)?.[1];
      if (name === null) {
        const link = cell.match(/<a[^>]*title="([^"]+)"/i)?.[1];
        if (link) {
          name = text(link);
          continue;
        }
        if (sort && !/^\d+$/.test(sort)) {
          name = text(sort);
          continue;
        }
      }
      if (name !== null && id === null && sort && /^\d{1,4}$/.test(sort)) {
        id = Number(sort);
      }
    }
    if (id === null || id <= 0 || name === null || seen.has(id)) continue;

    const bodies = cells.map((c) => text(c.replace(/^<td[^>]*>/i, "")));
    const last = bodies[bodies.length - 1] ?? "";
    const quality = /^[0-4]$/.test(last) ? Number(last) : null;

    // The flavour quote sits in its own <i> cell and the description is the next
    // one. Taking "the longest cell" instead looked fine until Transcendence,
    // whose real description is three words: it returned the quote, "We all float
    // down here...", and the item lost its flight.
    const quoteAt = cells.findIndex((c) => /<i>/i.test(c));
    const description =
      quoteAt >= 0 && bodies[quoteAt + 1] !== undefined
        ? bodies[quoteAt + 1]
        : bodies.slice(2, quality === null ? undefined : -1)
            .reduce((a, b) => (b.length > a.length ? b : a), "");

    seen.add(id);
    rows.push({ id, name, description, quality });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Derivation - every pattern anchored, nothing inferred
// ---------------------------------------------------------------------------

/**
 * Stat magnitudes. Each entry needs an explicit sign AND the stat's own word, so
 * "+1 damage" is taken and "increases damage" is not. `up to`, `per`, `every` and
 * `chance` guard against numbers that are a ceiling or a rate rather than a delta.
 */
const FLAT: { dim: Dim; re: RegExp }[] = [
  { dim: "damage", re: /([+-]\s?\d+(?:\.\d+)?)\s*damage\b/i },
  { dim: "fire_rate", re: /([+-]\s?\d+(?:\.\d+)?)\s*tears\b/i },
  { dim: "range", re: /([+-]\s?\d+(?:\.\d+)?)\s*range\b/i },
  { dim: "shot_speed", re: /([+-]\s?\d+(?:\.\d+)?)\s*shot\s?speed\b/i },
  { dim: "speed", re: /([+-]\s?\d+(?:\.\d+)?)\s*speed\b/i },
  { dim: "luck", re: /([+-]\s?\d+(?:\.\d+)?)\s*luck\b/i },
];
const MULT: { dim: Dim; re: RegExp }[] = [
  { dim: "damage", re: /(?:multiplies|multiplied)\s+(?:Isaac's\s+)?damage\s+by\s+(\d+(?:\.\d+)?)/i },
  { dim: "damage", re: /damage\s+is\s+multiplied\s+by\s+(\d+(?:\.\d+)?)/i },
  { dim: "damage", re: /\bx\s?(\d+(?:\.\d+)?)\s*damage\b/i },
];
/** A number that is a bound or a rate, not a flat delta. */
const NOT_A_DELTA = /\b(up to|per\s|every\s|chance|maximum|max\.|%\s*)/i;

const TEAR_WORDS: { flag: TearFlag; re: RegExp }[] = [
  { flag: "homing", re: /\bhoming\b/i },
  { flag: "piercing", re: /\bpiercing\b|\bpierces?\s+(?:through|enemies)\b/i },
  { flag: "spectral", re: /\bspectral\b/i },
  { flag: "explosive", re: /\bexplosive tears\b|\btears?\s+(?:that\s+)?explode/i },
];

// The wiki phrases a weapon swap five different ways; matching only one of them
// left Epic Fetus, Technology 2, Monstro's Lung and Ludovico looking like ordinary
// items, which is exactly the conflict the assistant exists to warn about.
const REPLACES =
  /\breplaces?\s+(?:the\s+|normal\s+|Isaac's\s+)*tears\b|\btears?\s+(?:are|is)\s+replaced\b|\binstead of (?:firing\s+)?tears\b|\bin place of (?:Isaac's )?tears\b/i;
const FLIGHT = /\bflight\b/i;
/** Wording that makes a grant situational rather than permanent. */
const CONDITIONAL_CLAUSE = /\b(while|when|if|after|upon|once|during|as long as)\b/i;
const FAMILIAR = /\bfamiliars?\b|\bfollows? Isaac\b/i;
// The wiki writes containers both ways: "+1 heart container" and "Grants one full
// Red Heart container". Missing the worded form left Breakfast with no hearts and
// no defensive role at all.
const HEART_CONTAINER =
  /([+-]?\s?\d+|one|two|three|a|an)\s+(?:full\s+)?(?:red\s+)?(?:empty\s+)?heart containers?\b/i;
const WORDED: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };
/** "damage taken", "damage from spikes": the word is there, the offence is not. */
const DAMAGE_TAKEN = /\bdamage\s+(taken|from)\b|\btakes?\s+damage\b|\bnegates?\b/i;
const DEFENSIVE =
  /\b(heart containers?|soul hearts?|eternal hearts?|black hearts?|invulnerab|shield|immune|protect|negates?)\b/i;

const PROC = /\b(chance|randomly|at random|occasionally)\b/i;
const CONDITIONAL =
  /\b(when|while|upon|after|if |on kill|each room|per room|charges?|activat|the more|scales?)\b/i;

function num(s: string): number {
  return Number(s.replace(/\s/g, ""));
}

/**
 * Turns one wiki row into a knowledge-base entry.
 *
 * Never returns `undefined`: an item we can say little about is still worth
 * registering with its name and a role, because the alternative is the assistant
 * dropping it from the analysis entirely.
 */
export function deriveItem(row: WikiRow): Item {
  const d = row.description;
  const roles = new Set<Role>();

  const stat_effects: Partial<Record<Dim, StatEffect>> = {};
  if (!NOT_A_DELTA.test(d)) {
    for (const { dim, re } of FLAT) {
      const m = d.match(re);
      // "+1 shot speed" also matches the looser /speed/ pattern, so the more
      // specific dimension wins and the generic one is skipped.
      if (m && !(dim === "speed" && /shot\s?speed/i.test(m[0]))) {
        stat_effects[dim] = { op: "flat", value: num(m[1]) };
      }
    }
  }
  for (const { dim, re } of MULT) {
    const m = d.match(re);
    if (m && stat_effects[dim] === undefined) {
      stat_effects[dim] = { op: "mult", value: num(m[1]) };
    }
  }

  const grants_tear_flags = TEAR_WORDS.filter(({ re }) => re.test(d)).map(({ flag }) => flag);
  const is_tears_replacement = REPLACES.test(d);
  // Empty Vessel grants flight *while Isaac has no red hearts*. Reading the word
  // alone would have the assistant announce flight this build does not have, which
  // is the same lie in the other direction.
  const flightClause = d.split(/(?<=\.)\s+/).find((c) => FLIGHT.test(c)) ?? "";
  const grants_flight = flightClause !== "" && !CONDITIONAL_CLAUSE.test(flightClause);
  const is_familiar = FAMILIAR.test(d);
  const heartsMatch = d.match(HEART_CONTAINER);
  const hearts = heartsMatch
    ? (WORDED[heartsMatch[1].toLowerCase().trim()] ?? num(heartsMatch[1]))
    : undefined;

  // "Damage" alone is not offence when the sentence is about damage RECEIVED -
  // that is how Holy Mantle, a pure shield, came out classed as offensive.
  const offensiveWord = /\bdamage\b|\btears\b/i.test(d) && !DAMAGE_TAKEN.test(d);
  if (stat_effects.damage || stat_effects.fire_rate || offensiveWord) {
    roles.add("offensive");
  }
  if (hearts !== undefined || DEFENSIVE.test(d)) {
    roles.add("defensive");
  }
  if (grants_flight || stat_effects.speed || /\b(teleport|dash|speed)\b/i.test(d)) {
    roles.add("mobility");
  }
  if (grants_tear_flags.length > 0 || is_tears_replacement) roles.add("tear_mod");
  if (is_familiar) roles.add("familiar");
  if (roles.size === 0) roles.add("utility");

  const complexity: Complexity = PROC.test(d)
    ? "proc"
    : CONDITIONAL.test(d) || is_tears_replacement
      ? "conditional"
      : "flat";

  return {
    id: row.id,
    name: row.name,
    roles: [...roles],
    ...(Object.keys(stat_effects).length > 0 ? { stat_effects } : {}),
    ...(grants_tear_flags.length > 0 ? { grants_tear_flags } : {}),
    ...(grants_flight ? { grants_flight: true } : {}),
    ...(is_tears_replacement ? { is_tears_replacement: true } : {}),
    ...(is_familiar ? { is_familiar: true } : {}),
    ...(hearts !== undefined ? { hearts } : {}),
    ...(row.quality !== null ? { quality: row.quality } : {}),
    complexity,
    curated: false,
  };
}
