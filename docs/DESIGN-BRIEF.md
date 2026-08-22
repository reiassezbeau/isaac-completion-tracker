<!-- SPDX-License-Identifier: GPL-3.0-only -->
<!-- Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau -->

# Design brief — **Isaac Completion Tracker**
### The brief used to build the app's whole art direction

> **Expected role:** the application is **already functional** (every view exists and works).
> The mission is NOT to add features, it is to **raise the aesthetics**: visual identity,
> component system, data viz, original assets, micro-interactions. Work on top of what exists.

---

## ▶️ How to use this document — read this first

**This document is self-contained**: it holds everything needed. Steps:
1. **Read this brief in full.**
2. **Explore the code**: `src/views/` (the 13 views), `src/components/ui.tsx` (the `Card`,
   `Pill`, `ProgressBar`, `SectionTitle`, `EmptyState`, `StatTile`, `GitHubLink` components),
   `src/components/Layout.tsx` (sidebar + header + footer), and above all
   **`tailwind.config.js`** — that is **where** the `isaac-*` tokens to rework live.
3. **Deliver first** the *design system* (tokens + rationale), then a **Dashboard mockup and the
   34×12 marks grid**. Then iterate **view by view**.

**Exact stack**: Tauri v2 · **React 19** · strict TypeScript · **Tailwind CSS v3** (⚠️ not v4) ·
lucide-react · Zustand. Any Tailwind v4 config or pattern must be corrected.

**Interfaces to preserve**: the views consume the `ui.tsx` components listed above with their
current props. Keep those signatures (or explicitly call out the ones you change) so that
**nothing breaks** functionally.

**See the app running** (to calibrate against the real rendering): `npm run tauri dev`, load a save,
look at Dashboard / Character / Optimizer / Build Assistant / Stats / Card. Screenshots help, but
you can also start from the code.

**3 NON-negotiable guardrails** (the app is public and 100% offline):
1. **Zero external resources** — no Google Fonts, no CDN, no remote image. The CSP **blocks them at
   runtime**: everything must be **inline or bundled** (inline SVG, system font, or a base64-embedded font).
2. **Zero game assets** — no sprite, icon, portrait, or sound, and no copied prose (EID-style),
   *not even "just for the mockup"*. **Only ORIGINAL art** that you create.
3. **Do not break the functionality** — you restyle what exists, you do not add features.

*(The full detail — context, palette, inventory of the 13 screens, deliverables, anti-patterns — follows below.)*

---

## 🩸 Visual identity — the world of Isaac (THE CORE OF THE MISSION)

> **Pitfall #1 (already hit once, in Delivery 1).** The first design system was technically
> excellent but **soulless**: a generic "premium" dark red-and-gold dashboard that could have been
> a finance app. **That is NOT what we want.**

**"No ripped assets" does NOT mean "no theme".** It means: you **draw it yourself, from scratch** —
art that **EVOKES** the world of *The Binding of Isaac*. Go **all in** on that direction, 100%
original (SVG/CSS, offline).

**The mental reference: a CURSED GRIMOIRE / Isaac's journal** — not a SaaS dashboard. Isaac's world
is a filthy basement and attic, Christian religious horror (guilt, sacrifice, demons), blood, tears
and flesh, a **deliberately imperfect hand-drawn line**, and occult symbolism (cross, pentagram,
heart, tear, halo, worm).

**What to inject — all ORIGINAL:**
- **Materials**: stained parchment, grain, blood splatter, worn edges — through **original and
  subtle** SVG/noise filters (never photos or downloaded textures).
- **Hand-drawn line**: the glyphs and icons must NOT be clean lucide-style line icons. Give them a
  slightly wobbly, etched, organic stroke.
- **Redrawn occult and religious iconography** (cross, pentagram, tear, heart, halo, worm) —
  universal symbols that you recreate, **never the game's sprites**.
- **Character sigils** instead of "IS / MG / CA" monograms: 34 small original abstract
  sigils/silhouettes, recognizable at 20 px.
- **Embedded display font** (**free / OFL** license, base64) with real character (etched, lightly
  gothic) for titles and large numbers — not Segoe.
- **Diegetic frame**: the chrome, the headers, and the Dead God gauge treated as an **artifact from
  Isaac's world**.

**NON-negotiable balance — atmospheric skin, LEGIBLE data core.** This is a **dense tool**
(408 marks, 641 achievements): tables, numbers, and the marks grid stay **crisp and readable**.
The atmosphere lives in the **chrome, textures, iconography, and accents** — never in an unreadable
soup. **Do not overcorrect** into full grunge.

**Already ACQUIRED (Delivery 1) — keep it, do not redo it, you are DRESSING it:** the color ramps
(blood / gold + jade `#3ec07f` + warm charcoal neutrals), the **tokens as CSS variables**
(light/dark theme without touching the JSX), the **preserved `isaac-*` namespace**, `tabular-nums`,
the **dual color + shape encoding** (filled / ring / empty), the **34×12 grid split into 2 blocks of
17** with column totals, and the Tailwind integration. You do not rebuild that skeleton — you give
it a soul.

