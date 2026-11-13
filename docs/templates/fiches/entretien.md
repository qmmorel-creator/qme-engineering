# T11 · Entretien de la maison

Slug `entretien`, préfixe `ENT` (clés locales `qme-ent-*`), prix prévu 12 € (`price_cents` 1200), permalien
Gumroad prévu `entretien-maison`. Taille S, P2. Origine : liste initiale du 12/11/2026 (ligne T11 de
`IDEES.md`). Marqué **daté** : toute fréquence d'origine réglementaire est paramétrable, affichée avec sa
source et « à vérifier selon votre département / votre bail ». Moteur d'échéances réutilisable pour T61
(GMAO légère) et T63 (vérifications réglementaires), sans aucune donnée commune.

État : application, page catalogue « Mise en vente prochaine » et communication prêtes (13/11/2026).
Fiche Gumroad non créée.

## Pour qui

- **Propriétaires d'une maison** : chaudière, ramonage, toiture, gouttières, jardin, fosse… une trentaine
  d'échéances de fréquences différentes, souvent notées nulle part.
- **Locataires** : une grande part de l'entretien courant leur revient (chaudière, ramonage, bouches de VMC,
  joints, détecteur de fumée) et le bailleur peut demander l'attestation.
- **Propriétaires bailleurs d'un ou deux logements**, pour savoir quoi vérifier (usage secondaire, V1 pensée
  pour un seul logement).

Aujourd'hui : des factures dans un tiroir, la date du dernier ramonage retrouvée sur l'attestation au moment
où l'assureur la demande, des filtres jamais changés.

## Écrans (4 onglets + réglages)

- **Échéances** (accueil) : salutation, tuiles En retard / Ce mois-ci / À venir (90 jours) / Dépensé sur
  12 mois ; listes « En retard », « Ce mois-ci », « À venir », « À planifier » (dates inconnues, bouton
  « Étaler sur les 12 prochains mois »). Chaque ligne : échéance, tâche, équipement, fréquence, saison,
  zone, pastille « Obligation », répartition indicative si locataire, dernière fois ; boutons « Fait »
  (date, coût, intervenant libre, note) et « Reporter » (date ; le report tient jusqu'à la prochaine
  réalisation).
- **Année** : 12 mois (réalisations de l'historique et échéances prévues, retards ramenés au mois en
  cours), tâches mensuelles regroupées dans « Chaque mois », navigation d'une année à l'autre, **impression**
  de la liste (cases à cocher, en-tête avec la mention « obligations à vérifier »).
- **Équipements** : tâches par zone et par équipement (fréquence, prochaine échéance, obligation, retard) ;
  « Choisir mes équipements » (décocher désactive les tâches sans effacer l'historique) ; « Obligations et
  sources » ; conseils ; avertissement.
- **Historique** : tuiles 12 derniers mois / depuis le 1er janvier / depuis le début ; graphique des
  dépenses par mois (une série, survol et tableau des chiffres) ; interventions par année, modifiables ;
  export CSV.
- **Réglages** (fenêtre) : prénom, maison ou appartement, propriétaire ou locataire, copie JSON
  (télécharger, restaurer), historique CSV, compte, « Sur téléphone » (fenêtre « Comme une application »),
  à propos.
- **Fenêtre de tâche** : encart réglementaire (titre, texte, source, date de relecture, « à vérifier »),
  répartition indicative, titre, fréquence (proposée rappelée), zone (tâche perso), saison (12 mois à
  cocher), dernière fois, note, suivre ou non, historique de la tâche.
- **Premier lancement** en 3 étapes : prénom, maison ou appartement, propriétaire ou locataire ; équipements
  par zone (sélection courante précochée, équipements « maison » masqués en appartement) ; mois de la
  dernière intervention pour chaque obligation, et option « étaler les autres tâches ».

## Base intégrée (`donnees.js`)

- **9 zones** (chauffage et climatisation, eau et assainissement, air et ventilation, cuisine, buanderie,
  sécurité et électricité, intérieur, toiture et extérieur, jardin et piscine), une couleur fixe chacune.
- **37 équipements, 89 tâches types** : fréquence en mois, saison conseillée, répartition indicative
  (`locataire`, `proprietaire`, `selon`), conseil, règle éventuelle. Exemples : chaudière gaz, fioul ou
  bois, poêle, cheminée ou insert, pompe à chaleur, radiateurs, climatisation, robinetterie, chauffe-eau
  électrique ou thermodynamique, adoucisseur, assainissement individuel, récupérateur d'eau, VMC, entrées
  d'air, hotte, réfrigérateur, lave-vaisselle, four, cuisson au gaz, lave-linge, sèche-linge, détecteurs
  de fumée et de monoxyde de carbone, extincteur, tableau électrique, joints et serrures, volets roulants,
  toiture et gouttières, façade, portail motorisé, robinets extérieurs, jardin, arbres, débroussaillement,
  piscine.
- **8 règles sourcées** (`BASE.regles`), relues le 13/11/2026 quand `verifie: true` :

| Règle | Fréquence proposée | Source | Vérifiée |
|---|---|---|---|
| Entretien annuel des chaudières 4 à 400 kW | 12 mois | Code de l'environnement, art. R224-41-4 à R224-41-9 ; arrêté du 15/09/2009 ; loi 89-462, art. 7 ; service-public.gouv.fr F20760 (vérifiée le 19/05/2025 par l'administration) | oui |
| Ramonage des conduits de fumée | 12 mois | Décret n° 2023-641 du 20/07/2023 (code de la santé publique, en vigueur le 01/10/2023) : au moins tous les 12 mois en logement individuel, un arrêté peut en demander plus ; règlement sanitaire départemental | oui (Légifrance) |
| Entretien des appareils à combustion | 12 mois | Même décret | oui (Légifrance) |
| Pompes à chaleur et climatisations 4 à 70 kW | 24 mois | Code de l'environnement, art. R224-44 à R224-44-5 (décret n° 2020-912 du 28/07/2020) ; arrêté du 24/07/2020 ; chauffe-eau thermodynamiques d'un seul logement exclus | oui (Légifrance, recherche) |
| Détecteur de fumée | — (notice) | CCH, art. R142-1 à R142-5 (loi n° 2010-238) : installation par le propriétaire, entretien par l'occupant, sauf exceptions | oui (Légifrance, service-public) |
| Vidange de l'assainissement non collectif | — (ordre de grandeur 4 ans) | Arrêté du 07/09/2009 modifié | **à vérifier** |
| Contrôle par le SPANC | — (10 ans au plus) | CGCT, art. L2224-8 | **à vérifier** |
| Obligation légale de débroussaillement | — (annuelle, zones fixées par arrêté) | Code forestier et arrêté préfectoral | **à vérifier** |

