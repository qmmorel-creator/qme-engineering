# Fiche T95 · Rentabilité d'un investissement locatif

Cadrage délégué par Quentin (14/11/2026). Application `templates/investissement-locatif/`, préfixe **RNT**, 15 €,
catalogue `perso`, thème « Argent ». Pack visé : « Propriétaire » (PPB). Permalien Gumroad prévu
`rentabilite-investissement-locatif`. Statut : **prêt** le 14/11/2026, mise en vente prochaine (démo libre).

## Promesse

« Ce bien, rentable ou pas ? » Savoir, avant de faire une offre, ce qu'un bien locatif rapporte vraiment (brut et net
de charges), ce qu'il coûtera ou rapportera chaque mois (cash-flow avant impôt, effort d'épargne) et jusqu'à quel prix
il reste intéressant, en comparant plusieurs biens.

## Public

- **Particuliers** qui étudient l'achat d'un bien locatif : premier investissement ou deuxième bien, location nue,
  meublée, colocation ou location saisonnière.
- Prescripteurs possibles : clubs et associations d'investisseurs particuliers, formateurs en investissement
  immobilier, conseillers en gestion de patrimoine, courtiers, agents immobiliers (voir
  `communication/investissement-locatif/prospects.md`, organismes à vérifier un à un).

## Écrans

1. **Comparatif** (jusqu'à 5 biens) : verdict (meilleur rendement net, meilleur cash-flow s'il diffère), tuile par
   bien (net, cash-flow, brut, type, coût total ; « à compléter » avec ce qui manque), graphique en barres signées du
   cash-flow mensuel (couleur du bien, valeur signée, infobulle et tableau accessible), tableau côte à côte, **prix
   maximal** de chaque bien pour le rendement visé (brut ou net, saisi), encadré « Hors calcul : l'impôt », export CSV.
2. **Analyse** d'un bien (sélecteur) : 4 tuiles (brut, net, cash-flow mensuel, effort d'épargne), alertes (cash-flow
   négatif, vacance nulle, entretien nul, notaire estimé), **cascade mensuelle** loyers → vacance → charges → crédit →
   cash-flow, détail du calcul en trois colonnes (acquisition, loyers et charges, financement et résultat : capital
   remboursé la 1re année, cash-flow ÷ apport, prix et loyer au m² calculés depuis la saisie), prix maximal, 7 ou 8
   points à vérifier avant d'acheter (à cocher, par bien), repères de calcul.
3. **Sensibilité** : loyer − 10 %, vacance + 1 mois (30 nuits de moins en saisonnier), taux + 1 point (crédit
   seulement), les trois à la fois ; barres signées, tableau (rendement net, cash-flow, écart, effort) ; tableau de tous
   les biens face aux mêmes chocs.
4. **Fiche d'analyse** : une page imprimable (ou PDF depuis le navigateur) : chiffres clés, acquisition, loyers,
   charges, financement, sensibilité, prix maximal, hypothèse de notaire, note, fiscalité hors calcul, avertissement.

Saisie d'un bien dans une fenêtre unique (le bien, acquisition, loyers, charges, financement) avec aperçu en direct ;
dupliquer (« variante » : prix négocié, autre durée, autre type de location), supprimer avec annulation.
Socle commun : clé de licence ou code, démo (`?demo`), synchronisation et conflit 409, hors ligne, annulation par
toast, réglages (CSV, impression de la fiche, copie JSON, recommencer à zéro), fenêtre « Comme une application ».

## Calculs (règles pures, `regles.js`, tests `outils/templates/investissement-locatif.test.mjs`)

- **Coût total d'acquisition** = prix + notaire + agence + travaux + mobilier + frais bancaires + autres frais.
  Notaire : montant saisi, ou prix × pourcentage (hypothèse affichée).
- **Loyers** : théoriques = Σ loyers mensuels des lots × 12 (un lot par chambre en colocation) ; encaissés = loyers ×
  (12 − vacance) / 12, vacance en mois par an au demi-mois. Saisonnier : prix moyen d'une nuit × nuits louées par an
  (les nuits louées tiennent lieu de vacance).
- **Charges** (par an) : taxe foncière (obligatoire, 0 si aucune), copropriété non récupérable, assurance PNO,
  assurance loyers impayés, gestion ou conciergerie en % des loyers encaissés, entretien, énergie-internet-ménage,
  autres.
- **Crédit** (formules de `templates/emprunt/`) : montant = saisi ou coût total − apport ; mensualité
  `C × r / (1 − (1 + r)^−n)` ; assurance `capital × taux × quotité / 12` sur capital initial, ou moyenne de la
  1re année sur capital restant dû. Comptant : aucune mensualité.
- **Rendement brut** = loyers théoriques / prix d'achat. **Rendement net de charges** = (loyers encaissés − charges) /
  coût total. **Cash-flow mensuel avant impôt** = (loyers encaissés − charges − 12 × mensualité assurance comprise) / 12.
  **Effort d'épargne** = max(0, − cash-flow).
- **Prix maximal** : brut → loyers théoriques / cible ; net → `(revenu net / cible − F) / (1 + k)`, k = part des frais
  de notaire et d'agence dans le prix (suivent le prix), F = travaux, mobilier, frais bancaires, autres (fixes).
  Arrondi à l'euro inférieur ; « inatteignable » si négatif.
- Un bien incomplet (prix, loyer, taxe foncière, taux, durée ou assurance du crédit manquants) n'affiche **aucun**
  rendement : ce qui manque est listé (test).

## Données datées et sources

| Donnée | Valeur | Source | Vérifiée |
|---|---|---|---|
| Frais de notaire estimés | 8 % ancien, 3 % neuf | Hypothèse : haut des ordres de grandeur couramment donnés (7–8 % et 2–3 %), reprise de T85 | 14/11/2026, présentée comme hypothèse, **modifiable** ou montant saisi |

**Aucun** taux de crédit, taux d'assurance, prix au m², loyer de référence, taux d'imposition ni plafond légal intégré
(test sur la base). Les points à vérifier (encadrement des loyers, décence énergétique, location saisonnière) renvoient
à service-public.fr sans chiffre ni date.

## Fiscalité

Hors calcul, signalé sur le comparatif, l'analyse, la fiche imprimable, la page du site et la fiche Gumroad : impôt sur
le revenu et prélèvements sociaux dépendent du type de location, du régime (forfaitaire ou réel), des autres revenus et
des règles de l'année. Résultats « avant impôt » partout.

## Risques et garde-fous

- **Argent** : avertissement sur chaque vue, la page du site et la fiche Gumroad : simulation avant impôt qui **ne
  remplace pas un conseil en investissement ni un conseil fiscal** ; l'offre de prêt écrite fait foi.
- Pas de recommandation d'achat : le verdict classe les biens saisis, il ne dit pas d'acheter.
- Confidentialité : démo entièrement fictive (quatre biens sans adresse ni ville réelle, prix, loyers et taux inventés).
  Données de l'acheteur : prix, loyers, crédit, enregistrés en ligne liés à la clé, comme les autres templates d'argent.

## Hors champ (V1)

Calcul fiscal (micro-foncier, réel, LMNP…), revente et plus-value, TRI sur la durée de détention, revalorisation des
loyers et des charges, différé d'amortissement, prêts multiples, taux variable, saisonnalité mois par mois du
saisonnier (voir T64 pour l'exploitation). Version anglaise : en attente.