---

## 0. Product context
A **desktop** application (Windows) that helps a *The Binding of Isaac: Repentance+* player
**complete the 641 achievements** all the way to **Dead God** (100%). It reads the save read-only,
shows progress, predicts what a given run unlocks, draws a roadmap, and (through a companion mod)
tracks in-game stats. Audience: **hardcore completionists** — they want a tool that is **dense with
information, readable, and rewarding**, not cute. *Isaac* mood: dark, visceral, sacred/occult — see
the **🩸 Visual identity** section above, which is the heart of the mission.

## 1. Stack and technical constraints (MANDATORY)
- **Tauri v2 + React 19 + TypeScript + Tailwind CSS v3 + lucide-react.** Expected deliverables:
  Tailwind tokens, React/TSX components, and **inline SVG** (no external images).
- **100% offline, strict CSP**: **no external resource** — no Google Fonts, no CDN, no remote image,
  no icon downloaded at runtime. **Everything must be inline or bundled** (inline SVG, system font,
  or a base64-embedded font if truly needed).
- **NO ripped game assets** (a rights rule, since the product is shared publicly): no sprite, no
  icon, no portrait, no sound, no copied prose. **Only ORIGINAL art** (shapes, glyphs, abstract
  pictograms that YOU create). The *names* (characters, bosses, achievements) stay in English —
  that is text, and it is allowed.
- **Theme-aware**: dark by default (see palette), but a clean **light** rendering is expected too.
- **Accessibility**: AA contrast minimum, visible keyboard focus, click targets ≥ 32 px.
- **Responsive**: the window ranges from about 940 px to full screen; dense tables and grids scroll
  inside their own container (never a horizontal page scroll).
- The **reiassezbeau / github.com/reiassezbeau** attribution must stay present (footer + About) —
  style it, do not remove it.

## 2. Current palette and identity (a starting point to refine)
"Isaac" theme: very dark charcoal, **blood red**, **gold** (Golden God / Dead God), green for "done".
```
bg        #0a0a0c   surface   #141418   surface2 #1c1c22   border  #2a2a33
text      #eae7e1   muted     #9b968c
blood     #c1272d   blood-dim #7f1416   (main accent / "to do")
gold      #d4af37   gold-dim  #a8862b   (premium accent / Hard mark / Dead God)
done      #4caf50   (Normal mark / unlocked achievement)
```
Completion statuses: **red = to do**, **green = done (Normal)**, **gold = done (Hard)**.
Current typography: Inter / system Segoe UI. **You may** propose a better typographic hierarchy, or
even an embedded accent font (mono or display) for numbers and titles — **but bundled offline**.

Expected from you: **a complete, validated color system** (scales, hover/active/disabled states,
clear semantics), light + dark, coherent, a clear step above the current one.

## 3. Inventory of the screens to dress
**The views exist and work** (sidebar + content area + header + footer). Actual nav order:
1. **SlotPicker** (entry screen) — save selection (slot list + preview).
2. **Dashboard** — global X/641 counter + %, "distance to Dead God" gauge, per-category breakdown
   (bars), recommended next targets, mod onboarding banner.
3. **Character** — **grid of the 34 characters** (17 + 17 Tainted) + detail: **completion marks grid**
   (12 marks × status), "to do" list, routing tips, **"game stats" card** (winrate/hits, with the mod).
4. **Predictor** — 2 selectors (character × target) → a "this unlocks / nothing" result, plus a
   "what to do next" view.
5. **Achievements** — **browser for all 641**: search, filters (category/DLC/status), dense rows,
   reveal for hidden conditions.
6. **Roadmap** — an ordered plan toward Dead God (steps + progress bars).
7. **Optimizer** (`src/views/Optimizer.tsx`) — the **"what to play next" view**: a hero **Dead God ETA
   gauge** (marks done/408 + estimated runs/attempts), a list of **actions ranked by expected value**
   (each row: character + route + marks/achievements/items pills + EV bar + colored success %),
   **bottlenecks** (bars) and **"almost done"** (closest characters). Cold-start banner.
8. **Build Assistant** (`src/views/BuildAssistant.tsx`) — **simulator**: item picker (search),
   current build as chips, a "try synergy" panel with a **before/after SVG stat radar**, a colored
   verdict, synergy notes, stat delta, plus a **composition and strengths/weaknesses** panel.
9. **Stats** (`src/views/Stats.tsx`) — 3 tabs: **Overview** (KPI tiles, hits by source, **hits/floor
   heatmap**, **trend**, per-character table), **Runs** (history), **Insights** (streaks, correlation,
   cleanest/bloodiest characters, records).
