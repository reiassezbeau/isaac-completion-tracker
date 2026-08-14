// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Modale thémée (remplace les alert()/confirm bruts). Fermeture Échap / clic hors. */
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="animate-fadeSlide relative z-10 w-full max-w-md rounded-xl border border-isaac-border-strong bg-isaac-surface3 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_22px_54px_-22px_rgba(0,0,0,0.92)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-isaac-text">{title}</h2>
          <button onClick={onClose} className="text-isaac-faint transition-colors hover:text-isaac-text" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="text-sm leading-relaxed text-isaac-muted">{children}</div>}
        {actions && <div className="mt-5 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Bouton d'action standard pour les modales. */
export function ModalButton({
  onClick,
  children,
  tone = "ghost",
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "primary" | "danger" | "ghost";
}) {
  const cls =
    tone === "primary"
      ? "border-isaac-gold/50 bg-isaac-gold/15 text-isaac-gold hover:bg-isaac-gold/25"
      : tone === "danger"
        ? "border-isaac-dried/50 bg-isaac-dried/15 text-isaac-blood-light hover:bg-isaac-dried/25"
        : "border-isaac-border text-isaac-muted hover:text-isaac-text";
  return (
    <button onClick={onClick} className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${cls}`}>
      {children}
    </button>
  );
}
