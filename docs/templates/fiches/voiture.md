# T10 · Carnet de voiture

Slug `voiture`, préfixe `CAR` (clés locales `qme-car-*`, règles `window.CAR`), prix prévu 13 € (**à confirmer
par Quentin**), permalien Gumroad prévu `carnet-voiture`, catégorie Gumroad `business-and-money/personal-finance`
(à vérifier), taille M, priorité P2. Catalogue : `data-pour="perso"`, thème « Organisation et études ».
Origine : liste initiale (12/11/2026) et demande de Quentin du 13/11/2026 (« gestionnaire de voitures »)
fusionnées. Version particulier du moteur de T29 (`templates/flotte/`), sans conducteurs, réservations ni
sinistres. Marques de risque : **daté** (périodicité du contrôle technique : sourcée, datée, modifiable),
**argent** (avertissement dans l'application, la page catalogue et la fiche Gumroad). Fiche rédigée le
14/11/2026. Aucune marque ni aucun modèle de véhicule, nulle part ; aucune automatisation ni lien externe.

## Pour qui

Particuliers et foyers avec une à quelques voitures : la personne qui garde les factures dans la boîte à
gants, découvre l'échéance du contrôle technique au dernier moment, fait l'entretien « à peu près tous les
ans » et n'a qu'une impression de ce que la voiture coûte. Distinct de la **gestion de flotte** (T29, PME et
collectivités : conducteurs, réservations, sinistres, amendes, location longue durée) et du **budget du
foyer** (enveloppes de toutes les dépenses).

## Promesse

Ta voiture, entretenue à temps : les entretiens à la date ou au kilométrage, le contrôle technique, chaque
plein et chaque dépense, et ce que la voiture coûte vraiment au kilomètre.

## Écrans (4 onglets + réglages)

1. **Tableau de bord** : filtre de voiture ; tuiles (en retard, bientôt, coût mensuel et coût au km des
   12 derniers mois) ; liste « À faire » (entretiens, contrôle technique, contre-visite, kilométrage à
   mettre à jour) triée retards d'abord, chacune avec « C'est fait » (ouvre la saisie préremplie) ; « Mes
   voitures » (kilométrage, rythme mensuel, consommation moyenne, prochain entretien, contrôle technique).
2. **Entretiens** : par voiture, la ligne du contrôle technique puis chaque opération du plan avec son
   état (en retard, bientôt, à jour, sans échéance), sa prochaine échéance « à N km ou le JJ/MM/AAAA, la
   première atteinte », la dernière fois et ce qui reste (km, jours, date estimée du km) ; « Modifier le
   plan » ; historique des interventions (entretiens et contrôles, avec coût) ; « Historique pour la revente ».
3. **Dépenses** : filtre de voiture et période (12 derniers mois, cette année, depuis le début) ; tuiles
   (total, coût mensuel, coût au km, km parcourus) ; graphique par poste (barres horizontales) et par mois
   (colonnes), infobulles et tableau accessible ; consommation par voiture et par énergie (moyenne, dernier
   intervalle, prix moyen saisi) ; journal filtrable par poste (25 lignes puis « Afficher tout ») ; export CSV.
4. **Voitures** : cartes (plaque, énergie, mise en circulation, km, km par mois, coût mensuel, contrôle
   technique, prochain entretien, notes) ; « Relevé km », « Historique », « Modifier » ; voitures vendues
   à part, gardées pour leur historique, sans alerte.
5. **Réglages** : fenêtres d'alerte (jours, km), relevé ancien ; **contrôle technique** (1er contrôle
   48 mois, puis 24 mois, contre-visite 2 mois, date de vérification, résumé et source affichés) ; export
   CSV ; sauvegarde JSON ; compte ; « Sur téléphone » ; données personnelles ; à propos.

