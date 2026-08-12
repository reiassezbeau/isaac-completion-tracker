<!-- SPDX-License-Identifier: GPL-3.0-only -->
<!-- Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau -->

# Brief design — **Isaac Completion Tracker**
### À donner à Claude Design pour construire toute la direction artistique de l'app

> **Rôle attendu :** l'application est **déjà fonctionnelle** (toutes les vues existent et marchent).
> Ta mission n'est PAS d'ajouter des features, c'est d'**élever l'esthétique** : identité visuelle,
> système de composants, data-viz, assets originaux, micro-interactions. Applique-toi sur l'existant.

---

## 0. Contexte produit
Application **desktop** (Windows) qui aide un joueur de *The Binding of Isaac: Repentance+* à
**compléter les 641 succès** jusqu'à **Dead God** (100 %). Elle lit sa sauvegarde en lecture seule,
affiche sa progression, prédit ce que débloque tel run, trace une roadmap, et (via un mod compagnon)
suit ses stats de jeu. Public : **complétionnistes hardcore** — ils veulent un outil **dense en info,
lisible, et gratifiant**, pas mignon. Ambiance *Isaac* : sombre, viscéral, un soupçon sacré/doré.

## 1. Stack & contraintes techniques (IMPÉRATIVES)
- **Tauri v2 + React 19 + TypeScript + Tailwind CSS v3 + lucide-react.** Livrables attendus : tokens
  Tailwind, composants React/TSX, et **SVG inline** (pas d'images externes).
- **100 % hors-ligne, CSP stricte** : **aucune ressource externe** — pas de police Google Fonts, pas
  de CDN, pas d'image distante, pas d'icône téléchargée à l'exécution. **Tout doit être inline ou
  bundlé** (SVG inline, police système ou police embarquée en base64 si vraiment nécessaire).
- **AUCUN asset rippé du jeu** (règle de droits, produit partagé publiquement) : pas de sprite, pas
  d'icône, pas de portrait, pas de son, pas de recopie de prose. **Uniquement de l'art ORIGINAL**
  (formes, glyphes, pictos abstraits que TU crées). Les *noms* (persos, bosses, succès) restent en
  anglais, ça c'est du texte, autorisé.
- **Theme-aware** : par défaut sombre (voir palette), mais prévoir un rendu **light** propre aussi.
- **Accessibilité** : contrastes AA minimum, focus visibles au clavier, cibles cliquables ≥ 32px.
- **Responsive** : la fenêtre va de ~940px à plein écran ; les tableaux/grilles denses scrollent dans
  leur conteneur (jamais de scroll horizontal de page).
- Attribution **reiassezbeau / github.com/reiassezbeau** présente (footer + À propos) — à styliser, pas à retirer.

## 2. Palette & identité actuelles (point de départ à raffiner)
Thème « Isaac » : charbon très sombre, **rouge sang**, **doré** (Golden God / Dead God), vert pour « fait ».
```
bg        #0a0a0c   surface   #141418   surface2 #1c1c22   border  #2a2a33
text      #eae7e1   muted     #9b968c
blood     #c1272d   blood-dim #7f1416   (accent principal / "à faire")
gold      #d4af37   gold-dim  #a8862b   (accent premium / mark Hard / Dead God)
done      #4caf50   (mark Normal / succès débloqué)
```
Statuts de complétion : **rouge = à faire**, **vert = fait (Normal)**, **or = fait (Hard)**.
Typo actuelle : Inter / Segoe UI système. **Tu peux** proposer une meilleure hiérarchie typographique,
voire une police d'accent embarquée (mono ou display) pour les chiffres/titres — **mais bundlée offline**.

Attendu de toi : **un système de couleurs complet et validé** (échelles, états hover/active/disabled,
sémantique claire), light + dark, cohérent, un cran au-dessus de l'actuel.

## 3. Inventaire des écrans à habiller
**Les 12 vues existent et fonctionnent** (barre latérale + zone de contenu + header + footer). Ordre de nav réel :
1. **SlotPicker** (écran d'accueil) — choix de la sauvegarde (liste de slots + aperçu).
2. **Dashboard** — compteur global X/641 + %, jauge « distance à Dead God », répartition par catégorie
   (barres), prochaines cibles recommandées, encart d'onboarding du mod.
3. **Personnage** — **grille des 34 persos** (17 + 17 Tainted) + fiche : **grille de completion marks**
   (12 marks × statut), liste « à faire », conseils de routing, **carte « stats de jeu »** (winrate/hits, si mod).
4. **Prédicteur** — 2 sélecteurs (perso × cible) → résultat « ça débloque / rien », + « quoi faire ensuite ».
5. **Succès** — **navigateur des 641** : recherche, filtres (catégorie/DLC/statut), lignes denses, révélation des cachés.
6. **Roadmap** — plan ordonné vers Dead God (étapes + barres de progression).
7. **Optimiseur** (`src/views/Optimizer.tsx`, NOUVEAU) — **la vue « que jouer ensuite »** : hero **jauge ETA
   Dead God** (marques faites/408 + runs/tentatives estimés), liste d'**actions classées par espérance de gain**
   (chaque ligne : perso + route + pills marques/succès/objets + barre EV + % réussite coloré), **goulots
   d'étranglement** (barres) et **« presque fini »** (persos les plus proches). Bannière cold-start.
8. **Assistant build** (`src/views/BuildAssistant.tsx`, NOUVEAU) — **simulateur** : sélecteur d'items (recherche),
   build courant en chips, panneau « try synergy » avec **radar SVG stats avant/après**, verdict coloré,
   notes de synergie, delta de stats, + panneau **composition & forces/faiblesses**.
9. **Stats** (`src/views/Stats.tsx`, NOUVEAU) — 3 onglets : **Aperçu** (tuiles KPI, hits par source, **heatmap
   hits/étage**, **tendance**, table par perso), **Runs** (historique), **Insights** (streaks, corrélation,
   persos clean/saignants, records).
10. **Carte** (`src/views/StatCard.tsx`, NOUVEAU) — générateur de **carte PNG partageable** (templates Profil +
    Run), rendu sur `<canvas>` 1200×630, aperçu + export. **Le rendu canvas est dans le TSX** (couleurs en dur,
    cf. §4.8) — à réharmoniser avec ton système.
11. **Diagnostic** — chemins résolus, statut du mod, boutons (installer mod / lancer Isaac / backup).
12. **Corrections** (override) — forcer le statut d'un succès / d'une mark.
13. **À propos** — nom, version, crédit reiassezbeau (lien), disclaimer.
- **Hors de ton scope web** : le **HUD in-game** (rendu Lua dans Isaac) — mentionné pour info, tu n'y touches pas.

## 4. Ce que je te demande de produire
1. **Système de design** : tokens (couleurs, espacements, rayons, ombres, typo), light+dark, mappés sur
   Tailwind (`tailwind.config.js` + variables CSS). Documenté.
2. **Bibliothèque de composants** (React/TSX + classes Tailwind), cohérente et réutilisable :
   cartes, boutons (primaire/secondaire/ghost/danger), badges/pills de statut, **barres & anneaux de
   progression**, checklist, **tuiles de stat / KPI**, tableaux denses, champs (input/select), toasts,
   **modales** (remplacer les `alert()` bruts actuels), états vides, bannières d'alerte, tooltips.
3. **Éléments signature** (là où l'app doit impressionner) :
   - **Grille de completion marks** 34×12 : lisible d'un coup d'œil, statut par couleur (rouge/vert/or),
     survol informatif, dense mais élégante. C'est LE tableau de bord du complétionniste.
   - **Jauge « Dead God »** : une pièce maîtresse (anneau/barre) qui donne envie d'y arriver.
   - **Badges de mark** (À faire / Normal / Hard) au design mémorable.
4. **Data-viz ORIGINALE** — ces composants **existent déjà** (implémentation fonctionnelle basique) ; ta mission
   est de les **élever et harmoniser**, pas de les inventer. Restyler concrètement :
   - **barres par catégorie** (Dashboard) et **barres EV / goulots** (Optimiseur),
   - **anneaux / jauges de progression** — surtout la **jauge ETA Dead God** (Optimiseur) et « distance à Dead God » (Dashboard),
   - **heatmap hits/étage** + **barres de tendance** (Stats/Aperçu),
   - **radar de stats avant/après** (Assistant build — `Radar` dans `BuildAssistant.tsx`, SVG 6 axes maison à sublimer),
   - **jauges de score / propreté** (Stats/Insights).
   Palette de data-viz accessible (daltonisme), cohérente avec le thème sombre.
5. **Iconographie / illustrations ORIGINALES** (SVG inline) :
   - un petit set de **glyphes pour les 12 endings/marks** (Mom's Heart, Mother, Beast, Hush…) — abstraits,
     PAS les sprites du jeu ; juste des pictos évocateurs et cohérents entre eux,
   - **avatars de perso** abstraits/monogrammes (PAS les sprites) pour la grille des 34,
   - icônes de statut/catégorie (au-delà de lucide-react si besoin).
6. **Micro-interactions** : remplissage animé des barres/anneaux, transitions de vue douces, hover/press
   states, toast d'arrivée, pulsation discrète sur « nouveau déblocage ». Sobres, jamais gênantes.
7. **Onboarding / premier lancement** : parcours clair (choisir save → installer mod → jouer), encart déjà présent à sublimer.
8. **Template de la carte de stats partageable (PNG)** : la carte **existe déjà** (rendu `<canvas>` 1200×630,
   templates Profil + Run, watermark `github.com/reiassezbeau`) dans `src/views/StatCard.tsx`. Les couleurs y sont
   **codées en dur** (objet `C` en haut du fichier) car le canvas ne lit pas Tailwind — fournis-moi les **valeurs
   hex finales** de ton système pour cet objet, et une maquette de mise en page à reproduire au pinceau canvas.

## 5. Livrables attendus (format)
- Un **design system** documenté (tokens + rationale) prêt à intégrer dans Tailwind.
- Des **maquettes** des écrans clés (au moins Dashboard, Personnage/marks, Succès, Roadmap) — en artifact HTML/React.
- Une **bibliothèque de composants** (TSX + Tailwind) réutilisable, theme-aware.
- Les **SVG originaux** (inline) : glyphes d'endings, avatars abstraits, jauge Dead God.
- Des **specs data-viz** (types de graphes + palette + règles) appliquées aux vues **Stats / Optimiseur / Assistant build** déjà en place.
- Tout **strictement offline** (aucune ressource externe), **sans aucun asset du jeu**.

## 6. Ton & anti-patterns
- **Oui** : sombre, dense, premium, viscéral, lisibilité d'abord, accents rouge/or parcimonieux, chiffres
  qui claquent, sensation de progression gratifiante.
- **Non** : mignon/cartoon, néon criard, dégradés arc-en-ciel, surcharge d'effets, illisibilité au profit du style,
  et surtout **aucun visuel repris du jeu**.

> Réfère-toi au dépôt pour l'existant (`src/`, `tailwind.config.js`). L'app tourne déjà ; tu peux demander
> des captures des écrans actuels pour partir de la base et la sublimer.
