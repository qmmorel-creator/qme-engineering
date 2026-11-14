# T34 · Tableau de bord de pilotage PME

Slug `pilotage-pme`, préfixe `TDB` (clés locales `qme-tdb-*`, règles `window.TDB`), prix prévu 39 €,
permalien Gumroad prévu `tableau-de-bord-pme`, catégorie Gumroad prévue
`business-and-money/management-and-leadership` (à confirmer), taille M, priorité P2. Origine : backlog de
Quentin n° 08 (ligne T34 de `IDEES.md` : KPI mensuels, objectifs, écarts, graphiques, saisie simple ; jeu de
KPI types CA, marge, pipe, charge). Format tranché : **application web** (pas de modèle tableur). Fiche
rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de validation à
attendre). Catalogue : `data-pour="pro"`, thème `independants` (`--c:var(--jaune)`), comme la trésorerie
prévisionnelle. Marques de risque : **comptable** (outil de pilotage, pas un logiciel comptable : les
valeurs sont celles que le dirigeant saisit, approchées, hors taxes). **Confidentiel vérifié** : aucun
tableau de bord interne d'origine professionnelle repris ; la bibliothèque d'indicateurs est rédigée pour
QME à partir de définitions de gestion courantes (marge brute, point mort, délai de paiement, taux
d'absentéisme…), sans chiffre de référence.

## Pour qui

Dirigeants de TPE et de PME (de 1 à 50 personnes environ) qui pilotent « au ressenti » ou dans un tableur
refait chaque mois : chiffre d'affaires connu, mais marge, trésorerie, charge de l'équipe et qualité
suivies de loin ; objectifs annuels fixés en janvier et jamais revus ; comité de direction ou point mensuel
avec l'associé, le banquier ou l'expert-comptable préparé à la main. Aussi : responsables d'agence, de
centre de profit ou d'association employeuse.

Distinct de la **Trésorerie prévisionnelle 12 mois** (T42) : celle-ci prévoit les flux de trésorerie ;
ici, une dizaine à une trentaine d'indicateurs mensuels de tous les domaines, face à leurs objectifs. Distinct
du **Coût de revient** (T37) : aucun calcul de prix.

## Promesse

Tes chiffres du mois face à tes objectifs, en dix minutes de saisie : écarts, tendances et alertes
calculés, et une revue mensuelle prête à imprimer.

## Base intégrée (ce qui fait la valeur)

1. **Bibliothèque de 45 indicateurs types** en 6 domaines : commercial, finances, trésorerie, ressources
   humaines, production et activité, qualité. Pour chacun : définition, formule, sens de lecture (« plus
   haut est mieux », « plus bas est mieux », « au plus près de la cible »), où trouver le chiffre, conseil
   d'interprétation, unité, mode de cumul sur l'exercice (somme des mois, moyenne, dernier mois connu),
   tolérance proposée. **Aucun ratio sectoriel de référence** : les objectifs sont ceux du dirigeant.
2. **Indicateurs calculés** à partir des indicateurs saisis : taux de marge brute, résultat de gestion,
   point mort, flux de trésorerie net, autonomie de trésorerie (mois de charges fixes), délai moyen de
   paiement clients (approché), taux de transformation des devis, taux de charge, taux d'absentéisme,
   taux de rotation du personnel, chiffre d'affaires par ETP, taux de service, taux de réclamation (14 au
   total). Ajouter
   un indicateur calculé ajoute aussi ceux qu'il utilise.
3. **5 jeux de départ** par activité (services et conseil, commerce et négoce, artisanat et BTP, industrie
   et atelier, généraliste) qui cochent une douzaine d'indicateurs pertinents, modifiables ensuite.
4. Conseils de pilotage (une revue par mois, peu d'indicateurs, un responsable par indicateur, objectifs
   répartis selon la saisonnalité).

## Écrans (5 onglets + réglages)

1. **Tableau de bord** du mois choisi : tuiles par domaine (valeur, objectif, écart, statut avec icône et
   libellé : atteint, à surveiller, en alerte, sans objectif ; mini-courbe des 12 derniers mois ; flèche de
   tendance favorable ou défavorable), alertes en tête, filtre par domaine, synthèse (nombre d'indicateurs
   par statut).
