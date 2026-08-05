import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderSearch, HardDriveDownload, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { api } from "../lib/api";
import { editionLabel } from "../lib/format";
import { EmptyState } from "../components/ui";
import type { SaveSlot } from "../lib/types";

function SlotRow({ slot, onPick }: { slot: SaveSlot; onPick: (s: SaveSlot) => void }) {
  const ok = slot.parse_error == null;
  return (
    <button
      onClick={() => onPick(slot)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-isaac-border bg-isaac-surface px-5 py-4 text-left transition-colors hover:border-isaac-blood/50"
    >
      <div>
        <div className="font-semibold">
          {slot.label} <span className="text-isaac-muted">· {slot.source}</span>
        </div>
        <div className="mt-0.5 text-xs text-isaac-muted">{slot.filename}</div>
        {!ok && <div className="mt-1 text-xs text-isaac-blood">⚠ {slot.parse_error}</div>}
      </div>
      <div className="text-right">
        {ok ? (
          <>
            <div className="text-lg font-bold text-isaac-gold">
              {slot.unlocked}
              <span className="text-sm text-isaac-muted"> / {slot.total}</span>
            </div>
            <div className="text-xs text-isaac-muted">{editionLabel(slot.edition)}</div>
          </>
        ) : (
          <span className="text-xs text-isaac-blood">Corriger via ⚙️</span>
        )}
      </div>
    </button>
  );
}

export function SlotPicker() {
  const { slots, loadingSlots, loadSlots, selectSlot, toast } = useStore();

  useEffect(() => {
    if (slots == null) loadSlots();
  }, [slots, loadSlots]);

  async function locateManually() {
    const dir = await open({ directory: true, title: "Localiser le dossier de sauvegarde Isaac" });
    if (typeof dir !== "string") return;
    const found = await api.scanFolder(dir);
    if (found.length === 0) {
      toast("Aucune sauvegarde trouvée dans ce dossier.");
      return;
    }
    useStore.setState((s) => ({
      slots: [...found, ...(s.slots ?? [])].filter(
        (v, i, arr) => arr.findIndex((x) => x.path === v.path) === i,
      ),
    }));
    toast(`${found.length} sauvegarde(s) trouvée(s).`);
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-isaac-gold">
          The Binding of Isaac · Repentance+
        </p>
        <h1 className="text-3xl font-bold">Choisis ta sauvegarde</h1>
        <p className="mt-2 text-sm text-isaac-muted">
          Détection automatique dans Steam Cloud et Documents. Lecture seule — ta save n'est jamais modifiée.
        </p>
      </div>

      {loadingSlots && (
        <div className="flex items-center justify-center gap-2 py-8 text-isaac-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Recherche des sauvegardes…
        </div>
      )}

      {!loadingSlots && slots && slots.length > 0 && (
        <div className="space-y-3">
          {slots.map((s) => (
            <SlotRow key={s.path} slot={s} onPick={selectSlot} />
          ))}
        </div>
      )}

      {!loadingSlots && slots && slots.length === 0 && (
        <EmptyState title="Aucune sauvegarde détectée automatiquement.">
          Utilise « Localiser ma save… » pour pointer le dossier manuellement.
        </EmptyState>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={locateManually}
          className="inline-flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-4 py-2 text-sm text-isaac-text transition-colors hover:border-isaac-gold/50"
        >
          <FolderSearch className="h-4 w-4" /> Localiser ma save…
        </button>
        <button
          onClick={() => loadSlots()}
          className="inline-flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-4 py-2 text-sm text-isaac-muted transition-colors hover:text-isaac-text"
        >
          <HardDriveDownload className="h-4 w-4" /> Re-scanner
        </button>
      </div>
    </div>
  );
}
