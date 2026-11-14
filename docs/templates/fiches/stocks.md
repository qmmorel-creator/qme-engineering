# T62 · Stocks et inventaire

Slug `stocks`, préfixe `STK` (clés locales `qme-stk-*`, règles `window.STK`), prix prévu 25 €, permalien
Gumroad prévu `stocks-inventaire`, catégorie Gumroad prévue `business-and-money/management-and-leadership`
(à confirmer), taille S, priorité P2. Origine : backlog de Quentin n° 40 (ligne T62 de `IDEES.md` :
articles, entrées et sorties, seuils d'alerte, valorisation, inventaire ; application web, pas de modèle
tableur). Fiche rédigée le 14/11/2026. Catalogue : `data-pour="pro"`, thème `independants`
(`--c:var(--jaune)`). Marques de risque : **comptable** (outil de gestion, pas un logiciel comptable ;
valorisation de clôture renvoyée à l'expert-comptable). Pas de base datée : aucun taux, aucun prix intégré.
Avertissement dans l'application, la page catalogue et la fiche Gumroad.

## Pour qui

Petits commerces, artisans, ateliers et e-commerçants débutants qui suivent leur stock de tête, sur un
carnet ou dans un tableur : ruptures découvertes trop tard, commandes fournisseurs faites de mémoire,
argent immobilisé dans des articles qui ne se vendent plus, inventaire annuel qui ne tombe jamais juste.
Distinct de l'**Inventaire valorisé** (T69, `templates/patrimoine/`) : celui-ci recense les biens
d'un foyer pour l'assurance et la revente, avec décote ; ici, un stock professionnel qui tourne (entrées,
ventes, réapprovisionnement, coût moyen, inventaire avec écarts). Distinct aussi du **Coût de revient et prix par client**
(T37) : ici, pas de calcul de prix, seulement le prix de vente saisi pour la marge théorique.

## Promesse

Le bon stock, au bon moment : le stock de chaque article calculé par ses mouvements, les alertes et la
liste à commander, la valeur du stock et des inventaires dont les écarts se corrigent d'un clic.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles (valeur du stock selon la méthode, avec l'autre méthode en rappel ;
   alertes : ruptures et sous le seuil ; montant à commander au dernier prix ; stock dormant) ; ventes
   théoriques des 30 derniers jours (CA HT et marge théorique) et valeur de vente du stock ; avertissement
   de stock négatif ; bandeau de l'inventaire en cours ; alertes avec bouton « Réception » ; valeur par
   catégorie (barres + tableau) ; stock dormant ; derniers mouvements.
2. **Articles** : filtres Tous, À surveiller, Rupture, Sous le seuil, Dormants, Archivés ; filtre par
   catégorie ; recherche (référence, nom, emplacement, fournisseur) ; chaque ligne : stock et unité, valeur
   et coût unitaire, statut, quantité à commander, taux de marque. **Fiche** : stock, valeur, CMUP et
   dernier prix, prix de vente, marge unitaire, taux de marque et coefficient, rotation et couverture,
   dernière vente, dernier comptage, quantité à commander, boutons des 6 mouvements, historique (stock et
   CMUP après chaque mouvement, suppression).
3. **Mouvements** : journal du plus récent au plus ancien (150 affichés, tout dans l'export), filtres par
   type, recherche, suppression avec « Annuler ».
4. **À commander** : articles au seuil ou dessous, regroupés par fournisseur (texte libre), quantité
   proposée et coût estimé ; « Réception » (entrée préremplie) ; « Copier la commande » (texte à coller
   dans sa messagerie, rien n'est envoyé).
5. **Inventaire** : inventaire en cours (stock théorique, saisie du compté, écart en quantité et en euros
   mis à jour à la frappe, comptés, avec écart, exactitude, écart net), validation et abandon ; inventaires
   validés (détail des écarts) ; repères (CMUP, dernier prix, PEPS non calculé, inventaire annuel à
   vérifier, prix HT).
6. **Réglages** : entreprise, méthode de valeur affichée, jours avant dormant, période de rotation,
   période des ventes, catégories ; export CSV (état du stock, mouvements) ; sauvegarde JSON ; compte ;
   « Sur téléphone » ; à propos.

**Saisie d'un mouvement** : article, type (6 boutons), quantité (signée pour un ajustement), date, prix
d'achat HT pour une entrée (dernier prix proposé), motif pour une perte, note ; aperçu « stock actuel →
après » et alerte si le stock deviendrait négatif.

Premier lancement en 2 étapes : entreprise, type d'activité (5 choix qui proposent des catégories) et 4
conseils, puis catégories (modifiables) et méthode de valeur affichée.

## Base intégrée (`templates/stocks/donnees.js`)

13 unités, 5 types d'activité avec leurs catégories proposées, 6 types de mouvements (sens et
description), 6 motifs de perte, 4 conseils, 5 repères. Aucun prix, aucun fournisseur réel.

## Calculs (règles pures, `templates/stocks/regles.js`, `window.STK`)

- Prix en centimes HT (fractions de centime admises : 0,065 € = 6,5 centimes, 4 décimales d'euro à la
  saisie), quantités décimales à 3 chiffres ; saisie tolérante (espaces, virgule, signe −).
- **Stock** = somme des mouvements datés jusqu'au jour (entrée et retour client +, sortie, perte et retour
  fournisseur −, ajustement signé), rejoués par date puis ordre de saisie.