2. **Saisie** du mois : un champ par indicateur saisi, groupé par domaine, avec le mois précédent et le même
   mois de l'an dernier en rappel ; indicateurs calculés mis à jour en direct ; « Entrée » passe au champ
   suivant ; mois incomplet signalé.
3. **Indicateurs** : liste des indicateurs suivis ; fiche détaillée (courbe sur 12 mois : réel, objectif,
   année précédente ; tableau mois par mois ; cumul de l'exercice et objectif cumulé ; projection de fin
   d'exercice au rythme actuel ; tendance sur 3 mois ; variation sur un an ; définition, formule, sens de
   lecture) ; **bibliothèque** pour en ajouter ; indicateur personnalisé (saisi ou calculé : rapport ou
   différence de deux indicateurs).
4. **Objectifs** de l'exercice : objectif annuel par indicateur et répartition sur 12 mois (égale,
   saisonnière d'après l'année précédente, ou mois par mois) ; total contrôlé ; seuils (tolérance en % de
   l'objectif, plancher ou plafond absolu, par exemple une trésorerie minimale).
5. **Revue mensuelle** imprimable (A4) : synthèse des statuts, tableau par domaine (mois, cumul, écart,
   tendance), faits marquants, décisions et actions (responsable, échéance, statut) avec reprise des
   actions ouvertes des mois précédents ; export CSV de la revue et de toutes les saisies.

Réglages : entreprise, mois de début d'exercice, export / import JSON, déconnexion, « Sur téléphone ».

## Calculs (règles pures, `regles.js`, tests `outils/templates/pilotage-pme.test.mjs`)

- Mois `AAAA-MM` ; exercice de 12 mois à partir du mois de début choisi (janvier par défaut).
- Valeur d'un mois : saisie, ou calcul (rapport `a ÷ b × facteur`, différence `a − b`), récursif, sans
  boucle ; vide si une composante manque ; division par zéro → vide.
- Cumul sur une période : somme, moyenne des mois saisis, ou dernier mois connu ; pour un indicateur
  calculé, calcul refait sur les cumuls des composantes (taux de marge cumulé = marge cumulée ÷ CA cumulé,
  jamais la moyenne des taux).
- Répartition de l'objectif annuel (indicateurs cumulés en somme) : égale, saisonnière (poids des mois de
  l'année précédente, égale à défaut), manuelle ; arrondi au plus fort reste pour que la somme tombe juste.
  Indicateurs de niveau (taux, trésorerie, effectif) : l'objectif annuel est la cible de chaque mois.
- Statut : atteint si l'objectif est atteint dans le bon sens ; « à surveiller » si l'écart défavorable
  reste dans la tolérance (10 % par défaut) ; « en alerte » au-delà, ou si un plancher ou un plafond est
  franchi ; « cible » : écart dans un sens ou dans l'autre.
- Tendance : moyenne des 3 derniers mois face aux 3 précédents, stable sous 2 % de variation ;
  favorable ou défavorable selon le sens de lecture.
- Projection de fin d'exercice (indicateurs en somme) : cumul réel ÷ part de l'objectif annuel déjà
  écoulée ; à défaut d'objectif, rythme mensuel moyen × 12.

## Démo

PME fictive de services techniques (« Exemple Services », 14 ETP, 26 indicateurs suivis) : exercice civil, année
précédente complète, mois de l'exercice en cours saisis jusqu'au mois dernier ; au moins un indicateur
atteint, à surveiller, en alerte, sans objectif, une valeur manquante, une trésorerie sous son plancher un
mois, des actions ouvertes et faites dans les revues. Données relatives à aujourd'hui.

## Risques et limites

- Pas un logiciel comptable : chiffres saisis par le dirigeant, approchés, hors taxes ; le résultat
  comptable relève de l'expert-comptable (dit dans l'application, la page catalogue et la fiche Gumroad).
- Délai de paiement clients approché sur le CA HT du mois (surestimé si les créances sont TTC : le dire).
- Aucune connexion à une banque, une comptabilité ou un CRM (règle « aucune automatisation »).
- Données de salariés : aucune donnée nominative, seulement des totaux (effectif, heures, départs).
