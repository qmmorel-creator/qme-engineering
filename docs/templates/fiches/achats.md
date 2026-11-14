# T82 · Demandes d'achat et fournitures

Slug `achats`, préfixe `ACH` (clés locales `qme-ach-*`, règles `window.ACH`), prix 19 €, permalien Gumroad prévu
`demandes-achat-fournitures`, catégorie Gumroad prévue `business-and-money/management-and-leadership` (à confirmer),
taille S, priorité P3, usage `pro`. Origine : proposition validée par Quentin le 14/11/2026 (pack « Moyens
généraux », PMG). Fiche rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de
validation à attendre). Catalogue : `data-pour="pro"`, thème `equipements-et-vehicules` (`--c:var(--bleu)`), comme
la réservation de salles (T50), l'autre template « moyens généraux » à usage partagé. Marque de risque : **argent**
léger (montants estimés, pas une comptabilité). **Confidentiel vérifié** : démo d'un atelier fictif (« Atelier
Exemple »), fournisseurs fictifs, prix fictifs.

## Pour qui

Office managers et responsables des services généraux de PME (10 à 150 personnes), dirigeants qui gèrent eux-mêmes
les fournitures, petites structures associatives. Aujourd'hui : demandes par e-mail, sur un post-it ou dans un
tableur partagé, validations orales, commandes passées « quand on y pense », aucune vue du budget par service.

## Promesse

Qui a demandé quoi, qui l'a validé, ce qui est commandé, et où en est le budget de chaque service.

## Décisions de cadrage

- **Usage à plusieurs (V1)** : une seule clé partagée (même modèle que T50) ; pas de comptes ni de rôles. Chacun
  saisit son nom à chaque étape (demande, validation, commande, réception), mémorisé sur son appareil. Toute
  personne qui a la clé peut valider : l'outil garde le nom, signale l'auto-validation (« c'est ta propre
  demande ») et montre l'effet sur le budget avant de valider. Évolution possible : code « demandeur » distinct.
- **Une demande = un article** (qui, quoi, quantité, unité, service, urgence, motif, prix unitaire estimé
  facultatif). Le formulaire accepte plusieurs articles en un envoi : chacun devient une demande (même groupe),
  ce qui permet de valider, commander et recevoir ligne à ligne. Numérotation `DA-AAAA-NNN`.
- **Circuit** : demandée → validée ou refusée (motif obligatoire) → commandée → reçue ; reçue en partie possible
  (reliquat attendu), reliquat abandonné (« ne plus attendre »), annulation avant commande, réouverture d'une
  demande refusée ou annulée. Le fond (quantité, article, service, motif) n'est modifiable qu'avant validation ;
  prix et fournisseur jusqu'à la commande ; prix réel à la réception.
- **Seuil de validation** (réglage, 100 € par défaut, vide = toujours valider) : validation automatique à l'envoi
  si le prix est estimé, le montant sous le seuil et le budget du service suffisant ; sinon une personne valide.
