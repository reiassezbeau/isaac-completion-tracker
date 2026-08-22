// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * ThemePicker - chips for the places of Isaac (Basement / Sheol / Void / Corpse /
 * Cathedral). Each chip shows the theme's background and accent.
 */
import { useStore, type ThemeId } from "../store";

const THEMES: { id: ThemeId; name: string; bg: string; accent: string }[] = [
  { id: "basement", name: "Basement", bg: "#0a0807", accent: "#8c1a1a" },
  { id: "sheol", name: "Sheol", bg: "#090505", accent: "#c1272d" },
  { id: "void", name: "The Void", bg: "#09070f", accent: "#9d7fd6" },
  { id: "corpse", name: "Corpse", bg: "#080b08", accent: "#8a9e42" },
  { id: "cathedral", name: "Cathedral", bg: "#f0ece4", accent: "#a8862b" },
];

export function ThemePicker() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Theme">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={t.name}
            aria-label={t.name}
            aria-pressed={active}
            className={`relative h-5 w-5 flex-shrink-0 rounded-full transition-transform hover:scale-110 ${active ? "scale-110" : ""}`}
            style={{
              background: t.bg,
              boxShadow: active
                ? `0 0 0 1.5px ${t.accent}, 0 0 8px -1px ${t.accent}`
                : "inset 0 0 0 1px rgba(128,128,128,.35)",
            }}
          >
            <span className="absolute inset-0 m-auto h-2 w-2 rounded-full" style={{ background: t.accent }} />
          </button>
        );
      })}
    </div>
  );
}
