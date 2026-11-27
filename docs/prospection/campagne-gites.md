# Campagne ciblée « gîtes » (lancée le 25/11/2026)

Demande de Quentin du 25/11/2026 : présenter le template **Location saisonnière** (T64, `SJR`, 25 €, en vente) aux
gîtes, chambres d'hôtes et meublés de tourisme de 1 à 10 logements exploités par une entreprise ou un exploitant
identifiable, comme outil prêt à l'emploi, avec l'ouverture sur du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/gites/` (captures réelles de la démo, données fictives) |
| Démo | `https://qm-engineering.fr/templates/location-saisonniere/?demo` |
| Modèle de mail | `outils/prospection/campagnes/gites.mjs` (objet, texte, relance J+7) ; liens traçables `?utm_campaign=gi-<id>` |
| Fin de mail | Pack Propriétaire (`/packs/proprietaire/`), en citant Entretien de la maison et Pilote de travaux (catalogue perso, pas `/pro/`) |
| Envoi | OVH via le site, file `/api/prospection` (campagne `gites`, sans plafond depuis le 25/11/2026 vers 13 h 50, campagnes en parallèle à tour de rôle), lundi–samedi, 8 h–18 h |
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

- **Quota** (mis à jour le 25/11/2026 à 13 h 35) : le plafond global de 50 par jour est supprimé en production (PR #303,
  un envoi toutes les 2 minutes, 300 par jour au plus). `auto-ecole` n'a plus de `parJour` (144 en file), `btp` est
  en pause à 12. La consigne de départ (« 50 par jour toutes campagnes confondues, somme des parJour ≤ 50 ») ne peut
  plus être vérifiée telle quelle : Quentin a donné son feu vert le 25/11/2026 (« Fusionne et lance la campagne ») : `gites` part à 12 par jour, `auto-ecole` inchangée. L'envoi sert les campagnes dans l'ordre de lecture
  (`auto-ecole`, `btp`, `gites`) : `gites` ne part qu'une fois la file d'`auto-ecole` vide ou plafonnée.

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
| 2026-11-25 | 0 | 0 | 0 | Feu vert de Quentin : PR fusionnée, campagne `gites` créée (`parJour: 12`), lot 1 (71) mis en file, fiches Nexora `a-contacter` |
| 2026-11-25 | 0 | 0 | 0 | Vers 13 h 50, à la demande de Quentin (session « Limite d'envoi mail OVH ») : plafond de `gites` retiré, envoi en parallèle des campagnes (PR #305), 30 mails par heure au total |
| 2026-11-25 (soir) | 33 | 0 | 0 | 2 en erreur OVH (quota de 200 mails par heure du compte dépassé vers 14 h 30) : La Ferme Manoir Saint Barthélemy, Le Clos de la Croix ; remise en file refusée par le serveur (id déjà traité), décision de Quentin. 36 en file. Fiches Nexora `contacte`, relance 2026-12-02. Concept `envoye`. Copies cachées des envois introuvables dans Gmail |
| 2026-11-25 (soir) | — | — | — | Lot 2 : 100 adresses vérifiées (sites propres, aucune nominative, opposition 0, aucun contact antérieur dans Gmail), mises en file (136 en file) et fiches Nexora `a-contacter` (lot 2) |
| 2026-11-26 | 77 | 0 | 0 | Aucune erreur d'envoi. 59 en file. Aucune réponse, aucun rejet ni réponse automatique dans Gmail. Fiches Nexora `contacte`, relance 2026-12-03 (mises à jour le 27/11 au matin, le pilotage du 26 au soir n'ayant pas tourné). Lot 3 de sourcing lancé |
| 2026-11-27 | — | — | — | Lot 3 : 99 adresses vérifiées (une écartée par prudence : adresse pouvant contenir un nom de famille), opposition 0, aucun contact antérieur dans Gmail ; mises en file (151 en file) et fiches Nexora `a-contacter` (lot 3) |
