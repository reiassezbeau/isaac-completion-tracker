// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useCallback, useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Download, Image as ImageIcon } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store";
import { Card, EmptyState, SectionTitle } from "../components/ui";
import type { Dashboard, Insights, Run, StatsOverview } from "../lib/types";

type Template = "profile" | "run";

const W = 1200;
const H = 630;

// Palette lue depuis les variables CSS du thème actif → la carte exportée épouse
// le thème courant (Sous-sol / Sheol / Vide / Corpse / Cathédrale).
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const p = v.split(/\s+/).map(Number);
  return p.length === 3 && p.every((n) => !Number.isNaN(n)) ? `rgb(${p[0]}, ${p[1]}, ${p[2]})` : v || fallback;
}
let C = {
  bg: "#0a0807",
  panel: "#100c09",
  border: "#241d16",
  blood: "#c1272d",
  accent: "#8c1a1a",
  gold: "#c9a94a",
  done: "#3ec07f",
  text: "#efe8dc",
  muted: "#a49a8b",
};
function readPalette() {
  C = {
    bg: cssVar("--i-bg", "#0a0807"),
    panel: cssVar("--i-surface", "#100c09"),
    border: cssVar("--i-border", "#241d16"),
    blood: cssVar("--i-blood", "#c1272d"),
    accent: cssVar("--i-accent", "#8c1a1a"),
    gold: cssVar("--i-gold", "#c9a94a"),
    done: cssVar("--i-jade", "#3ec07f"),
    text: cssVar("--i-text", "#efe8dc"),
    muted: cssVar("--i-muted", "#a49a8b"),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function tile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: string,
) {
  ctx.fillStyle = C.panel;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();

  ctx.fillStyle = C.muted;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label.toUpperCase(), x + 18, y + 32);
  ctx.fillStyle = color;
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText(value, x + 18, y + 74);
}

function paintFrame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // vignette discrète, teintée par l'accent du thème
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, C.accent.replace("rgb(", "rgba(").replace(")", ", 0.09)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // liseré or en haut
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, 0, W, 5);
}

function paintHeader(ctx: CanvasRenderingContext2D, subtitle: string) {
  ctx.save();
  ctx.letterSpacing = "4px";
  ctx.fillStyle = C.gold;
  ctx.font = "700 24px 'Cinzel', Georgia, serif";
  ctx.fillText("ISAAC COMPLETION TRACKER", 48, 62);
  ctx.restore();
  ctx.fillStyle = C.muted;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText(subtitle, 48, 90);
}

function paintWatermark(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.muted;
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText("github.com/reiassezbeau · outil communautaire, non affilié à Nicalis / Edmund McMillen", 48, H - 30);
}

function pctStr(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function drawProfile(
  ctx: CanvasRenderingContext2D,
  data: { dash: Dashboard; ov: StatsOverview | null; ins: Insights | null; attempts: number | null; name: (id: string) => string },
) {
  const { dash, ov, ins, attempts, name } = data;
  paintFrame(ctx);
  paintHeader(ctx, "Progression vers Dead God");

  const dgDone = dash.dead_god_total - dash.dead_god_remaining;
  const dgPct = dash.dead_god_total > 0 ? dgDone / dash.dead_god_total : 0;

  // Héros : % Dead God
  ctx.fillStyle = C.gold;
  ctx.font = "700 112px 'Cinzel', Georgia, serif";
  ctx.fillText(pctStr(dgPct), 48, 236);
  ctx.fillStyle = C.text;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("vers Dead God", 48, 280);
  ctx.fillStyle = C.muted;
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(`${dgDone} / ${dash.dead_god_total} marques Hard  ·  ${dash.total_unlocked} / ${dash.total} succès`, 48, 312);

  // Barre de progression Dead God
  const bx = 48;
  const by = 336;
  const bw = W - 96;
  ctx.fillStyle = C.panel;
  roundRect(ctx, bx, by, bw, 16, 8);
  ctx.fill();
  ctx.fillStyle = C.gold;
  roundRect(ctx, bx, by, Math.max(16, bw * dgPct), 16, 8);
  ctx.fill();

  // Tuiles
  const cleanest = ins?.cleanest_characters?.[0];
  const best = ins?.best_clean_runs?.[0];
  const ty = 392;
  const tw = (W - 96 - 3 * 20) / 4;
  const th = 96;
  tile(ctx, 48 + 0 * (tw + 20), ty, tw, th, "Winrate", ov ? pctStr(ov.overall_winrate) : "—", C.done);
  tile(
    ctx,
    48 + 1 * (tw + 20),
    ty,
    tw,
    th,
    "Perso le + clean",
    cleanest ? name(cleanest.character) : "—",
    C.gold,
  );
  tile(
    ctx,
    48 + 2 * (tw + 20),
    ty,
    tw,
    th,
    "Meilleur run",
    best ? `${best.hits} hits` : "—",
    C.blood,
  );
  tile(ctx, 48 + 3 * (tw + 20), ty, tw, th, "Tentatives → DG", attempts != null ? String(attempts) : "—", C.text);

  paintWatermark(ctx);
}

function fmtDuration(frames: number | null): string {
  if (!frames || frames <= 0) return "—";
  const s = Math.round(frames / 30); // frames de logique ~30/s
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function drawRun(ctx: CanvasRenderingContext2D, run: Run, charName: string) {
  paintFrame(ctx);
  paintHeader(ctx, "Récap de run");

  // Perso
  ctx.fillStyle = C.text;
  ctx.font = "700 70px 'Cinzel', Georgia, serif";
  ctx.fillText(charName, 48, 214);

  // Issue
  const win = run.outcome === "win";
  const label = win ? "VICTOIRE" : run.outcome === "death" ? "MORT" : (run.outcome ?? "EN COURS").toUpperCase();
  const color = win ? C.done : run.outcome === "death" ? C.blood : C.muted;
  ctx.font = "700 26px system-ui, sans-serif";
  const lw = ctx.measureText(label).width + 36;
  ctx.fillStyle = color + "22";
  roundRect(ctx, 48, 244, lw, 46, 12);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 48, 244, lw, 46, 12);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, 66, 276);

  if (run.ending) {
    ctx.fillStyle = C.muted;
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.fillText(`Fin : ${run.ending}`, 60 + lw, 276);
  }

  // Tuiles
  const ty = 360;
  const tw = (W - 96 - 3 * 20) / 4;
  const th = 96;
  tile(ctx, 48 + 0 * (tw + 20), ty, tw, th, "Hits subis", String(run.hits_total), C.blood);
  tile(ctx, 48 + 1 * (tw + 20), ty, tw, th, "Étage atteint", String(run.deepest_stage), C.gold);
  tile(ctx, 48 + 2 * (tw + 20), ty, tw, th, "Durée", fmtDuration(run.duration_frames), C.text);
  tile(ctx, 48 + 3 * (tw + 20), ty, tw, th, "Coups bloqués", String(run.shielded_hits), C.done);

  paintWatermark(ctx);
}

