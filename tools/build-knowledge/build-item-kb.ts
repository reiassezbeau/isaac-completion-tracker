// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * tools/build-knowledge/build-item-kb.ts — Compilateur de la BASE DE CONNAISSANCES
 * D'ITEMS (DEV-TIME). Source = données FACTUELLES curées à la main (ids vérifiés
 * contre l'enum CollectibleType officiel ; effets documentés sur le wiki).
 *
 * UNE source → DEUX sorties (garde-fous : pas deux copies de la connaissance) :
 *   - src-tauri/resources/item_kb.json   (pour l'app, vues riches)
 *   - isaac-tracker-mod/item_kb.lua      (pour le mod, calcul in-run compact)
 *
 * ⚠️ CONTRAINTES (garde-fous §3.4) : AUCUN asset rippé — pas de sprite, pas de
 * recopie de la prose EID. Uniquement des faits (ids, rôles, deltas de stats,
 * tear flags, remplacement de larmes, complexité) + notes courtes de notre plume.
 *
 * KB volontairement PARTIELLE et EXTENSIBLE : on couvre en priorité les items à
 * haute valeur & très fiables (remplacements de larmes = conflits, tear flags,
 * vol, familiers, stat-ups classiques). Régénérer : `npm run build:item-kb`.
 *
 * Auteur : reiassezbeau — https://github.com/reiassezbeau
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES = resolve(__dirname, "../../src-tauri/resources");
const MOD = resolve(__dirname, "../../isaac-tracker-mod");

// ---------------------------------------------------------------------------
// Vocabulaires (validés au build).
// ---------------------------------------------------------------------------
const ROLES = ["offensive", "defensive", "mobility", "tear_mod", "utility", "familiar"] as const;
const DIMS = ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"] as const;
const TEAR_FLAGS = ["homing", "piercing", "spectral", "explosive"] as const;
const COMPLEXITY = ["flat", "proc", "conditional"] as const;

type Role = (typeof ROLES)[number];
type Dim = (typeof DIMS)[number];
type TearFlag = (typeof TEAR_FLAGS)[number];
type Complexity = (typeof COMPLEXITY)[number];
type StatEffect = { op: "flat" | "mult"; value: number };

interface Item {
  id: number;
  name: string;
  roles: Role[];
  stat_effects?: Partial<Record<Dim, StatEffect>>;
  grants_tear_flags?: TearFlag[];
  grants_flight?: boolean;
  is_tears_replacement?: boolean;
  is_familiar?: boolean;
  /** delta de conteneurs de cœurs rouges (documenté), si pertinent. */
  hearts?: number;
  complexity: Complexity;
  /** note factuelle courte, de notre plume (jamais de la prose EID). */
  note?: string;
}

interface Synergy {
  a: number;
  b: number;
  type: "strong" | "weak" | "dangerous";
  text: string;
}

// ---------------------------------------------------------------------------
// SOURCE FACTUELLE (curée). ids = enum CollectibleType (vérifiés).
// ---------------------------------------------------------------------------
const ITEMS: Item[] = [
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
  { id: 82, name: "Lord of the Pit", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["homing"], complexity: "flat", note: "Flight + homing." },
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
  { id: 185, name: "Dead Dove", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["spectral", "piercing"], complexity: "flat", note: "Flight + spectral and piercing tears." },
  { id: 210, name: "Gnawed Leaf", roles: ["defensive", "utility"], complexity: "conditional", note: "Invincible while standing still." },
  { id: 222, name: "Anti-Gravity", roles: ["tear_mod", "offensive"], stat_effects: { fire_rate: { op: "flat", value: 1.0 } }, complexity: "conditional", note: "Tears float, then fire on release." },
  { id: 224, name: "Cricket's Body", roles: ["offensive", "tear_mod"], stat_effects: { range: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Tears split into 4 on landing." },
  { id: 229, name: "Monstro's Lung", roles: ["offensive", "tear_mod"], is_tears_replacement: true, complexity: "conditional", note: "Charged shotgun-style burst." },
  { id: 233, name: "Tiny Planet", roles: ["tear_mod"], stat_effects: { range: { op: "flat", value: 2.0 } }, complexity: "conditional", note: "Tears orbit around Isaac." },
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
  { id: 573, name: "Immaculate Heart", roles: ["offensive", "tear_mod"], grants_tear_flags: ["homing"], stat_effects: { damage: { op: "flat", value: 0.5 } }, complexity: "proc", note: "Chance of an extra homing tear + soul heart." },
  { id: 698, name: "Twisted Pair", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Two familiars that copy your shots." },
];

// Synergies CURÉES (haute valeur, factuelles). Les CONFLITS génériques de
// remplacement de larmes sont détectés par RÈGLE côté moteur (toute paire de
// is_tears_replacement) — ici on ne liste que des combos spécifiques connus.
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
];

// ---------------------------------------------------------------------------
// Validation (le build échoue si la source est incohérente).
// ---------------------------------------------------------------------------
function fail(msg: string): never {
  console.error(`\n❌ build-item-kb : ${msg}\n`);
  process.exit(1);
}

const ids = new Set<number>();
for (const it of ITEMS) {
  if (!Number.isInteger(it.id) || it.id <= 0) fail(`id invalide pour « ${it.name} »`);
  if (ids.has(it.id)) fail(`id dupliqué : ${it.id} (${it.name})`);
  ids.add(it.id);
  if (!it.roles.length) fail(`« ${it.name} » sans rôle`);
  for (const r of it.roles) if (!ROLES.includes(r)) fail(`rôle inconnu « ${r} » (${it.name})`);
  for (const f of it.grants_tear_flags ?? []) if (!TEAR_FLAGS.includes(f)) fail(`tear flag inconnu « ${f} » (${it.name})`);
  if (!COMPLEXITY.includes(it.complexity)) fail(`complexité inconnue « ${it.complexity} » (${it.name})`);
  for (const d of Object.keys(it.stat_effects ?? {})) if (!DIMS.includes(d as Dim)) fail(`dimension inconnue « ${d} » (${it.name})`);
  if (it.is_familiar && !it.roles.includes("familiar")) fail(`« ${it.name} » is_familiar mais rôle familiar manquant`);
}
for (const s of SYNERGIES) {
  if (!ids.has(s.a) || !ids.has(s.b)) fail(`synergie référence un id absent : ${s.a}/${s.b}`);
  if (!["strong", "weak", "dangerous"].includes(s.type)) fail(`type de synergie inconnu « ${s.type} »`);
}

// ---------------------------------------------------------------------------
// Sortie JSON (app).
// ---------------------------------------------------------------------------
const kb = { schema: 1, items: ITEMS, synergies: SYNERGIES };
mkdirSync(RES, { recursive: true });
writeFileSync(resolve(RES, "item_kb.json"), JSON.stringify(kb, null, 2) + "\n", "utf8");

// ---------------------------------------------------------------------------
// Sortie Lua (mod) — module retournant une table. Sérialiseur minimal.
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
-- GÉNÉRÉ par tools/build-knowledge/build-item-kb.ts — NE PAS ÉDITER À LA MAIN.
-- Base de connaissances d'items (faits uniquement, aucun asset rippé).
`;
const luaBody = `return ${luaVal(kb)}\n`;
mkdirSync(MOD, { recursive: true });
writeFileSync(resolve(MOD, "item_kb.lua"), luaHeader + luaBody, "utf8");

// ---------------------------------------------------------------------------
// Résumé.
// ---------------------------------------------------------------------------
const byRole: Record<string, number> = {};
for (const it of ITEMS) for (const r of it.roles) byRole[r] = (byRole[r] ?? 0) + 1;
const replacements = ITEMS.filter((i) => i.is_tears_replacement).length;
console.log(`✅ item_kb : ${ITEMS.length} items, ${SYNERGIES.length} synergies curées.`);
console.log(`   remplacements de larmes : ${replacements} · par rôle : ${JSON.stringify(byRole)}`);
console.log(`   → ${resolve(RES, "item_kb.json")}`);
console.log(`   → ${resolve(MOD, "item_kb.lua")}`);
