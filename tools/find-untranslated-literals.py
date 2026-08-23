#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Isaac Completion Tracker - (c) 2026 reiassezbeau - https://github.com/reiassezbeau
#
# Run from the repo root:  python tools/find-untranslated-literals.py
#
# Expect three known false positives (code fragments whose punctuation looks like
# JSX text). Anything else is UI text that will not translate.
"""Find UI text that never goes through t().

Hunting for French by keyword missed "Historique des runs" - no accents, and
"historique" was not in the word list. The general problem is not "is this
French" but "is this a literal that should have been a translation key", so
this looks for JSX text nodes and human-looking string props instead.
"""
import io, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Props whose value reaches a human.
TEXT_PROPS = ("title", "aria-label", "placeholder", "label", "alt")
# Words that legitimately appear as bare literals in this codebase.
ALLOW = re.compile(
    r"^(Isaac Completion Tracker|The Binding of Isaac.*|reiassezbeau|Tainted|Regular|"
    r"Hard|Normal|Repentance\+?|GPL-3\.0|Steam Cloud|Dead God|[\W\d]+|[A-Za-z]+)$"
)

findings = []
for root, dirs, files in os.walk("src"):
    for fn in files:
        if not fn.endswith(".tsx"):
            continue
        p = os.path.join(root, fn).replace(os.sep, "/")
        if "i18n" in p or p.endswith(".test.tsx"):
            continue
        src = io.open(p, encoding="utf-8").read()
        for i, line in enumerate(src.split("\n"), 1):
            s = line.strip()
            if s.startswith("//") or s.startswith("*") or s.startswith("/*"):
                continue

            # 1. JSX text between tags: >Some words here<
            for m in re.finditer(r">([^<>{}\n]{4,})<", line):
                txt = m.group(1).strip()
                if not txt or ALLOW.match(txt) or len(txt.split()) < 2:
                    continue
                findings.append((p, i, "jsx text", txt))

            # 2. Human-facing props given a bare string
            for prop in TEXT_PROPS:
                for m in re.finditer(prop + r'="([^"]{4,})"', line):
                    txt = m.group(1).strip()
                    if ALLOW.match(txt) or len(txt.split()) < 2:
                        continue
                    findings.append((p, i, prop, txt))

if findings:
    print("Literals that never pass through t():\n")
    for p, i, kind, txt in findings:
        print(f"  {p}:{i}  [{kind}]  {txt[:88]}")
    print(f"\n{len(findings)} finding(s)")
else:
    print("No untranslated UI literals found.")