- **Commandes** : les demandes validées sont regroupées par fournisseur (celui de la demande, sinon celui de
  l'article) ; lignes du même article fusionnées (quantités additionnées, services listés) ; minimum de commande
  du fournisseur signalé ; demandes sans fournisseur à rattacher. Bon de commande `BC-AAAA-NNN` imprimable en A4
  (organisation, adresse de livraison, fournisseur, référence, lignes, total estimé). Document interne, rien
  n'est envoyé.
- **Livraison** : date attendue = date du bon + délai du fournisseur (saisi) ; retard signalé.
- **Budget annuel par service** : exercice civil ou décalé (mois de début réglable), une demande compte sur
  l'exercice de sa date de création. Consommé = quantités reçues × prix réel (ou estimé) ; engagé = validé ou
  commandé et pas encore reçu ; en attente = à valider (affiché à part, non compté) ; disponible = budget −
  consommé − engagé. Niveaux : dépassé, plus de 90 %, sans budget.
- **Montants** : HT ou TTC selon un réglage qui n'est qu'un libellé ; **aucun calcul de TVA, aucune règle
  comptable ou fiscale**.
- **Conflits de synchronisation** : chaque modification est une action pure (`appliquer`) journalisée ; en cas de
  conflit 409, les actions locales sont rejouées sur la version du serveur (`rejouer`, comme `templates/salles/`).
  Une action devenue impossible (demande déjà validée, commandée ou soldée sur un autre appareil) est refusée et
  signalée ; numéros en double renumérotés ; réceptions idempotentes.

## Base intégrée (`donnees.js`)

- 104 fournitures types en 6 catégories (fournitures de bureau, papier et impression, entretien et hygiène, café et
  cuisine, informatique courante, petit équipement) + « Autre », avec leur unité. **Sans prix, sans marque, sans
  référence fournisseur** (« selon modèle » pour les consommables d'imprimante et capsules).
- Unités, 6 services proposés, 3 niveaux d'urgence (normale, urgente, bloquante), motifs et motifs de refus types,
  réglages par défaut, palette de 8 couleurs fixes (celle de T50, validée).
- Rédaction QME, aucune source externe, **aucune donnée qui se périme** (aucun prix, aucun taux).

## Écrans

- **Demandes** : tuiles (à valider avec relances, à commander, en livraison et retards, budget de l'exercice),
  alerte de budget dépassé, filtres (à valider, à commander, en livraison, les miennes, en cours, reçues,
  refusées et annulées, toutes), service, recherche ; validation rapide ; export CSV.
- **Détail d'une demande** : état, montants, effet sur le budget, actions selon l'état, historique daté.
- **Commandes** : à commander par fournisseur, aperçu et impression du bon, « Passer la commande », bons en
  cours (réception, retard), bons reçus.
- **Budget** : exercice précédent ou suivant, tuiles, barres empilées par service (consommé, engagé, en attente,
  repère du budget), tableau accessible.
- **Catalogue** : articles par catégorie (prix habituel, fournisseur, référence, « Demander »), fournisseurs
  (délai, minimum), services (responsable, budget).
- **Historique** : exercice en cours, 12 mois ou exercice précédent ; nombre de demandes, taux de refus, délais
  moyens (validation, commande, livraison), reçu par mois, par catégorie, par service, articles les plus demandés.
- **Réglages** : organisation, adresse de livraison, seuil, relance, exercice, HT/TTC, nom sur l'appareil,
  effacement des noms des demandes terminées anciennes, CSV, copie JSON, partage de la clé, écran d'accueil.
- **Premier lancement** en 2 étapes : services et budgets ; seuil, exercice, catégories du catalogue, nom.

## RGPD et risques

- Noms saisis (prénom suffisant), aucune autre donnée personnelle ; adresse de livraison de l'organisation.
  Effacement des noms des demandes terminées créées il y a plus de N mois (montants conservés).
- Pas de comptes : la clé partagée est la seule protection ; le dire partout (application, page, Gumroad).
- Pas une comptabilité ni un outil d'achat connecté : aucun fournisseur, aucune messagerie, aucun paiement.

## Statut

**prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/achats/?demo`, page `catalogue/achats/`, carte
`carte prochaine` du catalogue). Tests : `outils/templates/achats.test.mjs` (17 tests : exercice, montants, budget,
seuil, circuit complet, reliquat, regroupement, retard, rejeu en conflit 409, statistiques, RGPD, CSV). Parcours
Playwright (1280 px, iPhone 13, Pixel 7) : code faux refusé, premier lancement, seuil automatique, second appareil,
conflit 409 (validation gardée, refus signalé), rechargement, fenêtre « Comme une application ».
Restent : nom et prix à confirmer (clé partagée par toute l'équipe au prix d'un template individuel, même
question que T50), fiche Gumroad et clé de licence, entrée dans `gumroad-a-creer.json`, ajout au pack PMG
(`netlify/lib/packs.mjs`, pages régénérées), version anglaise, plannings LinkedIn et Instagram, mise en vente.
