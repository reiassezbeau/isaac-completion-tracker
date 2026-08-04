/**
 * Isaac Completion Tracker — fenêtre d'amorçage (étape 1 du plan de build).
 * L'UI complète (Dashboard, Personnage, Prédicteur, Succès, Roadmap, À propos)
 * arrive aux étapes suivantes. Ici : on prouve juste que la fenêtre se lance,
 * avec le thème sombre « Isaac » et Tailwind opérationnels.
 *
 * Créé par reiassezbeau — https://github.com/reiassezbeau
 */
function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-isaac-gold">
          The Binding of Isaac · Repentance+
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Isaac{" "}
          <span className="text-isaac-blood">Completion</span> Tracker
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-isaac-muted">
          Suivi de complétion 100 % hors-ligne — lecture de votre sauvegarde,
          641 succès, completion marks par personnage, et la route vers{" "}
          <span className="text-isaac-gold">Dead God</span>.
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-xl border border-isaac-border bg-isaac-surface px-4 py-2 text-xs text-isaac-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-isaac-done" />
          Fenêtre d'amorçage — étape 1/10 : scaffold opérationnel
        </div>
      </main>

      <footer className="border-t border-isaac-border bg-isaac-surface/60 px-6 py-3 text-center text-xs text-isaac-muted">
        Créé par{" "}
        <span className="font-medium text-isaac-text">reiassezbeau</span> ·{" "}
        <span className="text-isaac-gold">github.com/reiassezbeau</span>
      </footer>
    </div>
  );
}

export default App;
