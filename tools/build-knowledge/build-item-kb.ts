// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * tools/build-knowledge/build-item-kb.ts - Compiler for the ITEM KNOWLEDGE BASE
 * (DEV-TIME). Source = hand-curated FACTUAL data (ids checked
 * against the official CollectibleType enum; effects documented on the wiki).
 *
 * ONE source -> TWO outputs (guardrail: never two copies of the knowledge):
 *   - src-tauri/resources/item_kb.json   (for the app, rich views)
 *   - isaac-tracker-mod/item_kb.lua      (for the mod, compact in-run computation)
 *
 * CONSTRAINTS (guardrails §3.4): NO ripped asset - no sprite, no
 * copying of EID prose. Facts only (ids, roles, stat deltas,
 * tear flags, tear replacement, complexity) + short notes written by us.
 *
 * The KB is deliberately PARTIAL and EXTENSIBLE: it covers first the items with
 * high value and high confidence (tear replacements = conflicts, tear flags,
 * flight, familiars, classic stat-ups). Regenerate with `npm run build:item-kb`.
 *
 * Created by reiassezbeau — https://github.com/reiassezbeau
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fetchWikiRows, deriveItem } from "./derive-items.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES = resolve(__dirname, "../../src-tauri/resources");
const MOD = resolve(__dirname, "../../isaac-tracker-mod");

// ---------------------------------------------------------------------------
// Vocabularies (validated at build time).
// ---------------------------------------------------------------------------
const ROLES = ["offensive", "defensive", "mobility", "tear_mod", "utility", "familiar"] as const;
const DIMS = ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"] as const;
const TEAR_FLAGS = ["homing", "piercing", "spectral", "explosive"] as const;
const COMPLEXITY = ["flat", "proc", "conditional"] as const;

export type Role = (typeof ROLES)[number];
export type Dim = (typeof DIMS)[number];
export type TearFlag = (typeof TEAR_FLAGS)[number];
export type Complexity = (typeof COMPLEXITY)[number];
export type StatEffect = { op: "flat" | "mult"; value: number };

export interface Item {
  id: number;
  name: string;
  roles: Role[];
  stat_effects?: Partial<Record<Dim, StatEffect>>;
  grants_tear_flags?: TearFlag[];
  grants_flight?: boolean;
  is_tears_replacement?: boolean;
  is_familiar?: boolean;
  /** delta of red heart containers (documented), when relevant. */
  hearts?: number;
  complexity: Complexity;
  /** short factual note, written by us (never EID prose). */
  note?: string;
  /** Item quality 0-4 as the wiki states it. */
  quality?: number;
  /** True for the hand-checked entries below; false for anything derived. The app
   *  says which, so a number nobody verified never passes for one that was. */
  curated?: boolean;
}

interface Synergy {
  a: number;
  b: number;
  type: "strong" | "weak" | "dangerous";
  text: string;
}

