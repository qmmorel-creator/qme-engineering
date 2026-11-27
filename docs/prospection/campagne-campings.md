# Campagne ciblée « campings » (préparée le 27/11/2026)

Sous-campagne lancée depuis la session « Audit campagnes ciblées » (27/11/2026) : présenter le **Pack Exploitation et
maintenance** (PXP, en vente) aux campings indépendants, angle « préparer l'ouverture » (l'hiver est la période de
préparation de la saison), avec l'ouverture sur du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/` ;
structure du mail : `docs/prospection/mail-type-packs-niches.md`.

| Élément | Valeur |
|---|---|
| Pack | Exploitation et maintenance (`/packs/exploitation/`) : Vérifications réglementaires (VRF, 35 €), Maintenance préventive (GMA, 39 €), Stocks et inventaire (STK, 25 €), Non-conformités (NCF, 20 €) |
| Prix (lus le 27/11/2026 sur la page du pack et dans `outils/packs/donnees.mjs`) | 95 € au lieu de 119 € ; achat unique ; outils seuls de 20 à 39 € ; 14 jours d'essai sans carte bancaire |
| Gumroad | `node outils/gumroad/ecart.mjs` le 27/11/2026 : aucun écart (pack et outils en vente) |
| Page concept | `https://qm-engineering.fr/concepts/campings/` (captures réelles des démos `?demo`, données fictives) |
| Modèle de mail | `outils/prospection/campagnes/campings.mjs` (objet, texte, relance J+7) ; liens traçables `?utm_campaign=campings-<id>` vers la page concept et la page du pack |
| Envoi | OVH via le site, file `/api/prospection` (campagne `campings`, sans `parJour`, en pause à la création), lundi–samedi, 8 h–18 h, un mail toutes les 2 minutes, campagnes en parallèle à tour de rôle |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` (pas de Floriane : mail de masse) |
| Nexora | concept `cpt-campings` (brouillon) ; prospects `vague: "cible-campings"` après feu vert |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu de la PR) et brouillon Gmail `[À valider · campagne campings]` validés par Quentin avant toute fusion, mise en file ou envoi |

## Ce que la page montre, et ne promet pas

- Vérifications : la base intégrée (brochure INRS ED 828) couvre notamment électricité (dont ERP), éclairage de
  sécurité, extincteurs, SSI, désenfumage, gaz (ERP), production de chaleur (ERP), grandes cuisines (ERP).
- **Piscine et aires de jeux ne sont pas dans la base** (vérifié le 27/11/2026 dans `templates/verifications/donnees.js`) :
  la page montre leur saisie en « Autre contrôle (périodicité à saisir) », capture réelle de la démo avec une piscine
  créée sur le site « Espace d'accueil du public », périodicité laissée vide (le formulaire l'exige). Aucune
  périodicité de piscine ni d'aire de jeux n'est donnée.
- Les démos sont industrielles (atelier, bureaux, boutique de bougies, chantiers) : la page le dit, aucune donnée
  « camping » n'a été fabriquée.

## Cible et exclusions

- Campings indépendants (exploitation familiale ou privée), avec locatifs et bâtiment d'accueil ; adresse générique ou
  de l'établissement constatée sur une page du site officiel ; un fait vérifié sur ce site.
- Exclus : chaînes, groupes et franchises (Huttopia, Capfun, Siblu, Sandaya, Homair/Marvilla, Tohapi, Campéole,
  Yelloh! Village, Flower, Sunêlia, Camping Paradis, Ciela, Kawan…), campings municipaux en régie, adresses
  nominatives ou vues seulement dans un annuaire ; campagnes `gites` et `hotels`, vague 13 « Hébergement et loisirs »,
  fabricants d'aires de jeux de la vague `registres` ; `desinscrits.md`, liste d'opposition.
- **Aucun doublon** (règle de Quentin du 27/11/2026) : chaque lot passe `campagne.mjs doublons`, Nexora `list_qme`
  (nom de l'entreprise) et Gmail `in:anywhere <domaine>` ; `doublons` est relancé juste avant `file`.

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page, captures, modèle de mail, journal ; concept Nexora (brouillon) ; lot 1 en cours de sourcing ; en attente du feu vert de Quentin |
