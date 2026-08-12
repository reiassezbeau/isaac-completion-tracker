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
  { id: 2, name: "The Inner Eye", roles: ["offensive", "tear_mod"], stat_effects: { fire_rate: { op: "mult", value: 0.51 } }, complexity: "flat", note: "Tir triple, cadence fortement réduite." },
  { id: 3, name: "Spoon Bender", roles: ["tear_mod"], grants_tear_flags: ["homing"], complexity: "flat", note: "Donne le homing aux larmes." },
  { id: 4, name: "Cricket's Head", roles: ["offensive"], stat_effects: { damage: { op: "mult", value: 1.5 } }, complexity: "flat", note: "Multiplicateur de dégâts (approximatif)." },
  { id: 6, name: "Number One", roles: ["offensive"], stat_effects: { fire_rate: { op: "flat", value: 2.0 }, range: { op: "flat", value: -1.5 } }, complexity: "flat" },
  { id: 8, name: "Brother Bobby", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familier qui tire des larmes." },
  { id: 12, name: "Magic Mushroom", roles: ["offensive", "defensive"], stat_effects: { damage: { op: "mult", value: 1.5 }, range: { op: "flat", value: 1.5 }, speed: { op: "flat", value: 0.3 }, fire_rate: { op: "flat", value: 0.3 } }, hearts: 1, complexity: "conditional", note: "Boost global (dégâts multiplicatifs, approximatif)." },
  { id: 20, name: "Transcendence", roles: ["mobility"], grants_flight: true, complexity: "flat", note: "Donne le vol." },
  { id: 25, name: "Breakfast", roles: ["defensive"], hearts: 1, complexity: "flat", note: "+1 conteneur de cœur." },
  { id: 38, name: "Tammy's Head", roles: ["offensive", "utility"], complexity: "proc", note: "Actif : salve de larmes en anneau." },
  { id: 48, name: "Cupid's Arrow", roles: ["tear_mod"], grants_tear_flags: ["piercing"], complexity: "flat", note: "Larmes perçantes." },
  { id: 50, name: "Steven", roles: ["familiar", "offensive"], is_familiar: true, stat_effects: { damage: { op: "flat", value: 0.3 } }, complexity: "flat" },
  { id: 52, name: "Dr. Fetus", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["explosive"], complexity: "conditional", note: "Remplace les larmes par des bombes." },
  { id: 55, name: "Mom's Eye", roles: ["offensive"], complexity: "proc", note: "Chance de tirer une larme supplémentaire vers l'arrière." },
  { id: 67, name: "Sister Maggy", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familier qui tire des larmes." },
  { id: 68, name: "Technology", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Remplace les larmes par un laser continu." },
  { id: 69, name: "Chocolate Milk", roles: ["offensive", "tear_mod"], complexity: "conditional", note: "Tir chargeable ; dégâts selon la charge (PAS un remplacement de larmes)." },
  { id: 81, name: "Dead Cat", roles: ["utility", "defensive"], complexity: "conditional", note: "9 vies, met la vie max à 1 cœur." },
  { id: 82, name: "Lord of the Pit", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["homing"], complexity: "flat", note: "Vol + homing." },
  { id: 87, name: "Loki's Horns", roles: ["offensive"], complexity: "proc", note: "Chance de tirer en croix (4 directions)." },
  { id: 95, name: "Robo-Baby", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familier qui tire un laser." },
  { id: 100, name: "Little Steven", roles: ["familiar", "offensive"], is_familiar: true, grants_tear_flags: ["homing"], complexity: "flat", note: "Familier à larmes homing." },
  { id: 101, name: "Halo", roles: ["offensive", "defensive"], stat_effects: { damage: { op: "flat", value: 0.3 }, fire_rate: { op: "flat", value: 0.2 }, range: { op: "flat", value: 0.25 }, speed: { op: "flat", value: 0.05 } }, hearts: 1, complexity: "flat", note: "Petit boost de toutes les stats." },
  { id: 108, name: "The Wafer", roles: ["defensive"], complexity: "flat", note: "Dégâts reçus plafonnés à un demi-cœur." },
  { id: 113, name: "Demon Baby", roles: ["familiar", "offensive"], is_familiar: true, complexity: "proc", note: "Familier qui tire sur les ennemis proches." },
  { id: 114, name: "Mom's Knife", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Remplace les larmes par un couteau lancé." },
  { id: 115, name: "Ouija Board", roles: ["tear_mod"], grants_tear_flags: ["spectral"], complexity: "flat", note: "Larmes spectrales (traversent les obstacles)." },
  { id: 118, name: "Brimstone", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Remplace les larmes par un rayon de sang chargé." },
  { id: 134, name: "Guppy's Tail", roles: ["utility"], complexity: "conditional", note: "Change les probabilités de coffres/portes." },
  { id: 145, name: "Guppy's Head", roles: ["utility", "offensive"], complexity: "proc", note: "Actif : invoque un essaim de mouches." },
  { id: 149, name: "Ipecac", roles: ["offensive", "tear_mod"], grants_tear_flags: ["explosive"], stat_effects: { damage: { op: "flat", value: 40 }, fire_rate: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Larmes explosives empoisonnées en cloche — risque d'auto-dégâts." },
  { id: 151, name: "Mulligan", roles: ["familiar"], is_familiar: true, complexity: "proc", note: "Chance d'invoquer une mouche en tirant." },
  { id: 152, name: "Technology 2", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Laser continu sur un œil (garde les larmes sur l'autre)." },
  { id: 153, name: "Mutant Spider", roles: ["offensive", "tear_mod"], stat_effects: { fire_rate: { op: "mult", value: 0.7 } }, complexity: "flat", note: "Tir quadruple." },
  { id: 159, name: "Spirit of the Night", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["spectral"], complexity: "flat", note: "Vol + larmes spectrales." },
  { id: 168, name: "Epic Fetus", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["explosive"], complexity: "conditional", note: "Remplace le tir par des frappes de missile ciblées." },
  { id: 169, name: "Polyphemus", roles: ["offensive"], stat_effects: { damage: { op: "mult", value: 2.0 }, fire_rate: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Larmes énormes ; perce sur kill. Dégâts multiplicatifs (approximatif)." },
  { id: 179, name: "Fate", roles: ["mobility"], grants_flight: true, complexity: "flat", note: "Vol + cœur éternel." },
  { id: 182, name: "Sacred Heart", roles: ["offensive", "tear_mod"], grants_tear_flags: ["homing"], stat_effects: { damage: { op: "mult", value: 2.3 }, fire_rate: { op: "flat", value: -0.6 } }, complexity: "conditional", note: "Gros dégâts + homing, cadence réduite." },
  { id: 185, name: "Dead Dove", roles: ["mobility", "tear_mod"], grants_flight: true, grants_tear_flags: ["spectral", "piercing"], complexity: "flat", note: "Vol + larmes spectrales et perçantes." },
  { id: 210, name: "Gnawed Leaf", roles: ["defensive", "utility"], complexity: "conditional", note: "Invincible à l'immobilité." },
  { id: 222, name: "Anti-Gravity", roles: ["tear_mod", "offensive"], stat_effects: { fire_rate: { op: "flat", value: 1.0 } }, complexity: "conditional", note: "Les larmes flottent puis partent au relâchement." },
  { id: 224, name: "Cricket's Body", roles: ["offensive", "tear_mod"], stat_effects: { range: { op: "flat", value: -1.0 } }, complexity: "conditional", note: "Les larmes se divisent en 4 à l'atterrissage." },
  { id: 229, name: "Monstro's Lung", roles: ["offensive", "tear_mod"], is_tears_replacement: true, complexity: "conditional", note: "Tir chargé en salve type fusil à pompe." },
  { id: 233, name: "Tiny Planet", roles: ["tear_mod"], stat_effects: { range: { op: "flat", value: 2.0 } }, complexity: "conditional", note: "Les larmes orbitent autour d'Isaac." },
  { id: 244, name: "Tech.5", roles: ["offensive", "tear_mod"], grants_tear_flags: ["piercing"], complexity: "proc", note: "Ajoute un laser tech (par-dessus les larmes)." },
  { id: 245, name: "20/20", roles: ["offensive", "tear_mod"], complexity: "flat", note: "Tir double." },
  { id: 261, name: "Proptosis", roles: ["offensive"], stat_effects: { damage: { op: "mult", value: 3.0 } }, complexity: "conditional", note: "Dégâts triplés à bout portant, décroissent avec la distance (approximatif)." },
  { id: 310, name: "Eve's Mascara", roles: ["offensive", "tear_mod"], stat_effects: { damage: { op: "mult", value: 2.0 }, fire_rate: { op: "mult", value: 0.66 } }, complexity: "flat", note: "×2 dégâts, cadence et portée réduites." },
  { id: 329, name: "Ludovico Technique", roles: ["offensive", "tear_mod"], is_tears_replacement: true, complexity: "conditional", note: "Une seule larme flottante contrôlable." },
  { id: 330, name: "Soy Milk", roles: ["offensive", "tear_mod"], stat_effects: { fire_rate: { op: "mult", value: 5.0 }, damage: { op: "mult", value: 0.2 } }, complexity: "flat", note: "Cadence extrême, dégâts minuscules." },
  { id: 360, name: "Incubus", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Familier qui copie tes tirs (stats comprises)." },
  { id: 394, name: "The Marked", roles: ["offensive", "utility"], complexity: "conditional", note: "Tir automatique vers un marqueur au sol." },
  { id: 395, name: "Tech X", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Anneau laser chargé et perçant." },
  { id: 409, name: "Empty Vessel", roles: ["defensive"], complexity: "conditional", note: "Vol + invincibilité à 0 cœur rouge (conditionnel)." },
  { id: 462, name: "Eye of Belial", roles: ["tear_mod", "offensive"], grants_tear_flags: ["homing", "piercing"], complexity: "conditional", note: "Après avoir touché : larmes perçantes et homing." },
  { id: 533, name: "Trisagion", roles: ["offensive", "tear_mod"], is_tears_replacement: true, grants_tear_flags: ["piercing"], complexity: "conditional", note: "Remplace les larmes par des piliers de lumière perçants." },
  { id: 573, name: "Immaculate Heart", roles: ["offensive", "tear_mod"], grants_tear_flags: ["homing"], stat_effects: { damage: { op: "flat", value: 0.5 } }, complexity: "proc", note: "Chance de larme homing supplémentaire + cœur d'âme." },
  { id: 698, name: "Twisted Pair", roles: ["familiar", "offensive"], is_familiar: true, complexity: "flat", note: "Deux familiers qui copient tes tirs." },
];

// Synergies CURÉES (haute valeur, factuelles). Les CONFLITS génériques de
// remplacement de larmes sont détectés par RÈGLE côté moteur (toute paire de
// is_tears_replacement) — ici on ne liste que des combos spécifiques connus.
const SYNERGIES: Synergy[] = [
  { a: 118, b: 38, type: "strong", text: "Anneau de rayons de Brimstone." },
  { a: 229, b: 330, type: "strong", text: "Salve de très nombreuses larmes (quasi mitraillette)." },
  { a: 169, b: 330, type: "strong", text: "Soy Milk rend à Polyphemus des dégâts complets par larme → grosses larmes rapides." },
  { a: 395, b: 169, type: "strong", text: "Énormes anneaux perçants très puissants." },
  { a: 149, b: 229, type: "strong", text: "Fusil à pompe explosif (attention aux auto-dégâts)." },
  { a: 149, b: 52, type: "dangerous", text: "Explosions énormes mais fort risque d'auto-dégâts." },
  { a: 329, b: 114, type: "strong", text: "Couteau flottant contrôlable." },
  { a: 329, b: 118, type: "strong", text: "Boule de Brimstone contrôlable." },
  { a: 182, b: 118, type: "dangerous", text: "Brimstone écrase les larmes homing de Sacred Heart." },
  { a: 233, b: 118, type: "weak", text: "Brimstone en orbite : difficile à viser." },
  { a: 69, b: 169, type: "strong", text: "Tir chargé à très gros dégâts." },
  { a: 244, b: 118, type: "dangerous", text: "Brimstone masque le laser de Tech.5 (redondant)." },
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
