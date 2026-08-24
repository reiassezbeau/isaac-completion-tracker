// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { describe, expect, it } from "vitest";
import { groupSlots } from "./slotGrouping";
import type { SaveSlot } from "../lib/types";

function slot(filename: string, live: boolean, readable = true): SaveSlot {
  return {
    path: `/x/${filename}`,
    filename,
    label: "Slot 1",
    slot_number: 1,
    source: "Steam Cloud",
    source_code: "steam_cloud",
    edition: readable ? "repentanceplus" : null,
    unlocked: readable ? 340 : null,
    total: 641,
    marks_reliable: readable,
    parse_error: readable ? null : "invalid header",
    error_code: readable ? null : "bad_header",
    error_detail: null,
    family: "repentance_plus",
    live,
    modified_ms: 0,
  };
}

describe("save picker grouping", () => {
  it("shows the live saves and folds the rest away", () => {
    const { live, old } = groupSlots([
      slot("rep+persistentgamedata1.dat", true),
      slot("rep_persistentgamedata1.dat", false),
      slot("persistentgamedata1.dat", false, false),
      slot("20260104.rep+persistentgamedata1.dat", false),
    ]);
    expect(live.map((s) => s.filename)).toEqual(["rep+persistentgamedata1.dat"]);
    expect(old).toHaveLength(3);
  });

  it("shows everything when nothing is live, rather than an empty list", () => {
    // A Repentance-only install, or a folder where every file fails to parse.
    // Folding them all away would leave the user with no way in.
    const all = [slot("rep_persistentgamedata1.dat", false), slot("persistentgamedata2.dat", false, false)];
    const { live, old } = groupSlots(all);
    expect(live).toHaveLength(2);
    expect(old).toHaveLength(0);
  });

  it("handles the pre-scan state without throwing", () => {
    expect(groupSlots(null)).toEqual({ live: [], old: [] });
    expect(groupSlots([])).toEqual({ live: [], old: [] });
  });

  it("never drops a slot", () => {
    const all = [slot("a.dat", true), slot("b.dat", false), slot("c.dat", false, false)];
    const { live, old } = groupSlots(all);
    // Nothing is deleted and nothing is silently lost: every file is in exactly one bucket.
    expect(live.length + old.length).toBe(all.length);
  });
});