Saisies (modales) : voiture (nom, immatriculation, énergie, mise en circulation, entrée dans le carnet et
km à cette date, type « voiture particulière » ou « autre véhicule » avec périodicité saisie, dernier
contrôle technique connu, notes, vendue) ; plan d'entretien (opération, km, mois, dernière fois connue :
date et km ; « Reprendre le plan proposé ») ; relevé km ; entretien fait (opérations cochées, garage, coût,
note) ; contrôle technique (périodique ou contre-visite, résultat favorable / défaillance majeure /
défaillance critique, centre, coût) ; plein, recharge ou dépense (catégorie, montant, quantité en litres
ou kWh, compteur, plein complet, « un passage précédent n'a pas été noté », prix unitaire affiché) ;
historique pour la revente (montants affichés ou non, imprimer, copier le texte).

Premier lancement en 2 étapes : présentation et 4 conseils ; puis la première voiture (nom, immatriculation,
énergie, mise en circulation, kilométrage du jour, dernier contrôle technique facultatif).

## Base intégrée (`templates/voiture/donnees.js`)

- **7 énergies** : essence, diesel, hybride non rechargeable, hybride rechargeable (carburant et
  recharge), électrique, GPL ou bicarburation, autre.
- **Contrôle technique d'une voiture particulière** : 48 / 24 / 2 mois, source et résumé (voir Sources).
- **Plan d'entretien indicatif** (11 opérations, selon l'énergie) : révision, vidange et filtre à huile,
  filtre à air, filtre d'habitacle, liquide de frein, freins, pneus, liquide de refroidissement,
  distribution, climatisation, batterie 12 V. **Ordres de grandeur rédigés pour le produit, non sourcés**,
  présentés comme indicatifs : « le carnet d'entretien du constructeur prime ». Repris de T29, valeurs
  ajustées pour un particulier (vidange 15 000 km ou 12 mois, pneus 10 000 km ou 12 mois).
- **11 catégories de dépenses** en 6 groupes : carburant, recharge électrique (énergie) ; entretien,
  contrôle technique (comptés automatiquement depuis leurs saisies) ; réparations, pneus ; assurance ;
  péage, stationnement ; crédit ou location, autre.
- 4 conseils. **Aucun prix** de carburant ni d'électricité.

## Calculs (règles pures, `templates/voiture/regles.js`, `window.CAR`)

