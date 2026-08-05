import { Github, Heart } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card } from "../components/ui";
import { GITHUB_URL } from "../lib/format";

const VERSION = "0.1.0";

export function AboutView() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-isaac-gold">
          The Binding of Isaac · Repentance+
        </p>
        <h1 className="text-3xl font-bold">
          Isaac <span className="text-isaac-blood">Completion</span> Tracker
        </h1>
        <p className="mt-1 text-sm text-isaac-muted">Version {VERSION}</p>
      </div>

      <Card className="text-center">
        <p className="text-sm text-isaac-muted">Créé par</p>
        <button
          onClick={() => openUrl(GITHUB_URL)}
          className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-isaac-text transition-colors hover:text-isaac-gold"
        >
          <Github className="h-5 w-5" />
          reiassezbeau
        </button>
        <div className="mt-2">
          <button onClick={() => openUrl(GITHUB_URL)} className="text-sm text-isaac-gold hover:underline">
            {GITHUB_URL}
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-isaac-muted">
          À propos
        </h2>
        <div className="space-y-2 text-sm text-isaac-muted">
          <p>
            Outil <strong className="text-isaac-text">100 % local et hors-ligne</strong> : il lit ta
            sauvegarde (lecture seule) pour suivre tes 641 succès, tes completion marks par personnage, et
            tracer ta route vers Dead God. Aucun appel réseau, aucune API Steam requise.
          </p>
          <p>
            Projet open-source (licence MIT). La base des 641 succès est compilée au dev-time depuis le wiki
            communautaire et embarquée dans l'app.
          </p>
          <p className="flex items-center gap-1.5 text-xs">
            <Heart className="h-3 w-3 text-isaac-blood" />
            Outil communautaire non affilié à Nicalis ni à Edmund McMillen.
          </p>
        </div>
      </Card>
    </div>
  );
}
