// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * tools/build-knowledge/derive-synergies.ts — pairs of collectibles the community
 * wiki documents as interacting (DEV-TIME, internet allowed).
 *
 * WHY THIS EXISTS
 * The knowledge base carried 16 hand-written synergies for 719 items, so the build
 * assistant answered "no strong named synergy" for essentially every pair anyone
 * actually tested. This finds ~4300 documented pairs covering ~630 items.
 *
 * WHAT IT REFUSES TO DO
 * It does not judge the pair, and it does not copy a word of the wiki's prose.
 *
 * A first attempt classified each bullet with keywords - "overrides", "replaced by",
 * "loses" meaning a conflict. It agreed with the hand-verified set 6 times out of 16
 * and, worse, called Brimstone + Mom's Knife DANGEROUS: those two merge into one of
 * the best weapons in the game, and the wording that fooled the classifier was the
 * sentence describing the merge. An app that tells you to skip that is worse than an
 * app that says nothing.
 *
 * So the only signal kept is the one that can be pointed at: which section the wiki's
 * own editors filed the bullet under. That is reported as attribution, never as
 * endorsement - "the wiki documents this pair" - and derived pairs deliberately do
 * NOT feed the verdict. Only the hand-verified entries do.
 *
 * Even that is imperfect: the wiki files Ipecac + Dr. Fetus under Synergies while our
 * verified entry calls it dangerous (it works, and it kills you). Both readings are
 * defensible, which is exactly why the curated entry always wins.
 */

const API = "https://bindingofisaacrebirth.wiki.gg/api.php";
const UA = "isaac-completion-tracker/0.5 (+https://github.com/reiassezbeau/isaac-completion-tracker)";
/** MediaWiki caps an anonymous multi-title query at 50. */
const BATCH = 50;

export type SynergyKind = "synergy" | "interaction";

export interface DerivedSynergy {
  a: number;
  b: number;
  kind: SynergyKind;
}

function sectionOf(wikitext: string, name: string): string {
  const m = new RegExp(`^==\\s*${name}\\s*==\\s*$([\\s\\S]*?)(?=^==\\s|$(?![\\s\\S]))`, "m").exec(
    wikitext,
  );
  return m?.[1] ?? "";
}

async function fetchBatch(titles: string[]): Promise<{ title: string; text: string }[]> {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: titles.join("|"),
    format: "json",
    formatversion: "2",
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`wiki HTTP ${res.status}`);
  const json = (await res.json()) as {
    query?: { pages?: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] };
  };
  return (json.query?.pages ?? [])
    .filter((p) => !p.missing && p.revisions?.[0])
    .map((p) => ({ title: p.title, text: p.revisions![0].slots.main.content }));
}

/**
 * @param names id -> collectible name, which doubles as the wiki page title
 *   (verified: all 719 resolve with no redirect and no normalisation).
 */
export async function deriveSynergies(
  names: Map<number, string>,
): Promise<{ pairs: DerivedSynergy[]; unresolved: Map<string, number> }> {
  const idOf = new Map([...names].map(([id, n]) => [n.toLowerCase(), id]));
  const titles = [...names.values()];

  // Key is "lo-hi" so a pair listed on both items' pages is stored once.
  const pairs = new Map<string, SynergyKind>();
  const unresolved = new Map<string, number>();

  for (let i = 0; i < titles.length; i += BATCH) {
    for (const page of await fetchBatch(titles.slice(i, i + BATCH))) {
      const a = idOf.get(page.title.toLowerCase());
      if (a === undefined) continue;

      for (const [name, kind] of [
        ["Synergies", "synergy"],
        ["Interactions", "interaction"],
      ] as const) {
        for (const line of sectionOf(page.text, name).split("\n")) {
          const s = line.trim();
          // Only top-level bullets. Nested ones ("**") elaborate on the line above
          // and their item links belong to that same pair, not to a new one.
          if (!s.startsWith("* ")) continue;
          for (const m of s.matchAll(/\{\{[Ii]\|([^|}]+)/g)) {
            const ref = m[1].trim();
            const b = idOf.get(ref.toLowerCase());
            if (b === undefined) {
              unresolved.set(ref, (unresolved.get(ref) ?? 0) + 1);
              continue;
            }
            if (b === a) continue;
            const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
            // "synergy" is the more specific filing; keep it if either page uses it.
            if (pairs.get(key) !== "synergy") pairs.set(key, kind);
          }
        }
      }
    }
    // The wiki is a volunteer-run service and this is a dev-time script: no rush.
    await new Promise((r) => setTimeout(r, 400));
  }

  return {
    pairs: [...pairs].map(([key, kind]) => {
      const [a, b] = key.split("-").map(Number);
      return { a, b, kind };
    }),
    unresolved,
  };
}