- **Kilométrage actuel** = plus grand compteur connu (entrée dans le carnet, relevés, entretiens,
  contrôles, pleins et recharges). **Rythme** = km/jour sur 365 jours (repli sur tout l'historique).
  **Km à une date** : interpolation linéaire entre deux points, bornée (jamais d'extrapolation). Un
  compteur incohérent (inférieur à un relevé antérieur ou supérieur à un relevé postérieur) est refusé.
- **Échéance d'entretien** : référence = dernier entretien qui contient l'opération, sinon « dernière
  fois connue » du plan, sinon l'entrée dans le carnet ; échéance km = référence + intervalle, échéance
  date = référence + mois (fin de mois bornée) ; **la première atteinte compte**. États : en retard (km
  atteint ou date passée), bientôt (fenêtre de jours ou de km, ou km estimé atteint dans la fenêtre de
  jours d'après le rythme), à jour, sans échéance.
- **Contrôle technique (M1)** : sans contrôle connu, échéance = mise en circulation + 48 mois − 1 jour
  (possible dès + 42 mois) ; ensuite dernier contrôle périodique + 24 mois − 1 jour (exemple de la fiche
  officielle : 14/05/2025 → 13/05/2027). Défaillance majeure ou critique : contre-visite au plus tard
  contrôle + 2 mois − 1 jour ; critique = alerte « ne plus circuler avant réparation ». Contre-visite
  favorable : prochain contrôle 24 mois après le contrôle défavorable. Autre véhicule : périodicités
  saisies, sinon aucun calcul.
- **Consommation plein à plein** (CAR en litres, REC en kWh) : d'un plein complet avec compteur au plein
  complet suivant, quantité = tout ce qui a été mis après le premier jusqu'au second inclus (appoints
  compris) ; un plein « oublié avant celui-ci » ou un plein complet sans compteur coupe la chaîne ;
  moyenne pondérée = quantité totale / km totaux × 100 ; prix moyen saisi par litre ou kWh.
- **Coûts** : dépenses + coût des entretiens + coût des contrôles, sur une période ; km parcourus
  interpolés ; coût au km = total / km (rien sous 1 km) ; coût mensuel = total / mois de la période
  effective (à partir de l'entrée dans le carnet), 1 mois au moins ; totaux par catégorie, par groupe et
  par mois civil.
- **Alertes** : entretiens et contrôle technique en retard ou bientôt, kilométrage plus vieux que le seuil
  (60 jours par défaut) ; voitures vendues exclues.
- **Historique pour la revente** : entretiens, contrôles, réparations et pneus, du plus récent au plus
  ancien ; montants masqués par défaut ; texte à copier et page imprimable.
- Export CSV (point-virgule, BOM UTF-8, formules neutralisées), normalisation tolérante, suppression d'une
  voiture avec ses saisies.
- 21 tests `node --test` dans `outils/templates/voiture.test.mjs`.

## Sources

- **Contrôle technique d'une voiture (catégorie M1)**, service-public.gouv.fr, fiche F2878
  (https://www.service-public.gouv.fr/particuliers/vosdroits/F2878), page « Vérifié le 01 janvier 2026 »,
  **lue le 14/11/2026** avec l'outil de lecture web : 1er contrôle dans les 6 mois avant le 4e anniversaire
  de la 1re mise en circulation ; résultat favorable valable 2 ans (exemple : 14 mai 2025 → 13 mai 2027) ;
  défaillance majeure : contrôle valable 2 mois, contre-visite dans les 2 mois ; défaillance critique :
  validité limitée au jour du contrôle, contre-visite dans les 2 mois ; contre-visite favorable valable
  2 ans à compter du contrôle défavorable ; obligatoire quelle que soit l'énergie. Affiché dans les
  Réglages et dans la saisie d'un contrôle.
- **Non vérifié, donc non intégré** : règles des deux-roues, camping-cars, utilitaires et véhicules de
  collection (type « Autre véhicule », périodicité saisie) ; délai d'une contre-visite elle-même
  défavorable (l'outil repart de la dernière visite défavorable : **à vérifier**).
- Intervalles d'entretien : indicatifs, rédigés pour le produit (aucune base externe, pas de licence).

## Données datées

- Périodicités du contrôle technique (48, 24 et 2 mois) : modifiables dans les Réglages, avec la date de
  vérification ; à revérifier chaque année sur la fiche F2878 et à mettre à jour dans `donnees.js`.
- Prix du carburant et de l'électricité : **jamais intégrés**, saisis à chaque plein ou recharge.

## Risques

- **Argent** : coûts calculés à partir de la saisie, hors prix d'achat et décote ; avertissement « ni
  conseil mécanique ni conseil financier » en pied de chaque vue, dans les Réglages, la page catalogue et la
  fiche Gumroad.
- **Entretien** : intervalles indicatifs ; « le carnet d'entretien du constructeur prime » au premier
  lancement, dans la saisie d'une voiture, le plan et l'avertissement.
- **Daté** : règle du contrôle technique sourcée et paramétrable (voir ci-dessus).
- **RGPD** : seules les données de l'acheteur (voitures, montants, garages) ; aucune géolocalisation,
  aucune donnée de tiers ; immatriculation facultative.
- Concurrence : applications mobiles gratuites avec publicité ou abonnement, carnets papier ; se distinguer
  par l'achat unique, le calcul « date ou kilométrage », le contrôle technique sourcé et l'historique de
  revente.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/conges/` (connexion avec `produit: 'CAR'`, synchronisation et 409, démo `?demo`
  non mémorisée, modales, toast Annuler, export / import JSON, service worker `voiture-20261114`, fenêtre
  « Comme une application » avec la clé `qme-car-ecran-accueil`, bandeau « Bientôt en vente » vers
  `/catalogue/voiture/`) ; moteur d'échéances repris de `templates/flotte/regles.js`.
- Démo : foyer fictif, « Citadine essence » (AA-123-AA), « Break diesel » (BB-456-BB), « Compacte
  électrique » (CC-789-CC) et « Ancienne citadine diesel » vendue (DD-000-DD) ; aucune marque ni modèle ;
  prix saisis fictifs ; états couverts : vidange en retard (date dépassée), contrôle technique bientôt,
  contre-visite après défaillance majeure, kilométrage à mettre à jour, pneus à l'approche du km, premier
  contrôle à venir, consommation essence, diesel et électrique, crédit, assurance mensuelle et annuelle,
  réparations, péages ; tout relatif à la date du jour.
- Graphiques (skill dataviz) : une seule série par graphique (bleu de la charte, mois en cours en encre),
  donc pas de palette catégorielle ; valeurs affichées, infobulle au survol et au clavier, tableau
  accessible des mois.
- Historique imprimable : page dédiée injectée dans `#impression` et `window.print()`, le reste masqué à
  l'impression ; aucun PDF généré côté serveur.
