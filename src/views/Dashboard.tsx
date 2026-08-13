// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "../store";
import { Card, ProgressBar, SectionTitle, Pill } from "../components/ui";
import { ModStatusCard } from "../components/ModStatus";
import { categoryLabel } from "../lib/format";
import { DeadGodGauge, Glyph, Sigil, baseSigilId } from "../lib/art";

function HeroTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "gold" | "done" | "text" }) {
  const color = tone === "gold" ? "text-isaac-gold" : tone === "done" ? "text-isaac-done" : "text-isaac-text";
  return (
    <div className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2.5">
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-isaac-faint">{label}</div>
      <div className={`mt-1 font-display text-xl ${color}`}>
        {value}
        <span className="text-xs font-normal text-isaac-faint"> {sub}</span>
      </div>
    </div>
  );
}

export function DashboardView() {
  const dashboard = useStore((s) => s.dashboard);
  const setView = useStore((s) => s.setView);

  const perEnding = useMemo(
    () => (dashboard?.dead_god_by_ending ?? []).map((e) => ({ hard: e.hard, normal: e.normal })),
    [dashboard],
  );
  if (!dashboard) return null;

  const done = dashboard.dead_god_total - dashboard.dead_god_remaining;
  const normalTotal = dashboard.dead_god_by_ending.reduce((a, e) => a + e.normal, 0);
  const achLeft = dashboard.total - dashboard.total_unlocked;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModStatusCard />

      {!dashboard.marks_reliable && (
        <div className="flex items-start gap-3 rounded-xl border border-isaac-gold/40 bg-isaac-gold/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-isaac-gold" />
          <div>
            <strong>Completion marks non fiables</strong> pour cette sauvegarde (format inattendu). Le
            décodage a été désactivé pour éviter d'afficher des données fausses — utilise les{" "}
            <button className="text-isaac-gold underline" onClick={() => setView("settings")}>
              corrections manuelles
            </button>
            .
          </div>
        </div>
      )}
      {!dashboard.checksum_ok && (
        <div className="rounded-xl border border-isaac-blood/40 bg-isaac-blood/10 px-4 py-3 text-sm text-isaac-text">
          ⚠ Le checksum de la sauvegarde ne correspond pas (fichier peut-être en cours d'écriture). Les
          données restent lisibles ; rafraîchis si besoin.
        </div>
      )}

      {/* ── HÉRO : la jauge Dead God (artefact de pierre) + les compteurs ── */}
      <div className="grid overflow-hidden rounded-xl border border-isaac-border bg-isaac-surface md:grid-cols-[300px_1fr]">
        <div
          className="flex flex-col items-center border-b border-isaac-border px-5 py-5 md:border-b-0 md:border-r"
          style={{ background: "radial-gradient(80% 70% at 50% 42%, rgba(201,169,74,.07), transparent 70%)" }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-isaac-faint">Distance à Dead God</div>
          <div className="relative mt-2">
            <DeadGodGauge perEnding={perEnding} size={238} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-5xl leading-none text-isaac-text" style={{ letterSpacing: "-.03em" }}>
                {dashboard.dead_god_remaining}
              </div>
              <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-isaac-faint">restantes</div>
            </div>
          </div>
          <div className="mt-1 font-mono text-xs text-isaac-gold">
            {done} / {dashboard.dead_god_total} <span className="text-isaac-faint">marks Hard</span>
          </div>
          <div className="mt-1.5 text-center text-[0.65rem] leading-snug text-isaac-faint">
            12 anneaux = les 12 endings · centre → extérieur = Mom's Heart → The Beast
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-5">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-isaac-faint">Succès débloqués</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-5xl text-isaac-gold" style={{ letterSpacing: "-.03em" }}>
                  {dashboard.total_unlocked}
                </span>
                <span className="text-lg text-isaac-faint">/ {dashboard.total}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl text-isaac-text">
                {dashboard.percent.toFixed(1)}
                <span className="text-base text-isaac-faint"> %</span>
              </div>
              <div className="mt-0.5 text-xs text-isaac-faint">{achLeft} restants</div>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={dashboard.total_unlocked} max={dashboard.total} tone="gold" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <HeroTile label="Marks Hard" value={String(done)} sub={`/ ${dashboard.dead_god_total}`} tone="gold" />
            <HeroTile label="Marks Normal" value={String(normalTotal)} sub="à refaire" tone="done" />
            <HeroTile label="Persos bouclés" value={String(dashboard.full_characters)} sub="/ 34" tone="text" />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="débloqués / total">Répartition par catégorie</SectionTitle>
          <div className="space-y-2.5">
            {dashboard.categories.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{categoryLabel(c.category)}</span>
                  <span className="font-mono text-xs text-isaac-faint">
                    {c.unlocked}/{c.total}
                  </span>
                </div>
                <ProgressBar value={c.unlocked} max={c.total} tone={c.unlocked === c.total ? "gold" : "done"} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="calculé depuis ta save">Prochaines cibles recommandées</SectionTitle>
          {dashboard.next_targets.length === 0 ? (
            <p className="text-sm text-isaac-done">Tout est bouclé de ce côté 🎉</p>
          ) : (
            <div className="space-y-2">
              {dashboard.next_targets.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setView("predictor")}
                  className="flex w-full items-center gap-3 rounded-lg border border-isaac-border bg-isaac-surface2/60 px-3 py-2.5 text-left text-sm transition-colors hover:border-isaac-dried/50"
                >
                  <Sigil id={baseSigilId(t.character_id)} size={28} tainted={t.character_id.startsWith("tainted_")} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="font-semibold text-isaac-text">{t.character_name}</span>
                    <br />
                    <span className="text-isaac-muted">{t.target_name}</span>
                  </span>
                  <span className="flex flex-shrink-0 text-isaac-faint">
                    <Glyph id={t.target_id} size={18} />
                  </span>
                  <span className="flex flex-shrink-0 flex-col items-end gap-1">
                    {t.new_unlocks > 0 && (
                      <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">+{t.new_unlocks} succès</Pill>
                    )}
                    {t.fills_hard_mark && (
                      <Pill className="border-isaac-dried/40 bg-isaac-dried/10 text-isaac-blood-light">mark Hard</Pill>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
