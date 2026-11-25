# Campagne ciblée « auto-écoles » (lancée le 25/11/2026)

Demande de Quentin du 25/11/2026 : vaste vague de prospection auprès des auto-écoles de toute la France, sans limite de
nombre, avec le template **Gestion d'auto-école** (T57, `AEC`) présenté comme prêt à l'emploi et l'ouverture sur du
sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/auto-ecole/` (captures réelles de la démo, données fictives) |
| Démo | `https://qm-engineering.fr/templates/auto-ecole/?demo` |
| Modèle de mail | `outils/prospection/campagnes/auto-ecole.mjs` (objet, texte, relance J+7) |
| Envoi | OVH via le site, file `/api/prospection` (campagne `auto-ecole`), un mail toutes les 2 minutes sans plafond global (25/11/2026), lundi–samedi, 8 h–18 h |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` (redirigée vers le Gmail de Quentin) |
| Nexora | concept `cpt-auto-ecole` ; prospects `vague: "cible-auto-ecole"`, segment « Auto-écoles indépendantes » |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page et brouillon validés par Quentin avant tout envoi (brouillon Gmail du 25/11/2026) |

## Points ouverts au lancement (réglés le 25/11/2026)

- Template AEC mis en vente sur Gumroad (45 €) ; bouton « Voir le template · 45 € » sur la page concept.
- `PROSPECTION_TOKEN` créé sur Netlify et enregistré comme secret réseau de l'environnement Claude (en-tête
  `X-Prospection-Token`). Un seul secret par domaine : ce jeton ouvre aussi la lecture de la liste d'opposition (#298).
- Envoi d'essai réel par OVH reçu dans le Gmail de Quentin le 25/11/2026 à 10:24 (hors indésirables).
- Quota de la boîte OVH à surveiller dans les journaux de `prospection-envoi` (jusqu'à 30 envois par heure).

## Lots

| Lot | Date | En file | Source | Notes |
|---|---|---|---|---|
| lot1 | 2026-11-25 | 154 | recherche web, adresse vérifiée sur le site | 8 écartées avant envoi (adresse seulement en JSON-LD) |
| lot2 | 2026-11-25 | 300 | sites tirés de l'annuaire maconduiteaac.fr, adresse vérifiée sur le site | 14 noms de gérant remplacés par le nom commercial ; réserve de 102 écoles vérifiées |

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-25 | 0 | 0 | 0 | Page, file d'envoi, modèle de mail, brouillon de validation ; premier lot de sourcing en cours |
| 2026-11-25 | 34 | 0 | 0 | Premiers envois de 11:12 à 17:56, aucune erreur d'envoi, aucun retour en erreur ni réponse dans Gmail ; 34 fiches Nexora en `contacte` (relance le 02/12) ; 420 en file (lots 1 et 2), en parallèle des campagnes btp, formation et gîtes |
