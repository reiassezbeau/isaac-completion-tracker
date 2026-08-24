#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Isaac Completion Tracker - (c) 2026 reiassezbeau - https://github.com/reiassezbeau
"""Static audit of the things that only ever showed up by looking at the app.

Every check here exists because a real bug shipped and was caught by eye instead
of by a test. Watching a screen recording is a slow, lossy way to find them; each
one is written down here so it can never come back silently.

    python tools/audit.py          # from the repo root
    npm run audit

Exits non-zero if anything fails, so it can gate a release.
"""
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

LANGS = ["en", "fr", "es", "pt", "de", "ru", "pl", "zh", "ja", "hi", "ar", "bn", "ur"]
CATALOGS = [
    "src/lib/i18n.ts", "src/lib/i18n-views.ts", "src/lib/i18n-views2.ts",
    "src/lib/i18n-views3.ts", "src/lib/i18n-views4.ts", "src/lib/i18n-views5.ts",
    "src/lib/i18n-views6.ts",
]

failures: list[str] = []
notes: list[str] = []


def check(title):
    print(f"\n\033[1m{title}\033[0m")


def ok(msg):
    print(f"  \033[32mok\033[0m    {msg}")


def fail(msg):
    print(f"  \033[31mFAIL\033[0m  {msg}")
    failures.append(msg)


def read(p):
    return io.open(p, encoding="utf-8").read()


def source_files(exts=(".ts", ".tsx"), skip_i18n=True):
    for root, dirs, files in os.walk("src"):
        for fn in files:
            if not fn.endswith(exts):
                continue
            p = os.path.join(root, fn).replace(os.sep, "/")
            if p.endswith((".test.ts", ".test.tsx")):
                continue
            if skip_i18n and "i18n" in p:
                continue
            yield p


# ---------------------------------------------------------------------------
# 1. UI text that never reaches the translation layer.
#    Caught: "Historique des runs" sat hardcoded in Stats.tsx and stayed French
#    in all 13 languages. Keyword-based French hunting missed it (no accents),
#    so this asks the structural question instead.
# ---------------------------------------------------------------------------
def audit_untranslated_literals():
    check("UI text that bypasses t()")
    TEXT_PROPS = ("title", "aria-label", "placeholder", "label", "alt")
    ALLOW = re.compile(
        r"^(Isaac Completion Tracker|The Binding of Isaac.*|reiassezbeau|Tainted|Regular|"
        r"Hard|Normal|Repentance\+?|GPL-3\.0|Steam Cloud|Dead God|[\W\d]+|[A-Za-z]+)$"
    )
    # Fragments of code whose punctuation the >...< regex mistakes for JSX text.
    KNOWN_FALSE_POSITIVES = {"0.004) arcs.push(", ": ok === false ?", "string): Promise"}
    found = []
    for p in source_files((".tsx",)):
        for i, line in enumerate(read(p).split("\n"), 1):
            s = line.strip()
            if s.startswith(("//", "*", "/*")):
                continue
            for m in re.finditer(r">([^<>{}\n]{4,})<", line):
                txt = m.group(1).strip()
                if txt and not ALLOW.match(txt) and len(txt.split()) >= 2:
                    found.append((p, i, txt))
            for prop in TEXT_PROPS:
                for m in re.finditer(prop + r'="([^"]{4,})"', line):
                    txt = m.group(1).strip()
                    if not ALLOW.match(txt) and len(txt.split()) >= 2:
                        found.append((p, i, txt))
    real = [f for f in found if f[2] not in KNOWN_FALSE_POSITIVES]
    if real:
        for p, i, txt in real:
            fail(f"{p}:{i} literal never translated: {txt[:70]}")
    else:
        ok(f"no untranslated literals ({len(found)} known false positives skipped)")


