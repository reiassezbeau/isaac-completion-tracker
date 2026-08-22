// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { create } from "zustand";
import { api } from "./lib/api";
import { type Lang, LANG_CODES, isRtl, translate } from "./lib/i18n";
import type { Dashboard, SaveSlot } from "./lib/types";

function readInitialLang(): Lang {
  try {
    const l = localStorage.getItem("isaac-lang") as Lang | null;
    if (l && LANG_CODES.includes(l)) return l;
  } catch {
    /* ignore */
  }
  try {
    const n = (navigator.language || "en").slice(0, 2) as Lang;
    if (LANG_CODES.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return "en";
}

function applyLang(l: Lang) {
  const el = document.documentElement;
  el.lang = l;
  el.dir = isRtl(l) ? "rtl" : "ltr";
  try {
    localStorage.setItem("isaac-lang", l);
  } catch {
    /* ignore */
  }
}

export type ThemeId = "basement" | "sheol" | "void" | "corpse" | "cathedral";

const THEME_IDS: ThemeId[] = ["basement", "sheol", "void", "corpse", "cathedral"];

function readInitialTheme(): ThemeId {
  try {
    const t = localStorage.getItem("isaac-theme") as ThemeId | null;
    if (t && THEME_IDS.includes(t)) return t;
  } catch {
    /* localStorage indisponible */
  }
  return "basement";
}

function applyTheme(t: ThemeId) {
  const el = document.documentElement;
  if (t === "basement") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  try {
    localStorage.setItem("isaac-theme", t);
  } catch {
    /* ignore */
  }
}

export type ViewId =
  | "dashboard"
  | "character"
  | "grid"
  | "predictor"
  | "achievements"
  | "roadmap"
  | "optimizer"
  | "build"
  | "stats"
  | "card"
  | "diagnostic"
  | "settings"
  | "about";

interface Toast {
  id: number;
  message: string;
}

interface AppStore {
  // navigation
  view: ViewId;
  setView: (v: ViewId) => void;

  // theme (a place from the world of Isaac)
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;

  // language
  lang: Lang;
  setLang: (l: Lang) => void;

  // save selection
  slots: SaveSlot[] | null;
  currentPath: string | null;
  currentSlot: SaveSlot | null;
  dashboard: Dashboard | null;

  loadingSlots: boolean;
  loading: boolean;
  error: string | null;
  parseError: string | null;

  toasts: Toast[];
  toast: (message: string) => void;
  dismissToast: (id: number) => void;

  loadSlots: () => Promise<void>;
  selectSlot: (slot: SaveSlot) => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  reloadAfterOverride: () => Promise<void>;
}

let toastSeq = 0;

const initialTheme = readInitialTheme();
applyTheme(initialTheme);
const initialLang = readInitialLang();
applyLang(initialLang);

export const useStore = create<AppStore>((set, get) => ({
  view: "dashboard",
  setView: (view) => set({ view }),

  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  lang: initialLang,
  setLang: (lang) => {
    applyLang(lang);
    set({ lang });
  },

  slots: null,
  currentPath: null,
  currentSlot: null,
  dashboard: null,

  loadingSlots: false,
  loading: false,
  error: null,
  parseError: null,

  toasts: [],
  toast: (message) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  loadSlots: async () => {
    set({ loadingSlots: true, error: null });
    try {
      const slots = await api.listSaves();
      set({ slots });
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loadingSlots: false });
    }
  },

  selectSlot: async (slot) => {
    set({ loading: true, error: null, parseError: null });
    try {
      const dashboard = await api.loadSlot(slot.path);
      set({ dashboard, currentPath: slot.path, currentSlot: slot, view: "dashboard" });
    } catch (e) {
      // Doubtful parse -> override screen
      set({ parseError: String(e), currentPath: slot.path, currentSlot: slot });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async (silent = false) => {
    if (!get().currentPath) return;
    try {
      const dashboard = await api.refresh();
      set({ dashboard, parseError: null });
      const t = (k: string) => translate(k, get().lang);
      get().toast(t(silent ? "common.progressUpdatedLive" : "common.progressUpdated"));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  reloadAfterOverride: async () => {
    try {
      const dashboard = await api.dashboard();
      set({ dashboard });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
