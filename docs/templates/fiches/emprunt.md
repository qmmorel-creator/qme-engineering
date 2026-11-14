# Fiche T85 · Capacité d'emprunt et comparateur de prêts

Cadrage délégué par Quentin (14/11/2026). Application `templates/emprunt/`, préfixe **CPT**, 15 €, catalogue
`perso`, thème « Argent ». Packs visés : « Reprendre la main sur son argent » (PAR) et « Propriétaire » (PPB).
Statut : **prêt** le 14/11/2026, mise en vente prochaine (démo libre).

## Promesse

« Combien emprunter, et à quel coût. » Savoir ce que ses revenus permettent d'emprunter, ce que coûte vraiment le
projet, et quelle offre de prêt revient le moins cher, avant de signer.

## Public

- **Primo-accédants** (seuls ou à deux) qui préparent un rendez-vous bancaire ou comparent les offres reçues.
- **Investisseurs** particuliers : revenus locatifs retenus à une part saisie, crédits en cours.
- Prescripteurs possibles : conseillers en gestion de patrimoine, agents immobiliers, associations de consommateurs,
  ADIL (à vérifier une à une, voir `communication/emprunt/prospects.md`).

## Écrans

1. **Capacité** : revenus retenus, mensualité maximale au taux d'effort saisi, montant empruntable au taux, à la
   durée, au taux d'assurance et à la quotité saisis ; détail du calcul (revenus, × taux d'effort, − crédits en
   cours, reste à vivre total et par personne, seuil facultatif) ; montant empruntable selon la durée (10, 15, 20,
   25 ans et seuil) au même taux ; encadré des seuils avec leur source.
2. **Projet** : prix, type de bien (ancien, neuf, terrain et construction), usage (résidence principale ou
   locatif), frais de notaire saisis ou estimés (hypothèse affichée), travaux, autres frais, apport ; budget total,
   besoin de financement, part de l'apport, prix maximal à la portée de la capacité ; alertes (capacité insuffisante,
   apport qui ne couvre pas les frais, apport supérieur au budget).
3. **Offres** (2 à 5) : nom, montant, durée en années, taux nominal, taux d'assurance annuel, base de l'assurance
   (capital initial ou capital restant dû), quotité, frais de dossier, garantie (type et coût), courtage, note.
   Verdict (moins chère en coût total, avertissement si montants ou durées diffèrent), tuiles, graphique en barres
   empilées (intérêts, assurance, frais), tableau côte à côte (mensualités, coûts, TAEG approché, taux d'effort,
   total remboursé), questions à poser à la banque (à cocher), repères de calcul.
4. **Amortissement** : choix de l'offre, résumé, graphique en colonnes empilées par année (capital, intérêts,
   assurance) avec infobulle et tableau accessible, tableau par année ou par mois (300 lignes pour 25 ans),
   export CSV, impression ; **remboursement anticipé** : mois, montant, « même mensualité, durée plus courte » ou
   « même durée, mensualité plus basse », indemnités au plafond légal, au montant de l'offre ou nulles ; économie
   d'intérêts et d'assurance, indemnités, gain net, durée gagnée ou nouvelle mensualité.

Socle commun : clé de licence ou code, démo (`?demo`), synchronisation et conflit 409, hors ligne, annulation par
toast, réglages (CSV du comparatif et de l'amortissement, impression, copie JSON, recommencer à zéro), fenêtre
« Comme une application ».

## Calculs (règles pures, `regles.js`, tests `outils/templates/emprunt.test.mjs`)

- Mensualité hors assurance : annuité `C × r / (1 − (1 + r)^−n)`, r = taux / 12 (même formule que `leasing`).
- Échéancier mois par mois : intérêts = capital restant dû × r arrondi au centime, dernière échéance ajustée.
- Assurance : `base × taux × quotité / 12`, base = capital emprunté (constante) ou capital restant dû du mois.
- Taux d'effort = (crédits en cours + autres charges retenues + nouvelle mensualité assurance comprise) / revenus
  retenus ; revenus = revenus nets + autres revenus + loyers × part retenue (70 % par défaut, hypothèse modifiable).
- Montant empruntable : capital dont mensualité + assurance (sur capital initial, estimation prudente) tient dans la
  mensualité maximale ; arrondi à l'euro inférieur. Sans taux saisi : rien n'est affiché.
- Coût total du crédit = intérêts + assurance + frais de dossier + garantie + courtage (hors notaire).
- **TAEG approché** : taux actuariel annuel `(1 + i)^12 − 1`, i mensuel tel que montant − frais = Σ échéances
  assurance comprise actualisées ; présenté partout comme une estimation, le TAEG de l'offre fait foi.
- Remboursement anticipé : versement après l'échéance du mois choisi ; durée recalculée (mensualité gardée) ou
  mensualité recalculée sur la durée restante ; indemnités = min(6 mois d'intérêts sur le montant remboursé, 3 % du
  capital restant dû avant remboursement), paramètres modifiables, ou montant saisi, ou aucune.

## Données datées et sources

| Donnée | Valeur | Source | Vérifiée |
|---|---|---|---|
| Taux d'effort maximal | 35 %, assurance comprise | Décision D-HCSF-2021-7 du 29/09/2021 (HCSF), applicable depuis le 01/01/2022, page HCSF d'economie.gouv.fr ; maintien en 2026 relevé dans la presse spécialisée | 14/11/2026, **modifiable** |
| Durée maximale | 25 ans (27 dans certains cas de neuf) | Même décision | 14/11/2026, **modifiable** |
| Indemnités de remboursement anticipé | min(6 mois d'intérêts, 3 % du capital restant dû) ; exonérations L313-48 | Code de la consommation, articles L313-47, L313-48 et R313-25 | 14/11/2026 (texte lu sur des reprises du code ; **à relire sur Légifrance**), **modifiable** |
| Frais de notaire estimés | 8 % ancien, 3 % neuf | Hypothèse : haut des ordres de grandeur couramment donnés (7–8 % et 2–3 %) | 14/11/2026, présentée comme hypothèse, **modifiable** ou montant saisi |

Aucun taux de crédit, taux d'assurance, frais de dossier ou coût de garantie intégré : tout est saisi.

## Risques et garde-fous

- **Argent** : avertissement sur chaque vue, la page du site et la fiche Gumroad : simulation qui ne remplace pas le
  conseil d'un professionnel du crédit ; l'offre de prêt écrite, son TAEG et son tableau d'amortissement font foi.
- Pas de « conseil » ni de recommandation de banque ; aucun nom de banque réel dans la démo.
- Les seuils HCSF peuvent évoluer (la Fédération bancaire française demande un assouplissement, octobre 2026) :
  revérifier à chaque mise à jour annuelle (`donnees.js`, `version`).
- Confidentialité : démo entièrement fictive (Camille et Sam, banques inventées). Données de l'acheteur : revenus et
  charges, enregistrés en ligne liés à la clé, comme les autres templates d'argent (budget, dettes).

## Hors champ (V1)

Prêts à taux variable, prêt à taux zéro et prêts aidés, lissage de plusieurs prêts, différé d'amortissement,
modulation des échéances, calcul fiscal de l'investissement locatif, restitution partielle des cautions.
Version anglaise : en attente.