# ---------------------------------------------------------------------------
# 2. Translation catalogue integrity.
#    Caught: a duplicated char.regular across two catalogues, and keys the UI
#    referenced that nothing declared (which render as the raw key to the user).
# ---------------------------------------------------------------------------
def audit_i18n():
    check("Translation catalogues")
    declared, dupes = {}, []
    for f in CATALOGS:
        for m in re.finditer(r'^\s*"([a-zA-Z0-9_.]+)":\s*\{(.*)\},\s*$', read(f), re.M):
            key, body = m.group(1), m.group(2)
            if key in declared:
                dupes.append(key)
            declared[key] = set(re.findall(r'(?:^|[\s{])([a-z]{2}):\s*"', body))

    used = set()
    for p in source_files():
        used |= set(re.findall(r'\bt\(\s*"([a-zA-Z0-9_.]+)"', read(p)))
    # Keys built at runtime by lib/format.ts helpers.
    for pre, vals in {
        "cat.": ["character", "item", "trinket", "pill", "card", "coop_baby", "challenge",
                 "completion_mark", "boss", "misc"],
        "role.": ["offensive", "defensive", "mobility", "tear_mod", "utility", "familiar"],
        "tflag.": ["homing", "piercing", "spectral", "explosive"],
        "stat.": ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"],
        "verdict.": ["strong_pickup", "fills_gap", "situational", "redundant_or_conflict"],
        "src.": ["steam_cloud", "documents", "backup"],
        "perr.": ["too_short", "bad_header", "unknown_version", "out_of_bounds", "unreadable"],
        "mark.": ["hard", "normal", "todo"],
        "nav.": [],
        "stage.": ["floor"],
    }.items():
        used |= {pre + v for v in vals}
    used |= {k for k in declared if k.startswith("nav.")}

    missing = sorted(used - set(declared))
    if missing:
        fail(f"referenced but never declared (renders as the raw key): {', '.join(missing)}")
    else:
        ok(f"{len(used)} keys referenced, all declared")

    if dupes:
        fail(f"declared twice: {', '.join(sorted(set(dupes)))}")
    else:
        ok(f"{len(declared)} keys declared, none twice")

    # Deliberate exceptions: proper nouns and in-game terms players use in English.
    INTENTIONAL = {"app.tagline", "mark.hard", "mark.normal", "src.steam_cloud"}
    gaps = {k: sorted(set(LANGS) - v) for k, v in declared.items() if set(LANGS) - v}
    unexpected = {k: v for k, v in gaps.items() if k not in INTENTIONAL}
    if unexpected:
        for k, v in sorted(unexpected.items()):
            fail(f"{k} missing {len(v)} language(s): {','.join(v)}")
    else:
        ok(f"every key covers 13 languages ({len(INTENTIONAL)} documented exceptions)")


# ---------------------------------------------------------------------------
# 3. Contrast of the semantic colours, per theme.
#    Caught: the blood-tinted pills sat at 2.77:1 in the DEFAULT theme, under the
#    3.0:1 floor for bold text - invisible to review, obvious once measured.
# ---------------------------------------------------------------------------
def audit_contrast():
    check("Colour contrast per theme")
    css = read("src/index.css")
    blocks = {}
    for m in re.finditer(r'(:root(?:\[data-theme="([a-z]+)"\])?)\s*\{([^}]*)\}', css):
        name = m.group(2) or "basement"
        toks = dict(re.findall(r"--i-([a-z0-9-]+):\s*([\d]+\s+[\d]+\s+[\d]+)\s*;", m.group(3)))
        if toks:
            blocks.setdefault(name, {}).update(toks)

    def lum(c):
        def f(v):
            v /= 255
            return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        r, g, b = (f(x) for x in c)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    def ratio(a, b):
        x, y = lum(a), lum(b)
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)

    def over(fg, alpha, bg):
        return tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))

    # The pills draw blood-light text; gold and jade draw at 90% of their own token.
    BLOOD_LIGHT = (196, 86, 92)
    FLOOR = 3.0
    worst = []
    for theme, toks in blocks.items():
        if "bg" not in toks:
            continue
        surface = tuple(int(x) for x in toks.get("surface", toks["bg"]).split())
        for tok in ("gold", "jade", "blood"):
            if tok not in toks:
                continue
            base = tuple(int(x) for x in toks[tok].split())
            bg = over(base, 0.10, surface)
            fg = BLOOD_LIGHT if tok == "blood" else over(base, 0.90, bg)
            r = ratio(fg, bg)
            if r < FLOOR:
                worst.append((theme, tok, r))
    if worst:
        for t, k, r in sorted(worst, key=lambda x: x[2]):
            fail(f"{t}/{k} at {r:.2f}:1, under the {FLOOR}:1 floor for bold text")
    else:
        ok(f"every semantic colour clears {FLOOR}:1 on all {len(blocks)} themes")


