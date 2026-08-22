# Isaac Completion Tracker

[🇫🇷 Français](README.md) · **🇬🇧 English**

> **Local, 100 % offline** completion tracker for *The Binding of Isaac: Repentance+*
> (641 Steam achievements). Reads your save **read-only** and tells you exactly what to
> do next — all the way to **Dead God**.
>
> Created by **[reiassezbeau](https://github.com/reiassezbeau)** · [github.com/reiassezbeau](https://github.com/reiassezbeau)

---

## What it does

- **Dashboard** — global `X / 641` counter, %, a "distance to Dead God" gauge (12 rings, one per
  ending), per-category breakdown, recommended next targets.
- **The Grid** — the completionist's board: **34 characters × 12 marks** at a glance, with
  per-column totals so you can spot your bottleneck instantly.
- **Character** — for each of the 34 characters (17 + 17 Tainted): their completion marks
  (To do / Normal / Hard), what's left to do and what it unlocks, routing tips.
- **Predictor** — "if I beat **[boss]** as **[character]**", it tells you what that unlocks
  (achievements, items) and whether it moves you toward Dead God. Plus a reverse "what next" view.
- **Optimizer** — ranks your next actions by **expected value** (value × probability of success):
  ETA to Dead God, bottlenecks, characters closest to 100 %.
- **Build Assistant** — simulator: compose your build, test a candidate item → stat delta,
  **before/after radar**, tear-replacement conflicts, verdict.
- **Game stats** (with the mod) — winrate, hits per floor, trends, records, insights.
- **Shareable card** — generate a PNG image of your progress or a notable run.
- **641-achievement browser** — search, filters (category / DLC / status), reveal the unlock
  conditions of locked achievements.
- **Roadmap** to Dead God, recomputed on every save read.
- **Manual overrides** — safety net if parsing gets something wrong (stored outside the save).
- **Live update** — as you play, the app refreshes itself.

### Personalization

- **5 themes** inspired by the game's locations: Basement, Sheol, The Void, Corpse, Cathedral (light).
- **13 languages** (navigation and chrome; view texts being translated) : English, Français, Español, Português, Deutsch, Русский, Polski, 中文, 日本語,
  हिन्दी, العربية, বাংলা, اردو (with RTL support).

**Zero network at runtime.** All knowledge (the 641 achievements + conditions) is bundled.
The app's CSP blocks any external access (`connect-src 'self'`).

## Where the app finds your save

On **Repentance+**, the live save usually lives in **Steam Cloud**:
`…/Steam/userdata/<id>/250900/remote/rep+persistentgamedata{1,2,3}.dat`.
The app also scans `Documents/My Games/Binding of Isaac Repentance+/` (and its backups). If nothing
is found, a **"Locate my save…"** button lets you point to the folder manually.
**Your save is never modified** (opened read-only).

## Installation (users)

Download the latest `.exe` installer from [Releases](https://github.com/reiassezbeau/isaac-completion-tracker/releases), run it, done.

> ⚠️ **SmartScreen**: the installer is unsigned (certificates cost money). Windows may show
> "Windows protected your PC". Click **"More info" → "Run anyway"**. This is normal for unsigned
> open-source software; the code is right here and auditable.

## In-game stats mod (optional)

A companion Lua mod, **purely an observer**, counts your hits and per-run stats (cross-referenced
with your completion).

### Installing the mod

**One click from the app** — no separate download:

1. Open the app → **Dashboard** banner (or the **Diagnostic** tab) → **"Install the stats mod"**
   button.
   The app automatically finds your **Steam** mods folder (via the registry + `libraryfolders.vdf`,
   even if the game is on another drive) and copies the mod there.

### Launching the mod

2. **Restart Isaac** — ⚠️ mods are only loaded **at game startup**. If Isaac was already running,
   close it completely first. A **"Launch Isaac"** button is provided in the app.
3. **Verify**: the mod shows up under *Options → Mods* as "**Isaac Tracker Stats**"
   (enabled by default). The app's **Diagnostic** tab also confirms the installation.
4. **Play**: stats flow automatically into the app's **Stats** tab.

> **Do I need to "launch" the mod?** No — the mod isn't a separate program: it's Lua loaded by
> Isaac **at game startup**. So the ideal order is: **game closed → install the mod from the app →
> launch Isaac**. The mod is active from your very first run, nothing else to do. The only case to
> avoid is installing **while** Isaac is running: you then have to close and restart it.

> **Your run is never lost.** You can enable/disable the mod and restart the game: the mod saves
> the current run when you return to the menu, and resumes it on **Continue**. An unfinished run
> is archived, never deleted.

> The mod **never uses the debug console** and **does not modify gameplay** → no impact on
> achievements once Mom has been beaten on that slot (a game rule, not a tracker rule). On a
> **fresh** save, beat Mom once before relying on unlocks.

> **Write permissions**: the mods folder lives under `Program Files`; it is almost always writable
> (Steam sets the permissions). If installation fails (locked folder), run the app as administrator,
> or copy `isaac-tracker-mod/` manually into
> `…\steamapps\common\The Binding of Isaac Rebirth\mods\`.

## Build (developers)

Requirements: **Node 18+**, **Rust stable** (MSVC toolchain on Windows), plus
**VS C++ Build Tools** + **WebView2** (preinstalled on Win 11).

```bash
npm install
npm run tauri dev      # run the app in dev mode
npm run tauri build    # produces the .exe (NSIS) + .msi installer in src-tauri/target/release/bundle
```

### Regenerating the knowledge bases

Compiled at **dev-time** (internet allowed), then committed:

```bash
npm run build:knowledge   # the 641 achievements
npm run build:item-kb     # the item knowledge base (2 formats: app + mod)
```

Details and sources in [`tools/build-knowledge/README.md`](tools/build-knowledge/README.md).

### Parser tests

```bash
cd src-tauri
# Validate against a real save (optional):
ISAAC_SAVE_PATH="C:/…/remote/rep+persistentgamedata1.dat" cargo test
```

Without `ISAAC_SAVE_PATH`, the tests use a synthetic in-memory fixture.

### Replacing the icon

The icon is a red/gold placeholder generated from `src-tauri/icons/icon-source.png`.
To replace it, supply your own 1024×1024 PNG then:

```bash
npm run tauri icon path/to/your-icon.png
```

## Stack

Tauri v2 (Rust) · React 19 + TypeScript (strict) · Vite · Tailwind CSS v3 · Zustand · lucide-react.

## Credits

Created by **[reiassezbeau](https://github.com/reiassezbeau)**.
Achievement database compiled from the community *Binding of Isaac: Rebirth* wiki.
The save format was reverse-engineered by the community; the parsing is reimplemented cleanly
(no third-party code copied) and **validated against a real save**.

Visual identity is **100 % original** (hand-made SVG, no game assets). *Cinzel* font (OFL).
Parchment texture: public domain (CC0, OpenGameArt).

## License

[GPL-3.0](LICENSE) © 2026 reiassezbeau. Any derivative must stay open-source and keep the
attribution — you may not repackage this project and claim it as your own.

A **community tool, not affiliated** with Nicalis / Edmund McMillen.
