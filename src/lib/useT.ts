// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useCallback } from "react";
import { useStore } from "../store";
import { translate } from "./i18n";

/** Hook de traduction : `const t = useT();` puis `t("nav.stats")`. */
export function useT() {
  const lang = useStore((s) => s.lang);
  return useCallback((key: string) => translate(key, lang), [lang]);
}
