# T42 · Trésorerie prévisionnelle 12 mois

Slug `tresorerie`, préfixe `TRS`, prix 29 €, permalien Gumroad `tresorerie-previsionnelle`, taille M,
priorité P1. Origine : backlog de Quentin n° 17 (prévu en tableur seul ; passé en application web par
défaut, comme toutes les idées « tableur seul »). Marque de risque : **comptable** (et **daté** pour
toute échéance fiscale ou sociale, d'où la règle : aucune en base).

## Pour qui

Dirigeants de TPE, indépendants, professions libérales et petites sociétés (0 à 10 salariés) qui veulent
savoir **si le compte tiendra** dans les 12 prochains mois : voir venir un creux de trésorerie avant qu'il
arrive (gros achat, échéance d'emprunt, mois creux, retard d'un client), décider d'un investissement ou
d'une embauche, préparer un rendez-vous avec la banque. Sans logiciel comptable, sans connexion bancaire,
sans tableur à maintenir.

Ce n'est **pas** un outil de comptabilité : pas d'écritures, pas de TVA calculée, pas de bilan. Il raisonne
en **flux de trésorerie** (ce qui entre et sort réellement du compte, TTC, à la date du paiement).

## Écrans (5 onglets)

1. **Synthèse** : phrase d'en-tête (« Ton compte reste au-dessus du seuil jusqu'en … » ou « Alerte :
   passage sous le seuil en … ») ; sélecteur de scénario (prudent, central, optimiste) ; quatre tuiles
   (solde fin du mois en cours, point bas sur 12 mois, encaissements et décaissements des 12 mois) ;
   **graphique du solde de fin de mois** sur 12 mois avec la ligne du seuil, la fourchette prudent ↔
   optimiste en aplat et les mois passés en trait plein ; liste des alertes (mois sous le seuil, mois à
   découvert, opérations passées non pointées) ; tableau accessible du graphique.
2. **Tableau** : le plan de trésorerie classique, **mois en colonnes, catégories en lignes** :
   solde de début, encaissements par catégorie, total, décaissements par catégorie, total, flux net,
   solde de fin ; cellules sous le seuil en jaune, à découvert en rouge ; mois passés affichables ;
   **export CSV** (séparateur point-virgule, virgule décimale, UTF-8 avec BOM : s'ouvre tel quel dans un
   tableur français).
3. **Pointage** : un mois choisi (mois passés, mois en cours, mois à venir) ; chaque échéance prévue
   avec son montant prévu, un champ « réalisé », l'écart ; « Conforme » d'un clic (réalisé = prévu) ;
   « Pas eu lieu » (réalisé = 0) ; modification du prévu de ce seul mois ; ajout d'une opération
   imprévue (ponctuelle, prévu 0).
4. **Prévisions** : les lignes du plan, groupées encaissements / décaissements puis par catégorie :
   libellé, montant, récurrence (ponctuel, mensuel, trimestriel, annuel), premier mois, dernier mois
   (facultatif) ; ajout depuis les catégories types.
5. **Hypothèses** : solde de départ et son mois (« recaler sur le solde bancaire » au début du mois en
   cours) ; seuil d'alerte ; écarts des scénarios en % sur les encaissements ; catégories (types et
   personnelles) ; avertissement comptable.

Premier lancement (2 étapes) : nom de l'activité, solde bancaire au début du mois en cours, seuil
d'alerte ; puis choix d'un profil (prestataire de services, commerce, artisan / BTP, société avec
salariés) qui propose une liste de lignes récurrentes types **sans montant** : l'utilisateur saisit les
montants de celles qui le concernent (les autres sont ignorées).

## Saisie

- Montants en euros à la française (`1 234,56`, `1234.5`, `12 €`) convertis en **centimes entiers** ;
  tous les calculs en centimes. Solde de départ et seuil acceptent un signe moins (découvert autorisé).
- Une ligne = type (encaissement ou décaissement), catégorie, libellé, montant TTC, récurrence, premier
  mois, dernier mois facultatif.
- Réalisé : par échéance (ligne × mois), saisi dans Pointage.

## Mécanique clé

