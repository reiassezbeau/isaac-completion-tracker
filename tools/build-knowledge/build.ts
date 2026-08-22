// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * tools/build-knowledge/build.ts - Knowledge-base compiler (DEV-TIME, internet allowed).
 *
 * Fetches the official list of the 641 achievements from the community wiki
 * (bindingofisaacrebirth.wiki.gg, the "Achievements" table ordered by ID - the ID
 * matches the in-game "secret" exactly, hence the bit read from the save),
 * extracts id/name/description/condition/DLC, derives a structured classification
 * (character_completion / boss_first_kill / challenge / cumulative…) exploitable
 * used by the predictor, then writes:
 *   - src-tauri/resources/achievements.json
 *   - src-tauri/resources/characters.json
 *   - src-tauri/resources/endings.json
 *
 * The shipped binary makes NO network call: only the generated JSON files are bundled.
 * Regenerate with `npm run build:knowledge` (see tools/build-knowledge/README.md).
 *
 * Auteur : reiassezbeau — https://github.com/reiassezbeau
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES = resolve(__dirname, "../../src-tauri/resources");

const WIKI_HTML_API =
  "https://bindingofisaacrebirth.wiki.gg/api.php?action=parse&page=Achievements&prop=text&format=json&formatversion=2";

// Official per-DLC counts (as announced on the wiki page) - used as a self-check.
const EXPECTED_TOTAL = 641;

// ---------------------------------------------------------------------------
// Canonical data (validated against a real save: the order of characters and
// marks equals the binary order of the marks section). See the game ECharacters / Marks.
// ---------------------------------------------------------------------------
interface CharacterDef {
  id: string;
  name: string;
  type: "regular" | "tainted";
  dlc: string;
  /** binary index of the character in the marks section (0..33) */
  save_index: number;
}

const CHARACTERS: CharacterDef[] = [
  { id: "isaac", name: "Isaac", type: "regular", dlc: "rebirth", save_index: 0 },
  { id: "magdalene", name: "Magdalene", type: "regular", dlc: "rebirth", save_index: 1 },
  { id: "cain", name: "Cain", type: "regular", dlc: "rebirth", save_index: 2 },
  { id: "judas", name: "Judas", type: "regular", dlc: "rebirth", save_index: 3 },
  { id: "blue_baby", name: "??? (Blue Baby)", type: "regular", dlc: "rebirth", save_index: 4 },
  { id: "eve", name: "Eve", type: "regular", dlc: "rebirth", save_index: 5 },
  { id: "samson", name: "Samson", type: "regular", dlc: "rebirth", save_index: 6 },
  { id: "azazel", name: "Azazel", type: "regular", dlc: "rebirth", save_index: 7 },
  { id: "lazarus", name: "Lazarus", type: "regular", dlc: "rebirth", save_index: 8 },
  { id: "eden", name: "Eden", type: "regular", dlc: "rebirth", save_index: 9 },
  { id: "the_lost", name: "The Lost", type: "regular", dlc: "rebirth", save_index: 10 },
  { id: "lilith", name: "Lilith", type: "regular", dlc: "afterbirth", save_index: 11 },
  { id: "keeper", name: "Keeper", type: "regular", dlc: "afterbirth", save_index: 12 },
  { id: "apollyon", name: "Apollyon", type: "regular", dlc: "afterbirth_plus", save_index: 13 },
  { id: "the_forgotten", name: "The Forgotten", type: "regular", dlc: "afterbirth_plus", save_index: 14 },
  { id: "bethany", name: "Bethany", type: "regular", dlc: "repentance", save_index: 15 },
  { id: "jacob_esau", name: "Jacob & Esau", type: "regular", dlc: "repentance", save_index: 16 },
  { id: "tainted_isaac", name: "Tainted Isaac", type: "tainted", dlc: "repentance", save_index: 17 },
  { id: "tainted_magdalene", name: "Tainted Magdalene", type: "tainted", dlc: "repentance", save_index: 18 },
  { id: "tainted_cain", name: "Tainted Cain", type: "tainted", dlc: "repentance", save_index: 19 },
  { id: "tainted_judas", name: "Tainted Judas", type: "tainted", dlc: "repentance", save_index: 20 },
  { id: "tainted_blue_baby", name: "Tainted ??? (Blue Baby)", type: "tainted", dlc: "repentance", save_index: 21 },
  { id: "tainted_eve", name: "Tainted Eve", type: "tainted", dlc: "repentance", save_index: 22 },
  { id: "tainted_samson", name: "Tainted Samson", type: "tainted", dlc: "repentance", save_index: 23 },
  { id: "tainted_azazel", name: "Tainted Azazel", type: "tainted", dlc: "repentance", save_index: 24 },
  { id: "tainted_lazarus", name: "Tainted Lazarus", type: "tainted", dlc: "repentance", save_index: 25 },
  { id: "tainted_eden", name: "Tainted Eden", type: "tainted", dlc: "repentance", save_index: 26 },
  { id: "tainted_lost", name: "Tainted Lost", type: "tainted", dlc: "repentance", save_index: 27 },
  { id: "tainted_lilith", name: "Tainted Lilith", type: "tainted", dlc: "repentance", save_index: 28 },
  { id: "tainted_keeper", name: "Tainted Keeper", type: "tainted", dlc: "repentance", save_index: 29 },
  { id: "tainted_apollyon", name: "Tainted Apollyon", type: "tainted", dlc: "repentance", save_index: 30 },
  { id: "tainted_forgotten", name: "Tainted Forgotten", type: "tainted", dlc: "repentance", save_index: 31 },
  { id: "tainted_bethany", name: "Tainted Bethany", type: "tainted", dlc: "repentance", save_index: 32 },
  { id: "tainted_jacob", name: "Tainted Jacob", type: "tainted", dlc: "repentance", save_index: 33 },
];

