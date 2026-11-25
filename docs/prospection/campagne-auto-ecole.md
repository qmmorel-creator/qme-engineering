# Campagne ciblée « auto-écoles » (lancée le 25/11/2026)

Demande de Quentin du 25/11/2026 : vaste vague de prospection auprès des auto-écoles de toute la France, sans limite de
nombre, avec le template **Gestion d'auto-école** (T57, `AEC`) présenté comme prêt à l'emploi et l'ouverture sur du
sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/auto-ecole/` (captures réelles de la démo, données fictives) |
| Démo | `https://qm-engineering.fr/templates/auto-ecole/?demo` |
| Modèle de mail | `outils/prospection/campagnes/auto-ecole.mjs` (objet, texte, relance J+7) |
| Envoi | OVH via le site, file `/api/prospection` (campagne `auto-ecole`), 50 par jour au plus, lundi–samedi, 8 h–18 h |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` (redirigée vers le Gmail de Quentin) |
| Nexora | concept `cpt-auto-ecole` ; prospects `vague: "cible-auto-ecole"`, segment « Auto-écoles indépendantes » |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page et brouillon validés par Quentin avant tout envoi (brouillon Gmail du 25/11/2026) |

## Points ouverts au lancement

- Le template AEC n'est **pas encore en vente** sur Gumroad (la démo affiche « Bientôt en vente ») : à régler par
  l'agent Gumroad avant les premiers envois, ou à assumer (le prospect intéressé passe alors par le sur-mesure ou une
  vente directe).
- Variables à créer par Quentin : `PROSPECTION_TOKEN` (Netlify, 32 caractères au moins) et le même jeton en secret
  réseau de l'environnement Claude (hôte `qm-engineering.fr`, en-tête `X-Prospection-Token`).
- La boîte OVH doit accepter 50 envois par jour en plus des mails du site (quota OVH à surveiller dans les journaux
  de `prospection-envoi`).

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-25 | 0 | 0 | 0 | Page, file d'envoi, modèle de mail, brouillon de validation ; premier lot de sourcing en cours |
