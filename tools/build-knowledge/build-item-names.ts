// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * tools/build-knowledge/build-item-names.ts — Compiles the collectible NAME INDEX
 * (DEV-TIME, internet allowed). Source: the community wiki's Collectibles table
 * (bindingofisaacrebirth.wiki.gg), which lists every collectible with its in-game id.
 *
 * Why this exists: item_kb.json only covers the ~60 items the Build Assistant can
 * reason about. A run snapshot holds every collectible the player was carrying, so
 * without this index the UI had to fall back to showing a raw "#317". Names are
 * plain factual identifiers — the same category as the achievement names we already
 * compile — so this ships only `id -> name`, no sprite and no wiki prose.
 *
 * Output: src-tauri/resources/item_names.json
 * Regenerate with `npm run build:item-names`.
 *
 * Created by reiassezbeau — https://github.com/reiassezbeau
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES = resolve(__dirname, "../../src-tauri/resources");

const WIKI_API =
  "https://bindingofisaacrebirth.wiki.gg/api.php?action=parse&page=Items&prop=text&format=json&formatversion=2";

const UA = "IsaacCompletionTracker-buildItemNames/0.1 (dev-time; github.com/reiassezbeau)";

/** Ids we know for sure — anchors so a wiki layout change fails the build loudly. */
const ANCHORS: Record<number, string> = {
  52: "Dr. Fetus",
  118: "Brimstone",
  395: "Tech X",
  533: "Trisagion",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Pulls (id, name) pairs out of the rendered table. Each row is
 *   <td data-sort-value="Brimstone"><a title="Brimstone">…</a></td>
 *   <td data-sort-value="118"><span class="ghost">5.100.</span>118</td>
 * so the name comes from the first cell's link (falling back to its sort value)
 * and the id from the first *numeric* sort value after it. Reading the sort value
 * rather than the visible text avoids the "5.100." prefix entirely.
 */
function parseItems(html: string): Map<number, string> {
  const out = new Map<number, string>();
  const rows = html.split(/<tr[^>]*>/i).slice(1);
  for (const row of rows) {
    const cells = row.split(/<td/i).slice(1).map((c) => "<td" + (c.split(/<\/td>/i)[0] ?? ""));
    if (cells.length < 2) continue;

    let name = "";
    let id: number | null = null;
    for (const cell of cells) {
      const sort = cell.match(/data-sort-value="([^"]*)"/i)?.[1];
      if (!name) {
        const link = cell.match(/<a[^>]*title="([^"]+)"/i)?.[1];
        if (link) {
          name = decodeEntities(link).trim();
          continue;
        }
        if (sort && !/^\d+$/.test(sort)) {
          name = decodeEntities(sort).trim();
          continue;
        }
      }
      if (name && id === null && sort && /^\d{1,4}$/.test(sort)) {
        id = Number(sort);
        break;
      }
    }
    if (id !== null && id > 0 && name && !out.has(id)) out.set(id, name);
  }
  return out;
}

async function main() {
  console.log("→ Fetching the collectibles table from the wiki…");
  const res = await fetch(WIKI_API, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`);
  const json = (await res.json()) as { parse?: { text?: string } };
  const html = json.parse?.text ?? "";
  if (!html) throw new Error("Wiki: empty HTML (did the page structure change?)");

  const items = parseItems(html);
  console.log(`  ${items.size} collectibles parsed`);

  // Hard self-checks: a silent layout change must fail the build, not ship a bad index.
  if (items.size < 600) {
    throw new Error(`Only ${items.size} collectibles found - the table layout probably changed`);
  }
  for (const [id, expected] of Object.entries(ANCHORS)) {
    const got = items.get(Number(id));
    if (!got || !got.toLowerCase().includes(expected.toLowerCase().replace(/^the /, ""))) {
      throw new Error(`Anchor failed: id ${id} expected "${expected}", got "${got}"`);
    }
  }

  const names: Record<string, string> = {};
  for (const id of [...items.keys()].sort((a, b) => a - b)) names[String(id)] = items.get(id)!;

  const payload = {
    meta: {
      count: items.size,
      generated_at: new Date().toISOString().slice(0, 10),
      source: "bindingofisaacrebirth.wiki.gg (Collectibles page)",
      note: "Compiled at dev time; runtime is 100% offline. Names only - no sprite, no wiki prose.",
    },
    names,
  };
  writeFileSync(resolve(RES, "item_names.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log(`✓ Written to ${RES}: item_names.json (${items.size} names)`);
}

main().catch((e) => {
  console.error("✗ build-item-names failed:", e.message);
  process.exit(1);
});
