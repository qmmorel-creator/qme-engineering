# T07 · Carnet de musculation et cross-training

Slug `musculation`, préfixe `MSC` (clés locales `qme-msc-*`, règles `window.MSC`), prix prévu 19 € (backlog
n° 48, **à confirmer par Quentin**), permalien Gumroad prévu `carnet-musculation-cross-training`, catégorie
Gumroad prévue `fitness-and-health` (à vérifier dans la liste des catégories au moment de créer la fiche),
taille M, priorité P2.
Origine : liste initiale (T07) et backlog de Quentin n° 48 (ligne T07 de `IDEES.md` : séances, WOD, volume,
records, progression, chronomètre ; 150 exercices par groupe musculaire). Fiche rédigée le 14/11/2026.
Marques de risque : **sport** (avertissement : ni programme d'entraînement ni avis médical), **marques et
droits** (aucune marque, aucun WOD de référence nommé), **aucune donnée de santé** (choix de conception).

## Pour qui

Pratiquants de musculation et de cross-training (salle, box, à la maison) qui notent leurs séances dans un
carnet papier, les notes du téléphone ou un tableur, et ne retrouvent ni leurs charges de la dernière fois
ni leurs records. Coachs pour leur propre pratique, ou pour conseiller l'outil à leurs adhérents (un carnet
par personne : pas d'espace « coach » avec plusieurs athlètes). Distinct du **suivi d'habitudes** (T-HBT,
cocher des routines) et de la **nutrition** (NTR, repas et dépense) : ici, uniquement les performances.

## Promesse

Chaque série notée, chaque record vu : les séances et les WOD, le volume de la semaine, les records
détectés tout seuls et un minuteur pour l'AMRAP, l'EMOM, le For Time et les intervalles, même sans réseau.

## Écrans (5 onglets + réglages)

1. **Séances** : tuiles (séances de la semaine et semaines d'affilée, tonnage et écart avec la semaine
   précédente, séries, records sur 30 jours) ; derniers records (valeur et valeur précédente) ; séances
   groupées par semaine (date, titre, résumé, format, score du WOD, étiquette « Record » ou « Score à
   saisir ») ; boutons Séance, WOD, Depuis un modèle. **Éditeur de séance** : date, durée facultative,
   titre (par défaut : les exercices ou le format), exercices dans l'ordre (monter, retirer), séries avec
   les champs de la mesure (charge et reps, reps, temps, distance et temps, calories et temps), RPE
   facultatif, « dernière fois » sous chaque exercice, 1RM estimé de la séance comparé au record en direct ;
   ajouter un exercice reprend les séries de la dernière fois. **Éditeur de WOD** : format (AMRAP, EMOM,
   For Time, intervalles), paramètres (durée, intervalle d'EMOM, tours, temps limite, travail et repos),
   mouvements (reps et charge, ou distance, calories, temps), score selon le format, « Lancer au
   minuteur ». Note libre avec la consigne « aucune donnée de santé ». Enregistrer comme modèle, refaire
   aujourd'hui, supprimer (toast « Annuler »).
2. **Progression** : tonnage ou séries par semaine sur 12 semaines (colonnes, semaine en cours en encre) ;
   séries par groupe musculaire sur 7 ou 28 jours (barres, groupes à zéro visibles) ; courbe d'un exercice
   (métrique principale par séance, évolution en %, réticule et infobulle) ; tableau accessible sous chaque
   graphique.
3. **Records** : recherche ; derniers records ; meilleur score de chaque WOD refait (historique des
   scores) ; carte par exercice (valeur principale, date, charge max, records par répétitions 1/3/5/8/10).
4. **Minuteur** : AMRAP, EMOM (toutes les 1 à 3 min), For Time (temps limite facultatif), intervalles
   (travail, repos, tours), chronomètre ; préparation réglable ; bips (3 dernières secondes et changement
   de phase), son coupable ; pause, reprise, arrêt ; « +1 tour » (AMRAP, For Time) ; « Terminé » (For Time,
   chrono) ; à la fin, « Enregistrer le score » ouvre le WOD avec le score reporté. Demande à l'écran de
   rester allumé quand le navigateur le permet.
5. **Bibliothèque** : modèles (utiliser, modifier, minuteur pour un WOD, ajouter les modèles QME manquants,
   nouveau modèle) ; 150 exercices et les exercices personnels, recherche, filtre par groupe ; fiche d'un
   exercice (records, progression, modifier ou supprimer un exercice personnel non utilisé).
6. **Réglages** : unité (kg ou lb, sans conversion), formule du 1RM (Epley ou Brzycki, avec source),
   répétitions au plus pour l'estimation (10 par défaut), export CSV, sauvegarde JSON, compte, « Sur
   téléphone », données personnelles, avertissement, sources, à propos.

Premier lancement en une étape : unité, formule, modèles QME à ajouter (cochés par défaut), 4 conseils,
avertissement.

## Base intégrée (`templates/musculation/donnees.js`)

- **150 exercices** aux noms génériques rédigés pour QME, en 13 groupes et familles : pectoraux (12), dos
  (14), épaules (11), biceps et avant-bras (9), triceps (8), quadriceps (12), ischios et fessiers (12),
  mollets (4), abdominaux et gainage (14), haltérophilie (14), gymnastique (16), kettlebell et fonctionnel
  (10), cardio et machines (14). Chacun avec sa **mesure** : charge × répétitions, répétitions, temps tenu,
  distance (allure sur 500 m pour les ergomètres, 1 000 m pour la course, 100 m pour la natation) ou calories
  affichées par la machine.
- **4 formats de WOD** génériques (AMRAP, EMOM, For Time, intervalles) avec leur règle de score.
- **12 modèles de séances** rédigés pour QME, nommés d'après leur contenu (« Haut du corps · poussée »,
  « AMRAP 12 min · poids du corps », « Intervalles 20 s / 10 s · 8 tours »…), sans charge imposée.
- **2 formules de 1RM** avec leur source, 4 conseils, 3 sources.

## Calculs (règles pures, `templates/musculation/regles.js`, `window.MSC`)

- **1RM estimé** : Epley, charge × (1 + reps ÷ 30) ; Brzycki, charge × 36 ÷ (37 − reps) ; 1 répétition =
  la charge ; rien au-delà de 10 répétitions (réglable de 1 à 15) ni sans charge. Toujours affiché « ≈ » et
  qualifié d'estimation.
- **Volume** : tonnage = Σ charge × reps des séries avec charge ; séries remplies par groupe ; pour un WOD,
  tonnage et reps sur les tours complets (AMRAP : tours du score ; For Time : tours prévus si terminé, sinon
  tours faits ; EMOM et intervalles : mouvements à tour de rôle ; intervalles sans reps prévues : reps du
  score réparties) et un bloc par mouvement. Semaines du lundi au dimanche, semaines d'affilée.
- **Records** : parcours chronologique (même jour : ordre de saisie) ; par exercice et par type (1RM estimé,
  charge max, reps, temps, distance, allure où plus petit vaut mieux, calories) ; la première performance
  est une référence, pas un record ; une égalité n'est pas un record ; **seules les séances « séries »
  comptent** pour les exercices (un mouvement de WOD se fait sous fatigue) ; records par répétitions
  (meilleure charge soulevée au moins 1, 3, 5, 8, 10 fois). **WOD** : reconnu par son modèle, sinon par son
  titre (sans accents ni casse) et son format ; comparaison selon le format (AMRAP : tours puis reps ; For
  Time : terminé avant non terminé, puis temps le plus court, ou tours puis reps au temps limite ; EMOM :
  minutes réussies ; intervalles : reps totales).
- **Progression** : meilleure valeur de la métrique principale à chaque séance.
- **Minuteur** : plan en segments (préparation, travail, repos), état à un instant donné (phase, tour,
  temps restant ou écoulé), bips entre deux instants. Calculé depuis l'horloge du navigateur, pas par
  incrément (pas de dérive en arrière-plan).
- Normalisation tolérante, modèles (depuis la base, depuis une séance, séance depuis un modèle avec les
  charges de la dernière fois), exercices personnels (refus de suppression s'ils sont utilisés), export CSV
  (point-virgule, BOM UTF-8, 1RM estimé et score de WOD).
- 20 tests `node --test` dans `outils/templates/musculation.test.mjs` (dont l'absence de noms de marque et
  de WOD de référence dans la base).

## Aucune donnée de santé (choix de conception)

Le carnet n'enregistre **que des performances sportives** : exercices, séries, charges, répétitions, temps,
distances, calories affichées par une machine, scores, RPE (effort perçu sur la série, une donnée
d'entraînement). Il ne demande **ni poids de corps, ni mensurations, ni fréquence cardiaque, ni blessures,
ni notes médicales** :
- ces informations sont des données de santé au sens du RGPD (catégorie particulière, art. 9), qui
  imposeraient consentement explicite et précautions d'hébergement que le stockage des templates n'a pas été
  conçu pour offrir ;
- elles ne sont pas nécessaires pour suivre une progression de charges, de répétitions ou de scores ;
- les exercices au poids du corps se mesurent en répétitions ou en temps (le tonnage les ignore), sans
  calcul « poids de corps + lest » ; les tractions lestées se notent par le seul lest.
La note de séance rappelle de n'y écrire aucune donnée de santé ; les réglages et la FAQ expliquent ce
choix. Aucun lien avec une montre, une application ou un capteur.

## Marques et droits

- Aucun nom de marque (matériel, machine, méthode ou application) : « cross-training » au lieu du nom
  déposé, « Ski ergomètre », « Vélo à air », « Squat à la machine inclinée », pas d'exercices portant le nom d'une
  personne ou d'un personnage (remplacés par une description : « Développé épaules avec rotation », « Curl au
  pupitre », « Rowing barre départ au sol », « Extension lombaire au banc »…). Test automatique sur une liste de mots
  interdits.
- **Aucun WOD de référence nommé** (ni « Girls » ni « Heroes ») : droits non vérifiés. Seulement les formats
  génériques et des modèles QME décrits par leur contenu. L'utilisateur peut saisir les siens.
- Termes anglais conservés parce que génériques et courants en salle : AMRAP, EMOM, For Time, WOD, RPE,
  1RM, thruster, wall ball, muscle-up, toes-to-bar (avec une traduction descriptive). **À vérifier par
  Quentin** : aucun de ces termes ne semble déposé seul, mais « WOD » est très associé à la marque de
  cross-training ; le garder dans l'interface est un choix discutable.

## Sources

- Epley B., *Poundage Chart*, Boyd Epley Workout, Lincoln (Nebraska), Body Enterprises, 1985 (formule
  1RM ≈ charge × (1 + reps ÷ 30)). **Référence primaire non consultée** : formule reprise des manuels de
  préparation physique qui la citent ; à vérifier.
- Brzycki M., « Strength testing: predicting a one-rep max from reps-to-fatigue », *Journal of Physical
  Education, Recreation & Dance*, vol. 64, n° 1, 1993, p. 88-90. **Non consultée** directement ; à vérifier.
- Zourdos M. C. et al., « Novel resistance training-specific rating of perceived exertion scale measuring
  repetitions in reserve », *Journal of Strength and Conditioning Research*, vol. 30, n° 1, 2016,
  p. 267-275 (RPE 1 à 10 fondé sur les répétitions en réserve). **Non consultée** directement ; à vérifier.
- Seuil de 10 répétitions pour l'estimation : choix de prudence courant (les formules divergent au-delà),
  réglable ; pas de source unique.
- Libellés « Ajouter à l'écran d'accueil » : repris du socle (relevés sur des guides récents).

Aucune donnée datée (pas de barème, de taux ni de prix) : rien à mettre à jour chaque année.

## Risques

- **Santé et sport** : l'outil pourrait être pris pour un programme ou inciter à tester un maximum.
  Avertissement visible sur l'écran de connexion, le premier lancement, en pied de chaque onglet, dans le
  minuteur et les réglages ; le 1RM est toujours « estimé » et « ≈ » ; aucune prescription de charge.
- **Marques** : contrôle par test automatique ; communication sans le nom déposé (voir plus haut).
- **RGPD** : performances sportives seulement, hébergées avec la clé de l'acheteur, export et
  restauration ; la note libre pourrait recevoir une donnée de santé malgré la consigne (risque résiduel,
  mentionné dans les réglages).
- **Calcul simplifié** : volume des WOD sur les tours complets, reps d'intervalles réparties également,
  WOD reconnu par son titre (deux WOD différents de même titre et format sont confondus : utiliser un modèle).
- **Minuteur** : sur iPhone, un onglet en arrière-plan ou un écran verrouillé peut suspendre les bips ;
  l'horloge reste juste au retour. Verrou d'écran (Wake Lock) seulement si le navigateur le permet.
- Concurrence : nombreuses applications d'entraînement gratuites ou par abonnement ; se distinguer par
  l'achat unique, l'absence de compte et de données de santé, la base en français et le minuteur intégré.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/conges/` (connexion avec `produit: 'MSC'`, synchronisation et 409, démo
  `?demo` non mémorisée, modales, toast Annuler, export / import JSON, service worker, fenêtre « Comme une
  application » avec la clé `qme-msc-ecran-accueil`, bandeau « Bientôt en vente » vers
  `/catalogue/musculation/`). Clé locale propre en plus : `qme-msc-son` (son du minuteur).
- Démo : pratiquant fictif sur 10 semaines dont une de pause (force le lundi et le mercredi avec progression,
  WOD le vendredi : AMRAP refait avec un meilleur score, For Time d'abord au temps limite puis terminé, EMOM,
  intervalles ; soulevé de terre, tractions, gainage et rameur un samedi sur deux), séance du jour avec un
  record aux tractions, WOD du jour sans score, un exercice personnel, un modèle personnel et les 12 modèles
  QME ; tout relatif à la date du jour.
- Graphiques (skill dataviz) : une seule série par graphique, teinte 1 de la palette de référence
  (`#2a78d6`, le `--bleu` de la charte échoue au plancher de chroma du validateur), semaine en cours en
  encre, barres de 24 px au plus arrondies côté valeur, ligne de 2 px, points de 8 px avec anneau de 2 px,
  réticule accroché au point le plus proche, infobulle au survol et au clavier, cibles de 28 px, tableau
  accessible, largeur du tracé mesurée sur le cadre (texte à taille réelle sur téléphone).
