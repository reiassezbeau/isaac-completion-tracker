// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { Languages } from "lucide-react";
import { useStore } from "../store";
import { LANGS, type Lang } from "../lib/i18n";
import { useT } from "../lib/useT";

export function LanguagePicker() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const t = useT();
  return (
    <label className="flex items-center gap-1.5" title={t("settings.language")}>
      <Languages className="h-4 w-4 text-isaac-faint" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t("settings.language")}
        className="rounded-lg border border-isaac-border bg-isaac-surface2 px-2 py-1 text-xs text-isaac-text outline-none focus:border-isaac-gold/60"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