- **CMUP** recalculé à chaque entrée : (stock × CMUP + quantité × prix) ÷ (stock + quantité) ; repart du
  prix d'entrée si le stock avant l'entrée est nul ou négatif ; avant toute entrée, prix d'achat de la
  fiche ; entrée sans prix : prix de la fiche. Sorties, pertes, retours (client et fournisseur) et
  ajustements se font au CMUP du moment sans le changer (retour fournisseur : simplification signalée).
- **Dernier prix d'achat** : prix de la dernière entrée (sinon prix de la fiche).
- **Valeur** = stock × coût unitaire de la méthode ; stock nul ou négatif : 0 (négatif signalé).
- **Marge théorique** : prix de vente HT − coût ; taux de marque = marge ÷ prix de vente ; coefficient =
  prix de vente ÷ coût.
- **Statut**, par priorité : archivé, jamais en stock (aucun mouvement), rupture (≤ 0), sous le seuil
  (≤ seuil), dormant, en stock. **Dormant** : en stock, sans sortie depuis plus de N jours (90 par
  défaut), ou jamais vendu avec un premier mouvement de plus de N jours.
- **Quantité à commander** (stock ≤ seuil > 0) : plus petit multiple de la quantité de réapprovisionnement
  qui repasse strictement au-dessus du seuil ; sans quantité de réapprovisionnement, de quoi revenir au
  double du seuil. Coût estimé au dernier prix. Regroupement par fournisseur et texte de commande.
- **Rotation** sur N jours (90 par défaut) : quantité vendue ÷ stock moyen ((début + fin) ÷ 2) ;
  **couverture** = stock ÷ ventes par jour.
- **Ventes théoriques** de la période : sorties × prix de vente de la fiche, moins les retours clients,
  marge au CMUP du moment de chaque sortie.
- **Inventaire** : complet (articles actifs) ou tournant (catégorie, emplacement, ou les N articles comptés
  le moins récemment, jamais comptés d'abord) ; stock théorique en fin de journée du comptage (une vente
  notée après ne fausse pas l'écart) ; écart = compté − théorique, valeur au CMUP de la date ;
  exactitude = lignes justes ÷ lignes comptées. **Validation** : un ajustement daté du comptage par écart
  non nul, lignes non comptées sans effet, théorique et coût figés, pas de double validation.
- Synthèse, export CSV (point-virgule, BOM UTF-8 : état du stock avec les deux valorisations, journal des
  mouvements signés), normalisation tolérante, suppression d'un article avec ses mouvements.
- 13 tests `node --test` dans `outils/templates/stocks.test.mjs`.

## Sources

- Formule du CMUP « après chaque entrée » et méthode PEPS : définitions usuelles de la gestion des stocks
  (règles du Plan comptable général sur l'évaluation des biens fongibles, **non vérifiées** article par
  article le 14/11/2026 : l'outil ne s'y réfère pas et renvoie la valorisation de clôture à
  l'expert-comptable).
- Obligation pour un commerçant de contrôler par inventaire, au moins une fois tous les douze mois,
  l'existence et la valeur de ses actifs : Code de commerce, art. L123-12, **à vérifier** (la page
  Légifrance n'a pas pu être consultée le 14/11/2026) ; marqué « à vérifier » dans les repères de
  l'application, non cité dans la communication.

## Risques

- **Comptable** : ce n'est pas un logiciel comptable ni un logiciel de caisse ; valeurs hors taxes à
  partir de la saisie ; valorisation de clôture, provisions pour dépréciation et PEPS hors périmètre.
- **Saisie** : sans lien avec une caisse, le stock n'est juste que si les sorties sont notées ; l'inventaire
  tournant et l'alerte de stock négatif servent de garde-fous.
- **Volume** : rejouer l'historique à chaque affichage reste rapide pour quelques centaines d'articles et
  quelques milliers de mouvements (démo : 17 articles, environ 1 100 mouvements) ; au-delà, prévoir un
  instantané par article (à mesurer).
- Concurrence : logiciels de caisse et de gestion commerciale par abonnement ; se distinguer par l'achat
  unique, la simplicité et l'inventaire tournant.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/impayes/` (connexion clé ou code avec `produit: 'STK'`, démo `?demo` non
  mémorisée, synchronisation et conflit 409, modales, toast « Annuler », export et import JSON, service
  worker, fenêtre « Comme une application » avec la clé `qme-stk-ecran-accueil` et l'entrée « Sur
  téléphone » des Réglages, bandeau « Bientôt en vente · Être prévenu de la sortie » vers
  `/catalogue/stocks/`).
- Démo : atelier fictif de bougies avec boutique, 5 catégories, 6 fournisseurs fictifs génériques
  (« … Exemple »), 17 articles et 180 jours de mouvements simulés (générateur pseudo-aléatoire à graine
  fixe, dates relatives à aujourd'hui) : rupture forcée (mèches), sous le seuil forcé (pots), dormant
  (mugs, dernière vente il y a 150 jours), jamais en stock (coffret), archivé, hausses de prix (CMUP ≠
  dernier prix), petit prix unitaire (0,065 €), quantités décimales (kg, L), pertes, retours client et
  fournisseur, inventaire complet validé il y a 60 jours (5 écarts), inventaire tournant des emballages
  en cours (écarts −2 et +5, une ligne juste, une ligne à compter).
- Graphique (skill dataviz) : une seule série (bleu `--bleu`), sans légende (le titre la nomme), valeurs
  en texte d'encre, barres de 20 px à bout arrondi, infobulle au survol, au toucher et au clavier, tableau
  accessible sous les barres.
- Unités accordées à l'affichage (« 2 pièces », « 3 rouleaux », « 2,5 kg »).
