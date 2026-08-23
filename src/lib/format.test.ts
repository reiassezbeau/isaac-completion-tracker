// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  editionLabel,
  markLabel,
  pct,
  roleLabel,
  stageKeyLabel,
  stageLabel,
  statDimLabel,
  tearFlagLabel,
  verdictLabel,
} from "./format";
import { translate, LANG_CODES, isRtl } from "./i18n";

/** Stands in for `useT()`: the same key -> string contract, minus React. */
const t = (lang: Parameters<typeof translate>[1]) => (k: string) => translate(k, lang);

describe("label helpers", () => {
  it("translate when given a t(), and fall back to English when not", () => {
    expect(roleLabel("tear_mod")).toBe("Tear modifier");
    expect(roleLabel("tear_mod", t("fr"))).toBe("Modif. de tirs");
    expect(statDimLabel("shot_speed", t("de"))).toBe("Schussgeschwindigkeit");
    expect(categoryLabel("coop_baby", t("es"))).toBe("Bebés cooperativos");
  });

  it("never blank a label when a key is missing from the catalog", () => {
    // The whole point of the two-step fallback: an unknown id must degrade to
    // something readable, never to the raw key and never to an empty string.
    const missing = (k: string) => k; // a t() that always misses
    expect(roleLabel("offensive", missing)).toBe("Offensive");
    expect(tearFlagLabel("homing", missing)).toBe("homing");
    expect(verdictLabel("situational", missing)).toBe("Situational");
  });

  it("pass unknown values through instead of throwing", () => {
    expect(roleLabel("from_a_future_dlc")).toBe("from_a_future_dlc");
    expect(categoryLabel("brand_new")).toBe("brand_new");
    expect(verdictLabel("unheard_of")).toBe("Situational"); // documented default
  });

  it("keep floor names in English but translate the numeric fallback", () => {
    // Faithfulness to the game: players say "Caves I" in every language.
    expect(stageLabel(3, t("fr"))).toBe("Caves I");
    expect(stageLabel(99, t("fr"))).toBe("Étage 99");
    expect(stageKeyLabel("2-2")).toBe("Basement II");
    expect(stageKeyLabel("not-a-stage")).toBe("not-a-stage");
  });

  it("keep Hard and Normal untranslated, but not To do", () => {
    expect(markLabel("hard", t("ja"))).toBe("Hard");
    expect(markLabel("normal", t("ru"))).toBe("Normal");
    expect(markLabel("none", t("fr"))).toBe("À faire");
  });

  it("format editions and percentages", () => {
    expect(editionLabel("repentanceplus")).toBe("Repentance+");
    expect(editionLabel(null)).toBe("—");
    expect(pct(0.5)).toBe("50%");
    expect(pct(0)).toBe("0%");
    expect(pct(1)).toBe("100%");
  });
});

describe("i18n engine", () => {
  it("falls back language -> English -> key", () => {
    expect(translate("nav.dashboard", "fr")).toBe("Tableau de bord");
    // mark.hard only declares en: every other language must land on it, not on the key.
    expect(translate("mark.hard", "bn")).toBe("Hard");
    expect(translate("no.such.key", "en")).toBe("no.such.key");
  });

  it("resolves every declared key in all 13 languages", () => {
    // A key that resolves to itself is a hole in the catalog, and the UI would show
    // "diag.momWarn" to a user. Spot-check a key from each catalog file.
    const keys = [
      "nav.dashboard", // i18n.ts
      "dash.allDone", // i18n-views.ts
      "set.resetBtn", // i18n-views2.ts
      "st.nemesis", // i18n-views3.ts
      "mod.installBtn", // i18n-views4.ts
      "perr.bad_header", // i18n-views5.ts
    ];
    for (const lang of LANG_CODES) {
      for (const key of keys) {
        expect(translate(key, lang), `${key} in ${lang}`).not.toBe(key);
      }
    }
  });

  it("marks only Arabic and Urdu as right-to-left", () => {
    expect(LANG_CODES.filter(isRtl)).toEqual(["ar", "ur"]);
  });
});
