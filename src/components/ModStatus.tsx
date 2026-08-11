// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { CheckCircle2, Gamepad2, Loader2, PackagePlus, Settings2 } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { Card } from "./ui";
import type { HealthReport } from "../lib/types";

/**
 * Encart d'onboarding du mod de stats (in-game). Guide l'utilisateur :
 * installer → relancer Isaac → jouer. Se réduit à une ligne discrète une fois
 * le mod installé ET des données détectées.
 */
export function ModStatusCard() {
  const [h, setH] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const setView = useStore((s) => s.setView);
  const toast = useStore((s) => s.toast);

  async function refresh() {
    try {
      setH(await api.getHealth());
    } catch {
      /* pas de save chargée : on n'affiche rien */
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  if (!h) return null;

  // Tout bon → ligne discrète.
  if (h.mod_installed && h.mod_data_file) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-isaac-done/30 bg-isaac-done/5 px-4 py-2 text-sm text-isaac-muted">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-isaac-done" />
        Mod de stats actif — données de run détectées.
      </div>
    );
  }

  async function install() {
    setBusy(true);
    try {
      await api.installTrackerMod();
      await refresh();
      toast("Mod installé ✓ — relance Isaac pour l'activer");
    } catch (e) {
      toast("Échec de l'installation : " + String(e));
    } finally {
      setBusy(false);
    }
  }

  const step = !h.game_root.exists
    ? "notfound"
    : !h.mod_installed
      ? "install"
      : "play";

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors";

  return (
    <Card className="border-isaac-gold/30 bg-isaac-gold/[0.04]">
      <div className="flex items-start gap-3">
        <PackagePlus className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Suivi de stats en jeu (optionnel)</div>
          <p className="mt-0.5 text-sm text-isaac-muted">
            {step === "notfound" &&
              "Jeu introuvable pour l'instant — vois l'onglet Diagnostic pour localiser Isaac."}
            {step === "install" &&
              "Installe le mod compagnon (1 clic), relance Isaac, et il comptera tes hits + stats à chaque run — croisés avec ta complétion."}
            {step === "play" &&
              "Mod installé ✓. Relance Isaac et joue un run : les premières stats apparaîtront ici automatiquement."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {step === "install" && (
              <button
                onClick={install}
                disabled={busy}
                className={`${btn} border border-isaac-blood/40 bg-isaac-blood/10 text-isaac-text hover:border-isaac-blood/70 disabled:opacity-40`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                Installer le mod
              </button>
            )}
            {step === "play" && (
              <button
                onClick={() => api.launchGame().catch((e) => toast("Impossible de lancer Isaac : " + String(e)))}
                className={`${btn} border border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold hover:border-isaac-gold/70`}
              >
                <Gamepad2 className="h-4 w-4" /> Lancer Isaac
              </button>
            )}
            <button
              onClick={() => setView("diagnostic")}
              className={`${btn} text-isaac-muted hover:text-isaac-text`}
            >
              <Settings2 className="h-4 w-4" /> Diagnostic
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
