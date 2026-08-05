# Isaac Completion Tracker

> Suivi de complétion **local et 100 % hors-ligne** pour *The Binding of Isaac: Repentance+*
> (641 succès Steam). Lit ta sauvegarde en **lecture seule** et te dit précisément quoi
> faire pour avancer — jusqu'à **Dead God**.
>
> Créé par **[reiassezbeau](https://github.com/reiassezbeau)** · [github.com/reiassezbeau](https://github.com/reiassezbeau)

---

## Ce que ça fait

- **Dashboard** — compteur global `X / 641`, %, distance à Dead God (marks Hard restantes),
  répartition par catégorie, prochaines cibles recommandées.
- **Mode Personnage** — pour chacun des 34 persos (17 + 17 Tainted) : ses completion marks
  (À faire / Normal / Hard), ce qu'il te reste à faire et ce que ça débloque, conseils de routing.
- **Mode Prédicteur** — « si je fais **[boss]** avec **[perso]** », il te dit ce que ça débloque
  (succès, items) et si ça rapproche de Dead God. Plus une vue inverse « quoi faire ensuite ».
- **Navigateur des 641 succès** — recherche, filtres (catégorie / DLC / statut), révélation
  des conditions des succès verrouillés.
- **Roadmap** vers Dead God, recalculée à chaque lecture de save.
- **Override manuel** — filet de sécurité si le parsing se trompe (stocké hors de la save).
- **Live update** — dès que tu joues, l'app se met à jour toute seule.

**Zéro réseau au runtime.** Toute la connaissance (les 641 succès + conditions) est embarquée.
Le CSP de l'app bloque tout accès externe (`connect-src 'self'`).

## Où l'app trouve la sauvegarde

Sur **Repentance+**, la save « live » est en général dans **Steam Cloud** :
`…/Steam/userdata/<id>/250900/remote/rep+persistentgamedata{1,2,3}.dat`.
L'app scanne aussi `Documents/My Games/Binding of Isaac Repentance+/` (et ses backups). Si rien
n'est trouvé, un bouton **« Localiser ma save… »** permet de pointer le dossier à la main.
**La save n'est jamais modifiée** (ouverture en lecture seule).

## Installation (utilisateur)

Télécharge le dernier installeur `.exe` depuis les [Releases](https://github.com/reiassezbeau/isaac-completion-tracker/releases), lance-le, c'est tout.

> ⚠️ **SmartScreen** : l'installeur n'est pas signé (certificat payant). Windows peut afficher
> « Windows a protégé votre ordinateur ». Clique sur **« Informations complémentaires » →
> « Exécuter quand même »**. C'est normal pour un logiciel open-source non signé ; le code est
> ici et vérifiable.

## Build (développeur)

Prérequis : **Node 18+**, **Rust stable** (toolchain MSVC sous Windows) et les
**VS Build Tools C++** + **WebView2** (préinstallé sur Win 11).

```bash
npm install
npm run tauri dev      # lance l'app en dev
npm run tauri build    # produit l'installeur .exe (NSIS) + .msi dans src-tauri/target/release/bundle
```

### Régénérer la base de connaissances

La liste des 641 succès est compilée au **dev-time** (internet autorisé) puis committée :

```bash
npm run build:knowledge
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

Tauri v2 (Rust) · React 18 + TypeScript (strict) · Vite · Tailwind CSS · Zustand · lucide-react.

## Crédits

Créé par **[reiassezbeau](https://github.com/reiassezbeau)**.
Base des succès compilée depuis le wiki communautaire *Binding of Isaac: Rebirth*.
Le format de sauvegarde a été rétro-ingénieré par la communauté ; le parsing est réimplémenté
proprement (aucun code tiers copié) et **validé contre une vraie sauvegarde**.

## Licence

[MIT](LICENSE) © 2026 reiassezbeau.

Outil **communautaire non affilié** à Nicalis / Edmund McMillen.
