# T48 · Suivi des congés et absences

Slug `conges`, préfixe `CNG` (clés locales `qme-cng-*`, règles `window.CNG`), prix prévu 19 €, permalien
Gumroad prévu `suivi-conges-absences`, catégorie Gumroad `business-and-money/management-and-leadership` (celle de
l'onboarding salarié), taille S, priorité P2.
Origine : backlog de Quentin n° 24 (ligne T48 de `IDEES.md` : soldes, demandes, calendrier d'équipe,
chevauchements ; règles d'acquisition paramétrables). Fiche rédigée le 14/11/2026. Marques de risque :
**daté** (règles légales et conventionnelles : paramètres sourcés, datés, modifiables), **RGPD**
(données de salariés, aucune donnée de santé). Avertissement « outil d'aide, la convention collective et
le Code du travail font foi » dans l'application, la page catalogue et la fiche Gumroad.

## Pour qui

TPE de 2 à 30 salariés sans logiciel RH (SIRH) : le dirigeant ou l'office manager qui tient les congés
sur un tableur ou un calendrier mural, recalcule les soldes à la main et découvre trop tard que deux
personnes de la même équipe partent la même semaine. Distinct de l'**onboarding / offboarding** (T47,
checklists d'arrivée et de départ) et du **planning Gantt** : ici, uniquement les absences et les soldes.
Pas d'accès salarié : un seul gestionnaire saisit et valide.

## Promesse

Qui est là, qui part, et combien il reste : les soldes de congés calculés, les demandes validées en un
geste, et le calendrier qui signale quand trop de monde manque en même temps.

## Écrans (4 onglets + réglages)

1. **Tableau de bord** : tuiles (absents aujourd'hui, ou le prochain jour ouvré le week-end ; demandes à
   traiter ; chevauchements dans les 60 jours ; congés à prendre de l'équipe) ; demandes à traiter
   (cartes avec solde après validation, alerte de chevauchement, Valider / Refuser) ; plages de
   chevauchement (équipe, pic d'absents, noms, « demande en attente » ou « déjà validé », lien vers le
   mois du calendrier) ; absents et prochaines absences ; avertissement.
2. **Absences** : filtres À traiter, À venir, En cours, Passées, Refusées, Annulées, Toutes ; recherche ;
   chaque ligne : salarié, type (pastille couleur + lettre), dates, équipe, note, statut, chevauchement,
   demi-journée, jours décomptés ; Valider / Refuser sur les demandes. **Saisie** : salarié, type, du /
   au, demi-journées (commence l'après-midi, s'arrête à midi), statut (demandée, validée, refusée,
   annulée), aperçu en direct (jours décomptés, solde avant / après, conflit avec une autre absence du
   salarié, chevauchement d'équipe), note (masquée pour les types liés à la santé).
3. **Calendrier** : mois par mois, salariés groupés par équipe, cases colorées avec la lettre du type,
   demandes en attente hachurées, demi-journées en demi-case, week-ends et fériés grisés, ligne
   « Absents » par équipe en rouge au-delà du seuil ; filtre par équipe ; clic sur une case vide = saisie
   préremplie ; infobulle au survol et au clavier ; légende ; fériés du mois ; tableau accessible de la
   liste du mois. Défilement horizontal dans son cadre sur téléphone (colonne des noms figée).
4. **Équipe** : salariés par équipe (seuil d'absents affiché, modifiable), solde de congés payés et de
   RTT, étiquettes (absent, demandes en attente, solde négatif, sorti, données effacées) ; encadré RGPD.
   **Fiche salarié** : identité minimale, équipe, entrée, sortie, RTT par an, reliquats au début du suivi ;
   détail du solde (reliquat, acquis des périodes closes, acquis de la période en cours, ajustements, pris,
   posés, en attente, projection à la fin de la période) ; tableau de l'acquisition par période (travail,
   maladie, acquis) ; RTT ; ajustements (fractionnement, congés conventionnels, correction) ; exporter /
   effacer / supprimer.
5. **Réglages** : entreprise ; décompte en jours ouvrables ou ouvrés (propose les valeurs par défaut de
   l'unité) ; période de référence (1er juin, année civile, 1er mai, 1er avril) ; début du suivi ; jours
   travaillés ; **règles d'acquisition datées** (jours par mois, plafond, jours par mois d'arrêt maladie,
   plafond maladie, arrondi supérieur, mode RTT, date de vérification, repères et sources) ; **fériés
   chômés** (13 cases dont Alsace-Moselle, dates de l'année affichées) ; **types d'absence** (nom, lettre,
   compteur débité, effet sur l'acquisition, couleur, demande à valider, lié à la santé) ; export CSV ;
   sauvegarde JSON ; compte ; « Sur téléphone » ; données personnelles ; à propos.

Premier lancement en 2 étapes : entreprise, unité de décompte, période de référence, début du suivi et
4 conseils ; puis jusqu'à 3 équipes avec leur nombre maximal d'absents simultanés.

## Base intégrée (`templates/conges/donnees.js`)

- **Réglages par défaut** (relevés le 14/11/2026) : jours ouvrables, période du 1er juin au 31 mai,
  lundi à vendredi travaillés, 2,5 jours par mois, 30 au plus, arrêt maladie non professionnel 2 jours par
  mois et 24 au plus par période, arrondi supérieur à la clôture, 11 fêtes légales chômées, RTT au fil de
  l'année.
- **Valeurs en jours ouvrés** proposées quand on change d'unité : 2,0833 par mois, 25 au plus, 1,6667 et
  20 pour la maladie (conversion × 5/6, pratique courante, **à vérifier** selon la convention).
- **7 types d'absence** : congés payés (C), RTT (R), arrêt maladie (M, santé, acquisition « maladie »),
  événement familial (F), congé sans solde (S, n'acquiert pas), accident du travail / maladie
  professionnelle (A, santé, acquiert), autre absence (X).
- **Palette de 7 couleurs** dans un ordre fixe (validée avec le script du skill dataviz : séparation
  daltonisme ΔE ≥ 9,1, vision normale ≥ 19,6 ; trois teintes sous 3:1 sur blanc, d'où la lettre dans chaque
  case, la légende et le tableau de la liste du mois).
- 4 conseils, 6 repères juridiques, 6 sources.

## Calculs (règles pures, `templates/conges/regles.js`, `window.CNG`)

- **Pâques** (algorithme grégorien dit de Meeus / Jones / Butcher) et les 13 fériés possibles d'une année ;
  fériés chômés selon les réglages.
- **Jour ouvré** = jour travaillé de l'entreprise hors férié chômé ; **jour ouvrable** = tous les jours
  sauf dimanche et férié chômé.
- **Décompte d'une absence** (congés payés dans l'unité choisie, RTT toujours en jours ouvrés) : en jours
  ouvrables, un congé qui se termine le dernier jour travaillé de la semaine emporte le samedi (une semaine
  = 6 jours) ; demi-journées de début et de fin ; bornes pour séparer le pris du posé.
- **Période de référence** d'une date selon le mois de départ.
- **Acquisition** sur une période : prorata des jours calendaires de chaque mois de présence (entrée,
  sortie, début du suivi) ; jours d'absence validée « maladie » au taux maladie (plafonné par période),
  « non » à zéro ; total plafonné ; arrondi supérieur quand la période est close.
- **Soldes** : reliquat + acquis des périodes closes + acquis de la période en cours + ajustements − pris
  (jusqu'à hier) − posés (validés, à partir d'aujourd'hui) ; en attente et solde après demandes ;
  projection à la fin de la période. RTT : jours par an au prorata de l'année civile, ou crédités au
  1er janvier au prorata de la présence prévue.
- **Chevauchements** : par équipe, jours ouvrés où le nombre de salariés absents (validés et demandés)
  dépasse le seuil ; regroupés en plages ; vus depuis une demande. **Conflit personnel** : deux absences
  actives du même salarié qui se recouvrent, refusé à la saisie.
- **Statuts** et transitions : demandée → validée, refusée, annulée ; validée → annulée ou remise en
  attente ; refusée ou annulée → remise en attente.
- **RGPD** : effacement (prénom « Salarié », nom « effacé n », notes vidées, dates gardées), suppression
  avec les absences, export des données d'un salarié (fiche, absences, soldes).
- Export CSV (point-virgule, BOM UTF-8), normalisation tolérante des anciennes données.
- 13 tests `node --test` dans `outils/templates/conges.test.mjs`.

## Sources (vérifiées le 14/11/2026 sur code.travail.gouv.fr, site du ministère du Travail qui reproduit Légifrance)

- Code du travail, art. L3141-3 : 2,5 jours ouvrables par mois de travail effectif chez le même
  employeur, 30 jours ouvrables au plus. https://code.travail.gouv.fr/code-du-travail/l3141-3
- Art. L3141-5 : périodes assimilées à du travail effectif (congés payés, maternité, paternité, repos
  compensateurs, accident du travail et maladie professionnelle sans limite affichée, et au 7° l'arrêt
  maladie non professionnel). https://code.travail.gouv.fr/code-du-travail/l3141-5
- Art. L3141-5-1 (loi n° 2024-364 du 22/04/2024) : périodes du 7° de L3141-5, 2 jours ouvrables par
  mois, dans la limite de 24 jours ouvrables par période de référence. Application rétroactive depuis le
  01/12/2009 sous réserves (art. 37, II de la loi) : **non gérée par l'outil**.
  https://code.travail.gouv.fr/code-du-travail/l3141-5-1
- Art. L3141-7 : un nombre de jours non entier est porté à l'entier immédiatement supérieur.
  https://code.travail.gouv.fr/code-du-travail/l3141-7
- Art. R3141-4 : point de départ de la période au 1er juin à défaut d'accord (1er avril pour les
  professions affiliées à une caisse de congés). https://code.travail.gouv.fr/code-du-travail/r3141-4
- Art. L3133-1 (les 11 fêtes légales) et L3133-4 (1er mai férié et chômé).
  https://code.travail.gouv.fr/code-du-travail/l3133-1
- **Non vérifié, à vérifier** : l'équivalence en jours ouvrés (25 jours, × 5/6, et 20 jours pour la
  maladie) ; la règle du samedi décompté en jours ouvrables (pratique courante) ; l'assimilation des
  congés pour événements familiaux à du travail effectif (réglage par défaut « acquiert ») ; le report de
  15 mois et l'information du salarié après un arrêt (art. L3141-19-1 et suivants, cités par des sources
  secondaires, non gérés) ; le décompte « 4 semaines ou 24 jours = 1 mois » (art. L3141-4) remplacé par un
  prorata calendaire.

## Risques

- **Daté / conventionnel** : la loi peut changer, la convention collective ou un accord peut être plus
  favorable (taux, période, congés d'ancienneté, fractionnement) ; tout est paramétrable, avec une date
  de vérification affichée ; mise à jour de `donnees.js` si la loi change.
- **Calcul simplifié** : prorata calendaire, pas de règle de l'équivalence « 4 semaines / 24 jours », pas
  de calcul automatique des jours de fractionnement (saisis en ajustement), pas de report des congés après
  arrêt, pas d'indemnité de congés payés. Écart possible avec la paie : le gestionnaire de paie fait foi.
- **RGPD** : données de salariés hébergées en ligne avec la clé de l'acheteur ; minimisation (prénom,
  nom, équipe, dates), **aucune donnée de santé** (type seul, notes désactivées pour les types santé),
  export, effacement et suppression par salarié, rappel dans l'application. Durées de conservation :
  renvoyées au gestionnaire de paie (à vérifier).
- Concurrence : logiciels RH et de paie par abonnement ; se distinguer par l'achat unique, le calendrier
  avec seuil par équipe et les règles visibles et modifiables.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/impayes/` (connexion avec `produit: 'CNG'`, synchronisation et 409, démo
  `?demo` non mémorisée, modales, toast Annuler, export / import JSON, service worker, fenêtre « Comme une
  application » avec la clé `qme-cng-ecran-accueil`, bandeau « Bientôt en vente » vers
  `/catalogue/conges/`).
- Démo : menuiserie fictive, 3 équipes (seuil 1), 9 salariés dont une arrivée récente (solde négatif après
  une prise anticipée) et un départ ; congés pris sur deux étés, congés de fin d'année posés, 4 demandes à
  traiter (dont deux en chevauchement), une refusée, une annulée, arrêt maladie en cours, RTT, demi-journée,
  événement familial, congé sans solde, ajustement « jours de fractionnement » ; tout relatif à la date du
  jour.
- Calendrier (skill dataviz) : couleur par type dans un ordre fixe, lettre dans chaque case (identité
  jamais par la couleur seule), hachures pour les demandes (texture), infobulle au survol et au clavier,
  légende et tableau accessible.
