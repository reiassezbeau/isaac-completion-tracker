// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import type { SaveSlot } from "../lib/types";

/**
 * Splits the scanned saves into the ones worth showing and the ones to fold away.
 *
 * Isaac never deletes an older edition's save file, so a long-time player's folder
 * holds one family per DLC plus dated backups plus files this app cannot read. The
 * backend marks the live ones (see `save_locator.rs`); this is the UI half of that
 * decision, extracted so it can be tested without mounting the view.
 *
 * The important case is the fallback: when NOTHING is live — a Repentance-only
 * install, or every file failing to parse — showing an empty list would strand the
 * user. We then show everything and fold away nothing.
 */
export function groupSlots(slots: SaveSlot[] | null): { live: SaveSlot[]; old: SaveSlot[] } {
  const all = slots ?? [];
  const live = all.filter((s) => s.live);
  if (live.length === 0) return { live: all, old: [] };
  return { live, old: all.filter((s) => !s.live) };
}
