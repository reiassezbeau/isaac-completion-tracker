# tools/build-knowledge — Compilateur de la base de connaissances (dev-time)

Ce script **dev-time** (internet autorisé) compile la liste des **641 succès** de
*The Binding of Isaac: Repentance+* et écrit les JSON bundlés par l'application.
Il ne fait **pas** partie du binaire final : seuls les JSON générés sont embarqués,
et l'app runtime ne fait **aucun** appel réseau.

> Créé par **reiassezbeau** — https://github.com/reiassezbeau

## Ce qu'il produit

- `src-tauri/resources/achievements.json` — les 641 succès : `id` (= secret-ID
  in-game = bit dans la save), `name`, `description`, `category`, `dlc`, `hidden`,
  `unlock` (`text` toujours lisible + classification structurée `type`/`character`/
  `target`/`predictable`) et `reward`.
- `src-tauri/resources/characters.json` — les 34 personnages (17 + 17 Tainted) avec
  leur `save_index` (ordre binaire de la section marks).
- `src-tauri/resources/endings.json` — les 12 completion marks (ordre binaire),
  avec `mark_index` et `hard_matters`.

`routing_tips.json` est **édité à la main** (éditorial), pas généré ici.

## Source

Table `Achievements` du wiki communautaire **bindingofisaacrebirth.wiki.gg**
(`order by = id`). L'ID de la table correspond exactement au « secret » in-game,
donc au bit lu dans `persistentgamedata*.dat`. On réimplémente le parsing ; aucun
code tiers n'est copié.

Auto-contrôles durs (le build échoue si le wiki a changé de structure) :
- total = **641**,
- `id 1 = Magdalene`, `id 637 = Dead God`, `id 641 = Item Descriptions`,
- aucun ID manquant sur `1..641`,
- la répartition DLC affichée doit matcher les compteurs officiels
  (Rebirth 178, Afterbirth 98, Afterbirth+ 127, Repentance 234, Repentance+ 4).

## Régénérer

```bash
npm run build:knowledge
```

Les JSON générés sont **committés** (build reproductible sans re-scraper). Ne les
édite pas à la main : relance le script. Si la structure du wiki change, ajuste le
parsing/la classification ici puis régénère.

## Limites connues

- Le flag Steam « caché » (181 succès masqués) n'est pas exposé par le wiki :
  `hidden` est mis à `false` pour tous. L'UI propose un révélateur de conditions
  pour les succès **verrouillés** (spoilers) à la place.
- La classification `unlock.type`/`predictable` est **heuristique** et volontairement
  **conservatrice** : `predictable:true` seulement en haute confiance
  (character_completion, boss_first_kill « propre », challenge). En cas de doute →
  `predictable:false` (le succès reste visible dans le navigateur avec sa condition
  texte, mais n'est pas prédit). La condition `unlock.text` est, elle, toujours exacte.
