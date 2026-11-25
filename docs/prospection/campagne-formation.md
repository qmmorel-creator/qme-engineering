# Campagne ciblée « formation » (lancée le 25/11/2026)

Demande de Quentin du 25/11/2026 : campagne ciblée auprès des petits organismes de formation professionnelle, petits
CFA indépendants et écoles privées de langues ou d'arts qui construisent l'emploi du temps de quelques groupes,
formateurs et salles, avec le template **Emploi du temps d'établissement** (T56, `EDT`, 45 €, en vente) présenté comme
prêt à l'emploi et l'ouverture sur du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/formation/` (captures réelles de la démo du 25/11/2026, données fictives) |
| Démo | `https://qm-engineering.fr/templates/emploi-du-temps/?demo` |
| Modèle de mail | `outils/prospection/campagnes/formation.mjs` (objet, texte, relance J+7) ; lien traçable `?utm_campaign=fo-<id>` |
| Angle | conflits de salles ou de formateurs signalés avant qu'ils arrivent ; heures réalisées par groupe et par formateur |
| Fin de mail | catalogue `/pro/` : Banque de questions et quiz formateur (QZZ), Progression pédagogique (PRG) |
| Exclu | pack « Écoles et formateurs » (PNS), incomplet : CSE bloqué par Quentin |
| Envoi | OVH via le site, file `/api/prospection` (campagne `formation`), `parJour: 12` relances comprises, lundi–samedi, 8 h–18 h |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` |
| Nexora | concept `cpt-formation` ; prospects `vague: "cible-formation"`, segment « Organismes de formation et écoles privées » |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu Netlify de la PR) et brouillon Gmail validés par Quentin avant tout envoi |

## Cible et exclusions

- Petits organismes indépendants, avec plusieurs groupes, formateurs et salles.
- Exclus : grands réseaux et franchises nationales, établissements publics (CFA consulaires, Greta, lycées,
  universités, conservatoires municipaux), auto-écoles, tout organisme déjà présent dans Nexora Optim › QME (dont
  Compagnie Antarès et École de musique de Givry, en discussion ; vague 8 « Formation » de novembre), désinscrits et
  liste d'opposition.
- Adresse générique ou de l'établissement relevée sur une page précise du site de l'organisme ; un seul fait vérifié
  sur ce site par mail.

## Points ouverts au lancement

- **Quota** : au 25/11/2026 à 12 h, `auto-ecole` était à `parJour: 50` (somme avec `formation` : 62 > 50), d'où une
  campagne non créée. Depuis la PR #303 (fusionnée et publiée le 25/11 à 13:30, feu vert de Quentin), plus de plafond
  global : envoi toutes les 2 minutes, lundi–samedi, 8 h–18 h ; `auto-ecole` n'a plus de `parJour`, `btp` est à 12 (en
  pause). Constaté par `campagne.mjs etat` le 25/11 à 13:31. À confirmer par Quentin : `formation` à `parJour: 12`
  comme prévu, la contrainte « 50 au total » de sa demande ne s'appliquant plus.

## Premier lot (25/11/2026)

- **101 adresses vérifiées** (3 lots par régions : Sud-Est et Centre-Est 34, Nord et Est 34, Ouest et Centre 33), chacune
  relevée sur une page précise du site de l'organisme, avec un fait tiré du site. Écartés à la relecture : Capriciozo
  (fait sur des cours individuels), Danse Passion (un studio, deux professeurs), Véronique Danse (prénom dans
  l'adresse), Atelier 71 (même lieu que Studio Théâtre 71).
- Contrôles : aucun recoupement avec Nexora Optim › QME (segments « Écoles privées », « Formation » et recherches par
  mots-clés), le dépôt, `desinscrits.md`, ni Gmail (`in:anywhere`, tous dossiers) ; liste d'opposition : 0 sur 101.
- Répartition : 70 écoles d'arts (musique, danse, théâtre), 16 écoles de langues, 12 organismes de formation,
  3 CFA. Les petits organismes de formation à adresse générique sont rares (formulaire seul le plus souvent).
- Quelques structures moins petites gardées, à confirmer : Cours Simon, IMEP, ASMM, CLCF (Paris), Altaé Langues
  (14 villes), CSForm (5 campus), ISFAC (3 sites).
- Fichier du lot hors dépôt (adresses) ; il sera versé dans Nexora au lancement (`etape: "a-contacter"`).

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-25 | 0 | 0 | 0 | Page (PR #301, aperçu Netlify), modèle de mail, 101 adresses vérifiées, brouillon Gmail de validation ; campagne non créée (quota) |
| 2026-11-25 | 1 | 0 | 0 | Feu vert de Quentin : PR #301 fusionnée (squash), page en production (200, noindex) ; campagne `formation` créée (`parJour: 12`), 101 mails en file, opposition revérifiée (0) ; 101 fiches Nexora (`fo-*`, `a-contacter`), concept `en-ligne` ; premier envoi 13:46 (Start Music 63). Copies cachées non visibles dans la boîte Gmail consultée (comme pour `auto-ecole`) |
