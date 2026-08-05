import { create } from "zustand";
import { api } from "./lib/api";
import type { Dashboard, SaveSlot } from "./lib/types";

export type ViewId =
  | "dashboard"
  | "character"
  | "predictor"
  | "achievements"
  | "roadmap"
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

export const useStore = create<AppStore>((set, get) => ({
  view: "dashboard",
  setView: (view) => set({ view }),

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
