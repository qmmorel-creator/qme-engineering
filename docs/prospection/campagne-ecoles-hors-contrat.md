# Campagne ciblée « ecoles-hors-contrat » (préparée le 27/11/2026)

Sous-campagne lancée depuis la session « Audit campagnes ciblées » : pack **Écoles et formateurs** (PNS, en vente depuis
le 27/11/2026) présenté aux écoles privées hors contrat et aux centres de soutien scolaire indépendants. Skill :
`.claude/skills/campagne-ciblee-pack/` ; structure du mail : `docs/prospection/mail-type-packs-niches.md`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/ecoles-hors-contrat/` (captures réelles des démos du 27/11/2026, données fictives) |
| Démos | `/templates/gestion-classe/?demo`, `/templates/progression/?demo`, `/templates/quiz/?demo`, `/templates/emploi-du-temps/?demo` |
| Modèle de mail | `outils/prospection/campagnes/ecoles-hors-contrat.mjs` (objet, texte, relance J+7) ; lien traçable `?utm_campaign=ehc-<id>` |
| Angle | notes et bulletins, progression par classe, quiz, emploi du temps des classes et des salles |
| Prix (lus le 27/11/2026 sur `/packs/enseignant/` et dans `outils/packs/donnees.mjs`) | pack 111 € au lieu de 149 € ; seuls : PRG 15 €, QZZ 19 €, CSE 25 €, EDT 45 € (104 € les quatre) ; AEC 45 € non mis en avant |
| Envoi | OVH via le site, file `/api/prospection` (campagne `ecoles-hors-contrat`, créée sans `parJour`, en pause jusqu'au feu vert), un mail toutes les 2 minutes au total, campagnes en parallèle à tour de rôle, lundi–samedi, 8 h–18 h |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` ; pas de Floriane (mail de masse) |
| Nexora | concept `cpt-ecoles-hors-contrat` ; prospects `vague: "cible-ecoles-hors-contrat"`, segment « Écoles hors contrat et soutien scolaire » |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu Netlify de la PR) et brouillon Gmail validés par Quentin avant tout envoi |

## Cible et exclusions

- Écoles privées hors contrat (primaire, collège, lycée, pédagogies alternatives) et centres de soutien scolaire
  indépendants ; adresse générique ou de l'établissement relevée sur une page précise de son site ; un seul fait vérifié.
- Exclus : établissements sous contrat et publics, réseaux nationaux et franchises de soutien scolaire, écoles de
  musique, danse, théâtre ou langues, auto-écoles, et tout établissement déjà prospecté (campagne `formation`, vagues 14
  et 15 « Écoles privées », Montessori, écoles de musique, Compagnie Antarès, École de musique de Givry).
- Anti-doublon (§ 4 du skill) : `campagne.mjs doublons`, puis Nexora `list_qme` par nom, puis Gmail `in:anywhere
  <domaine>` ; `doublons` relancé juste avant `file`.

## Points ouverts

- **Prix** : les quatre outils utiles à cette cible coûtent 104 € séparément, moins que le pack (111 €), qui contient
  aussi l'auto-école. Le mail le dit tel quel ; à confirmer par Quentin.
- La démo de l'emploi du temps montre un centre de formation fictif (pas une école) : la page le présente comme
  « établissement fictif ».
- La gestion de classe signale elle-même qu'elle ne remplace pas un logiciel de vie scolaire : la page le dit.

## Lots

(à compléter : adresses retenues et écartées par contrôle)

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page, captures, modèle de mail ; sourcing en cours ; rien en file |
