# T66 · Simulateur leasing ou achat

Slug `leasing`, préfixe `VTR` (clés locales `qme-vtr-*`, règles dans `window.VTR`), prix prévu 12 € (prix
minimum de Quentin), permalien Gumroad prévu `simulateur-leasing-achat`, catégorie Gumroad
`business-and-money/personal-finance`, taille S, produit d'appel. Origine : backlog de Quentin n° 45 (ligne
T66 de `IDEES.md` : LOA, LLD, crédit, comptant : coût total, valeur résiduelle, kilométrage), outil interne
« Ma voiture en leasing » (aucune donnée reprise). Fiche rédigée le 14/11/2026. Marques de risque :
**argent** (simulation, pas un conseil financier : avertissement dans l'application, la page catalogue et la
fiche Gumroad) ; **fiscal** pour les indépendants (déductibilité, TVA, amortissement, avantage en nature :
signalés, jamais calculés). Pas de modèle tableur : application web.

## Pour qui

Particuliers et indépendants qui hésitent entre plusieurs façons de payer une voiture : ils ont un devis de
LOA, une offre de crédit, une proposition de LLD, et aucun moyen simple de les ramener au même étalon. Les
publicités affichent un loyer, pas un coût total ; la revente, le dépassement kilométrique, l'option d'achat
et l'argent immobilisé sont oubliés. Distinct de **Gestion de flotte** (T29, véhicules d'entreprise au
quotidien) et de **Remboursement de dettes** (T63) : ici, une décision d'achat, avant de signer.

## Promesse

Ta voiture, au vrai prix : le coût total net de chaque offre, côte à côte, revente et kilomètres compris.

## Écrans (4 onglets + réglages)

Plusieurs **comparaisons** (une par véhicule, 20 au plus), chacune avec ses hypothèses et jusqu'à 6 offres ;
sélecteur en tête de chaque vue, création, duplication, suppression.

1. **Comparaison** : verdict (l'offre la moins chère, son coût net, par mois, par km et l'écart avec la
   deuxième) ; une tuile par offre (coût net, par mois, par km, rang et écart, dépassement kilométrique) ;
   offres à compléter avec ce qui manque ; **graphique du coût cumulé** (décaissements mois par mois, saut
   des paiements de fin de contrat, coût net revente déduite en légende, infobulle au survol, au toucher et
   au clavier, tableau des données) ; **tableau côte à côte** des postes ; **selon ton kilométrage** (plages
   de 0 à 60 000 km/an où chaque offre est la moins chère, seuils par rapport à la moins chère, curseur
   « Et si tu roulais… » qui reclasse sans rien enregistrer) ; encadré « Indépendant ou société ? » (fiscalité
   non calculée) ; ce qui n'est pas compté ; avertissement.
2. **Offres** : une carte par offre (montants clés, alertes, coût net ou « À compléter ») ; ajout par type,
   modification avec **aperçu en direct** du coût net (et de la mensualité pour un crédit), duplication,
   suppression ; détail du calcul poste par poste.
3. **Hypothèses** : prix, durée de détention, km par an, décote (1re année puis annuelle), effet du
   kilométrage sur la valeur, entretien annuel, assurance proposée (et appliquée à toutes les offres sur
   demande), coût d'opportunité (taux de placement) ; table de la valeur de revente estimée année par année ;
   kilométrage réel face aux forfaits ; mes comparaisons ; repères ; ce qui n'est pas compté.
4. **Questions** : « ce qu'il faut demander au vendeur », par type d'offre présent (communes, crédit, LOA,
   LLD : 18 questions), chacune avec son « pourquoi » ; cases à cocher enregistrées ; copie des questions
   restantes.
5. **Réglages** : export CSV de la comparaison, sauvegarde et restauration JSON, compte, « Sur téléphone »
   (fenêtre « Comme une application »), données, à propos.

Premier lancement en 2 étapes : véhicule, prix, durée, km par an et 4 conseils ; puis les types d'offres à
comparer (les 4 cochés par défaut, à compléter avec les montants des devis).

## Base intégrée (`templates/leasing/donnees.js`)

Aucune donnée de marché (pas de prix, de taux, de cote ni de marque) : tout montant vient de l'utilisateur.
- **Hypothèses par défaut, signalées comme telles** : 48 mois, 15 000 km/an, décote 20 % la 1re année puis
  12 %/an, 0,05 €/km de valeur perdue au-delà de 15 000 km/an (regagnée en deçà), entretien 500 €/an,
  assurance 60 €/mois, coût d'opportunité désactivé.
- Libellés et phrases des 4 types, **18 questions au vendeur** (4 communes, 4 crédit, 5 LOA, 5 LLD), 4
  conseils, 5 repères (dont « Indépendants »), liste de ce qui n'est pas compté.

## Calculs (règles pures, `templates/leasing/regles.js`, `window.VTR`)

