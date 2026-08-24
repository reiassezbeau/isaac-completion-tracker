# Contributing

Thanks for looking. This is a small, opinionated project — reading this first will save
you a round trip.

## The three rules that will not change

1. **The save is read-only.** The app opens `persistentgamedata*.dat` to read and never
   writes to it, never deletes it, never moves it. Any change that could touch a player's
   save will be refused, however convenient it looks. The same goes for the picker: files
   that are not useful get folded away, never removed from disk.
2. **No ripped game assets.** No sprite, no screenshot, no copied wiki prose. The whole
   visual identity is hand-made SVG, and it stays that way — that is what keeps this
   distributable under GPL-3.0. Facts (ids, names, effects) are fine; artwork is not.
3. **Offline by default.** Nothing may contact the network on a timer, at startup, or as a
   side effect. The one exception is the update check in *About*, and it only runs while
   the user is pressing the button. If you add a second network call, it needs the same
   deal: explicit, documented in the README, and never carrying user data.

## Reporting a bug

Open an issue with the **Bug report** template. The single most useful thing you can
include is the **Diagnostic** tab: it shows the resolved paths, the save that is loaded,
whether the mod is installed, and whether the completion marks decoded reliably. A
screenshot of it answers most questions before they are asked.

If the bug is about a save that will not load, the exact **file name** matters
(`rep+persistentgamedata1.dat` and `rep_persistentgamedata1.dat` are different editions).

## Translations

The catalogs live in `src/lib/i18n.ts` and `src/lib/i18n-views{,2,3,4,5}.ts`. Every key
carries all 13 languages; a missing language falls back to English rather than breaking.

The non-Latin translations (hi, ar, bn, ur, zh, ja) were generated and are the most likely
to read awkwardly to a native speaker — **corrections are genuinely welcome** and are the
easiest possible first contribution. Edit the value, leave the key alone.

Some strings are untranslated **on purpose**, for faithfulness to the game: floor names,
DLC names, `Hard` / `Normal`, character and ending names, and the theme names (Basement,
Sheol, The Void, Corpse, Cathedral). Players use the English terms in every language.

## Working on the code

```bash
npm install
npm run tauri dev       # the real app
npm run dev             # front end alone (Tauri calls will fail; fine for styling)
```

Before opening a pull request:

```bash
npm run audit                          # static audit (see below)
npx tsc --noEmit                       # types
npm run test                           # front-end unit tests
npm run build                          # production bundle
cd src-tauri && cargo test --lib       # backend
cd src-tauri && cargo clippy --all-targets -- -D warnings
```

`npm run check` chains the first four. All of them are expected to pass with zero
output. `cargo test` includes a test that runs against a real save when one is present
and skips cleanly when it is not.

### The audit

`tools/audit.py` exists because a run of bugs shipped that no test caught and only
showed up by watching someone use the app: a header hardcoded in French, red text
at 2.77:1 against its own background, and 136 achievements displaying a literal
"???" because the wiki redacts hidden unlocks that way and the generator copied it.

Each of those is now a check, so none of them can come back quietly:

- **UI text that bypasses `t()`** - asks the structural question (is this string
  translated?) instead of guessing whether a string looks foreign.
- **Catalogue integrity** - keys referenced but never declared render as the raw
  key to the user; keys declared twice make the winner depend on file order.
- **Contrast per theme** - every semantic colour, measured on its own surface,
  against the 3.0:1 floor for bold text.
- **Bundled data** - placeholder values reaching the UI. Isaac genuinely names
  things "???" and "Undefined", so the exclusion is driven by the collectible
  index rather than an allowlist.
- **Version consistency** - four files declare the version; a mismatch ships an
  installer whose About screen lies.
- **Backend prose** - a `Serialize` struct must not carry a free-form prose field.
  The build assistant built English sentences in Rust and the view printed them
  as-is, so its whole strengths/weaknesses panel stayed English in all 13
  languages. Send a `Note { code, params }` and let the catalogue own the wording;
  a field that genuinely carries generated-JSON facts (an item name, a wiki unlock
  condition) is exempted with an `// i18n-exempt:` comment saying why.
- **Note codes** - every code Rust emits has a `bldn.*` entry. They are built by
  template in the view, so the generic reference check cannot see them.
- **Views that cache mod data** - the mod's run history lives in its own file, not
  in the save. Refresh re-read only the save, so a run that had just ended stayed
  invisible and the button looked broken. Any view calling `getRunHistory` or
  `getStatsOverview` must depend on `dataVersion`.

When you fix a bug that a person had to *see*, add the check that would have found
it. That is the whole point of the file.

### The item knowledge base: 59 verified, 660 derived

`build-item-kb.ts` holds hand-verified entries and derives the rest from the wiki's
Items table. Both halves are needed: curating 719 items by hand is not realistic,
and a curated-only base covered 5.3% of the items picked up across 25 real runs -
the assistant spent its time answering "30 items not in the knowledge base".

Two rules keep the derived half honest:

- **Anything ambiguous yields nothing.** A magnitude is recorded only when the
  description states it with a sign and a unit; "increases damage" sets the role
  and stops there. An invented number is worse than an absent one.
- **The curated entries are the derivation's test set.** The build cross-checks
  flight, tear replacement, familiar and tear flags against all 53 comparable
  hand-verified items and *fails* on any disagreement. That caught the scraper
  returning Transcendence's flavour quote instead of its description - it silently
  lost its flight, and nothing else would have noticed.

The comparison cuts both ways: it also found four wrong *curated* entries (Lord of
the Pit's homing, Dead Dove's piercing, Immaculate Heart's homing, Tiny Planet's
missing spectral), each verified against the item's own wiki page before fixing.
When the wiki's one-line description genuinely cannot carry what a curated entry
knows, add the id to `EXPECTED_DISAGREEMENT` with a comment saying why.

Derived entries carry `curated: false`, and the app degrades gracefully: a stat
delta involving one is flagged approximate, because nobody checked that number.

### The knowledge bases are generated, not hand-edited

Three files under `src-tauri/resources/` are compiled at dev time (internet allowed) and
committed:

```bash
npm run build:knowledge    # the 641 achievements, from the community wiki
npm run build:item-kb      # the curated item knowledge base -> app JSON + mod Lua
npm run build:item-names   # the full collectible name index (~719 entries)
```

Editing the generated JSON by hand will be silently undone the next time someone
regenerates. Edit the generator in `tools/build-knowledge/` instead. Each one has hard
self-checks and **fails the build** rather than shipping a bad index — that is deliberate,
because a wrong classification quietly corrupts the predictor.

### Adding an item to the knowledge base

`tools/build-knowledge/build-item-kb.ts` holds curated *facts*: ids verified against the
`CollectibleType` enum, roles, stat deltas, tear flags, and a short note in our own words.

If you add a synergy, only add outcomes you can point to. The engine deliberately says
"this pair is not documented" rather than guessing — an invented interaction is worse than
an absent one, because players act on it.

## Language of the repository

Code, comments, commit messages, and documentation are in **US English**. The app's
interface is translated; the repository itself is not.

## Questions

[Discord](https://discord.gg/53NyaVUE73) for anything conversational, issues for anything
that needs tracking.
