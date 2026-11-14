# T44 · Suivi de TVA

- **Slug** : `tva` · **préfixe** : `TVA` (clés locales `qme-tva-…`, `PRODUIT = 'TVA'`)
- **Thème** : Comptabilité (rattaché à la puce « Indépendants » du catalogue, faute de puce Comptabilité)
- **Prix prévu** : 19 € (≥ 12 €), taille S, priorité P3, backlog Quentin n° 20
- **Statut** : prêt, « Mise en vente prochaine » (pas de fiche Gumroad)
- **Format** : application web (le backlog prévoyait « tableur seul » ; `IDEES.md` fait passer T44 en application
  web par défaut). Export et import CSV pour le tableur et l'expert-comptable.
- **Mentions** : **daté** (taux, échéances) et **fiscal** (outil d'aide, pas de conseil).

## Pour qui

Petites sociétés (SARL, SAS, EURL…) et entrepreneurs individuels **au régime réel de TVA** qui tiennent leur TVA
dans un tableur, en général avec un expert-comptable qui dépose ou contrôle les déclarations : artisans, commerces,
petites entreprises de services. Pas pour les micro-entrepreneurs en franchise (voir T26), ni pour les entreprises
qui ont besoin d'autoliquidation, de TVA sur marge, de prorata de déduction ou d'opérations intracommunautaires.

## Promesse

« Ta TVA, période par période. » Chaque vente et chaque achat saisis au centime, la TVA collectée et déductible
de chaque période, ce qui reste à payer ou le crédit à reporter, l'échéancier de tes déclarations et les points à
contrôler avant de déclarer.

## Écrans (5 onglets + réglages)

1. **Synthèse** : tuiles (TVA de la période en cours, prochaine échéance, crédit reporté, nombre de contrôles),
   alerte si une échéance passée n'est pas pointée, graphique en barres groupées « TVA collectée / déductible »
   des 12 dernières périodes (une seule échelle, légende, infobulle, tableau accessible), liste « À faire »,
   carte de la période en cours, avertissement fiscal.
2. **Opérations** : liste filtrée par type (ventes, achats, frais, immobilisations), par période et par texte ;
   chaque ligne montre HT et taux, TVA collectée (+) ou déductible (−), TTC, et ses contrôles. Fenêtre de saisie :
   type, date, pièce, libellé, « saisir à partir du HT ou du TTC », taux (liste + autre taux), TVA calculée et
   modifiable, aperçu des écarts.
3. **Périodes** : cartes par période (collectée, déductible, crédit antérieur, acomptes au simplifié, à payer ou
   crédit, statut). Fenêtre de période : détail par taux (base HT, TVA, nombre d'opérations), déductible biens et
   services / immobilisations, calcul du solde, pointage (déclarée le, payée le, montant déclaré, remboursement
   demandé, note), TVA de référence et paiement des acomptes au simplifié.
4. **Échéances** : CA3 (ou acomptes et CA12), statut fait / période en cours / bientôt (10 jours) / en retard /
   à venir, boutons « Déclarée » et « Payée » (date du jour), filtre « À faire / Toutes ».
5. **Contrôles** : à corriger, à vérifier, pour info ; chaque point renvoie à l'opération, à la période ou au pointage.
6. **Réglages** : société ; « Régime, taux et échéances » (régime, début du suivi, crédit initial, jour d'échéance
   CA3, seuil du trimestriel, clôture, acomptes, dispense, CA12, fin annoncée du simplifié, liste des taux,
   seuils des contrôles, **sources avec statut « vérifié / à vérifier » et date de vérification**, retour aux
   valeurs par défaut) ; exports CSV (opérations, bilan des périodes, échéancier) ; import CSV ; copie JSON ;
   retrait des opérations anciennes (le crédit reporté à cette date devient le crédit initial) ; compte ; « Sur
   téléphone » ; à propos (cas non gérés).

Premier lancement en 2 étapes (bienvenue avec avertissement fiscal, puis société, régime, début du suivi, crédit
initial, jour d'échéance, clôture). Démo `?demo` : menuiserie fictive au réel normal mensuel, onze mois relatifs à
aujourd'hui, trois mois d'investissement (crédit reporté cinq périodes), une CA3 déclarée non payée, la suivante à
faire bientôt, un taux de 8 %, une TVA fausse de 2,50 €, un achat saisi après la déclaration de son mois (qui
fait apparaître un crédit non imputé).

## Base intégrée (`templates/tva/donnees.js`)

Réglages par défaut, trois régimes, quatre types d'opérations, couleurs, conseils et **sources** (sujet, texte,
statut). Aucune URL, aucune marque, aucune donnée de démo.

| Valeur par défaut | Source | Statut |
|---|---|---|
| Taux 20 %, 10 %, 5,5 %, 2,1 % (+ 0 % exonéré) | economie.gouv.fr, fiche du 11/12/2025 ; BOFiP BOI-TVA-LIQ-40 (2,1 %, CGI art. 281 octies) ; CGI art. 278, 279, 278-0 bis | vérifié le 14/11/2026 |
| CA3 mensuelle ; trimestrielle si TVA exigible annuelle < 4 000 € | Notice du formulaire 3310-CA3-SD 2026 (impots.gouv.fr) | vérifié |
| Échéance CA3 : jour 15 par défaut | impots.gouv.fr : entre le 15 et le 24 selon forme juridique, département, SIREN ou initiale | **à vérifier** pour chaque entreprise (paramètre) |
| Acomptes 55 % (juillet) et 40 % (décembre), dispense sous 1 000 €, jour 15 | Sources secondaires (cabinets, sites spécialisés) | **à vérifier** |
| CA12 : 2e jour ouvré après le 1er mai (5 mai 2026) ; 3 mois après une clôture décalée | Sources secondaires | **à vérifier** |
| Fin du régime simplifié au 1er janvier 2027 | Loi n° 2025-127 du 14/02/2025 (LF 2025), art. 38, d'après sources secondaires | **à vérifier** (paramètre `finSimplifie`) |
| Report des échéances au jour ouvrable suivant | Sources secondaires | **à vérifier** |
| Facturation électronique | Calendrier non repris dans l'outil | **à vérifier** |

## Calculs (règles pures, `templates/tva/regles.js`, `window.TVA`)

- **Montants en centimes entiers** ; HT → TVA = arrondi(HT × taux) au centime le plus proche (demi-centime vers
  l'extérieur) ; TTC → HT = arrondi(TTC / (1 + taux)), TVA = TTC − HT.
- **Écarts** : TVA saisie − HT × taux au-delà de la tolérance (0,01 € par défaut) ; HT + TVA ≠ TTC.
- **Périodes** : mois, trimestre civil, ou exercice (12 mois après le mois de clôture) ; du début du suivi à la
  période d'aujourd'hui ou de la dernière opération.
- **Bilan chaîné** : nette = collectée − déductible (biens et services + immobilisations) − crédit antérieur ;
  à payer = max(0, nette), crédit = max(0, −nette) ; crédit reporté = crédit − remboursement demandé (plafonné).
- **Réel simplifié** : TVA de référence = collectée − déductible biens et services de l'exercice précédent (ou
  saisie) ; acomptes = référence × 55 % et × 40 % (sauf dispense) ; solde CA12 = nette − acomptes versés.
- **Échéances** : CA3 au jour paramétré du mois suivant (ramené au dernier jour du mois) ; acomptes au jour
  paramétré des 7e et 12e mois de l'exercice ; CA12 au 2e jour ouvré après le 1er mai (ou jour fixe, ou délai
  après clôture) ; report au jour ouvrable suivant (week-ends et 11 jours fériés métropolitains).
- **Contrôles** : TVA ≠ HT × taux ; HT + TVA ≠ TTC ; taux absent de la liste ; opération avant le début du suivi ;
  opération future ; opération saisie après la déclaration de sa période ; échéance passée non déclarée, non
  payée, acompte non versé ; montant déclaré ≠ calcul (ou crédit antérieur non imputé) ; déductible > collectée
  N périodes de suite (3) ; crédit reporté N périodes de suite (3) ; seuil du trimestriel dépassé ; exercice
  ouvert après la fin annoncée du simplifié ; TVA de référence manquante.
- **CSV** : export point-virgule, virgule décimale, BOM, formules neutralisées ; import tolérant (séparateur,
  dates françaises, montants « 1 234,56 € », colonnes reconnues par leur titre, calcul des colonnes manquantes,
  doublons ignorés).

Tests : `outils/templates/tva.test.mjs` (13 tests).

## Risques

- **Fiscal** : un utilisateur pourrait prendre le calcul pour une déclaration. Avertissement visible (premier
  lancement, synthèse, périodes, échéances, contrôles, pied de page, page catalogue, fiche Gumroad).
- **Données datées** : taux, seuils et calendriers changent (réforme du simplifié en 2027, recodification du CGI,
  facturation électronique). Tout est paramétrable, sources et date affichées ; revue annuelle nécessaire.
- **Cas non gérés** : autoliquidation, TVA sur marge, prorata, intracommunautaire, outre-mer, TVA non récupérable
  (carburant, véhicules de tourisme…) : affiché dans « À propos » et la FAQ ; l'utilisateur saisit la part déductible.
- **Date d'exigibilité** : l'outil range l'opération à la date saisie ; l'aide rappelle livraison / encaissement.

## Points à faire valider par Quentin

1. Prix 19 €, nom « Suivi de TVA », permalien proposé `suivi-tva`, catégorie Gumroad (`business-and-money`).
2. Rattachement au thème « Indépendants » du catalogue (pas de puce Comptabilité ; en créer une si un 2e template
   de comptabilité arrive).
3. Valeurs par défaut « à vérifier » : jour d'échéance 15, acomptes 55 / 40 % au 15, dispense 1 000 €, CA12 au
   2e jour ouvré après le 1er mai, fin du simplifié au 01/01/2027 et ce qui la remplace.
4. Règle de base des acomptes (collectée − déductible biens et services de l'exercice précédent) et contrôle du
   seuil trimestriel calculé sur la TVA nette des 4 derniers trimestres.
5. Seuils des contrôles (3 périodes) et tolérance de 0,01 €.
6. Garder ou non un modèle tableur en plus de l'application (question ouverte dans `IDEES.md`).

## Choix d'implémentation (14/11/2026)

Application seule (pas de tableur) avec export et import CSV ; pas de création de déclaration ni de numéros de
lignes CA3 (l'outil donne bases et TVA par taux) ; pointage par période ; changement de régime sans perte des
pointages (clés différentes par régime) ; aucune connexion externe.
