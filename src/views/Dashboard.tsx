import { AlertTriangle, Skull, Target, Trophy } from "lucide-react";
import { useStore } from "../store";
import { Card, ProgressBar, SectionTitle, Pill } from "../components/ui";
import { categoryLabel } from "../lib/format";

export function DashboardView() {
  const dashboard = useStore((s) => s.dashboard);
  const setView = useStore((s) => s.setView);
  if (!dashboard) return null;

  const deadGodDone = dashboard.dead_god_total - dashboard.dead_god_remaining;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 text-isaac-muted">
            <Trophy className="h-4 w-4 text-isaac-gold" />
            <span className="text-sm font-medium">Succès débloqués</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-isaac-gold">{dashboard.total_unlocked}</span>
            <span className="text-isaac-muted">/ {dashboard.total}</span>
            <span className="ml-auto text-sm text-isaac-muted">{dashboard.percent.toFixed(1)}%</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={dashboard.total_unlocked} max={dashboard.total} tone="gold" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-isaac-muted">
            <Skull className="h-4 w-4 text-isaac-blood" />
            <span className="text-sm font-medium">Distance à Dead God</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold">{dashboard.dead_god_remaining}</span>
            <span className="text-isaac-muted">marks Hard restantes</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={deadGodDone} max={dashboard.dead_god_total} tone="blood" />
          </div>
          <div className="mt-1 text-xs text-isaac-muted">
            {deadGodDone} / {dashboard.dead_god_total} marks dorées (34 persos × 12)
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle hint="débloqués / total">Répartition par catégorie</SectionTitle>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {dashboard.categories.map((c) => (
            <div key={c.category}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{categoryLabel(c.category)}</span>
                <span className="text-isaac-muted">
                  {c.unlocked}/{c.total}
                </span>
              </div>
              <ProgressBar value={c.unlocked} max={c.total} tone="done" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle hint="calculé depuis ta save">Prochaines cibles recommandées</SectionTitle>
        {dashboard.next_targets.length === 0 ? (
          <p className="text-sm text-isaac-muted">Tout est bouclé de ce côté 🎉</p>
        ) : (
          <div className="space-y-2">
            {dashboard.next_targets.map((t, i) => (
              <button
                key={i}
                onClick={() => setView("predictor")}
                className="flex w-full items-center justify-between rounded-lg border border-isaac-border bg-isaac-surface2/50 px-4 py-2.5 text-left text-sm transition-colors hover:border-isaac-blood/40"
              >
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-isaac-blood" />
                  <strong>{t.character_name}</strong> → {t.target_name}
                </span>
                <span className="flex items-center gap-2">
                  {t.new_unlocks > 0 && (
                    <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">
                      +{t.new_unlocks} succès
                    </Pill>
                  )}
                  {t.fills_hard_mark && (
                    <Pill className="border-isaac-blood/40 bg-isaac-blood/10 text-isaac-blood/90">
                      mark Hard
                    </Pill>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
