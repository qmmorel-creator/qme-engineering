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

### Lot A (27/11/2026) · Île-de-France, Hauts-de-France, Normandie, Bretagne, Pays de la Loire, Centre-Val de Loire, Grand Est, Bourgogne-Franche-Comté

- 47 lieux sourcés (adresse relue sur la page exacte du site), 50 écartés au sourcing (pas d'adresse 14, réseau 12,
  adresse nominative 7, site anti-robot 5, structure publique 5, hors cible 4, sites injoignables ou fermés).
- 7 écartés au tri : adresse d'un tiers (1), coworking activité secondaire (4), opérateur possible (1), jardin
  d'entreprises peut-être public (1). **40 retenus.**
- Contrôles anti-doublon : `doublons --campagne coworking` 0 écarté ; Nexora (nom puis radical du domaine, 95
  recherches) 0 écarté ; Gmail (une requête par domaine, 52 clés, témoins connu et inventé valides) 0 écarté.
- Opposition : à vérifier par l'API au moment de la mise en file (après feu vert). Fichier de lot hors dépôt.

### Lot B (27/11/2026) · Auvergne-Rhône-Alpes, Provence-Alpes-Côte d'Azur, Occitanie, Nouvelle-Aquitaine, Corse

- 49 lieux sourcés, 34 écartés au sourcing (réseau ou plus de 3 sites 9, adresse nominative ou incertaine 8, pas
  d'adresse 6, pas un coworking indépendant 7, site sans rapport 3, non vérifié 1).
- 4 écartés au tri : coworking activité secondaire (3), peut-être 4 sites (1). **45 retenus.**
- Contrôles anti-doublon : `doublons --campagne coworking` 0 ; Nexora (103 recherches) 0 ; Gmail (une requête par
  clé, 50 clés, témoins valides au début et à la fin) 0.
- À revoir à la main avant l'envoi : 3 sites protégés par une page anti-robot au second passage (Le Phare, Ocube,
  Maison Calvé), adresse lue au premier passage.

**Total prêt après feu vert : 85 adresses** (opposition à vérifier par l'API juste avant `file`, puis `doublons` relancé).

## Feu vert et lancement (28/11/2026)

- Feu vert de Quentin transmis par le GOD (`session_0183EW54bFyxAQcskkhnKJvb`, message du 27/11 à 17 h 52 relayé par la
  session « Audit campagnes ciblées », origine vérifiée dans son historique) : page, mail type et brouillon validés,
  cas limites tranchés selon les propositions, webmails au nom de l'établissement acceptés, fusion squash autorisée.
- 3 sites anti-robot (Le Phare, Ocube, Maison Calvé) **écartés faute de nouvelle vérification**. **82 adresses**.
- Avant mise en file : `doublons --campagne coworking` (outil de main) 0 écarté ; opposition par l'API 0 ; prix relu
  sur la page (223 € au lieu de 298 €). Modèle : pas d'élision devant h ou y (« de Happy Hours »), 3 faits sans ville
  répétée.
