# T60 · Pilotage de parcs multi-sites

Slug `parcs-multi-sites`, préfixe `PRK` (clés locales `qme-prk-*`, règles `window.REGLES`), prix prévu 49 €
(**à confirmer par Quentin**), permalien Gumroad proposé `pilotage-parcs-multi-sites`, catégorie Gumroad
`business-and-money/management-and-leadership` (**à vérifier**), taille L, priorité P2. Catalogue :
`data-pour="pro"`, thème « Équipements et véhicules » (`equipements-et-vehicules`, `--c:var(--bleu)`), avec
la gestion de flotte et le parc informatique. Origine : backlog de Quentin n° 38. Marque de risque :
**confidentiel** (inspiré d'un artefact professionnel « pilotage de parcs » : mécanique seulement, aucun nom
de site, aucune donnée, aucun chiffre repris ; exemples fictifs immobilier et équipements). Format demandé :
application + modèle tableur (ici : import et export CSV, modèles vides). Fiche rédigée le 14/11/2026.
Aucune marque (équipementier, logiciel, prestataire), aucune automatisation, aucun service externe.

## Pour qui

Exploitants qui gèrent **plusieurs sites et leurs équipements** : gestionnaires de patrimoine immobilier
(bureaux, résidences, commerces), responsables de services généraux multi-sites, exploitants de parcs
d'équipements (portes automatiques, froid, chauffage, groupes électrogènes, bornes), responsables techniques
de réseaux d'agences ou de points de vente, collectivités qui suivent leurs bâtiments. Aujourd'hui : un
tableur avec un onglet par site, des échéances de préventif recalculées à la main, des pannes suivies dans
la messagerie, le coût de chaque site reconstitué en fin d'année, aucune vue d'ensemble.

Distinct de **T61** (maintenance d'équipements : plans de maintenance, bons d'intervention) et de **T63**
(registre des contrôles réglementaires) : ici l'unité est **le site**, la vue est **consolidée**, et le
préventif tient en une périodicité par équipement. Distinct de la **gestion de flotte** (véhicules,
kilométrage, réservations) et du **parc informatique** (matériel affecté à des personnes, licences).

## Promesse

Tous tes sites, une seule vue : ce qui est dû, ce qui est à l'arrêt, le site qu'on a oublié, et ce que
coûte chacun.

## Écrans (5 onglets + guide + réglages)

1. **Alertes** (tableau de bord) : titre de synthèse (retards, points à surveiller) ; tuiles sites et
   équipements suivis, équipements à l'arrêt (et dégradés), préventifs en retard (et à prévoir), disponibilité
   moyenne du parc ; liste des alertes triée (retards d'abord) avec action directe (préventif fait, ouvrir la
   panne, ouvrir le site) ; correctifs ouverts. Boutons « Visite » et « Signaler une panne ».
2. **Sites** : bascule **Liste / Carte** (mémorisée sur l'appareil).
   - Liste : filtres (recherche texte, région, type, état) ; tableau **triable** par colonne (état, site,
     ville, région, équipements, disponibilité, préventifs en retard, délai moyen, coût) sur ordinateur ;
     cartes de site avec un sélecteur de tri sur téléphone.
   - Carte : **carte schématique en SVG** (aucun fond de carte, aucune tuile, aucun géocodage) : chaque site
     placé par ses coordonnées saisies (projection équirectangulaire corrigée de la latitude moyenne, cadrée
     sur les points), forme et couleur selon l'état (rond bleu à jour, carré jaune à surveiller, triangle
     rouge en retard), étiquettes placées sans chevauchement (sinon visibles au survol), quadrillage par
     degré, nord en haut, infobulle (état, alertes, équipements, disponibilité, coût), ouverture du site au
     clic ou au clavier. Les sites **sans coordonnées** sont regroupés **par région** sous la carte ; si
     aucun n'a de coordonnées, seule la grille par région s'affiche ; la liste reste toujours disponible.
   - Fiche site : en-tête (type, ville, région, responsable, dernière visite, GPS), tuiles (disponibilité,
     préventifs en retard et taux à temps, délai de résolution, coût préventif / correctif), alertes du site,
     équipements, coût par catégorie (barres), historique des interventions.
   - Import CSV, export CSV, ajout d'un site.
