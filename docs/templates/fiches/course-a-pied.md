# T97 · Plan d'entraînement course à pied

Slug `course-a-pied`, préfixe `CRS` (clés locales `qme-crs-*`, règles `window.CRS`), prix 15 €, permalien Gumroad prévu
`plan-entrainement-course-a-pied`, catégorie Gumroad prévue `fitness-and-health` (à confirmer), taille S, priorité P3,
usage `perso`. Origine : proposition validée par Quentin le 14/11/2026 (pack « Forme », PFM). Fiche rédigée le
14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de validation à attendre). Catalogue :
`data-pour="perso"`, thème `sante-et-forme` (`--c:var(--rouge)`), avec la nutrition, les habitudes et le carnet de
musculation. Marque de risque : **sport** (avertissement, pas un programme médical). **Confidentiel vérifié** : démo
d'une coureuse fictive, course fictive « Semi-marathon de Ville-Exemple », aucune donnée réelle.

## Pour qui

Coureurs amateurs qui préparent une course sur route (10 km, semi-marathon, marathon) : premier semi, premier
marathon, ou envie de progresser sur 10 km. Aujourd'hui : un plan trouvé en ligne ou dans un magazine, des allures
recopiées à la main, des séances placées sans tenir compte des jours libres, et une fatigue vue trop tard.

## Promesse

Tes allures et tes semaines, jusqu'au jour J : allures calculées depuis un chrono récent, plan placé sur tes jours,
chaque séance cochée.

## Décisions de cadrage

- **Allures** : calculées depuis le chrono de référence le plus récent (distance de 3 à 42,195 km, temps, date).
  Prédiction par la **formule de Riegel** T2 = T1 × (D2 ÷ D1)^1,06 (Riegel P. S., « Athletic Records and Human
  Endurance », American Scientist, vol. 69, n° 3, 1981, p. 285-290, référence vérifiée le 14/11/2026), exposant
  réglable de 1 à 1,2. Bases : allure marathon prédite, allure 5 km prédite, allure d'une course d'une heure (distance
  couverte en 3 600 s, réciproque de Riegel), allure de l'objectif (temps visé, sinon temps prédit). Fourchettes
  (**repères QME, présentés comme des estimations**) : récupération 1,25 à 1,35 × marathon ; footing 1,12 à 1,25 ×
  marathon ; sortie longue 1,08 à 1,20 × marathon ; seuil 0,99 à 1,03 × allure d'une heure ; fractionné 0,98 à 1,02 ×
  allure 5 km ; spécifique 0,99 à 1,01 × objectif. Aucune table VDOT ni méthode commerciale.
- **Avis sur l'objectif** : écart du temps visé au temps prédit ; < −5 % très ambitieux, −5 à −1 % ambitieux, −1 à +3 %
  réaliste, au-delà prudent. Avertissements : chrono de plus de 6 mois, extrapolation lointaine (rapport des distances
  > 4,5, la formule est souvent trop optimiste du 5 km au marathon pour un amateur).
