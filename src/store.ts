// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { create } from "zustand";
import { api } from "./lib/api";
import type { Dashboard, SaveSlot } from "./lib/types";

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

  // thème (lieu de l'univers d'Isaac)
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;

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

export const useStore = create<AppStore>((set, get) => ({
  view: "dashboard",
  setView: (view) => set({ view }),

  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
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
      // Parsing douteux -> écran override
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
      if (!silent) get().toast("Progression mise à jour ✓");
      else get().toast("Progression mise à jour ✓ (live)");
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
