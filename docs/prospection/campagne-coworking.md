# Campagne ciblée « coworking » (préparée le 27/11/2026)

Sous-campagne lancée le 27/11/2026 depuis la session « Audit campagnes ciblées » : présenter le **Pack Moyens généraux**
(`PMG`, 10 templates en vente, 223 € au lieu de 298 € lus sur `/packs/moyens-generaux/` le 27/11/2026, outils seuls de
19 à 39 €) aux coworkings et centres d'affaires indépendants, pour l'**exploitation du lieu**. Skill :
`.claude/skills/campagne-ciblee-pack/`. Structure du mail : `docs/prospection/mail-type-packs-niches.md`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/coworking/` (7 captures réelles des démos `?demo`, données fictives) |
| Mis en avant | Salles et bureaux (SDR), Vérifications (VRF, ERP), Maintenance (GMA), Contrats fournisseurs (CTR), Achats (ACH), Parc informatique (PRC), Événements (EVT) |
| Listés sans mise en avant | Gestion de flotte (VHC), Onboarding et offboarding (ARD), Journée de bascule (BSC) |
| Modèle de mail | `outils/prospection/campagnes/coworking.mjs` (objet, texte, relance J+7) ; liens traçables `?utm_campaign=cw-<id>` |
| Envoi | OVH via le site, file `/api/prospection`, campagne `coworking` créée **en pause, sans parJour**, après feu vert seulement |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` ; pas de Floriane (mail de masse) |
| Nexora | concept `cpt-coworking` (brouillon) ; prospects `vague: "cible-coworking"` |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu de la PR) et brouillon Gmail validés par Quentin avant toute fusion, mise en file ou envoi |

## Cible et exclusions

- Coworkings et centres d'affaires indépendants (1 à 3 sites), adresse générique lue sur le site de l'établissement.
- Exclus : réseaux nationaux et internationaux, franchises, opérateurs immobiliers, pépinières publiques ou consulaires,
  toute entreprise déjà vue dans une autre campagne (contrôle `doublons`), dans Nexora ou dans Gmail.
- Angle : contrôles du bâtiment, maintenance, contrats, salles. Le mail ne parle pas de la réservation par les membres.

## Points ouverts

- Beaucoup de coworkings ont déjà un logiciel de réservation et de facturation pour leurs membres : le pack ne le
  remplace pas (l'outil Salles est une réservation à clé partagée, pour l'équipe). Le mail ne le cite pas ; la page le
  dit dans sa note de bas de page.
- Prix du pack écrit en dur dans le modèle (223 €), avec contrôle de la somme des prix unitaires (298 €) : à relire
  sur la page avant chaque lot.

## Lots