- **Échéances** : une ligne tombe le mois `m` si `m ≥ premier mois`, `m ≤ dernier mois` (s'il existe) et
  l'écart en mois est un multiple du pas (ponctuel : 0 seulement ; mensuel 1 ; trimestriel 3 ; annuel 12).
- **Prévu du mois** = ajustement propre à ce mois s'il existe, sinon montant de la ligne.
- **Montant retenu** d'une échéance = réalisé s'il est saisi, sinon prévu ; pour un **encaissement non
  réalisé**, le prévu est corrigé de l'écart du scénario : `arrondi(prévu × (100 + écart) / 100)`.
  Défauts : prudent −20 %, central 0 %, optimiste +10 % (réglables de −100 à +100 %). Les décaissements
  ne varient pas (hypothèse prudente : les charges tombent).
- **Solde** : `solde début(m) = solde fin(m − 1)` ; `solde fin(m) = solde début(m) + encaissements(m) −
  décaissements(m)`, à partir du solde de départ au début de son mois.
- **12 mois glissants** : la fenêtre commence au mois en cours (ou au mois de départ s'il est plus tard)
  et couvre 12 mois ; les mois entre le départ et le mois en cours (passés) restent calculés et
  consultables. « Recaler » remplace le solde de départ par le solde bancaire constaté au début du mois
  en cours.
- **Alertes** : mois dont le solde de fin est sous le seuil ; mois à découvert (solde < 0) ; point bas
  des 12 mois ; échéances passées sans réalisé (« à pointer »). Limite affichée : le solde est un solde
  de **fin de mois**, il peut descendre plus bas en cours de mois.

## Base intégrée

- **37 catégories types d'une TPE**, rangées en 4 familles :
  - exploitation (encaissements : ventes de marchandises, prestations de services, acomptes clients,
    commissions, autres produits ; décaissements : achats et matières, sous-traitance, loyer et charges,
    énergie et eau, télécoms et internet, logiciels et abonnements, assurances, honoraires, frais
    bancaires, déplacements, marketing, fournitures, entretien et réparations, salaires nets,
    rémunération du dirigeant, autres charges) ;
  - fiscal et social (décaissements : TVA à reverser, charges sociales, cotisations du dirigeant,
    impôts et taxes ; encaissement : remboursement de crédit de TVA). **Aucun taux, aucun montant,
    aucune date** : la catégorie porte la mention « montants et dates selon tes avis d'échéance » ;
  - investissement (achats de matériel, véhicules, travaux ; cession d'un bien) ;
  - financement (apport des associés, déblocage d'emprunt, subventions et aides ; remboursement
    d'emprunt, prélèvements ou dividendes, remboursement de compte courant).
- **4 profils** (prestataire de services, commerce, artisan / BTP, société avec salariés) : chacun
  propose 8 à 12 lignes récurrentes types (catégorie, libellé, récurrence) **sans montant**.
- **3 scénarios** avec leurs écarts par défaut (réglables).

## Calculs (fonctions pures, `templates/tresorerie/regles.js`)

`versCentimes`, `euros`, `ajoutMois`, `ecartMois`, `tombe(ligne, mois)`, `prevuDu`, `appliquerEcart`,
`calculer(etat, { scenario, moisCourant })` (tous les mois du départ à la fin de la fenêtre, totaux par
catégorie, alertes, point bas), `echeancesDuMois`, `csv`.

## Sources

- Aucune donnée réglementaire, aucun taux, aucune échéance officielle en base : **rien de daté**. Les
  échéances fiscales et sociales (TVA, URSSAF, impôts) sont saisies par l'utilisateur d'après ses propres
  avis ; l'application le rappelle sur ces catégories.
- Catégories, profils et écarts par défaut des scénarios : rédigés pour le template (aucune base
  externe, aucune licence à vérifier). Les écarts −20 % / +10 % sont des valeurs de départ arbitraires
  présentées comme telles, pas une norme.

## Risques

- **comptable** : outil d'aide à la prévision, pas un logiciel comptable ni certifié, ne remplace pas un
  expert-comptable ; avertissement à l'écran de connexion, dans Hypothèses, dans le pied du tableau et
  sur la fiche Gumroad. Les montants saisis sont TTC (flux réels).
- **daté** : neutralisé (aucune échéance en base).
- Données financières de l'entreprise hébergées en ligne avec la clé ; partager la clé donne accès au
  plan. Aucune connexion bancaire.
- Démo entièrement fictive (activité « Atelier Exemple »), aucun montant réel.

## Choix d'implémentation

- Règles pures dans `templates/tresorerie/regles.js` (`window.TRS`), testées par
  `outils/templates/tresorerie.test.mjs` (chargement par `vm`, comme le budget du foyer).
- État : `{ version, nom, debut, soldeDepart, seuil, ecarts: { prudent, optimiste }, categoriesPerso,
  lignes, ajustements: { ligneId: { mois: centimes } }, realise: { ligneId: { mois: centimes } } }`.
- Graphique SVG maison : `viewBox` à la largeur de l'écran ; un seul trait (scénario choisi), fourchette
  prudent ↔ optimiste en aplat bleu à 12 %, seuil en trait rouge étiqueté directement, mois en cours
  repéré, infobulle au survol et au toucher, tableau accessible.
- Tableau : défilement horizontal dans son cadre (première colonne figée) ; la page ne déborde jamais.