function canvasToBytes(canvas: HTMLCanvasElement): Promise<number[]> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Rendu du canvas impossible."));
      const buf = await blob.arrayBuffer();
      resolve(Array.from(new Uint8Array(buf)));
    }, "image/png");
  });
}

export function StatCardView() {
  const dashboard = useStore((s) => s.dashboard);
  const toast = useStore((s) => s.toast);
  const theme = useStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [template, setTemplate] = useState<Template>("profile");
  const [ov, setOv] = useState<StatsOverview | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runIdx, setRunIdx] = useState(0);
  const [names, setNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    api.getCharactersStatic().then((cs) => setNames(Object.fromEntries(cs.map((c) => [c.id, c.name]))));
    api.getStatsOverview().then(setOv).catch(() => setOv(null));
    api.getInsights().then(setIns).catch(() => setIns(null));
    api.getRunHistory(40).then(setRuns).catch(() => setRuns([]));
    api.getOptimizer(1).then((r) => setAttempts(r.eta.estimated_attempts)).catch(() => setAttempts(null));
  }, []);

  const name = useCallback((id: string) => names[id] ?? id, [names]);

  // rendu du canvas à chaque changement de données/template/thème
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dashboard) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    readPalette(); // épouse le thème actif
    if (template === "profile") {
      drawProfile(ctx, { dash: dashboard, ov, ins, attempts, name });
    } else if (runs.length > 0) {
      const run = runs[Math.min(runIdx, runs.length - 1)];
      drawRun(ctx, run, name(run.character));
    } else {
      paintFrame(ctx);
      paintHeader(ctx, "Récap de run");
      ctx.fillStyle = C.muted;
      ctx.font = "500 24px system-ui, sans-serif";
      ctx.fillText("Aucun run enregistré (installe le mod et joue).", 48, 200);
      paintWatermark(ctx);
    }
  }, [template, dashboard, ov, ins, attempts, runs, runIdx, name, theme, fontsReady]);

  const onExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const defaultPath = `isaac-tracker-${template}-${stamp}.png`;
    try {
      const path = await save({
        defaultPath,
        title: "Enregistrer la carte de stats",
        filters: [{ name: "Image PNG", extensions: ["png"] }],
      });
      if (!path) return; // annulé
      setSaving(true);
      const bytes = await canvasToBytes(canvas);
      const written = await api.saveStatCard(path, bytes);
      toast(`Carte enregistrée ✓ (${written.split(/[\\/]/).pop()})`);
    } catch (e) {
      toast(`Échec de l'export : ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [template, toast]);

  if (!dashboard) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <EmptyState title="Charge une sauvegarde d'abord." />
      </div>
    );
  }

  const tabs: [Template, string][] = [
    ["profile", "Carte profil"],
    ["run", "Carte run"],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
          <ImageIcon className="h-6 w-6 text-isaac-gold" /> Carte de stats
        </h1>
        <p className="mt-1 text-sm text-isaac-muted">
          Génère une image partageable (Discord / Reddit) de ta progression ou d'un run marquant.
          100 % hors-ligne.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-isaac-border bg-isaac-surface p-1 text-sm">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTemplate(id)}
              className={`rounded-md px-3 py-1.5 transition-colors ${template === id ? "bg-isaac-blood/15 text-isaac-text" : "text-isaac-muted hover:text-isaac-text"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {template === "run" && runs.length > 0 && (
          <select
            value={runIdx}
            onChange={(e) => setRunIdx(Number(e.target.value))}
            className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-1.5 text-sm text-isaac-text outline-none focus:border-isaac-blood/60"
          >
            {runs.map((r, i) => (
              <option key={r.run_id} value={i}>
                {name(r.character)} · {r.outcome ?? "en cours"} · {r.hits_total} hits
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onExport}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-1.5 text-sm text-isaac-gold transition-colors hover:bg-isaac-gold/20 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Enregistrer le PNG"}
        </button>
      </div>

      <Card>
        <SectionTitle hint="1200 × 630">Aperçu</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-isaac-border">
          <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
        </div>
      </Card>
    </div>
  );
}
