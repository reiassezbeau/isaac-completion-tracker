// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronDown, FolderSearch, HardDriveDownload, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { api } from "../lib/api";
import { editionLabel } from "../lib/format";
import { EmptyState } from "../components/ui";
import { Defs } from "../components/Defs";
import { ThemeBackdrop } from "../components/ThemeBackdrop";
import { ThemePicker } from "../components/ThemePicker";
import { Emblem } from "../lib/art";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT } from "../lib/useT";
import type { SaveSlot } from "../lib/types";

/** Translated provenance, falling back to the backend's English label. */
function sourceLabel(slot: SaveSlot, t: (k: string) => string): string {
  const key = `src.${slot.source_code}`;
  const s = t(key);
  return s === key ? slot.source : s;
}

/**
 * Translated parse error. The backend sends a stable code plus the one technical
 * value worth showing (an offset, a version byte) — the sentence is translated, the
 * value is not, so a French UI no longer mixes in raw English parser output.
 */
function errorLabel(slot: SaveSlot, t: (k: string) => string): string {
  if (!slot.error_code) return slot.parse_error ?? "";
  const key = `perr.${slot.error_code}`;
  const sentence = t(key);
  const text = sentence === key ? (slot.parse_error ?? key) : sentence;
  return slot.error_detail ? `${text} (${slot.error_detail})` : text;
}

function SlotRow({ slot, onPick }: { slot: SaveSlot; onPick: (s: SaveSlot) => void }) {
  const t = useT();
  const ok = slot.parse_error == null;
  return (
    <button
      onClick={() => onPick(slot)}
      className="press-in group flex w-full items-center justify-between gap-4 rounded-xl border border-isaac-border bg-isaac-surface px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition-all duration-150 hover:-translate-y-0.5 hover:border-isaac-dried/60 hover:shadow-[0_6px_18px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div className="min-w-0">
        <div className="font-semibold">
          {slot.label} <span className="text-isaac-muted">· {sourceLabel(slot, t)}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-isaac-muted">{slot.filename}</div>
        {!ok && <div className="mt-1 text-xs text-isaac-blood">⚠ {errorLabel(slot, t)}</div>}
      </div>
      <div className="flex-shrink-0 text-right">
        {ok ? (
          <>
            <div className="text-lg font-bold text-isaac-gold">
              {slot.unlocked}
              <span className="text-sm text-isaac-muted"> / {slot.total}</span>
            </div>
            <div className="text-xs text-isaac-muted">{editionLabel(slot.edition)}</div>
          </>
        ) : (
          <span className="text-xs text-isaac-blood">{t("slot.fixVia")}</span>
        )}
      </div>
    </button>
  );
}

export function SlotPicker() {
  const { slots, loadingSlots, loadSlots, selectSlot, toast } = useStore();
  const theme = useStore((s) => s.theme);
  const t = useT();
  const [showOld, setShowOld] = useState(false);

  useEffect(() => {
    if (slots == null) loadSlots();
  }, [slots, loadSlots]);

  // Isaac never deletes an older edition's save, so this folder accumulates one file
  // family per DLC plus dated backups. Only the files the installed game actually
  // writes are shown; the rest stay one click away instead of being deleted, because
  // the app's whole promise is that it never touches your saves.
  const { live, old } = useMemo(() => {
    const all = slots ?? [];
    const live = all.filter((s) => s.live);
    return { live: live.length > 0 ? live : all, old: live.length > 0 ? all.filter((s) => !s.live) : [] };
  }, [slots]);

  async function locateManually() {
    const dir = await open({ directory: true, title: t("slot.dialogTitle") });
    if (typeof dir !== "string") return;
    const found = await api.scanFolder(dir);
    if (found.length === 0) {
      toast(t("slot.noneFound"));
      return;
    }
    useStore.setState((s) => ({
      slots: [...found, ...(s.slots ?? [])].filter(
        (v, i, arr) => arr.findIndex((x) => x.path === v.path) === i,
      ),
    }));
    setShowOld(true);
    toast(`${found.length} ${t("slot.found")}`);
  }

  return (
    <div className="relative min-h-screen">
      <Defs />
      <ThemeBackdrop theme={theme} />
      <div className="absolute right-5 top-5 z-10 flex items-center gap-3">
        <ThemePicker />
        <LanguagePicker />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center text-isaac-dried">
            <Emblem size={56} />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-isaac-gold">
            {t("app.tagline")}
          </p>
          <h1 className="font-display text-4xl text-isaac-text">Isaac Completion Tracker</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-isaac-muted">{t("slot.pick")}</p>
        </div>

        {loadingSlots && (
          <div className="flex items-center justify-center gap-2 py-8 text-isaac-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> {t("slot.searching")}
          </div>
        )}

        {!loadingSlots && live.length > 0 && (
          <div className="space-y-3">
            {live.map((s) => (
              <SlotRow key={s.path} slot={s} onPick={selectSlot} />
            ))}
          </div>
        )}

        {!loadingSlots && old.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowOld((v) => !v)}
              aria-expanded={showOld}
              className="press-in mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-isaac-faint transition-colors hover:text-isaac-muted"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${showOld ? "rotate-180" : ""}`}
              />
              {old.length} {t("slot.oldFiles")}
            </button>
            {showOld && (
              <div className="animate-fadeSlide mt-3 space-y-3 border-t border-isaac-border pt-3">
                <p className="text-center text-xs text-isaac-faint">{t("slot.oldFilesHint")}</p>
                {old.map((s) => (
                  <SlotRow key={s.path} slot={s} onPick={selectSlot} />
                ))}
              </div>
            )}
          </div>
        )}

        {!loadingSlots && slots && slots.length === 0 && (
          <EmptyState title={t("slot.none")}>{t("slot.noneHint")}</EmptyState>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={locateManually}
            className="press-in inline-flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-4 py-2 text-sm text-isaac-text transition-colors hover:border-isaac-gold/50"
          >
            <FolderSearch className="h-4 w-4" /> {t("slot.locate")}
          </button>
          <button
            onClick={() => loadSlots()}
            className="press-in inline-flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-4 py-2 text-sm text-isaac-muted transition-colors hover:text-isaac-text"
          >
            <HardDriveDownload className="h-4 w-4" /> {t("slot.rescan")}
          </button>
        </div>
      </div>
    </div>
  );
}
