// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * UpdateCard — the manual update check.
 *
 * The app is offline by design, so it cannot update itself silently and never tries:
 * nothing here runs unless the user presses the button. The flow is deliberately
 * three explicit steps — check, download, install — and the download is refused
 * unless its SHA-256 matches the checksum published with the release, so a corrupted
 * or tampered file can never be executed.
 */
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "./ui";
import { Modal, ModalButton } from "./Modal";
import { api } from "../lib/api";
import { useStore } from "../store";
import { useT } from "../lib/useT";
import { APP_VERSION } from "../lib/format";
import type { UpdateInfo } from "../lib/types";

type Phase = "idle" | "checking" | "result" | "downloading" | "ready";

export function UpdateCard() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [phase, setPhase] = useState<Phase>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [installer, setInstaller] = useState<string | null>(null);
  const [confirmInstall, setConfirmInstall] = useState(false);

  async function check() {
    setPhase("checking");
    try {
      const res = await api.checkForUpdate();
      setInfo(res);
      setPhase("result");
      if (!res.available) toast(t("upd.upToDate"));
    } catch (e) {
      setPhase("idle");
      toast(`${t("upd.checkFailed")} ${String(e)}`);
    }
  }

  async function download() {
    if (!info) return;
    setPhase("downloading");
    try {
      setInstaller(await api.downloadUpdate(info));
      setPhase("ready");
    } catch (e) {
      setPhase("result");
      toast(`${t("upd.downloadFailed")} ${String(e)}`);
    }
  }

  async function install() {
    if (!installer) return;
    setConfirmInstall(false);
    try {
      await api.installUpdate(installer);
    } catch (e) {
      toast(`${t("upd.installFailed")} ${String(e)}`);
    }
  }

  const busy = phase === "checking" || phase === "downloading";

  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-isaac-muted">
        {t("upd.title")}
      </h2>
      <p className="mb-3 text-sm text-isaac-muted">{t("upd.intro")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={check}
          disabled={busy}
          className="press-in inline-flex items-center gap-2 rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-text transition-colors hover:border-isaac-gold/50 disabled:opacity-40"
        >
          {phase === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("upd.checkBtn")}
        </button>
        <span className="text-xs text-isaac-faint">
          {t("about.version")} {APP_VERSION}
        </span>
      </div>

      {phase === "result" && info && !info.available && (
        <p className="animate-fadeSlide mt-3 inline-flex items-center gap-1.5 text-sm text-isaac-done">
          <CheckCircle2 className="h-4 w-4" /> {t("upd.upToDate")}
        </p>
      )}

      {info?.available && phase !== "idle" && phase !== "checking" && (
        <div className="animate-fadeSlide mt-3 rounded-xl border border-isaac-gold/40 bg-isaac-gold/[0.06] p-4">
          <div className="font-semibold text-isaac-gold">
            {t("upd.newVersion")} {info.latest_version}
          </div>
          {info.notes && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-isaac-muted">
              {info.notes}
            </pre>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {phase !== "ready" && info.installer_url && info.sha256 && (
              <button
                onClick={download}
                disabled={busy}
                className="press-in inline-flex items-center gap-2 rounded-lg border border-isaac-blood/40 bg-isaac-blood/10 px-3 py-1.5 text-sm text-isaac-text transition-colors hover:border-isaac-blood/70 disabled:opacity-40"
              >
                {phase === "downloading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("upd.downloadBtn")}
              </button>
            )}

            {phase === "ready" && (
              <button
                onClick={() => setConfirmInstall(true)}
                className="press-in inline-flex items-center gap-2 rounded-lg border border-isaac-done/50 bg-isaac-done/10 px-3 py-1.5 text-sm text-isaac-text transition-colors hover:border-isaac-done"
              >
                <ShieldCheck className="h-4 w-4 text-isaac-done" /> {t("upd.installBtn")}
              </button>
            )}

            <button
              onClick={() => openUrl(info.release_url)}
              className="press-in inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-isaac-muted transition-colors hover:text-isaac-text"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("upd.openPage")}
            </button>
          </div>

          {phase === "ready" && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-isaac-done">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("upd.verified")}
            </p>
          )}
          {!info.sha256 && (
            <p className="mt-2 text-xs text-isaac-blood">{t("upd.noChecksum")}</p>
          )}
        </div>
      )}

      <Modal
        open={confirmInstall}
        onClose={() => setConfirmInstall(false)}
        title={t("upd.confirmTitle")}
        actions={
          <>
            <ModalButton onClick={() => setConfirmInstall(false)}>{t("common.cancel")}</ModalButton>
            <ModalButton tone="primary" onClick={install}>
              {t("upd.installBtn")}
            </ModalButton>
          </>
        }
      >
        {t("upd.confirmBody")}
      </Modal>
    </Card>
  );
}