interface EndingDef {
  id: string;
  name: string;
  /** index of the mark in the save section (0..11) */
  mark_index: number;
  /** Dead God requires the Hard mark on every mark */
  hard_matters: boolean;
}

// Binary order of the completion marks (validated against the save).
const ENDINGS: EndingDef[] = [
  { id: "moms_heart", name: "Mom's Heart / It Lives", mark_index: 0, hard_matters: true },
  { id: "isaac", name: "Isaac", mark_index: 1, hard_matters: true },
  { id: "satan", name: "Satan", mark_index: 2, hard_matters: true },
  { id: "boss_rush", name: "Boss Rush", mark_index: 3, hard_matters: true },
  { id: "blue_baby", name: "??? (Blue Baby)", mark_index: 4, hard_matters: true },
  { id: "lamb", name: "The Lamb", mark_index: 5, hard_matters: true },
  { id: "mega_satan", name: "Mega Satan", mark_index: 6, hard_matters: true },
  { id: "greed", name: "Ultra Greed / Greedier", mark_index: 7, hard_matters: true },
  { id: "hush", name: "Hush", mark_index: 8, hard_matters: true },
  { id: "delirium", name: "Delirium (Void)", mark_index: 9, hard_matters: true },
  { id: "mother", name: "Mother (Corpse)", mark_index: 10, hard_matters: true },
  { id: "beast", name: "The Beast", mark_index: 11, hard_matters: true },
];

// ---------------------------------------------------------------------------
// Classification (heuristic, conservative: predictable=true only with
// high confidence; the `unlock.text` condition string is ALWAYS exact).
// ---------------------------------------------------------------------------

