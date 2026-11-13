# T12 · Remboursement de dettes

Slug `dettes`, préfixe `DTT` (clés locales `qme-dtt-*`), prix prévu 10 € (achat unique), permalien Gumroad
prévu `remboursement-dettes`, catégorie Gumroad `business-and-money/personal-finance`, taille S, priorité P2.
Origine : liste initiale (12/11/2026). Thème du site : « Pour la maison », colonne « Argent ».
Statut : prêt à la mise en vente (démo ouverte, fiche Gumroad à créer).

## Pour qui

Particuliers, couples et familles qui remboursent plusieurs dettes en même temps (crédit à la consommation,
crédit renouvelable, prêt auto, prêt d'un proche, découvert, retard de loyer…) et veulent savoir **quand
ils en auront fini**, dans quel ordre rembourser et ce que coûte chaque choix. Sans connexion bancaire,
sans abonnement.

## Écrans (5 onglets)

1. **Plan** : phrase d'en-tête « Libre de dettes en *mois année* » (dans *n* mois, intérêts sur tout le
   plan, budget) ; choix de la méthode (boule de neige, avalanche, ordre personnalisé) avec sa règle ;
   carte **« Ce mois-ci »** (paiement de chaque dette, dette prioritaire, versement, dette soldée ce mois,
   pointé ou non) ; alertes ; 4 tuiles (reste à rembourser d'après le pointage, déjà remboursé, intérêts à
   venir, dettes soldées) ; **graphique du solde restant** (plan, repère « minimums seuls », points du réel
   pointé) ; **ordre de remboursement** (rang, mois où chaque dette est soldée, intérêts, progression).
2. **Échéancier** : tableau mois par mois (paiement, intérêts, capital remboursé, reste dû, événements :
   dette soldée, versement), détail par dette en dépliant chaque mois ; total ; « Copier le résumé »
   (texte), « Exporter (CSV) », « Imprimer » ; explication du calcul.
3. **Dettes** : budget mensuel (minimums + surplus, jauge), cartes des dettes (type, reste dû, taux,
   minimum, intérêts du premier mois, mois de fin, alerte mensualité insuffisante), **ordre personnalisé**
   (flèches monter/descendre, « partir de la boule de neige / de l'avalanche »), « Où trouver les
   chiffres » pour chaque type utilisé.
4. **Comparer** : graphique du solde restant des trois méthodes et du repère « minimums seuls » ; tableau
   (fin, durée, intérêts, première dette soldée, gain face aux minimums seuls, bouton « Choisir ») ;
   **versements exceptionnels** (liste, ajout, effet en intérêts et en mois gagnés) ; **« Et si je
   versais… »** (simulation sans enregistrer, puis « Ajouter au plan ») ; méthodes en bref, 8 conseils,
   glossaire, mode de calcul.
5. **Pointage** : mois par mois, chaque paiement prévu : « Payé *x* € », « Autre montant », « Pas payé » ;
   « Tout payé comme prévu » ; résumé (prévu, payé, écart sur les paiements pointés) ; tableau **écart au
   plan** des mois entièrement pointés (prévu, payé, écart, écart cumulé, reste dû prévu et réel) ;
   « Recaler le plan sur le réel ».

Premier lancement : prénom, ajout des dettes par type (modale), puis budget mensuel (prérempli avec le
total des minimums, refusé s'il est inférieur) et méthode.

## Base intégrée (`donnees.js`)

- **11 types de dettes** (crédit conso, renouvelable, prêt auto, travaux, étudiant, prêt d'un proche,
  découvert, carte ou paiement fractionné, retard de loyer ou de facture, impôts en plan de paiement,
  autre), chacun avec **où trouver les chiffres** et **les points d'attention** (taux débiteur et TAEG,
  différé, LOA qui n'est pas un prêt, échéance du renouvelable qui varie, indemnités de remboursement
  anticipé…). Types souvent sans intérêts : taux prérempli à 0.
- **3 méthodes** et le repère « minimums seuls », avec règle et explication ; couleurs fixes validées
  (validateur dataviz : bande de luminance, chroma, séparation daltonisme toutes paires ≥ 9, contraste
  ≥ 3:1 sur blanc) : boule de neige `#2A63B0`, avalanche `#C0502F`, ordre personnalisé `#1E8A6E`,
  minimums seuls `#8C857A` (gris neutre, repère).
- Mode de calcul (5 points), glossaire (8 termes), conseils (8).
- **Aucun taux, barème ni seuil figé** : l'utilisateur saisit les chiffres de ses contrats.

## Calculs (`regles.js`, fonctions pures testées)

- Montants en **centimes entiers** ; taux en % annuel.
- **Intérêts du mois = capital restant × taux annuel ÷ 12, arrondi au centime** (calcul mensuel simple,
  expliqué dans l'application, avec ses limites : intérêts au jour près, assurance et frais ignorés).
- Chaque mois : intérêts ajoutés, puis mensualités minimales, puis versements fléchés, puis le reste du
  budget sur la dette prioritaire. **Report de la mensualité libérée** : le budget reste constant, donc ce
  que coûtait une dette soldée passe à la suivante.
- Ordre de priorité figé au départ : boule de neige (plus petit solde, puis taux le plus élevé), avalanche
  (taux le plus élevé, puis plus petit solde), personnalisé (ordre choisi, les autres en boule de neige).
- Repère « minimums seuls » : chaque dette reçoit sa mensualité, sans report.
- Contrôles : budget inférieur au total des minimums (refus avec le manque) ; **mensualité qui ne couvre
  pas les intérêts du mois** (alerte, avec le montant à ajouter) ; plan sans fin (au-delà de 600 mois).
- Effet des versements exceptionnels : même plan avec et sans eux (intérêts économisés, mois gagnés).
- Suivi réel : soldes rejoués avec les paiements pointés ; écart au plan mois par mois ; recalage (nouveau
  départ le mois suivant le dernier mois pointé, capitaux = soldes réels, historique gardé).
- Export CSV (point-virgule, virgule décimale, BOM pour les tableurs).

## Sources et dispositifs cités

- Calcul : aucune source externe (formule d'intérêts simples mensuels, rédigée pour QME).
- Avertissement (application, page catalogue, fiche Gumroad) : outil d'aide, ne remplace pas un conseil
  professionnel ; en cas de difficulté, **point conseil budget** (dispositif gratuit labellisé par l'État,
  ministère chargé des solidarités) ou **commission de surendettement** du département (secrétariat assuré
  par la Banque de France). Existence et noms vérifiés le 13/11/2026 sur les sites publics
  (solidarites.gouv.fr, banque-france.fr) ; mention textuelle, sans lien. **À revérifier chaque année**
  (le dispositif PCB est annoncé en refonte, labels 2027-2029).

## Risques

- **Conseil financier** : l'outil ne recommande pas d'emprunter, de racheter un crédit ni de déposer un
  dossier ; il calcule. Avertissement visible sur chaque vue principale.
- **Écart avec le tableau d'amortissement** du prêteur (calcul au jour près, assurance) : expliqué ;
  pointage et recalage permettent de repartir des vrais soldes.
- **Publics fragiles** : ton sobre, pas de promesse ; renvoi textuel vers les dispositifs publics gratuits.
- **Données personnelles** de l'acheteur seulement (montants de ses dettes), hébergées en ligne avec sa
  clé comme les autres templates ; aucune donnée bancaire, aucune connexion.
- Libellés de l'ajout à l'écran d'accueil : repris du socle commun (à revérifier si les navigateurs changent).