10. **Card** (`src/views/StatCard.tsx`) — generator for a **shareable PNG card** (Profile + Run
    templates), rendered on a 1200×630 `<canvas>`, with preview and export. **The canvas rendering
    lives in the TSX** (hard-coded colors, see §4.8) — to be harmonized with your system.
11. **Diagnostic** — resolved paths, mod status, buttons (install mod / launch Isaac / backup).
12. **Overrides** — force the status of an achievement or a mark.
13. **About** — name, version, reiassezbeau credit (link), disclaimer.
- **Outside your web scope**: the **in-game HUD** (Lua rendering inside Isaac) — mentioned for
  context only; you do not touch it.

## 4. What I am asking you to produce
1. **Design system**: tokens (colors, spacing, radii, shadows, typography), light + dark, mapped onto
   Tailwind (`tailwind.config.js` + CSS variables). Documented.
2. **Component library** (React/TSX + Tailwind classes), coherent and reusable:
   cards, buttons (primary/secondary/ghost/danger), status badges/pills, **progress bars and rings**,
   checklist, **stat/KPI tiles**, dense tables, fields (input/select), toasts,
   **modals** (to replace the current raw `alert()` calls), empty states, alert banners, tooltips.
3. **Signature elements** (where the app has to impress):
   - **34×12 completion marks grid**: readable at a glance, status by color (red/green/gold),
     informative hover, dense yet elegant. This is THE completionist's board.
   - **"Dead God" gauge**: a centerpiece (ring/bar) that makes you want to get there.
   - **Mark badges** (To do / Normal / Hard) with a memorable design.
4. **ORIGINAL data viz** — these components **already exist** (basic functional implementation); your
   mission is to **elevate and harmonize** them, not to invent them. Concretely, restyle:
   - **per-category bars** (Dashboard) and **EV / bottleneck bars** (Optimizer),
   - **progress rings/gauges** — above all the **Dead God ETA gauge** (Optimizer) and
     "distance to Dead God" (Dashboard),
   - **hits/floor heatmap** and **trend bars** (Stats/Overview),
   - **before/after stat radar** (Build Assistant — `Radar` in `BuildAssistant.tsx`, a home-made
     6-axis SVG to elevate),
   - **score/cleanliness gauges** (Stats/Insights).
   Use an accessible data-viz palette (color-blind safe), coherent with the dark theme.
5. **ORIGINAL iconography and illustrations** (inline SVG) — **with a hand-drawn line, not clean line
   icons** (see § 🩸 Visual identity):
   - a set of **glyphs for the 12 endings/marks** (Mom's Heart, Mother, Beast, Hush, and so on) —
     evocative, occult, consistent with one another, NOT the game's sprites,
   - **34 original character sigils** (abstract silhouettes/symbols, NOT "IS/MG/CA" monograms, NOT
     the sprites) — recognizable at 20 px,
   - status/category icons with real character (beyond lucide-react).
6. **Micro-interactions**: animated fill for bars and rings, smooth view transitions, hover/press
   states, arrival toast, a discreet pulse on "new unlock". Restrained, never annoying.
7. **Onboarding / first launch**: a clear path (pick a save → install the mod → play); the existing
   banner is there to be elevated.
8. **Shareable stats card (PNG) template**: the card **already exists** (a 1200×630 `<canvas>`
   rendering, Profile + Run templates, `github.com/reiassezbeau` watermark) in
   `src/views/StatCard.tsx`. Its colors are **hard-coded** (the `C` object at the top of the file)
   because canvas cannot read Tailwind — give me the **final hex values** of your system for that
   object, plus a layout mockup to reproduce with canvas drawing calls.

## 5. Expected deliverables (format)
- A documented **design system** (tokens + rationale) ready to drop into Tailwind.
- **Mockups** of the key screens (at least Dashboard, Character/marks, Achievements, Roadmap) — as an
  HTML/React artifact.
- A reusable, theme-aware **component library** (TSX + Tailwind).
- The **original SVGs** (inline): ending glyphs, abstract avatars, Dead God gauge.
- **Data-viz specs** (chart types + palette + rules) applied to the existing **Stats / Optimizer /
  Build Assistant** views.
- Everything **strictly offline** (no external resource), **with no game assets whatsoever**.

## 6. Tone and anti-patterns
- **Yes**: dark, dense, visceral, occult/sacred, material and hand-drawn line, readability first,
  sparing red/gold accents, numbers that land, a rewarding sense of progress — **a cursed grimoire
  that is still a tool**.
- **No**: the generic, soulless **"SaaS dashboard"** (pitfall #1); cute/cartoon, garish neon,
  rainbow gradients, effect overload, illegibility for the sake of style; and above all **no visual
  taken from the game**.

> Refer to the repository for what exists (`src/`, `tailwind.config.js`). The app already runs; you
> can ask for screenshots of the current screens to start from that base and elevate it.