- **Plans types originaux** (`donnees.js`) : 10 km en 8 semaines (développement, spécifique, affûtage, course), semi
  en 12, marathon en 16 (foncier, développement, spécifique, affûtage, course) ; semaine d'assimilation toutes les 3 à
  4 semaines. Chaque semaine liste 5 séances par priorité [qualité 1, sortie longue, footing, qualité 2, footing] ; à
  3 séances on garde les 3 premières, à 4 les 4. Bibliothèque de 46 séances (footings, footings avec accélérations,
  récupération, sorties longues avec ou sans fin à l'allure spécifique, seuil fractionné ou continu, fractionné à
  l'allure 5 km, allure spécifique en répétitions ou continue, activation, course). Séances décrites en minutes
  (adaptées à tous les niveaux), distances estimées d'après les allures.
- **Calendrier** : semaines du lundi au dimanche, la dernière contient la course. Placement : sortie longue sur son jour,
  séances de qualité sur les jours les plus éloignés d'elle et jamais deux jours de suite si possible, footings sur le
  reste ; semaine de la course : séances avant la course, l'activation au plus près. Course proche : le plan commence
  à la semaine correspondante (au moins 3 semaines) ; course lointaine : le plan commence plus tard (footing d'ici là).
- **Volume** : léger (× 0,85), normal, soutenu (× 1,15) sur les footings, sorties longues et récupérations.
- **Séances cochées** : prévue, faite (distance, durée, ressenti de 1 « très facile » à 5 « très dur », note) ou
  manquée. La course cochée avec son temps peut devenir le nouveau chrono de référence.
- **Adaptation simple** : semaine allégée (footings et sorties longues × 0,7 réglable, fractions × 0,6 ;
  échauffements gardés), proposée (jamais appliquée seule) quand 3 des 4 dernières séances des 14 derniers jours sont
  « dur » ou plus, ou après 2 séances manquées en 7 jours (« ne rattrape pas en doublant »). Déplacement d'une séance
  sur un jour libre de sa semaine, avec avertissements : même jour qu'une autre séance, séance difficile à côté d'une
  autre, veille de la sortie longue, hors de sa semaine ; jamais le jour de la course ou après. Recalcul des séances
  à venir quand la date, la distance ou les jours changent ; le passé et ce qui est coché restent.
- **Volume hebdomadaire** : kilomètres prévus et faits par semaine (deux séries côte à côte, palette validée avec le
  script du skill `dataviz` ; contraste du « prévu » sous 3:1 compensé par la légende, les valeurs et le tableau).
- **Impression** du plan (vue Plan, mise en page d'impression avec le détail et les allures de chaque séance) ;
  **exports** CSV, iCalendar (.ics, un événement journée par séance, lignes pliées à 75 octets) et copie JSON.
- **Aucune donnée de santé** (ni poids, ni fréquence cardiaque, ni blessure) ; le ressenti est l'effort perçu.
  Avertissement partout : ni programme médical ni avis médical, avis d'un médecin avant de commencer. Pas de règle
  d'inscription aux courses intégrée (conditions variables, datées) : renvoi à l'organisateur.
- Aucune montre ni application connectée ; aucun nom de marque, de méthode ou de plan commercial (test automatique).

## Écrans

Connexion (clé ou démo) ; premier lancement (chrono, course, disponibilité, aperçu du plan) ; **Semaine** (J-n,
suggestions, tuiles, prochaine séance avec allures, séances à cocher, semaine) ; **Plan** (phases et semaines,
alléger, imprimer, agenda) ; **Allures** (référence et historique, objectif, tableau des allures, prédictions,
explication et source) ; **Volume** (tuiles, graphique, tableau) ; **Objectif** (course, disponibilité, recalcul,
nouveau plan, plans précédents) ; Réglages (exposant, allègement, exports, sauvegarde, compte, écran d'accueil,
données personnelles, avertissement, sources).

## Démo

Coureuse fictive, semi-marathon dans 5 semaines (semaine 8 sur 12), 4 séances par semaine (mardi, jeudi, samedi,
dimanche), deux chronos de 10 km (52:30 il y a 3 mois, 50:40 il y a un mois), objectif 1:52:00. Historique simulé
avec les vraies règles : séances faites (distances ± 5 %), deux manquées, une semaine allégée, une séance passée à
cocher, séances récentes « dures » (la suggestion d'alléger s'affiche).

## Tests

`outils/templates/course-a-pied.test.mjs` (14 tests) : base (plans, séances, marques interdites, source), durées,
Riegel et réciproque, allures, avis, placement, génération (complète, raccourcie, trop proche, lointaine, saisies
invalides), durée et distance, volume et allègement, bilan et suggestions, déplacement, recalcul, normalisation,
CSV et iCalendar.

## Risques et limites

- Formule de Riegel : estimation, moins fiable en extrapolation lointaine (dit dans l'application).
- Fourchettes d'allure : repères QME, pas une norme ; à ajuster aux sensations.
- Pas de plan pour le 5 km ni l'ultra-trail (évolution possible), pas de dénivelé, pas de suivi de groupe par un
  entraîneur (sur mesure).
