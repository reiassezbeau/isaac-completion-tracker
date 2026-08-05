// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * Isaac Completion Tracker — coquille applicative.
 * Créé par reiassezbeau — https://github.com/reiassezbeau
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { AlertOctagon, Loader2 } from "lucide-react";
import { useStore } from "./store";
import { Shell } from "./components/Layout";
import { SlotPicker } from "./views/SlotPicker";
import { DashboardView } from "./views/Dashboard";
import { CharacterView } from "./views/Character";
import { PredictorView } from "./views/Predictor";
import { AchievementsView } from "./views/Achievements";
import { RoadmapView } from "./views/Roadmap";
import { SettingsView } from "./views/Settings";
import { AboutView } from "./views/About";

function CurrentView() {
  const view = useStore((s) => s.view);
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "character":
      return <CharacterView />;
    case "predictor":
      return <PredictorView />;
    case "achievements":
      return <AchievementsView />;
    case "roadmap":
      return <RoadmapView />;
    case "settings":
      return <SettingsView />;
    case "about":
      return <AboutView />;
  }
}

function ParseErrorScreen() {
  const { parseError, currentSlot } = useStore();
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertOctagon className="h-12 w-12 text-isaac-blood" />
      <h1 className="text-xl font-bold">Impossible de lire cette sauvegarde</h1>
      <p className="text-sm text-isaac-muted">
        {currentSlot?.filename} — {parseError}
      </p>
      <p className="text-sm text-isaac-muted">
        Le format ne correspond pas à ce qui était attendu. Choisis un autre slot, ou localise le bon
        dossier de sauvegarde.
      </p>
      <button
        onClick={() =>
          useStore.setState({ parseError: null, currentSlot: null, currentPath: null, dashboard: null })
        }
        className="rounded-lg border border-isaac-border bg-isaac-surface2 px-4 py-2 text-sm text-isaac-text hover:border-isaac-gold/50"
      >
        ← Choisir une autre sauvegarde
      </button>
    </div>
  );
}

export default function App() {
  const { dashboard, currentSlot, parseError, loading } = useStore();

  useEffect(() => {
    const unlisten = listen("save-changed", () => {
      useStore.getState().refresh(true);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  if (parseError && !dashboard) return <ParseErrorScreen />;

  if (!currentSlot && !dashboard) {
    return <SlotPicker />;
  }

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-isaac-muted">
        <Loader2 className="h-6 w-6 animate-spin" /> Chargement de la sauvegarde…
      </div>
    );
  }

  return (
    <Shell>
      <CurrentView />
    </Shell>
  );
}
