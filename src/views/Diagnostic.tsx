// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Download, FolderCog, PackagePlus, RefreshCw, X } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { editionLabel } from "../lib/format";
import { Card, SectionTitle } from "../components/ui";
import { Modal, ModalButton } from "../components/Modal";
import type { HealthReport, PathStatus } from "../lib/types";

function StatusRow({ ok, label, children }: { ok: boolean | null; label: string; children?: ReactNode }) {
  const icon =
    ok === true ? <Check className="h-4 w-4 text-isaac-done" /> : ok === false ? <X className="h-4 w-4 text-isaac-blood" /> : <span className="h-4 w-4 text-isaac-muted">–</span>;
  return (
    <div className="flex items-start gap-3 border-b border-isaac-border/60 py-2 last:border-0">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {children && <div className="mt-0.5 break-all text-xs text-isaac-muted">{children}</div>}
      </div>
    </div>
  );
}

function PathLine({ p }: { p: PathStatus }) {
  if (!p.path) return <span className="italic">non résolu</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <code className="rounded bg-isaac-surface2 px-1.5 py-0.5">{p.path}</code>
      <button
        onClick={() => navigator.clipboard?.writeText(p.path!)}
        className="text-isaac-muted hover:text-isaac-text"
        title="Copier le chemin"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

export function DiagnosticView() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ title: string; body: ReactNode } | null>(null);
  const { currentPath, toast } = useStore();

  async function refresh() {
    setHealth(await api.getHealth());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function doBackup() {
    if (!currentPath) return;
    setBusy(true);
    try {
      const dest = await api.backupSave(currentPath);
      toast("Backup créé ✓");
      setInfo({
        title: "Sauvegarde copiée",
        body: (
          <>
            Une copie datée a été écrite ici :
            <code className="mt-2 block break-all rounded-lg bg-isaac-surface2 px-3 py-2 font-mono text-xs text-isaac-gold">{dest}</code>
          </>
        ),
      });
    } catch (e) {
      toast("Échec du backup : " + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doInstallMod() {
    setBusy(true);
    try {
      const dest = await api.installTrackerMod();
      await refresh();
      setInfo({
        title: "Mod installé",
        body: (
          <>
            <code className="mb-3 block break-all rounded-lg bg-isaac-surface2 px-3 py-2 font-mono text-xs text-isaac-gold">{dest}</code>
            <ol className="space-y-1.5">
              <li>
                <strong className="text-isaac-text">➊</strong> Ferme et <strong className="text-isaac-text">relance</strong> le jeu (les mods se chargent au lancement).
              </li>
              <li>
                <strong className="text-isaac-text">➋</strong> Le watermark « modded » apparaîtra — inoffensif une fois Mom battue sur ce slot.
              </li>
              <li>
                <strong className="text-isaac-text">➌</strong> Sur une <strong className="text-isaac-text">nouvelle</strong> sauvegarde : bats Mom une fois avant de compter sur les déblocages (règle du jeu, pas du tracker).
              </li>
            </ol>
          </>
        ),
      });
    } catch (e) {
      toast("Échec de l'installation : " + String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!health) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
          <FolderCog className="h-6 w-6 text-isaac-gold" /> Diagnostic
        </h1>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-muted hover:text-isaac-text"
        >
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </button>
      </div>

      {health.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
          <span>{w}</span>
        </div>
      ))}

      <Card>
        <SectionTitle>Chemins résolus (réels, gère OneDrive)</SectionTitle>
        <StatusRow ok={health.game_root.exists} label="Dossier de jeu">
          <PathLine p={health.game_root} />
        </StatusRow>
        <StatusRow ok={health.mods_dir.exists} label="Dossier des mods">
          <PathLine p={health.mods_dir} />
          {!health.mods_dir.exists && " — sera créé à l'installation du mod"}
        </StatusRow>
        <StatusRow ok={health.data_dir.exists} label="Dossier de données (mod)">
          <PathLine p={health.data_dir} />
          {!health.data_dir.exists && " — créé au premier run avec le mod"}
        </StatusRow>
      </Card>

      <Card>
        <SectionTitle>Sauvegarde</SectionTitle>
        <StatusRow ok={health.steam_save_found} label="Save Steam Cloud détectée" />
        <StatusRow
          ok={health.save_loaded}
          label={
            health.save_loaded
              ? `Save chargée : ${health.unlocked}/${health.total} (${editionLabel(health.edition)})`
              : "Aucune save chargée"
          }
        >
          {health.save_path}
          {health.save_loaded && (
            <>
              <br />
              Checksum {health.checksum_ok ? "OK" : "invalide"} · marks{" "}
              {health.marks_reliable ? "fiables" : "NON fiables (override recommandé)"}
            </>
          )}
        </StatusRow>
        <StatusRow ok={health.mom_beaten} label="Mom battue sur ce slot">
          {health.mom_beaten === false &&
            "⚠ Sur une nouvelle save, les mods bloquent les déblocages tant que Mom n'a pas été battue une fois (règle du jeu)."}
          {health.mom_beaten === true && "Les mods ne bloquent aucun déblocage sur ce slot."}
        </StatusRow>
        <div className="pt-3">
          <button
            onClick={doBackup}
            disabled={!currentPath || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-text hover:border-isaac-gold/50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Sauvegarder ma save (backup daté)
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Mod de stats</SectionTitle>
        <StatusRow ok={health.mod_installed} label={health.mod_installed ? "Mod installé" : "Mod non installé"}>
          {health.mod_dir}
        </StatusRow>
        <StatusRow ok={health.mod_data_file != null} label="Données du mod présentes">
          {health.mod_data_file ?? "aucune (fais un run avec le mod activé)"}
        </StatusRow>
        <div className="pt-3">
          <button
            onClick={doInstallMod}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-isaac-blood/40 bg-isaac-blood/10 px-3 py-1.5 text-sm text-isaac-text hover:border-isaac-blood/70 disabled:opacity-40"
          >
            <PackagePlus className="h-4 w-4" />
            {health.mod_installed ? "Réinstaller le mod de stats" : "Installer le mod de stats"}
          </button>
        </div>
      </Card>

      <Modal
        open={!!info}
        onClose={() => setInfo(null)}
        title={info?.title ?? ""}
        actions={
          <ModalButton onClick={() => setInfo(null)} tone="primary">
            Compris
          </ModalButton>
        }
      >
        {info?.body}
      </Modal>
    </div>
  );
}
