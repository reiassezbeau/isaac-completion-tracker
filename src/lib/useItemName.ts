// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useCallback } from "react";
import { useStore } from "../store";

/**
 * `const itemName = useItemName();` then `itemName(118)` -> "Brimstone".
 *
 * Resolves a collectible id against the full name index loaded at startup. A run
 * snapshot contains every item the player was carrying, while the knowledge base
 * only covers the ones the Build Assistant can reason about — without this the UI
 * fell back to printing a raw "#317". The raw id is still the last resort, so an
 * item added by a future DLC degrades to something recognisable rather than blank.
 */
export function useItemName() {
  const names = useStore((s) => s.itemNames);
  return useCallback((id: number) => names[String(id)] ?? `#${id}`, [names]);
}