// Targets (endings) looked for in the ACTION PART (before "as <character>").
// Order matters: Mega Satan before Satan, Greedier before Greed, Mom's Heart before Mom.
const ENDING_PATTERNS: [RegExp, string][] = [
  [/mom'?s heart|it lives/i, "moms_heart"],
  [/mega satan/i, "mega_satan"],
  [/ultra greedier/i, "greed"],
  [/ultra greed/i, "greed"],
  [/boss rush/i, "boss_rush"],
  [/\bhush\b/i, "hush"],
  [/delirium/i, "delirium"],
  [/\bmother\b/i, "mother"],
  [/the beast|\bbeast\b/i, "beast"],
  [/the lamb|\blamb\b/i, "lamb"],
  [/\?\?\?|blue baby/i, "blue_baby"],
  [/\bsatan\b/i, "satan"],
  [/\bisaac\b/i, "isaac"],
];

// Character alias -> id. Tainted first (more specific).
const CHAR_PATTERNS: [string, string][] = [
  ["tainted isaac", "tainted_isaac"], ["tainted magdalene", "tainted_magdalene"],
  ["tainted cain", "tainted_cain"], ["tainted judas", "tainted_judas"],
  ["tainted ???", "tainted_blue_baby"], ["tainted blue baby", "tainted_blue_baby"],
  ["tainted eve", "tainted_eve"], ["tainted samson", "tainted_samson"],
  ["tainted azazel", "tainted_azazel"], ["tainted lazarus", "tainted_lazarus"],
  ["tainted eden", "tainted_eden"], ["tainted lost", "tainted_lost"],
  ["tainted lilith", "tainted_lilith"], ["tainted keeper", "tainted_keeper"],
  ["tainted apollyon", "tainted_apollyon"], ["tainted forgotten", "tainted_forgotten"],
  ["tainted bethany", "tainted_bethany"], ["tainted jacob", "tainted_jacob"],
  ["magdalene", "magdalene"], ["cain", "cain"], ["judas", "judas"],
  ["blue baby", "blue_baby"], ["???", "blue_baby"], ["eve", "eve"], ["samson", "samson"],
  ["azazel", "azazel"], ["lazarus", "lazarus"], ["eden", "eden"], ["the lost", "the_lost"],
  ["lilith", "lilith"], ["keeper", "keeper"], ["apollyon", "apollyon"],
  ["the forgotten", "the_forgotten"], ["bethany", "bethany"],
  ["jacob and esau", "jacob_esau"], ["jacob & esau", "jacob_esau"], ["jacob", "jacob_esau"],
  ["isaac", "isaac"],
];

// "Clean" first kills (a simple phrase, no counter or condition) -> predictable.
const FIRST_KILL_PATTERNS: [RegExp, string][] = [
  [/^defeat hush$/i, "hush"],
  [/^defeat mega ?satan$/i, "mega_satan"],
  [/^defeat delirium$/i, "delirium"],
  [/^defeat ultra greedier$/i, "greed"],
  [/^defeat ultra greed$/i, "greed"],
  [/^defeat mother$/i, "mother"],
  [/^defeat the beast$/i, "beast"],
  [/^(complete|defeat) boss rush$/i, "boss_rush"],
  [/^defeat satan$/i, "satan"],
  [/^defeat the lamb$/i, "lamb"],
  [/^defeat \?\?\?$/i, "blue_baby"],
  [/^defeat isaac$/i, "isaac"],
];

function findEnding(action: string): string | null {
  for (const [re, id] of ENDING_PATTERNS) if (re.test(action)) return id;
  return null;
}

function findCharacter(charPart: string): string | null {
  const t = " " + charPart.toLowerCase().trim() + " ";
  for (const [kw, id] of CHAR_PATTERNS) {
    if (t.includes(" " + kw + " ") || t.includes(" " + kw + ",") || t.startsWith(" " + kw)) return id;
  }
  return null;
}

interface UnlockClassification {
  type: string;
  character: string | null;
  target: string | null;
  predictable: boolean;
}

function classifyUnlock(unlock: string): UnlockClassification {
  const u = unlock.trim();

  // 1) Challenge (reward for completing a challenge).
  const chMatch = u.match(/\(challenge #?(\d+)\)/i);
  if (chMatch || /complete the challenge\b/i.test(u)) {
    return { type: "challenge", character: null, target: chMatch ? `challenge_${chMatch[1]}` : null, predictable: true };
  }

  // 2) "<action> as <character>" -> character_completion (the heart of the predictor).
  const asIdx = u.toLowerCase().lastIndexOf(" as ");
  if (asIdx !== -1) {
    const action = u.slice(0, asIdx);
    const charPart = u.slice(asIdx + 4);
    const character = findCharacter(charPart);
    const target = findEnding(action);
    if (character && target) {
      return { type: "character_completion", character, target, predictable: true };
    }
    if (character && !target) {
      // "as <character>" but the target is unknown (e.g. "as Tainted X" on a misc objective)
      return { type: "conditional", character, target: null, predictable: false };
    }
  }

  // 3) "Clean" first kill of a boss, independent of the character.
  for (const [re, id] of FIRST_KILL_PATTERNS) {
    if (re.test(u)) return { type: "boss_first_kill", character: null, target: id, predictable: true };
  }

  // 4) Cumulative / pickup / conditional -> not predictable (still visible in the browser).
  if (/\b\d+\b|times|donate|blow up|destroy|collect|streak|without|damage|use \b/i.test(u)) {
    return { type: "cumulative", character: null, target: null, predictable: false };
  }
  return { type: "misc", character: null, target: null, predictable: false };
}

function category(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("new character")) return "character";
  if (d.includes("new item")) return "item";
  if (d.includes("new trinket")) return "trinket";
  if (d.includes("new pill")) return "pill";
  if (d.includes("new card") || d.includes("new rune") || d.includes("soul stone") || d.includes("new tarot")) return "card";
  if (d.includes("co-player baby") || d.includes("co-op baby")) return "coop_baby";
  if (d.includes("challenge is available") || d.includes("new challenge")) return "challenge";
  return "misc";
}

function reward(name: string, cat: string, description: string): string {
  const label: Record<string, string> = {
    character: "character", item: "item", trinket: "trinket", pill: "pill",
    card: "card/rune", coop_baby: "co-op baby", challenge: "challenge",
  };
  if (label[cat]) return `${name} (${label[cat]})`;
  return description && !/^unlocked/i.test(description) ? description : "—";
}

// ---------------------------------------------------------------------------
// Parsing HTML
// ---------------------------------------------------------------------------
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    // Numeric entities BEFORE whitespace normalization: &#160; (NBSP) must
    // become a space, otherwise "Tainted&#160;???" breaks character detection.
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dlcOfNameCell(rawNameCell: string): string {
  // The DLC badge is read ONLY from the "Name" cell (Unlock cells also
  // contain badges referencing DLC content - those must be ignored).
  if (/Dlc_r%2B_indicator/i.test(rawNameCell)) return "repentance_plus";
  if (/Dlc_a%E2%80%A0_indicator/i.test(rawNameCell)) return "afterbirth_plus";
  if (/Dlc_r_indicator/i.test(rawNameCell)) return "repentance";
  if (/Dlc_a_indicator/i.test(rawNameCell)) return "afterbirth";
  return "rebirth";
}

interface RawAchievement {
  id: number;
  name: string;
  description: string;
  unlock: string;
  dlc: string;
}

function parseAchievements(html: string): RawAchievement[] {
  const tableStart = html.indexOf("<table");
  const tableEnd = html.indexOf("</table>", tableStart) + 8;
  const table = html.slice(tableStart, tableEnd);
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);

  const out: RawAchievement[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const id = parseInt(stripTags(cells[1]), 10);
    if (!Number.isFinite(id)) continue;
    out.push({
      id,
      name: stripTags(cells[0]),
      description: stripTags(cells[3]),
      unlock: stripTags(cells[4]),
      dlc: dlcOfNameCell(cells[0]),
    });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("→ Fetching the achievements table from the wiki…");
  const res = await fetch(WIKI_HTML_API, { headers: { "User-Agent": "IsaacCompletionTracker-buildKnowledge/0.1 (dev-time; github.com/reiassezbeau)" } });
  if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`);
  const json = (await res.json()) as { parse?: { text?: string } };
  const html = json.parse?.text ?? "";
  if (!html) throw new Error("Wiki: empty HTML (did the page structure change?)");

  const raw = parseAchievements(html);
  console.log(`  ${raw.length} achievements parsed (id ${raw[0]?.id}..${raw.at(-1)?.id})`);

  // Hard self-checks.
  const assertName = (id: number, expected: string) => {
    const a = raw.find((x) => x.id === id);
    if (!a || !a.name.toLowerCase().includes(expected.toLowerCase()))
      throw new Error(`Check failed: id ${id} expected "${expected}", got "${a?.name}"`);
  };
  if (raw.length !== EXPECTED_TOTAL) throw new Error(`Total ${raw.length} ≠ ${EXPECTED_TOTAL} expected`);
  assertName(1, "Magdalene");
  assertName(637, "Dead God");
  assertName(641, "Item Descriptions");
  const ids = new Set(raw.map((r) => r.id));
  for (let i = 1; i <= EXPECTED_TOTAL; i++) if (!ids.has(i)) throw new Error(`ID manquant: ${i}`);

  const achievements = raw.map((a) => {
    const cl = classifyUnlock(a.unlock);
    let cat = category(a.description);
    // Refinement: when the description does not say "Unlocked a new X", we recover
    // a useful category from the unlock mechanism (better UI filters).
    if (cat === "misc") {
      if (cl.type === "character_completion") cat = "completion_mark";
      else if (cl.type === "boss_first_kill") cat = "boss";
      else if (cl.type === "challenge") cat = "challenge";
    }
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      category: cat,
      dlc: a.dlc,
      hidden: false, // the Steam "hidden" flag is not exposed by the wiki; the UI reveals the conditions of locked achievements on demand.
      unlock: {
        text: a.unlock,
        type: cl.type,
        character: cl.character,
        target: cl.target,
        predictable: cl.predictable,
      },
      reward: reward(a.name, cat, a.description),
    };
  });

  // Sanity stats.
  const dist = (arr: string[]) => arr.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
  console.log("  DLC:", dist(achievements.map((a) => a.dlc)));
  console.log("  Category:", dist(achievements.map((a) => a.category)));
  console.log("  Type unlock:", dist(achievements.map((a) => a.unlock.type)));
  console.log("  Predictable:", achievements.filter((a) => a.unlock.predictable).length);

  // --- Deep validation (guardrails §3.2): the classification that drives
  // the predictor and EV MUST be correct. The build fails if an invariant breaks.
  const charIds = new Set(CHARACTERS.map((c) => c.id));
  const endingIds = new Set(ENDINGS.map((e) => e.id));
  for (const a of achievements) {
    const u = a.unlock;
    if (u.character && !charIds.has(u.character)) throw new Error(`char invalide #${a.id} ${a.name}: "${u.character}"`);
    if (u.target && !endingIds.has(u.target) && !u.target.startsWith("challenge_"))
      throw new Error(`target invalide #${a.id} ${a.name}: "${u.target}"`);
    if (u.type === "character_completion" && (!u.character || !u.target))
      throw new Error(`character_completion incomplet #${a.id} ${a.name}`);
  }
  // Coverage: every character (34) must have both a Mother and a Beast completion.
  const cover = new Map<string, Set<string>>();
  for (const a of achievements) {
    if (a.unlock.type === "character_completion" && a.unlock.character) {
      if (!cover.has(a.unlock.character)) cover.set(a.unlock.character, new Set());
      cover.get(a.unlock.character)!.add(a.unlock.target!);
    }
  }
  for (const c of CHARACTERS) {
    const s = cover.get(c.id) ?? new Set<string>();
    if (!s.has("mother") || !s.has("beast"))
      throw new Error(`Incomplete coverage for ${c.id}: Mother/Beast missing (is the classification broken?)`);
  }
  console.log(`  ✓ Validation: ids valid, character_completion complete, Mother+Beast coverage ${CHARACTERS.length}/${CHARACTERS.length}`);

  mkdirSync(RES, { recursive: true });
  const meta = {
    game: "The Binding of Isaac: Rebirth",
    edition: "Repentance+",
    total: EXPECTED_TOTAL,
    generated_at: new Date().toISOString().slice(0, 10),
    source: "bindingofisaacrebirth.wiki.gg (page Achievements, order by id)",
    note: "Compiled at dev time; runtime is 100% offline. The secret IDs match the bits in the save.",
  };
  writeFileSync(resolve(RES, "achievements.json"), JSON.stringify({ meta, achievements }, null, 2) + "\n");
  writeFileSync(resolve(RES, "characters.json"), JSON.stringify(CHARACTERS, null, 2) + "\n");
  writeFileSync(resolve(RES, "endings.json"), JSON.stringify(ENDINGS, null, 2) + "\n");

  console.log(`✓ Written to ${RES}: achievements.json (${achievements.length}), characters.json (${CHARACTERS.length}), endings.json (${ENDINGS.length})`);
}

main().catch((e) => {
  console.error("✗ build-knowledge failed:", e.message);
  process.exit(1);
});
