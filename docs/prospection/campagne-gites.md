# Campagne ciblée « gîtes » (préparée le 25/11/2026)

Demande de Quentin du 25/11/2026 : présenter le template **Location saisonnière** (T64, `SJR`, 25 €, en vente) aux
gîtes, chambres d'hôtes et meublés de tourisme de 1 à 10 logements exploités par une entreprise ou un exploitant
identifiable, comme outil prêt à l'emploi, avec l'ouverture sur du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/gites/` (captures réelles de la démo, données fictives) |
| Démo | `https://qm-engineering.fr/templates/location-saisonniere/?demo` |
| Modèle de mail | `outils/prospection/campagnes/gites.mjs` (objet, texte, relance J+7) ; liens traçables `?utm_campaign=gi-<id>` |
| Fin de mail | Pack Propriétaire (`/packs/proprietaire/`), en citant Entretien de la maison et Pilote de travaux (catalogue perso, pas `/pro/`) |
| Envoi | OVH via le site, file `/api/prospection` (campagne `gites`, `parJour: 12`, relances J+7 comprises), lundi–samedi, 8 h–18 h |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` |
| Nexora | concept `cpt-gites` (brouillon) ; prospects `vague: "cible-gites"` |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu de la PR) et brouillon Gmail validés par Quentin avant toute fusion, mise en file ou envoi |

## Cible et exclusions

- Gîtes, chambres d'hôtes, meublés de tourisme, 1 à 10 logements, site propre, adresse de l'établissement lue sur ce site.
- Exclus : conciergeries (cibles sur mesure, hors de cette vague), résidences de tourisme, chaînes, centrales de
  réservation, Conciergerie en Provence, toute fiche déjà dans Nexora, adresses vues seulement sur une plateforme de
  réservation ou un annuaire, `desinscrits.md`, liste d'opposition.

## Points ouverts au 25/11/2026

- **Quota** : la campagne `auto-ecole` est active avec `parJour: 50`. Ajouter `gites` à 12 porterait la somme à 62,
  au-delà du plafond de 50 par jour. De plus, l'envoi sert les campagnes dans l'ordre de lecture : tant qu'`auto-ecole`
  a 50 de quota et du stock, `gites` ne recevrait aucun créneau. Décision à prendre par Quentin (par exemple
  `auto-ecole` à 38) ; cette session ne modifie pas le `parJour` d'une autre campagne.

## Lot 1 (25/11/2026)

- 91 établissements sourcés (adresse relue sur la page exacte du site de l'établissement), 20 écartés : 17 adresses
  nominatives (prénom et nom de l'exploitant), 3 établissements qui peuvent dépasser 10 logements.
- **71 adresses prêtes** : liste d'opposition vérifiée par l'API (0 opposée), `desinscrits.md` (0), Nexora (aucune fiche
  correspondante), Gmail `in:anywhere` (aucun échange). Fichier de lot hors dépôt (adresses : pas dans un dépôt publié).
- Réserves : 9 établissements au nombre de logements non chiffré sur le site ; 9 adresses lues seulement dans les
  mentions légales. Il manque environ 80 adresses pour avoir trois jours d'avance (150) ; à 12 par jour, 71 adresses couvrent six jours d'envoi.

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-25 | 0 | 0 | 0 | Page, captures, modèle de mail, concept Nexora (brouillon) ; lot 1 : 71 adresses vérifiées ; lancement bloqué par le quota et en attente du feu vert |