// ---------------------------------------------------------------------------
// FACTUAL SOURCE (curated). ids = CollectibleType enum (verified).
// ---------------------------------------------------------------------------
const CURATED: Item[] = [
  { id: 1, name: "Sad Onion", roles: ["offensive"], stat_effects: { fire_rate: { op: "flat", value: 0.7 } }, complexity: "flat" },
  { id: 2, name: "The Inner Eye", roles: ["offensive", "tear_mod"], stat_effects: { fire_rate: { op: "mult", value: 0.51 } }, complexity: "flat", note: "Triple shot, heavily reduced fire rate." },
  { id: 3, name: "Spoon Bender", roles: ["tear_mod"], grants_tear_flags: ["homing"], complexity: "flat", note: "Grants homing tears." },
  { id: 4, name: "Cricket's Head", roles: ["offensive"], stat_effects: { damage: { op: "mult", value: 1.5 } }, complexity: "flat", note: "Damage multiplier (approximate)." },
  { id: 6, name: "Number One", roles: ["offensive"], stat_effects: { fire_rate: { op: "flat", value: 2.0 }, range: { op: "flat", value: -1.5 } }, complexity: "flat" },
  { id: 8, name: "Brother Bobby", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familiar that shoots tears." },
  { id: 12, name: "Magic Mushroom", roles: ["offensive", "defensive"], stat_effects: { damage: { op: "mult", value: 1.5 }, range: { op: "flat", value: 1.5 }, speed: { op: "flat", value: 0.3 }, fire_rate: { op: "flat", value: 0.3 } }, hearts: 1, complexity: "conditional", note: "All-around boost (multiplicative damage, approximate)." },
  { id: 20, name: "Transcendence", roles: ["mobility"], grants_flight: true, complexity: "flat", note: "Grants flight." },
  { id: 25, name: "Breakfast", roles: ["defensive"], hearts: 1, complexity: "flat", note: "+1 heart container." },
  { id: 38, name: "Tammy's Head", roles: ["offensive", "utility"], complexity: "proc", note: "Active: ring burst of tears." },
  { id: 48, name: "Cupid's Arrow", roles: ["tear_mod"], grants_tear_flags: ["piercing"], complexity: "flat", note: "Piercing tears." },
  { id: 50, name: "Steven", roles: ["familiar", "offensive"], is_familiar: true, stat_effects: { damage: { op: "flat", value: 0.3 } }, complexity: "flat" },
  { id: 52, name: "Dr. Fetus", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["explosive"], complexity: "conditional", note: "Replaces tears with bombs." },
  { id: 55, name: "Mom's Eye", roles: ["offensive"], complexity: "proc", note: "Chance to fire an extra tear backward." },
  { id: 67, name: "Sister Maggy", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familiar that shoots tears." },
  { id: 68, name: "Technology", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Replaces tears with a continuous laser." },
  { id: 69, name: "Chocolate Milk", roles: ["offensive", "tear_mod"], complexity: "conditional", note: "Chargeable shot; damage scales with charge (NOT a tear replacement)." },
  { id: 81, name: "Dead Cat", roles: ["utility", "defensive"], complexity: "conditional", note: "9 lives, sets max health to 1 heart." },
  { id: 82, name: "Lord of the Pit", roles: ["mobility"], grants_flight: true, stat_effects: { speed: { op: "flat", value: 0.3 } }, complexity: "flat", note: "Flight and a small speed boost. Does NOT grant homing." },
  { id: 87, name: "Loki's Horns", roles: ["offensive"], complexity: "proc", note: "Chance to fire in a cross (4 directions)." },
  { id: 95, name: "Robo-Baby", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familiar that fires a laser." },
  { id: 100, name: "Little Steven", roles: ["familiar", "offensive"], is_familiar: true, grants_tear_flags: ["homing"], complexity: "flat", note: "Familiar with homing tears." },
  { id: 101, name: "Halo", roles: ["offensive", "defensive"], stat_effects: { damage: { op: "flat", value: 0.3 }, fire_rate: { op: "flat", value: 0.2 }, range: { op: "flat", value: 0.25 }, speed: { op: "flat", value: 0.05 } }, hearts: 1, complexity: "flat", note: "Small boost to every stat." },
  { id: 108, name: "The Wafer", roles: ["defensive"], complexity: "flat", note: "Incoming damage capped at half a heart." },
  { id: 113, name: "Demon Baby", roles: ["familiar", "offensive"], is_familiar: true, complexity: "proc", note: "Familiar that shoots at nearby enemies." },
  { id: 114, name: "Mom's Knife", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Replaces tears with a thrown knife." },
  { id: 115, name: "Ouija Board", roles: ["tear_mod"], grants_tear_flags: ["spectral"], complexity: "flat", note: "Spectral tears (pass through obstacles)." },
  { id: 118, name: "Brimstone", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Replaces tears with a charged blood beam." },
  { id: 134, name: "Guppy's Tail", roles: ["utility"], complexity: "conditional", note: "Changes chest and door odds." },
  { id: 145, name: "Guppy's Head", roles: ["utility", "offensive"], complexity: "proc", note: "Active: summons a swarm of flies." },
  { id: 149, name: "Ipecac", roles: ["offensive", "tear_mod"], grants_tear_flags: ["explosive"], stat_effects: { damage: { op: "flat", value: 40 }, fire_rate: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Explosive poison tears with an arcing trajectory - self-damage risk." },
  { id: 151, name: "Mulligan", roles: ["familiar"], is_familiar: true, complexity: "proc", note: "Chance to spawn a fly when firing." },
  { id: 152, name: "Technology 2", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Continuous laser from one eye (tears stay on the other)." },
  { id: 153, name: "Mutant Spider", roles: ["offensive", "tear_mod"], stat_effects: { fire_rate: { op: "mult", value: 0.7 } }, complexity: "flat", note: "Quadruple shot." },
  { id: 159, name: "Spirit of the Night", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["spectral"], complexity: "flat", note: "Flight + spectral tears." },
  { id: 168, name: "Epic Fetus", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["explosive"], complexity: "conditional", note: "Replaces the shot with targeted missile strikes." },
  { id: 169, name: "Polyphemus", roles: ["offensive"], stat_effects: { damage: { op: "mult", value: 2.0 }, fire_rate: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Huge tears; pierces on kill. Multiplicative damage (approximate)." },
  { id: 179, name: "Fate", roles: ["mobility"], grants_flight: true, complexity: "flat", note: "Flight + eternal heart." },
  { id: 182, name: "Sacred Heart", roles: ["offensive", "tear_mod"], grants_tear_flags: ["homing"], stat_effects: { damage: { op: "mult", value: 2.3 }, fire_rate: { op: "flat", value: -0.6 } }, complexity: "conditional", note: "Big damage + homing, reduced fire rate." },
  { id: 185, name: "Dead Dove", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["spectral"], complexity: "flat", note: "Flight + spectral tears." },
  { id: 210, name: "Gnawed Leaf", roles: ["defensive", "utility"], complexity: "conditional", note: "Invincible while standing still." },
  { id: 222, name: "Anti-Gravity", roles: ["tear_mod", "offensive"], stat_effects: { fire_rate: { op: "flat", value: 1.0 } }, complexity: "conditional", note: "Tears float, then fire on release." },
  { id: 224, name: "Cricket's Body", roles: ["offensive", "tear_mod"], stat_effects: { range: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Tears split into 4 on landing." },
  { id: 229, name: "Monstro's Lung", roles: ["offensive", "tear_mod"], is_tears_replacement: true, complexity: "conditional", note: "Charged shotgun-style burst." },
  { id: 233, name: "Tiny Planet", roles: ["tear_mod"], grants_tear_flags: ["spectral"], stat_effects: { range: { op: "flat", value: 6.5 } }, complexity: "conditional", note: "Spectral tears that orbit Isaac at a fixed distance." },
  { id: 244, name: "Tech.5", roles: ["offensive", "tear_mod"], grants_tear_flags: ["piercing"], complexity: "proc", note: "Adds a tech laser (on top of tears)." },
  { id: 245, name: "20/20", roles: ["offensive", "tear_mod"], complexity: "flat", note: "Double shot." },
  { id: 261, name: "Proptosis", roles: ["offensive"], stat_effects: { damage: { op: "mult", value: 3.0 } }, complexity: "conditional", note: "Triple damage at point-blank range, falling off with distance (approximate)." },
  { id: 310, name: "Eve's Mascara", roles: ["offensive", "tear_mod"], stat_effects: { damage: { op: "mult", value: 2.0 }, fire_rate: { op: "mult", value: 0.66 } }, complexity: "flat", note: "2x damage, reduced fire rate and range." },
  { id: 329, name: "Ludovico Technique", roles: ["offensive", "tear_mod"], is_tears_replacement: true, complexity: "conditional", note: "A single controllable floating tear." },
  { id: 330, name: "Soy Milk", roles: ["offensive", "tear_mod"], stat_effects: { fire_rate: { op: "mult", value: 5.0 }, damage: { op: "mult", value: 0.2 } }, complexity: "flat", note: "Extreme fire rate, tiny damage." },
  { id: 360, name: "Incubus", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familiar that copies your shots (stats included)." },
  { id: 394, name: "The Marked", roles: ["offensive", "utility"], complexity: "conditional", note: "Auto-fires toward a marker on the ground." },
  { id: 395, name: "Tech X", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Charged, piercing laser ring." },
  { id: 409, name: "Empty Vessel", roles: ["defensive"], complexity: "conditional", note: "Flight + invincibility at 0 red hearts (conditional)." },
  { id: 462, name: "Eye of Belial", roles: ["tear_mod", "offensive"], grants_tear_flags: ["homing", "piercing"], complexity: "conditional", note: "After taking a hit: piercing and homing tears." },
  { id: 533, name: "Trisagion", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Replaces tears with piercing pillars of light." },
  { id: 573, name: "Immaculate Heart", roles: ["offensive", "tear_mod"], grants_tear_flags: ["spectral"], stat_effects: { damage: { op: "mult", value: 1.2 } }, hearts: 1, complexity: "proc", note: "Extra spectral tears that orbit Isaac, x1.2 damage, +1 heart container." },
  { id: 698, name: "Twisted Pair", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Two familiars that copy your shots." },
];

// CURATED synergies (high value, factual). Generic tear-replacement
// CONFLICTS are detected by a RULE in the engine (any pair of
// is_tears_replacement) - here we only list known specific combos.
const SYNERGIES: Synergy[] = [
  { a: 118, b: 38, type: "strong", text: "Ring of Brimstone beams." },
  { a: 229, b: 330, type: "strong", text: "A burst of many tears (near machine-gun)." },
  { a: 169, b: 330, type: "strong", text: "Soy Milk restores full per-tear damage on Polyphemus: big, fast tears." },
  { a: 395, b: 169, type: "strong", text: "Huge, very powerful piercing rings." },
  { a: 149, b: 229, type: "strong", text: "Explosive shotgun (watch out for self-damage)." },
  { a: 149, b: 52, type: "dangerous", text: "Huge explosions, but a high self-damage risk." },
  { a: 329, b: 114, type: "strong", text: "Controllable floating knife." },
  { a: 329, b: 118, type: "strong", text: "Controllable Brimstone ball." },
  { a: 182, b: 118, type: "dangerous", text: "Brimstone overrides Sacred Heart's homing tears." },
  { a: 233, b: 118, type: "weak", text: "Brimstone in orbit: hard to aim." },
  { a: 69, b: 169, type: "strong", text: "Charged shot with very high damage." },
  { a: 244, b: 118, type: "dangerous", text: "Brimstone hides the Tech.5 laser (redundant)." },

  // Tear-replacement OUTCOMES. Two items that both replace your tears do not simply
  // cancel each other: depending on the pair, Isaac either merges them or lets one
  // take over. Only pairs whose outcome is documented are listed here - when a pair
  // is missing the engine says so rather than guessing (see build_assistant.rs).
  { a: 118, b: 533, type: "dangerous", text: "Brimstone takes over: Trisagion's light pillars are not applied." },
  { a: 168, b: 52, type: "dangerous", text: "Epic Fetus takes over: it replaces Dr. Fetus entirely." },
  { a: 118, b: 114, type: "strong", text: "They merge: the thrown knife gains a Brimstone beam." },
  { a: 118, b: 229, type: "strong", text: "They merge: a charged burst of several Brimstone beams." },
];

// ---------------------------------------------------------------------------
// Validation (the build fails if the source is inconsistent).
// ---------------------------------------------------------------------------
function fail(msg: string): never {
  console.error(`\n❌ build-item-kb: ${msg}\n`);
  process.exit(1);
}

/**
 * The curated entries are hand-verified and always win; everything else is derived
 * from the wiki so that no item is missing entirely.
 *
 * Why this matters: measured against 25 real runs, the curated-only base could
 * analyse 5.3% of the items actually picked up. The assistant spent most of its
 * time answering "30 items not in the knowledge base" instead of answering.
 *
 * Derived entries are marked `curated: false` - the app never presents a scraped
 * value as a hand-verified one.
 */
console.log("-> Deriving the remaining items from the wiki...");
const derived = (await fetchWikiRows()).map(deriveItem);
if (derived.length < 600) fail(`only ${derived.length} rows scraped - the table layout changed`);

const curatedIds = new Set(CURATED.map((i) => i.id));
const ITEMS: Item[] = [
  ...CURATED.map((i) => ({ ...i, curated: true })),
  ...derived.filter((i) => !curatedIds.has(i.id)),
].sort((a, b) => a.id - b.id);

// Quality is factual and the curated list predates it, so take the wiki's value
// wherever the hand-written entry does not state one.
const qualityOf = new Map(derived.map((i) => [i.id, i.quality]));
for (const it of ITEMS) {
  if (it.quality === undefined) {
    const q = qualityOf.get(it.id);
    if (q !== undefined) it.quality = q;
  }
}

// ---------------------------------------------------------------------------
// The curated entries are the derivation's test set.
// ---------------------------------------------------------------------------
// 59 hand-verified items the scraper also sees: if it disagrees with them, either
// the wiki's table layout moved or a pattern broke. This is what caught the parser
// returning Transcendence's flavour quote instead of its description - the item
// silently lost its flight and nothing else would have noticed.
//
// It cuts both ways: the same comparison found four WRONG curated entries (Lord of
// the Pit's homing, Dead Dove's piercing, Immaculate Heart's homing, Tiny Planet's
// missing spectral), each then checked against the item's own wiki page and fixed.
{
  const byId = new Map(derived.map((i) => [i.id, i]));
  const FACTS = ["grants_flight", "is_tears_replacement", "is_familiar"] as const;
  // Items whose curated value is a deliberate judgement the wiki text cannot carry
  // (a thin description, or a mechanic we classify differently on purpose).
  // 50 Steven, 52 Dr. Fetus, 149 Ipecac, 151 Mulligan, 168 Epic Fetus: the table's
  //   one-line description cannot carry what the curated entry knows.
  // 573 Immaculate Heart: the table says "extra tears", the item's own page says
  //   "extra SPECTRAL tears". The curated value comes from the fuller page.
  const EXPECTED_DISAGREEMENT = new Set([50, 52, 149, 151, 168, 573]);
  let agree = 0;
  const off: string[] = [];
  for (const c of CURATED) {
    if (EXPECTED_DISAGREEMENT.has(c.id)) continue;
    const d = byId.get(c.id);
    if (d === undefined) {
      off.push(`#${c.id} ${c.name}: absent from the wiki table`);
      continue;
    }
    const bad = FACTS.filter((f) => Boolean(c[f]) !== Boolean(d[f])).map(
      (f) => `${f} curated=${Boolean(c[f])} derived=${Boolean(d[f])}`,
    );
    const cf = [...(c.grants_tear_flags ?? [])].sort().join(",");
    const df = [...(d.grants_tear_flags ?? [])].sort().join(",");
    if (cf !== df) bad.push(`tear flags curated=[${cf}] derived=[${df}]`);
    if (bad.length === 0) agree++;
    else off.push(`#${c.id} ${c.name}: ${bad.join("; ")}`);
  }
  const tested = CURATED.length - EXPECTED_DISAGREEMENT.size;
  if (off.length > 0) {
    console.error(`
  derivation disagrees with ${off.length}/${tested} verified items:`);
    for (const o of off) console.error(`    ${o}`);
    fail("the derivation no longer matches the hand-verified set");
  }
  console.log(`   cross-check: ${agree}/${tested} verified items reproduced from the wiki`);
}

const ids = new Set<number>();
for (const it of ITEMS) {
  if (!Number.isInteger(it.id) || it.id <= 0) fail(`invalid id for "${it.name}"`);
  if (ids.has(it.id)) fail(`duplicate id: ${it.id} (${it.name})`);
  ids.add(it.id);
  if (!it.roles.length) fail(`"${it.name}" has no role`);
  for (const r of it.roles) if (!ROLES.includes(r)) fail(`unknown role "${r}" (${it.name})`);
  for (const f of it.grants_tear_flags ?? []) if (!TEAR_FLAGS.includes(f)) fail(`unknown tear flag "${f}" (${it.name})`);
  if (!COMPLEXITY.includes(it.complexity)) fail(`unknown complexity "${it.complexity}" (${it.name})`);
  for (const d of Object.keys(it.stat_effects ?? {})) if (!DIMS.includes(d as Dim)) fail(`unknown stat dimension "${d}" (${it.name})`);
  if (it.is_familiar && !it.roles.includes("familiar")) fail(`"${it.name}" is_familiar but the familiar role is missing`);
}
for (const s of SYNERGIES) {
  if (!ids.has(s.a) || !ids.has(s.b)) fail(`synergy references a missing id: ${s.a}/${s.b}`);
  if (!["strong", "weak", "dangerous"].includes(s.type)) fail(`unknown synergy type "${s.type}"`);
}

// ---------------------------------------------------------------------------
// JSON output (app).
// ---------------------------------------------------------------------------
const kb = { schema: 1, items: ITEMS, synergies: SYNERGIES };
mkdirSync(RES, { recursive: true });
writeFileSync(resolve(RES, "item_kb.json"), JSON.stringify(kb, null, 2) + "\n", "utf8");

// ---------------------------------------------------------------------------
// Lua output (mod) - a module returning a table. Minimal serializer.
// ---------------------------------------------------------------------------
function luaStr(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}
function luaVal(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return luaStr(v);
  if (Array.isArray(v)) return "{ " + v.map(luaVal).join(", ") + " }";
  if (typeof v === "object") {
    const parts: string[] = [];
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue;
      const key = /^[A-Za-z_]\w*$/.test(k) ? k : `[${luaStr(k)}]`;
      parts.push(`${key} = ${luaVal(val)}`);
    }
    return "{ " + parts.join(", ") + " }";
  }
  return "nil";
}

const luaHeader = `-- SPDX-License-Identifier: GPL-3.0-only
-- Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau
-- GENERATED by tools/build-knowledge/build-item-kb.ts - DO NOT EDIT BY HAND.
-- Item knowledge base (facts only, no ripped asset).
`;
const luaBody = `return ${luaVal({ schema: 1, items: ITEMS.filter((i) => i.curated), synergies: SYNERGIES })}\n`;
mkdirSync(MOD, { recursive: true });
writeFileSync(resolve(MOD, "item_kb.lua"), luaHeader + luaBody, "utf8");

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------
const byRole: Record<string, number> = {};
for (const it of ITEMS) for (const r of it.roles) byRole[r] = (byRole[r] ?? 0) + 1;
const replacements = ITEMS.filter((i) => i.is_tears_replacement).length;
console.log(`✅ item_kb: ${ITEMS.length} items, ${SYNERGIES.length} curated synergies.`);
console.log(`   tear replacements: ${replacements} · by role: ${JSON.stringify(byRole)}`);
console.log(`   → ${resolve(RES, "item_kb.json")}`);
console.log(`   → ${resolve(MOD, "item_kb.lua")}`);
