// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * Isaac Completion Tracker — application shell.
 * Created by reiassezbeau - https://github.com/reiassezbeau
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { AlertOctagon, Loader2 } from "lucide-react";
import { useStore } from "./store";
import { Shell } from "./components/Layout";
import { Defs } from "./components/Defs";
import { Emblem } from "./lib/art";
import { useT } from "./lib/useT";
import { SlotPicker } from "./views/SlotPicker";
import { DashboardView } from "./views/Dashboard";
import { CharacterView } from "./views/Character";
import { MarksGridView } from "./views/MarksGrid";
import { PredictorView } from "./views/Predictor";
import { AchievementsView } from "./views/Achievements";
import { RoadmapView } from "./views/Roadmap";
import { OptimizerView } from "./views/Optimizer";
import { BuildAssistantView } from "./views/BuildAssistant";
import { StatsView } from "./views/Stats";
import { StatCardView } from "./views/StatCard";
import { DiagnosticView } from "./views/Diagnostic";
import { SettingsView } from "./views/Settings";
import { AboutView } from "./views/About";

function CurrentView() {
  const view = useStore((s) => s.view);
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "character":
      return <CharacterView />;
    case "grid":
      return <MarksGridView />;
    case "predictor":
      return <PredictorView />;
    case "achievements":
      return <AchievementsView />;
    case "roadmap":
      return <RoadmapView />;
    case "optimizer":
      return <OptimizerView />;
    case "build":
      return <BuildAssistantView />;
    case "stats":
      return <StatsView />;
    case "card":
      return <StatCardView />;
    case "diagnostic":
      return <DiagnosticView />;
    case "settings":
      return <SettingsView />;
    case "about":
      return <AboutView />;
  }
}

function ParseErrorScreen() {
  const { parseError, currentSlot } = useStore();
  const t = useT();
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertOctagon className="h-12 w-12 text-isaac-blood" />
      <h1 className="font-display text-2xl text-isaac-text">{t("err.saveUnreadable")}</h1>
      <p className="text-sm text-isaac-muted">
        {currentSlot?.filename} — {parseError}
      </p>
      <p className="text-sm text-isaac-muted">
        {t("err.saveFormat")}
      </p>
      <button
        onClick={() =>
          useStore.setState({ parseError: null, currentSlot: null, currentPath: null, dashboard: null })
        }
        className="rounded-lg border border-isaac-border bg-isaac-surface2 px-4 py-2 text-sm text-isaac-text hover:border-isaac-gold/50"
      >
        ← {t("err.chooseAnother")}
      </button>
    </div>
  );
}

export default function App() {
  const { dashboard, currentSlot, parseError, loading } = useStore();
  const t = useT();

  useEffect(() => {
    // The backend holds the authoritative language/theme: the web view's storage can
    // be cleared out from under us, and the choice must survive that.
    useStore.getState().hydratePrefs();
    useStore.getState().loadItemNames();
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
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3">
        <Defs />
        <div className="animate-glowPulse text-isaac-dried">
          <Emblem size={44} />
        </div>
        <div className="flex items-center gap-2 text-sm text-isaac-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <CurrentView />
    </Shell>
  );
}