Montants en centimes, taux en % par an, durées en mois. Période N = durée de détention, aussi durée des
contrats LOA et LLD.
- **Mensualité** (formule d'annuité) : M = C × t / (1 − (1 + t)^−n), t = taux annuel / 12, C = prix − apport ;
  taux nul : C / n. **Coût des intérêts** = M × n − C. **Capital restant dû** après k mois si le crédit dure
  plus longtemps que la détention : ajouté aux paiements de fin (remboursé à la revente).
- **Valeur de revente estimée** : prix × (1 − décote₁ × mois/12) la 1re année, puis prix × (1 − décote₁) ×
  (1 − décote₂)^((mois − 12)/12), moins (km/an − km normal) × N/12 × perte par km, bornée entre 0 et le prix.
  Calculée sur le prix de la comparaison (une remise comptant ne change pas la cote).
- **Comptant** : prix de l'offre + frais au départ ; assurance et entretien chaque mois ; revente déduite.
- **Crédit** : apport + frais au départ, mensualités pendant min(n, N) mois, capital restant dû à la fin ;
  revente déduite.
- **LOA** : premier loyer + frais au départ, puis N − 1 loyers ; option levée : option d'achat payée, revente
  déduite, pas de pénalité kilométrique (en général, à vérifier au contrat) ; option non levée : kilomètres
  supplémentaires et frais de remise en état, rien à revendre.
- **LLD** : premier loyer + frais, N − 1 loyers, kilomètres supplémentaires, frais de remise en état ;
  entretien compté seulement s'il n'est pas inclus.
- **Kilomètres supplémentaires** = max(0, km réels − forfait) × N/12, au prix du km saisi.
- **Coût d'opportunité** (option) : versé au départ × ((1 + taux)^(N/12) − 1).
- **Coût total net** = décaissements (départ, mensualités ou loyers, assurance, entretien, option, capital
  restant dû, km en plus, remise en état) + coût d'opportunité − valeur de revente. **Coût mensuel
  équivalent** = net / N ; **coût au km** = net / (km/an × N/12).
- **Seuils** : coûts affines par morceaux en km ; balayage de 0 à 60 000 km/an par pas de 250 km puis
  dichotomie au km près ; plages de l'offre la moins chère ; pour chaque autre offre, kilométrage le plus
  proche où elle passe devant la moins chère.
- **Alertes** : dépassement de forfait (et son coût), forfait surdimensionné (usage < 80 % du forfait),
  forfait non saisi, crédit plus long ou plus court que la détention.
- Offre incomplète (prix, taux, durée, loyer, option levée sans montant…) : hors classement, avec ce qui
  manque. Normalisation tolérante, couleurs stables par offre, 6 offres au plus. Export CSV (point-virgule,
  BOM UTF-8).
- 13 tests `node --test` dans `outils/templates/leasing.test.mjs` (mensualités connues : 20 000 € à 5 % sur
  48 mois = 460,59 € et 2 108,32 € d'intérêts ; 10 000 € à 6 % sur 12 mois = 860,66 € ; 16 000 € à 5 % sur
  36 mois = 479,53 €).

## Sources

- Formule d'annuité d'un prêt à taux fixe et mensualités constantes : formule mathématique standard,
  vérifiée par les cas chiffrés des tests (recalcul indépendant de l'amortissement).
- Pas de taux, de barème ni de règle fiscale intégrés : rien de daté à mettre à jour.
- Repères rédigés pour QME : le TAEG doit figurer dans une offre de crédit à la consommation (Code de la
  consommation) ; formulé sans citer d'article, **à vérifier** si Quentin veut une référence précise.

## Risques

- **Argent** : simulation à partir de la saisie ; hypothèses de revente et d'entretien choisies par
  l'utilisateur ; les offres écrites et les contrats font foi. Avertissement partout.
- **Fiscal** (indépendants) : déductibilité des loyers, amortissement plafonné selon les émissions, TVA,
  avantage en nature : non calculés, signalés dans la comparaison, les repères, la FAQ et la fiche Gumroad.
- **Approximations assumées** : mensualité calculée au taux saisi (le TAEG donne une mensualité un peu plus
  élevée que le taux débiteur : l'aide du champ le dit) ; pas d'indemnités de remboursement anticipé ; pas
  d'énergie (identique d'une offre à l'autre pour un même véhicule) ; LOA levée sans pénalité kilométrique.
- Aucune marque ni modèle réel, aucune connexion à une banque, un vendeur ou un loueur.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/impayes/` (connexion avec `produit: PRODUIT`, démo `?demo` non mémorisée,
  synchronisation et 409, modales, toast « Annuler », export et import JSON, service worker, fenêtre
  « Comme une application » avec `qme-vtr-ecran-accueil` et entrée « Sur téléphone », bandeau `.bientot-demo`
  vers `/catalogue/leasing/`).
- Démo : « SUV hybride » (38 000 €, 4 ans, 18 000 km/an, apport placé à 3 %) avec comptant remisé, crédit sur
  60 mois (capital restant dû), LOA option levée (dépassement sans pénalité), LLD entretien inclus avec
  12 000 km de dépassement ; « Citadine essence » (37 mois, 9 000 km/an) avec crédit soldé à 36 mois, LOA
  rendue avec frais de restitution, LLD à compléter. Questions déjà cochées.
- Graphique (skill dataviz) : palette catégorielle de 6 couleurs validée par le script du skill (toutes les
  vérifications passent ; écart CVD de 7,2 entre vert et terracotta, d'où l'encodage secondaire : tirets
  pour LOA et LLD, légende, étiquettes en bout de ligne sur ordinateur, tableau des données) ; `viewBox`
  selon la largeur ; graduations comptées depuis la fin.
