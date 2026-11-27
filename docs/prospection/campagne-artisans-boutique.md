# Campagne ciblée « artisans-boutique » (préparée le 27/11/2026)

Sous-campagne lancée le 27/11/2026 depuis la session « Audit campagnes ciblées » : présenter le **Pack Commerçant et
artisan** (PCA, en vente) aux artisans qui fabriquent et vendent, comme ensemble prêt à l'emploi, avec l'ouverture sur
du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/` ; structure du mail : `docs/prospection/mail-type-packs-niches.md`.

| Élément | Valeur |
|---|---|
| Pack | Commerçant et artisan (`/packs/commercant-artisan/`) : 95 € au lieu de 127 € (relu le 27/11/2026) |
| Outils | Stocks et inventaire (STK, 25 €), Générateur de devis (DVS, 29 €), Trésorerie prévisionnelle (TRS, 29 €), Suivi de TVA (TVA, 19 €), Livre recettes-dépenses micro-entreprise (MCE, 25 €) ; tous en vente (`ecart.mjs` vide le 27/11/2026) |
| Page concept | `https://qm-engineering.fr/concepts/artisans-boutique/` (captures réelles des démos, données fictives) |
| Démos | stocks : atelier de bougies fictif ; trésorerie : « Atelier Exemple » ; livre des recettes : atelier de céramique fictif ; TVA : menuiserie fictive ; devis : artisan du bâtiment fictif (aucun texte métier dans les templates, dit tel quel sur la page) |
| Modèle de mail | `outils/prospection/campagnes/artisans-boutique.mjs` (objet, texte, relance J+7 par profil) ; liens traçables `?utm_campaign=ab-<id>` |
| Profils (`profil` du lot) | `fleuriste`, `brasserie`, `atelier` (céramistes, savonniers, ébénistes, maroquiniers) |
| Envoi | OVH via le site, file `/api/prospection`, campagne `artisans-boutique` créée sans `parJour`, en pause jusqu'au feu vert |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` (serveur) ; pas de Cc (mail de masse) |
| Nexora | concept `cpt-artisans-boutique` (brouillon) ; prospects `vague: "cible-artisans-boutique"` après feu vert |
| Validation | page (aperçu de la PR) et brouillon Gmail « [À valider · campagne artisans-boutique] » validés par Quentin avant toute fusion, mise en file ou envoi |

## Argument propre au pack

Le livre des recettes ne sert qu'aux micro-entrepreneurs et le suivi de TVA qu'aux entreprises qui facturent la TVA :
le mail et la page le disent tels quels, ce qui appuie « chaque outil s'achète aussi seul (de 19 à 29 €) ».

## Cible et exclusions

- Fleuristes indépendants, micro-brasseries et brasseries artisanales, ateliers-boutiques (céramistes, savonniers,
  ébénistes, maroquiniers), site propre, adresse générique ou de l'établissement lue sur une page exacte de ce site.
- Exclus : franchises et réseaux, groupes brassicoles, horlogeries et magasins de sport (concepts déjà faits),
  boutiques de jeux (Royaumes & Légendes), Oh ! Délices Paysans et magasins de producteurs, adresses nominatives,
  toute fiche Nexora, `desinscrits.md`, liste d'opposition.
- Aucun doublon entre campagnes (règle du 27/11/2026) : `campagne.mjs doublons`, Nexora `list_qme` par nom, Gmail
  `in:anywhere <domaine>` ; `doublons` relancé juste avant `file`.

## Lots

(à compléter : nombre sourcé, écartés par contrôle, retenus)

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page, captures, modèle de mail ; sourcing du lot 1 lancé ; en attente du feu vert de Quentin |