3. **Équipements** : filtres (site, catégorie, état : actifs, à l'arrêt, dégradés, préventif en retard,
   réformés) ; ligne par équipement avec état calculé et prochaine échéance. Fiche équipement (fenêtre) :
   état, prochain préventif, disponibilité, « Préventif fait », « Signaler une panne » ou « Résoudre la
   panne », historique, champs (site, désignation, catégorie, criticité, marque et modèle libres, mise en
   service, périodicité du préventif, dernier préventif connu à la création, notes, réformé).
4. **Interventions** (journal) : filtres (type, site, pannes ouvertes seulement) ; 60 plus récentes
   affichées, export CSV complet. Fenêtre de saisie à trois types : **préventif** (date de réalisation,
   échéance prévue pré-remplie par le calcul), **correctif** (signalement, résolution vide tant que la panne
   est ouverte, « équipement à l'arrêt »), **visite de site** (équipement facultatif) ; libellé, prestataire
   (nom libre, liste des prestataires déjà saisis), coût.
5. **Indicateurs** : tuiles consolidées (disponibilité, préventif à temps, en retard, délai moyen de
   résolution, coût total préventif / correctif) ; barres coût par site (infobulle préventif, correctif,
   visites), coût par catégorie, disponibilité par site ; tableau par site avec la ligne « Parc » ; note de
   méthode.
6. **Guide** : démarrage, méthode de calcul, carte, mode d'emploi du modèle tableur, limites.
7. **Réglages** : structure, seuils (préventif « à prévoir » 30 j, arrêt 7 j, site sans visite 6 mois,
   période des indicateurs 365 j), exports CSV (sites, équipements, interventions), import CSV, modèles vides,
   copie JSON et restauration, compte, « Sur téléphone » (fenêtre « Comme une application »).

Socle commun : clé de licence ou code, démo `?demo` (non mémorisée par lien), code ADM avec `produit: 'PRK'`
dans les deux appels à `/connexion`, synchronisation (`/api/templates/*`, 409), hors ligne, toast
« Annuler », manifeste et service worker, bandeau `.bientot-demo` vers `/catalogue/parcs-multi-sites/`.

## Base intégrée (`templates/parcs-multi-sites/donnees.js`)

- 8 types de sites (bureaux, résidence, commerce, entrepôt, ERP, industriel, technique, autre).
- 13 catégories d'équipements (chauffage, climatisation et ventilation, ascenseur, électricité, groupe
  électrogène et onduleur, sécurité incendie, contrôle d'accès, portes et portails, plomberie, manutention,
  froid, production d'énergie, autre).
- 3 criticités, 3 types d'intervention, périodicités proposées (1 à 60 mois, toute valeur de 1 à 120 admise).
- 18 régions françaises proposées à la saisie (texte libre accepté : secteur, agence, pays).
- **Aucune périodicité réglementaire**, aucune marque, aucun prestataire, aucun prix : tout ce qui se périme
  ou dépend du contrat est saisi par l'utilisateur. Rédigée pour le produit, sans source externe.

## Calculs (règles pures, `templates/parcs-multi-sites/regles.js`)

- **État d'un équipement** : réformé (saisi) ; à l'arrêt si une panne « à l'arrêt » est ouverte (depuis la
  plus ancienne) ; dégradé si une autre panne est ouverte ; sinon en service.
- **Échéance du préventif** : dernier préventif réalisé (ou date de départ saisie, ou mise en service) +
  périodicité en mois (jour borné à la fin du mois) ; en retard après l'échéance, « à prévoir » dans la
  fenêtre d'alerte ; « sans » si périodicité 0 ou équipement réformé.
- **Disponibilité** d'un équipement sur la période : 1 − jours d'arrêt ÷ jours de la période (bornée à la
  mise en service), arrêts superposés fusionnés ; d'un site ou du parc : moyenne des équipements actifs.
- **Délai moyen de résolution** : moyenne des jours signalement → résolution des pannes résolues sur la
  période. **Taux de préventif à temps** : préventifs réalisés sur la période au plus tard à leur échéance
  enregistrée. **Coûts** : somme par site, par catégorie (visites sans équipement : « Visites de site ») et
  par type, datés de la réalisation (préventif, visite) ou de la résolution (panne ; signalement si ouverte).
- **Alertes** : préventif dépassé (retard) ou proche ; à l'arrêt depuis ≥ N jours (retard) ou moins
  (à surveiller) ; site actif sans visite (préventif, panne résolue, visite) depuis plus de N mois (retard) ou
  sans aucune visite (à surveiller). État d'un site = pire de ses alertes.
