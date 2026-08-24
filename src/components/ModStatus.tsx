// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { CheckCircle2, Gamepad2, Loader2, PackagePlus, Settings2 } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { useT } from "../lib/useT";
import { Card } from "./ui";
import type { HealthReport } from "../lib/types";

/**
 * Onboarding card for the in-game stats mod. Walks the user through:
 * install -> relaunch Isaac -> play. Shrinks to a discreet single line once
 * the mod is installed AND data has been detected.
 */
export function ModStatusCard() {
  const t = useT();
  const [h, setH] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const setView = useStore((s) => s.setView);
  const toast = useStore((s) => s.toast);

  async function refresh() {
    try {
      setH(await api.getHealth());
    } catch {
      /* no save loaded: show nothing */
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  if (!h) return null;

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors";

  async function install() {
    setBusy(true);
    try {
      await api.installTrackerMod();
      await refresh();
      toast(t("mod.installedToast"));
    } catch (e) {
      toast(`${t("diag.installFail")} ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // Installed, but not the version this app ships: Isaac is loading old Lua, and
  // "installed" alone would hide that forever.
  if (h.mod_installed && h.mod_outdated) {
    return (
      <Card className="border-isaac-gold/30 bg-isaac-gold/[0.04]">
        <div className="flex items-start gap-3">
          <PackagePlus className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t("mod.updateTitle")}</div>
            <p className="mt-0.5 text-sm text-isaac-muted">
              {t("mod.updateBody")
                .split("{installed}").join(h.mod_version_installed ?? "?")
                .split("{bundled}").join(h.mod_version_bundled ?? "?")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={install}
                disabled={busy}
                className={`${btn} border border-isaac-blood/40 bg-isaac-blood/10 text-isaac-text hover:border-isaac-blood/70 disabled:opacity-40`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                {t("mod.updateBtn")}
              </button>
              <button
                onClick={() => api.launchGame().catch((e) => toast(`${t("mod.launchFail")} ${String(e)}`))}
                className={`${btn} text-isaac-muted hover:text-isaac-text`}
              >
                <Gamepad2 className="h-4 w-4" /> {t("mod.launchBtn")}
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // All good -> discreet line.
  if (h.mod_installed && h.mod_data_file) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-isaac-done/30 bg-isaac-done/5 px-4 py-2 text-sm text-isaac-muted">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-isaac-done" />
        {t("mod.active")}
      </div>
    );
  }

  const step = !h.game_root.exists
    ? "notfound"
    : !h.mod_installed
      ? "install"
      : "play";

  return (
    <Card className="border-isaac-gold/30 bg-isaac-gold/[0.04]">
      <div className="flex items-start gap-3">
        <PackagePlus className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{t("mod.title")}</div>
          <p className="mt-0.5 text-sm text-isaac-muted">
            {step === "notfound" &&
              t("mod.stepNotFound")}
            {step === "install" &&
              t("mod.stepInstall")}
            {step === "play" &&
              t("mod.stepPlay")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {step === "install" && (
              <button
                onClick={install}
                disabled={busy}
                className={`${btn} border border-isaac-blood/40 bg-isaac-blood/10 text-isaac-text hover:border-isaac-blood/70 disabled:opacity-40`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                {t("mod.installBtn")}
              </button>
            )}
            {step === "play" && (
              <button
                onClick={() => api.launchGame().catch((e) => toast(`${t("mod.launchFail")} ${String(e)}`))}
                className={`${btn} border border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold hover:border-isaac-gold/70`}
              >
                <Gamepad2 className="h-4 w-4" /> {t("mod.launchBtn")}
              </button>
            )}
            <button
              onClick={() => setView("diagnostic")}
              className={`${btn} text-isaac-muted hover:text-isaac-text`}
            >
              <Settings2 className="h-4 w-4" /> {t("nav.diagnostic")}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