# ---------------------------------------------------------------------------
# 4. Bundled data.
#    Caught: 135 achievements shipped a literal "???" as their reward, because
#    the wiki redacts hidden unlocks that way and the generator copied it.
# ---------------------------------------------------------------------------
def audit_data():
    check("Bundled knowledge")
    ach = json.load(io.open("src-tauri/resources/achievements.json", encoding="utf-8"))
    items = json.load(io.open("src-tauri/resources/item_names.json", encoding="utf-8"))
    kb = json.load(io.open("src-tauri/resources/item_kb.json", encoding="utf-8"))

    n = len(ach["achievements"])
    if n != 641:
        fail(f"{n} achievements, expected 641")
    else:
        ok("641 achievements")

    collectible_names = {n.lower() for n in items["names"].values()}
    PLACEHOLDER = re.compile(r"^\s*(\?{2,}|-{2,}|TODO|FIXME|N/?A|null|undefined)\s*$", re.I)
    bad = []
    for a in ach["achievements"]:
        for field in ("name", "reward", "description"):
            v = a.get(field)
            if not isinstance(v, str) or not PLACEHOLDER.match(v):
                continue
            # Isaac names things that look like placeholders. "???" is a
            # character and "Undefined" is collectible 324, so the exclusion is
            # driven by the data rather than by a hand-written allowlist.
            if field in ("name", "reward") and v.split(" (")[0].lower() in collectible_names:
                continue
            if field == "name" and a.get("category") == "character":
                continue
            bad.append(f"#{a['id']} {a['name']}.{field} = {v!r}")
    if bad:
        fail(f"{len(bad)} placeholder value(s) reaching the UI, e.g. {bad[0]}")
    else:
        ok("no placeholder values in any achievement field")

    missing = [a["id"] for a in ach["achievements"] if not a.get("name")]
    if missing:
        fail(f"{len(missing)} achievement(s) with no name")
    else:
        ok("every achievement is named")

    if len(items["names"]) < 600:
        fail(f"only {len(items['names'])} collectible names - the index looks truncated")
    else:
        ok(f"{len(items['names'])} collectible names")

    kb_items = kb["items"] if isinstance(kb, dict) else kb
    unknown = [i["id"] for i in kb_items if str(i["id"]) not in items["names"]]
    if unknown:
        notes.append(f"{len(unknown)} knowledge-base item(s) absent from the name index: {unknown[:5]}")
    else:
        ok(f"all {len(kb_items)} knowledge-base items exist in the name index")

    # The reverse direction, which is the one that actually bit: the base held 59
    # items out of 719, so across 25 real runs the build assistant could analyse
    # 5.3% of what was picked up and spent its time saying "not in the knowledge
    # base". Coverage is now the invariant, not an aspiration.
    kb_ids = {str(i["id"]) for i in kb_items}
    absent = [n for n in items["names"] if n not in kb_ids]
    if absent:
        fail(f"{len(absent)} collectible(s) missing from the knowledge base "
             f"(the assistant would drop them from any build): {absent[:5]}")
    else:
        ok(f"every one of the {len(items['names'])} collectibles is in the knowledge base")

    curated = sum(1 for i in kb_items if i.get("curated"))
    notes.append(f"knowledge base: {curated} hand-verified, {len(kb_items) - curated} derived from the wiki")


# ---------------------------------------------------------------------------
# 5. Version consistency. A mismatch ships an installer whose About screen lies.
# ---------------------------------------------------------------------------
def audit_versions():
    check("Version consistency")
    found = {
        "package.json": re.search(r'"version":\s*"([^"]+)"', read("package.json")).group(1),
        "Cargo.toml": re.search(r'^version = "([^"]+)"', read("src-tauri/Cargo.toml"), re.M).group(1),
        "tauri.conf.json": re.search(r'"version":\s*"([^"]+)"', read("src-tauri/tauri.conf.json")).group(1),
        "format.ts": re.search(r'APP_VERSION = "([^"]+)"', read("src/lib/format.ts")).group(1),
    }
    if len(set(found.values())) != 1:
        fail("versions disagree: " + ", ".join(f"{k}={v}" for k, v in found.items()))
    else:
        v = next(iter(found.values()))
        ok(f"all four sources say {v}")
        readme = read("README.md")
        if f"v{v}/Isaac-Completion-Tracker_{v}_" not in readme:
            notes.append(f"README download links do not point at v{v} (fine between releases)")
        else:
            ok(f"README download links point at v{v}")



# ---------------------------------------------------------------------------
# 6. Right-to-left safety.
#    Caught: the search inputs pinned their magnifier with `left-3` and reserved
#    room with `pl-9`. Neither flips under dir=rtl, so in Arabic and Urdu the icon
#    sat stranded on the wrong side of the field. Tailwind's logical utilities
#    (start/end, ps/pe, ms/me) flip; the physical ones never do.
# ---------------------------------------------------------------------------
def audit_rtl():
    check("Right-to-left safety (ar, ur)")
    # Only the placement utilities matter: a physical padding on a centred button
    # is harmless, but one that positions or pushes an element is not.
    RISKY = re.compile(r'(absolute[^"]*(left|right)-\d|[mp][lr]-auto)')
    hits = []
    for p_ in source_files((".tsx",)):
        for i, line in enumerate(read(p_).split(chr(10)), 1):
            if line.strip().startswith(("//", "*")):
                continue
            m = RISKY.search(line)
            if m:
                hits.append((p_, i, m.group(0)))
    if hits:
        for p_, i, what in hits:
            fail(f"{p_}:{i} `{what}` does not flip under dir=rtl - use the logical form")
    else:
        ok("no placement utility that would break Arabic or Urdu")


