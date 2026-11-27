# Campagne ciblée « proprete » (préparée le 27/11/2026)

Sous-campagne lancée depuis la session « Audit campagnes ciblées » : le **Pack Petite entreprise** (`PPE`, en vente,
164 € au lieu de 219 € sur `/packs/petite-entreprise/` au 27/11/2026) présenté aux entreprises de propreté et de
nettoyage indépendantes, prêt à l'emploi, avec l'ouverture sur du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Produit | Pack Petite entreprise : Suivi des congés (CNG), Notes de frais et IK (NDF), Onboarding et offboarding (ARD), Trésorerie prévisionnelle (TRS), Compte rendu → plan d'actions (CRA), Tableau de bord PME (TDB), Planning d'équipe (EQP), Entretiens annuels et professionnels (ENP), Document unique (DRP) ; tous en vente (`outils/gumroad/ecart.mjs` du 27/11/2026 : aucun écart) |
| Prix | calculés par le modèle depuis `netlify/lib/packs.mjs` et `outils/packs/donnees.mjs` : pack 164 € au lieu de 219 €, outils seuls de 15 à 39 €, achat unique, 14 jours d'essai sans carte bancaire (conforme à la page du pack lue le 27/11/2026) |
| Page concept | `https://qm-engineering.fr/concepts/proprete/` : neuf sections (équipes, obligations d'employeur, quotidien, pilotage), une capture réelle de chaque démo `?demo`, bloc « Prêt à l'emploi, ou sur mesure » ; contrôle Playwright 1280, 1024, 768, 390, 360 px : aucun défilement horizontal |
| Modèle de mail | `outils/prospection/campagnes/proprete.mjs`, structure de `docs/prospection/mail-type-packs-niches.md` (renvoi vers le pack) ; relance J+7 |
| Cible | entreprises de propreté et de nettoyage indépendantes de 10 à 50 salariés (bureaux, copropriétés, vitrerie, fin de chantier) ; exclus : groupes, franchises et réseaux nationaux, services à la personne, Conciergerie en Provence, toute fiche Nexora, campagnes `btp` et `gites` |
| Envoi | OVH via le site, file `/api/prospection` (campagne `proprete`, sans `parJour`, créée en pause après feu vert), lundi–samedi, 8 h–18 h, à tour de rôle avec les autres campagnes |
| Nexora | concept `cpt-proprete` (brouillon) ; prospects `vague: "cible-proprete"` (après feu vert) |
| Validation | page (aperçu Netlify de la PR) et brouillon du mail type validés par Quentin avant tout envoi |

## Captures (production, 27/11/2026)

| Section | Template | Vue de la démo | Fichier |
|---|---|---|---|
| 01 Équipes | EQP | `#planning` (semaine par personne) | `planning.webp` |
| 02 Équipes | CNG | tableau de bord (absents, demandes, chevauchements) | `conges.webp` |
| 03 Équipes | ARD | tableau de bord (parcours, retards, objets non rendus) | `onboarding.webp` |
| 04 Obligations | ENP | `#echeances` | `entretiens.webp` |
| 05 Obligations | DRP | tableau de bord (priorités, matrice) ; la vue Évaluation montre une menuiserie, peu parlante ici | `document-unique.webp` |
| 06 Quotidien | NDF | aperçu (kilomètres et indemnité au barème) | `notes-de-frais.webp` |
| 07 Quotidien | CRA | `#actions` | `comptes-rendus.webp` |
| 08 Pilotage | TRS | `#synthese` | `tresorerie.webp` |
| 09 Pilotage | TDB | tableau de bord | `tableau-de-bord.webp` |

Bande « Mode démo » masquée, fenêtre d'accueil fermée. Les démos sont des entreprises fictives d'autres métiers
(atelier, agence) : la page le dit.

## Vérifications du contenu

- **Document unique** : la famille « Produits chimiques, émissions et déchets » cite bien la situation « Produits de
  nettoyage, colles, vernis ou solvants utilisés sans aération », les produits transvasés sans étiquette et les fiches de
  données de sécurité ; les familles chute de hauteur, plain-pied, postures et risque routier existent. **Mais il n'y a
  aucun modèle de secteur « propreté »** (modèles : bureaux, commerce, restauration, bâtiment, atelier, logistique, aide
  à domicile, coiffure, autre) : l'entreprise crée ses unités de travail elle-même. La page et le mail ne promettent pas
  de modèle propreté.
- **Onboarding** : DPAE, badge et clés figurent dans les checklists par défaut ; « Tenue de travail » dans le matériel.
- **Entretiens** : EPP et état des lieux récapitulatif (8 ans) calculés, paramétrables.

## Points ouverts

- Les entreprises les plus structurées ont déjà un logiciel de planning des interventions (sites, passages, pointage) :
  l'angle du mail porte sur la gestion du personnel et les obligations d'employeur, pas sur le planning de chantiers.
- Planning d'équipe : il raisonne en heures par semaine et par projet (le site client devient un « poste à couvrir »),
  pas en créneaux horaires ni en tournées ; une entreprise qui planifie à l'heure près le verra vite.
- **Vague 31 de Nexora** (« Sécurité privée et propreté multisite », 45 fiches, Auvergne-Rhône-Alpes, PACA,
  Occitanie, premier mail le 06/11/2026) : des entreprises de propreté ont déjà été approchées. Elles ne sont que dans
  Nexora (l'outil `doublons` ne les voit pas) : 3 retirées du lot 1. Tout lot suivant passe le contrôle Nexora.
- Modèle de secteur « propreté » absent du document unique : à ajouter au template si Quentin le souhaite (hors de
  cette campagne).

## Lots de sourcing

| Lot | Fichier | Adresses | Contrôles (27/11/2026) |
|---|---|---|---|
| 1 | `docs/prospection/lots/proprete-lot1.json` (écartés : `proprete-lot1-ecartes.md`) | 96, 56 départements (49 nord, 47 sud) ; 19 webmails affichés sur le site de l'entreprise | 100 sourcées → 1 écartée à la relecture (taille) ; `doublons --campagne proprete` : 0 écarté ; Nexora par nom : 3 écartés (vague 31) ; Nexora par radical du domaine : 0 ; Gmail, une requête par domaine entre guillemets, témoins `melko-nettoyage.fr` (trouvé) et domaine inventé (rien) : 3 écartés (les mêmes) ; désinscrits : 0 ; opposition (API) : 0 |

À surveiller dans le lot 1 : taille incertaine ou faible (Solhygie, Allo Services, Ann'Net, DRT Propreté, Aquitaine
Nettoyage, Clair & Net, ABC Propreté, ECOCLEAN 07, SouaClean, Éclat Vitres Services, Propreté Mosellane, MS PRO',
Puissance Propre, Magnou, PropreTIX, Green Propreté, LB Propreté, Indigo Propreté, Novalis, SV Propreté, Atout
Propreté) ; peut-être plus de 50 salariés (SPN NET, RegioNettoyage, Astic et Clean Aveyron à 50) ; activité en partie
chez les particuliers (Top Clean, Caen c'est propre, DL Nettoyage 51, ISM, Airnova, RM Services, Net et Clean, SDI,
Éclat Vitres, SouaClean) ; adresse relevée seulement dans les mentions légales (MIL'SERVICES écartée, Senet, Toupin,
Clean Aveyron, SDI, Ann'Net, Pro Service, Perez) ; domaine de l'adresse différent du site, serveur de messagerie
vérifié (Alpes Maintenance Nettoyage, ATN Services, PPS, RegioNettoyage, E.N.S, Puissance Propre, IMA Propreté, Clean
Action Services, Green Propreté) ; EDEN Nettoyage écrit depuis `eden-groupe.net` (aucun site, deux agences :
pas de groupe national identifié) ; Atout Propreté (Lorient, `.bzh`) homonyme sans lien de la fiche vague 31 de
Grésy-sur-Aix. Effectifs non recoupés avec l'annuaire des entreprises (inaccessible depuis la session).

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page, captures, modèle de mail, concept Nexora `cpt-proprete` (brouillon), PR #333 (aperçu contrôlé), brouillon Gmail de validation ; lot 1 : 96 adresses contrôlées ; campagne non créée sur le serveur, rien en file ; en attente de validation |
