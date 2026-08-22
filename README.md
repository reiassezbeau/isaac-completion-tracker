# Isaac Completion Tracker

**🇫🇷 Français** · [🇬🇧 English](README.en.md)

[![Télécharger](https://img.shields.io/badge/T%C3%A9l%C3%A9charger-.exe%20Windows-c1272d?style=for-the-badge&logo=windows)](https://github.com/reiassezbeau/isaac-completion-tracker/releases/download/v0.1.0/Isaac-Completion-Tracker_0.1.0_x64-setup.exe)
[![Release](https://img.shields.io/github/v/release/reiassezbeau/isaac-completion-tracker?style=for-the-badge&color=d4af37)](https://github.com/reiassezbeau/isaac-completion-tracker/releases/latest)
[![licence](https://img.shields.io/badge/licence-GPL--3.0-8c1a1a?style=for-the-badge)](LICENSE)

> Suivi de complétion **local et 100 % hors-ligne** pour *The Binding of Isaac: Repentance+*
> (641 succès Steam). Lit ta sauvegarde en **lecture seule** et te dit précisément quoi
> faire pour avancer — jusqu'à **Dead God**.
>
> Créé par **[reiassezbeau](https://github.com/reiassezbeau)** · [github.com/reiassezbeau](https://github.com/reiassezbeau)

---

## Ce que ça fait

- **Dashboard** — compteur global `X / 641`, %, jauge « distance à Dead God » (12 anneaux, un par
  ending), répartition par catégorie, prochaines cibles recommandées.
- **La Grille** — le tableau du complétionniste : **34 personnages × 12 marques** d'un seul coup
  d'œil, avec les totaux par colonne pour repérer le goulot d'étranglement.
- **Personnage** — pour chacun des 34 persos (17 + 17 Tainted) : ses completion marks
  (À faire / Normal / Hard), ce qu'il te reste à faire et ce que ça débloque, conseils de routing.
- **Prédicteur** — « si je fais **[boss]** avec **[perso]** », il te dit ce que ça débloque
  (succès, items) et si ça rapproche de Dead God. Plus une vue inverse « quoi faire ensuite ».
- **Optimiseur** — classe tes prochaines actions par **espérance de gain** (valeur × probabilité) :
  ETA vers Dead God, goulots d'étranglement, persos les plus proches du 100 %.
- **Assistant de build** — simulateur : compose ton build, teste un item candidat → delta de stats,
  **radar avant/après**, conflits de remplacement de larmes, verdict.
- **Stats de jeu** (avec le mod) — winrate, hits par étage, tendances, records, insights.
- **Carte partageable** — génère une image PNG de ta progression ou d'un run marquant.
- **Navigateur des 641 succès** — recherche, filtres (catégorie / DLC / statut), révélation
  des conditions des succès verrouillés.
- **Roadmap** vers Dead God, recalculée à chaque lecture de save.
- **Corrections manuelles** — filet de sécurité si le parsing se trompe (stocké hors de la save).
- **Live update** — dès que tu joues, l'app se met à jour toute seule.

### Personnalisation

- **5 thèmes** inspirés des lieux du jeu : Sous-sol, Sheol, Le Vide, Corpse, Cathédrale (clair).
- **13 langues** (navigation et interface ; textes des vues en cours de traduction) : English, Français, Español, Português, Deutsch, Русский, Polski, 中文, 日本語,
  हिन्दी, العربية, বাংলা, اردو (avec support RTL).

**Zéro réseau au runtime.** Toute la connaissance (les 641 succès + conditions) est embarquée.
Le CSP de l'app bloque tout accès externe (`connect-src 'self'`).

## Où l'app trouve la sauvegarde

Sur **Repentance+**, la save « live » est en général dans **Steam Cloud** :
`…/Steam/userdata/<id>/250900/remote/rep+persistentgamedata{1,2,3}.dat`.
L'app scanne aussi `Documents/My Games/Binding of Isaac Repentance+/` (et ses backups). Si rien
n'est trouvé, un bouton **« Localiser ma save… »** permet de pointer le dossier à la main.
**La save n'est jamais modifiée** (ouverture en lecture seule).

## Installation (utilisateur)

**[⬇️ Télécharger l'installeur Windows (.exe)](https://github.com/reiassezbeau/isaac-completion-tracker/releases/download/v0.1.0/Isaac-Completion-Tracker_0.1.0_x64-setup.exe)** — lance-le, c'est tout.

Toutes les versions : [page des Releases](https://github.com/reiassezbeau/isaac-completion-tracker/releases/latest). Un `.msi` et les empreintes `SHA256SUMS.txt` y sont aussi fournis.

> ⚠️ **SmartScreen** : l'installeur n'est pas signé (certificat payant). Windows peut afficher
> « Windows a protégé votre ordinateur ». Clique sur **« Informations complémentaires » →
> « Exécuter quand même »**. C'est normal pour un logiciel open-source non signé ; le code est
> ici et vérifiable.

## Mod de stats en jeu (optionnel)

Un mod Lua compagnon, **purement observateur**, compte tes hits et stats par run (croisés
avec ta complétion).

### Installer le mod

Installation **en 1 clic depuis l'app** — pas de fichier à télécharger séparément :

1. Ouvre l'app → encart du **Dashboard** (ou onglet **Diagnostic**) → bouton
   **« Installer le mod de stats »**.
   L'app détecte automatiquement le dossier mods de **Steam** (via le registre + `libraryfolders.vdf`,
   même si le jeu est sur un autre disque) et y copie le mod.

### Lancer le mod

2. **Relance Isaac** — ⚠️ les mods ne se chargent **qu'au démarrage du jeu**. Si Isaac tournait
   déjà, ferme-le complètement d'abord. Un bouton **« Lancer Isaac »** est fourni dans l'app.
3. **Vérifie** : le mod apparaît dans *Options → Mods* comme « **Isaac Tracker Stats** »
   (activé par défaut). L'onglet **Diagnostic** de l'app confirme aussi son installation.
4. **Joue** : les stats remontent automatiquement dans l'onglet **Stats** de l'app.

> **Faut-il « lancer » le mod ?** Non — le mod n'est pas un programme séparé : c'est du Lua chargé
> par Isaac **au démarrage du jeu**. L'ordre idéal est donc : **jeu fermé → installe le mod depuis
> l'app → lance Isaac**. Le mod est actif dès la première partie, rien d'autre à faire. Le seul cas
> à éviter est d'installer **pendant** qu'Isaac tourne : il faut alors le fermer et le relancer.

> **Ton run n'est jamais perdu.** Tu peux activer/désactiver le mod et relancer le jeu :
> le mod sauvegarde le run en cours quand tu retournes au menu, et le reprend au **Continue**.
> Un run non terminé est archivé, jamais supprimé.

> Le mod **n'utilise jamais la console de debug** et **ne modifie pas le gameplay** → aucun impact
> sur les succès une fois Mom battue sur le slot (règle du jeu, pas du tracker). Sur une **nouvelle**
> save, bats Mom une fois avant de compter sur les déblocages.

> **Droits d'écriture** : le dossier mods est sous `Program Files` ; il est presque toujours
> inscriptible (Steam pose les droits). Si l'installation échoue (dossier verrouillé), lance l'app
> en administrateur, ou copie `isaac-tracker-mod/` à la main dans
> `…\steamapps\common\The Binding of Isaac Rebirth\mods\`.

## Build (développeur)

Prérequis : **Node 18+**, **Rust stable** (toolchain MSVC sous Windows) et les
**VS Build Tools C++** + **WebView2** (préinstallé sur Win 11).

```bash
npm install
npm run tauri dev      # lance l'app en dev
npm run tauri build    # produit l'installeur .exe (NSIS) + .msi dans src-tauri/target/release/bundle
```

### Régénérer les bases de connaissances

Compilées au **dev-time** (internet autorisé) puis committées :

```bash
npm run build:knowledge   # les 641 succès
npm run build:item-kb     # la base d'items (2 formats : app + mod)
```

Détails et sources dans [`tools/build-knowledge/README.md`](tools/build-knowledge/README.md).

### Tests du parseur

```bash
cd src-tauri
# Validation contre une vraie sauvegarde (facultatif) :
ISAAC_SAVE_PATH="C:/…/remote/rep+persistentgamedata1.dat" cargo test
```

Sans `ISAAC_SAVE_PATH`, les tests utilisent une fixture synthétique en mémoire.

### Remplacer l'icône

L'icône est un placeholder rouge/or généré à partir de `src-tauri/icons/icon-source.png`.
Pour la remplacer, fournis ton propre PNG 1024×1024 puis :

```bash
npm run tauri icon path/vers/ton-icone.png
```

## Stack

Tauri v2 (Rust) · React 19 + TypeScript (strict) · Vite · Tailwind CSS v3 · Zustand · lucide-react.

## Crédits

Créé par **[reiassezbeau](https://github.com/reiassezbeau)**.
Base des succès compilée depuis le wiki communautaire *Binding of Isaac: Rebirth*.
Le format de sauvegarde a été rétro-ingénieré par la communauté ; le parsing est réimplémenté
proprement (aucun code tiers copié) et **validé contre une vraie sauvegarde**.

Esthétique **100 % originale** (SVG maison, aucun asset du jeu). Police *Cinzel* (OFL).
Texture de parchemin : domaine public (CC0, OpenGameArt).

## Licence

[GPL-3.0](LICENSE) © 2026 reiassezbeau. Tout dérivé doit rester open-source et
conserver l'attribution — tu ne peux pas repackager ce projet en le revendiquant.

Outil **communautaire non affilié** à Nicalis / Edmund McMillen.