- **Liste** : filtres texte (accents ignorés), région, type, état ; tri stable par colonne.
- **Carte** : `projeter()` (cadrage, étendue minimale 0,5°, marge) et `grilleRegions()`.
- **CSV** : point-virgule, UTF-8 avec BOM, CRLF, décimales à virgule, formules neutralisées par une
  apostrophe (retirée à la relecture) ; lecture tolérante (séparateur `;`, `,` ou tabulation détecté sur
  l'en-tête, guillemets, retours à la ligne dans un champ, dates JJ/MM/AAAA ou AAAA-MM-JJ, colonnes dans
  n'importe quel ordre, accents et casse ignorés). Import des sites : mise à jour par nom, sinon ajout ;
  import des équipements : site par son nom (doit exister), mise à jour par site + désignation ; valeurs
  inconnues remplacées par « Autre » ou « Moyenne » avec une remarque par ligne ; aperçu avant d'appliquer.
  L'export des sites et des équipements se réimporte sans doublon (test d'aller-retour).
- Tests : `outils/templates/parcs-multi-sites.test.mjs` (14 tests, date de référence fixe).

## Sources

Aucune base externe : listes et méthodes rédigées pour le produit (définitions usuelles de la disponibilité,
du délai moyen de résolution et du taux de préventif à temps, sans norme citée). Coordonnées GPS saisies par
l'utilisateur ; aucun service de cartographie ni de géocodage.

## Données datées

Aucune. Les régions françaises (découpage de 2016) sont seulement proposées en saisie libre.

## Risques

- **Confidentiel** : l'artefact professionnel d'origine n'est pas repris ; la démo n'emploie que des noms de
  sites génériques inventés (« Résidence des Tilleuls », « Entrepôt Nord », « Immeuble Horizon »…), des
  prénoms et initiales, des prestataires notés « (fictif) », des coûts inventés. Les villes de la démo
  (Rennes, Lille, Lyon…) ne servent que de repère géographique, avec des coordonnées approximatives de
  centre-ville.
- **Réglementaire** : ascenseurs, sécurité incendie, installations électriques, gaz, froid ont des
  obligations propres. L'outil n'en connaît aucune et le dit (fiche équipement, guide, FAQ) ; c'est un outil
  de pilotage, pas un registre réglementaire (voir T63).
- **Données personnelles** : responsables de site en texte libre (prénom et initiale conseillés) ; pas de
  coordonnées personnelles demandées.
- **Volume** : environ 900 Ko par compte ; la démo (10 sites, 30 équipements, 125 interventions sur
  deux ans) occupe environ 38 Ko. Un parc de plusieurs centaines d'équipements avec des années
  d'historique peut approcher la limite : message 413 prévu, export puis purge.
- **Carte** : schématique, non à l'échelle d'une carte réelle ; sites très proches → étiquettes masquées
  (visibles au survol), la liste reste la référence.

## Points à valider par Quentin

1. Nom « Pilotage de parcs multi-sites » et **prix de 49 €** (taille L, IDEES.md).
2. Périmètre : pas de périodicités réglementaires en base, pas de pièces jointes, pas de bons de travail,
   un seul compte sans droits par personne.
3. Démo : villes réelles comme simples repères (avec des sites inventés), ou passage à des villes fictives.
4. Thème du catalogue « Équipements et véhicules » (avec flotte et parc informatique).
5. Permalien Gumroad `pilotage-parcs-multi-sites` et catégorie.

## Choix d'implémentation (14/11/2026)

- Socle repris de `templates/flotte/` (lot du 13/11) : connexion, démo, synchronisation, modales, toast,
  écran d'accueil, Pastel ; métier entièrement réécrit, règles dans `regles.js`.
- Un seul préventif périodique par équipement (le plan multi-opérations relève de T61).
- Les sites portent un nom unique (clé de l'import) ; un équipement est unique par site et désignation.
- Graphiques : barres horizontales à une seule série (bleu), valeur écrite au bout, infobulle, tableau
  accessible ; aucune palette catégorielle (les couleurs vives restent aux états). La carte encode l'état
  par la forme **et** la couleur, avec légende.
- La carte recalcule son `viewBox` à la largeur de l'écran (texte lisible sur téléphone).