def audit_backend_prose():
    """Prose written in Rust reaches the screen untranslated.

    The build assistant shipped its whole strengths/weaknesses panel in English in
    all 13 languages, because the backend built finished sentences and the view
    printed them as-is. Two rules keep that from coming back:

    1. A struct that crosses the Tauri boundary (`Serialize`) must not carry a
       free-form prose field. It sends a code and the catalogue owns the wording.
    2. Every `Note` code emitted by Rust must exist in the catalogue, or the user
       reads a raw key. These are built by template so the generic reference check
       cannot see them.
    """
    check("Backend prose and note codes")

    rust = []
    for root, _, files in os.walk("src-tauri/src"):
        for fn_ in files:
            if fn_.endswith(".rs"):
                rust.append(os.path.join(root, fn_).replace(os.sep, "/"))

    # -- 1. prose-shaped fields on serialized structs ------------------------
    PROSE = re.compile(
        r"pub (?:text|message|label|reason|summary|\w*_text|\w*_message)"
        r"\s*:\s*(?:String|Vec<String>)"
    )
    offenders = []
    for p_ in rust:
        lines = read(p_).split(chr(10))
        for i, line in enumerate(lines):
            if not PROSE.search(line):
                continue
            # An explicit, documented exemption on the lines just above.
            window = chr(10).join(lines[max(0, i - 6):i])
            if "i18n-exempt" in window:
                continue
            offenders.append((p_, i + 1, line.strip()))
    if offenders:
        for p_, i, line in offenders:
            fail(f"{p_}:{i} prose field crosses to the UI untranslated: {line}")
    else:
        ok("no serialized struct carries free-form prose")

    # -- 2. every emitted note code is declared -----------------------------
    emitted = set()
    for p_ in rust:
        # The code is not always the first token: `Note::new(if x { "a" } else { "b" })`
        # is a legitimate call site, so scan the whole argument span.
        for span in re.findall(r"Note::(?:new|with)\((.*?)\)", read(p_), re.S):
            # Everything before the params array is the code - and there can be
            # more than one, since `Note::new(if x { "a" } else { "b" })` is a
            # legitimate call site. Param NAMES live inside `&[..]` and are not codes.
            emitted |= set(re.findall(r'"([a-z][a-z0-9_]*)"', span.split("&[")[0]))
    declared = set()
    for f in CATALOGS:
        declared |= set(re.findall(r'"bldn\.([a-z0-9_]+)"\s*:', read(f)))
    missing = sorted(emitted - declared)
    orphan = sorted(declared - emitted)
    if missing:
        fail("note code(s) with no catalogue entry (renders as a raw key): "
             + ", ".join(f"bldn.{c}" for c in missing))
    else:
        ok(f"all {len(emitted)} note codes are declared")
    if orphan:
        fail("catalogue entr(ies) no backend code emits: "
             + ", ".join(f"bldn.{c}" for c in orphan))
    else:
        ok("no orphan note strings")

    # -- 3. views holding mod data must follow Refresh -----------------------
    # The header Refresh re-read the save but not the mod's run file, and the views
    # that had already fetched their runs kept showing the old ones. Pressing the
    # button did visibly nothing; only restarting the app helped.
    MOD_READS = ("getRunHistory", "getStatsOverview")
    stale = []
    for p_ in source_files((".tsx",)):
        src = read(p_)
        if any(f"api.{c}(" in src for c in MOD_READS) and "dataVersion" not in src:
            stale.append(p_)
    if stale:
        for p_ in stale:
            fail(f"{p_} caches mod data but does not depend on dataVersion - "
                 "Refresh will not update it")
    else:
        ok("every view holding mod data re-reads it on Refresh")


for fn in (audit_untranslated_literals, audit_i18n, audit_contrast, audit_data,
           audit_versions, audit_rtl, audit_backend_prose):
    fn()

print()
for n in notes:
    print(f"  \033[33mnote\033[0m  {n}")
if failures:
    print(f"\n\033[31m{len(failures)} check(s) failed\033[0m")
    sys.exit(1)
print("\n\033[32mAudit clean\033[0m")