- Répartition locataire / propriétaire : **indicative**, d'après le décret n° 87-712 du 26/08/1987
  (réparations locatives), non revérifié ligne par ligne ; le bail prime.
- Fréquences non réglementaires : bonnes pratiques courantes (notices usuelles), rédigées pour QME, sans
  source externe reprise ; toutes modifiables. Aucun prix intégré.

## Calculs (`regles.js`, fonctions pures testées)

- **Dernière fois** = la plus récente entre la date saisie au départ et l'historique.
- **Prochaine échéance** = report s'il existe ; sinon dernière fois + fréquence (en mois, fin de mois
  bornée : 31 janvier + 1 mois = 28 ou 29 février), ramenée dans la saison conseillée ; sinon date prévue
  (« étaler ») ; sinon inconnue.
- **Saison** : une échéance hors saison va au plus proche entre la fin de la saison précédente (si elle
  tombe après la dernière fois) et le 1er du prochain mois de saison. Une obligation annuelle n'est donc
  jamais repoussée de presque un an.
- **Statuts** : retard (échéance passée), ce mois-ci (jusqu'à la fin du mois), à venir (90 jours), plus
  tard, inconnue.
- **Année** : occurrences successives jusqu'au 31/12 ; une tâche en retard figure au mois en cours puis
  repart d'aujourd'hui ; tâches mensuelles à part.
- **Étaler** : tâches sans date, obligations d'abord, décalées de mois en mois (dans la limite de leur
  fréquence), ramenées dans leur saison, jamais dans le passé.
- **Coûts** : 12 derniers mois calendaires, total d'une période, montants saisis lus avec tolérance
  (« 1 200 € », « 85,50 »).
- **Équipements** : ajout des tâches types manquantes, désactivation sans effacement, réactivation qui garde
  la fréquence choisie. Export CSV (point-virgule, virgule décimale, BOM UTF-8).

## Démo

Maison fictive de « Claire », propriétaire, 23 équipements, deux ans d'historique simulés avec les vraies
règles et des coûts fictifs ; à des dates relatives à aujourd'hui : ramonage et gouttières en retard, test du
détecteur de fumée en retard, tâches du mois, à venir, un report, deux tâches sans date (« À planifier »),
une tâche désactivée, une tâche ajoutée par l'utilisatrice, une intervention d'il y a deux jours.

## Hors périmètre (V1)

Aucune notification, aucun export agenda, aucun lien vers un artisan ou une application ; un seul logement ;
pas de photo ni de document stocké (l'attestation se note en texte) ; pas de prix intégré.

## Risques

- **Données datées** : les règles changent (ramonage réécrit en 2023). Revoir `BASE.regles` et
  `verifieLe` chaque année ; les trois règles « à vérifier » restent à confirmer par Quentin avant la mise
  en vente.
- **Responsabilité** : outil d'aide, sans valeur d'attestation ; avertissement dans l'application, la page
  catalogue et la fiche Gumroad. Jamais « obligatoire » sans « à vérifier ».
- **Marques** : aucune marque d'appareil ni d'enseigne dans la base, la démo ou la communication.
