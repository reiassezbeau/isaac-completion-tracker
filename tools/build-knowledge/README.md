# tools/build-knowledge — Knowledge base compilers (dev time)

These **dev-time** scripts (internet allowed) compile the data bundled into the app.
They are **not** part of the shipped binary: only the generated JSON is embedded, and the
app makes **no** network call at runtime.

> Created by **reiassezbeau** — https://github.com/reiassezbeau

## What they produce

### `build.ts` — the 641 achievements

- `src-tauri/resources/achievements.json` — the 641 achievements: `id` (the in-game secret ID,
  which is also the bit read from the save), `name`, `description`, `category`, `dlc`, `hidden`,
  `unlock` (always-readable `text` plus a structured `type` / `character` / `target` /
  `predictable` classification) and `reward`.
- `src-tauri/resources/characters.json` — the 34 characters (17 + 17 Tainted) with their
  `save_index` (the binary order of the marks section).
- `src-tauri/resources/endings.json` — the 12 completion marks (binary order), with `mark_index`
  and `hard_matters`.

`routing_tips.json` is **hand-written** (editorial), not generated here.

### `build-item-kb.ts` — the item knowledge base

One curated, factual source produces **two formats** from a single definition:

- `src-tauri/resources/item_kb.json` — for the app (rich views).
- `isaac-tracker-mod/item_kb.lua` — for the mod (compact in-run lookups).

Per item: `id`, `name`, roles, stat effects (with an additive vs multiplicative flag), granted
tear flags, `is_tears_replacement`, `is_familiar`, `complexity`, plus a short factual note.
Item IDs are verified against the official `CollectibleType` enum.

**Constraints**: factual data only — **no ripped assets** (no sprites, no video) and no copied
prose from other tools such as EID.

## Source

The `Achievements` table of the community wiki **bindingofisaacrebirth.wiki.gg**
(`order by = id`). The table ID matches the in-game "secret" exactly, and therefore the bit read
from `persistentgamedata*.dat`. The parsing is reimplemented here; no third-party code is copied.

Hard self-checks (the build fails if the wiki structure changed):

- total = **641**,
- `id 1 = Magdalene`, `id 637 = Dead God`, `id 641 = Item Descriptions`,
- no missing ID across `1..641`,
- the DLC breakdown must match the official counts
  (Rebirth 178, Afterbirth 98, Afterbirth+ 127, Repentance 234, Repentance+ 4).

## Regenerating

```bash
npm run build:knowledge   # the 641 achievements
npm run build:item-kb     # the item knowledge base (both formats)
```

The generated files are **committed** so the build is reproducible without re-scraping. Do not edit
them by hand: re-run the script instead. If the wiki structure changes, adjust the parsing and
classification here, then regenerate.

## Known limitations

- The Steam "hidden" flag (181 hidden achievements) is not exposed by the wiki, so `hidden` is set
  to `false` for all of them. Instead, the UI offers an opt-in reveal for the conditions of
  **locked** achievements (spoilers).
- The `unlock.type` / `predictable` classification is **heuristic** and deliberately
  **conservative**: `predictable: true` only in high-confidence cases (character_completion, clean
  boss_first_kill, challenge). When in doubt it falls back to `predictable: false` — the
  achievement stays visible in the browser with its condition text, but is not predicted. The
  `unlock.text` condition itself is always exact.
- The item knowledge base is intentionally **partial and extensible**: it prioritizes high-value,
  highly reliable data (tear replacements and their conflicts, tear flags, flight, familiars,
  classic stat-ups). Named synergies are a curated subset, not an exhaustive list.
