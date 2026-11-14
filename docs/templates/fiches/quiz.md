# T58 · Banque de questions et quiz formateur

Slug `quiz`, préfixe `QZZ` (clés locales `qme-qzz-code`, `qme-qzz-cache`, `qme-qzz-demo`, `qme-qzz-ecran-accueil`,
règles `window.QZZ`, `produit: 'QZZ'` dans les deux appels à `/connexion`), prix prévu **19 €** (au-dessus du minimum
de 12 €, **à confirmer par Quentin**), permalien Gumroad proposé `banque-questions-quiz`, catégorie Gumroad `education`
(**à vérifier**, comme la gestion de classe), taille M, priorité P3. Catalogue : `data-pour="pro"`, thème
« Associations, formation et événements » (`associations-formation-et-evenements`, `--c:var(--rouge)`, avec la gestion
de classe, l'emploi du temps et la progression pédagogique). Pack Enseignant et formateur (`PNS`), où `QZZ` est déjà
annoncé dans `PREVUS`. Origine : backlog de Quentin n° 35. Fiche rédigée le 14/11/2026 (feu vert de Quentin donné pour
le lot). Aucune marque, aucun logiciel ni plateforme de quiz nommés, aucune donnée réelle, aucune automatisation ni
lien externe.

## Public

Formateurs (formation continue, apprentissage, formateurs indépendants, formateurs internes) et enseignants qui
évaluent par quiz ou QCM, gardent leurs questions dans des fichiers épars et refont chaque sujet à la main, sans savoir
ensuite quelles questions posent problème.

## Promesse

« Tes questions, tes quiz, tes résultats. » Une banque de questions étiquetées ; un quiz tiré en un clic, imprimé avec
son corrigé à part ; une correction automatique à partir des réponses saisies ; des statistiques qui montrent les
questions trop faciles, trop difficiles et la mauvaise réponse qui attire.

## Confidentialité, contenu et RGPD (exigences de Quentin)

- **Aucun contenu d'un artefact existant repris** (la fiche IDEES citait une banque de questions d'élèves d'un
  artefact client) : mécanique générique seulement, rédigée pour QME. Aucune question fournie dans l'application.
- **Démo entièrement fictive** : 30 questions génériques rédigées pour QME (pourcentages, unités, tableur, orthographe,
  sécurité numérique ; connaissances courantes, aucun programme ni manuel recopié), apprenants inventés (prénom et
  initiale, ou pseudonymes « Aster », « Boréal »…), dates relatives à aujourd'hui.
- **RGPD (résultats nominatifs)** :
  - mention explicite au premier lancement (case à cocher obligatoire), dans l'onglet Corrections, dans les Réglages
    et sur le tableau de bord tant qu'elle n'a pas été lue ;
  - **saisie anonyme** par défaut (« Copie 1, Copie 2… ») ou **prénom et initiale, ou pseudonyme**, session par session ;
    aucun autre champ sur les apprenants ;
  - **export** : résultats d'un apprenant (JSON et CSV), de tous les résultats (JSON), notes et réponses détaillées
    (CSV) par session ou en tout ;
  - **effacement** : d'un apprenant (toutes ses copies nominatives), d'une session, de tous les résultats (la banque et
    les quiz restent) ; **anonymisation** d'une session (noms remplacés, statistiques gardées) ;
  - **durée de conservation** réglable (12 mois par défaut) : rappel au tableau de bord pour les sessions nominatives
    plus anciennes.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles (questions et étiquettes, quiz et sessions, copies corrigées et réponses à vérifier,
   réussite moyenne et note moyenne) ; « À regarder » (réponses courtes à vérifier, copies incomplètes, sessions
   nominatives au-delà de la conservation, questions trop difficiles ou trop faciles, questions sans étiquette) ;
   dernières sessions avec leur moyenne ; quiz prêts à faire passer.
2. **Banque** : filtres par type (pilules), étiquette, difficulté, archivées ; recherche ; carte de chaque question
   (type, difficulté en barres, étiquettes, points, énoncé, propositions avec la bonne en vert, explication, réussite
   réelle, classe, nombre de quiz) ; sélection → « Créer un quiz avec » ; nouvelle question ; coller une liste ;
   dupliquer ; export CSV.
3. **Quiz** : générateur (étiquettes au moins une ou toutes, difficultés, types, nombre, priorité aux moins posées,
   ordre au hasard ou par difficulté croissante, mélange des propositions, nombre de questions disponibles en direct) ;
   détail du quiz (résumé, étiquettes, questions avec propositions dans l'ordre du sujet, monter, descendre, retirer,
   ajouter depuis la banque, mélanger à nouveau, titre et consignes, dupliquer, supprimer) ; impression du sujet
   (cases à cocher, cadre nom ou pseudonyme, points facultatifs, exemplaires) et du **corrigé sur une page à part**
   (bonne réponse, points, explications).
4. **Corrections** : sessions (quiz, groupe, date, anonyme ou nominative) ; tuiles (copies, moyenne, médiane, étendue,
   à vérifier) ; réponses courtes à vérifier (Juste, Faux, Toujours accepter) ; grille des copies (juste, faux, blanc,
   à vérifier, non saisie ; note) avec la réussite par question ; saisie d'une copie (lettres du sujet, vrai ou faux,
   texte, « Blanc », score en direct, « Enregistrer et suivante ») ; **passation sur cet appareil** (l'apprenant
   répond, rend sa copie, l'appareil passe au suivant, aucune réponse affichée) ; exports ; anonymiser ; effacer ;
   bloc « Données des apprenants ».
5. **Statistiques** : périmètre (toutes les sessions ou une) ; tuiles (réponses analysées, réussite globale, trop
   difficiles, trop faciles) ; réussite par étiquette (barres) ; progression (moyenne de chaque session dans l'ordre
   des dates) ; parcours d'un apprenant nommé ; tableau par question (de la moins à la plus réussie, distracteur le plus
   choisi s'il dépasse 15 % des réponses, classe).
- **Réglages** : note sur 10, 20 ou 100 ; seuils trop facile (85 %) et trop difficile (35 %) ; réponses minimum avant
  de classer (5) ; saisie proposée par défaut ; conservation (12 mois) ; exports (banque, notes, réponses, résultats
  JSON) ; effacements ; copie complète JSON et restauration ; compte ; « Sur téléphone » ; à propos.
- Premier lancement en 2 étapes : présentation et conseils ; RGPD (case obligatoire), saisie par défaut, barème.

## Base intégrée (`donnees.js`)

Types de questions et leur règle, niveaux de difficulté, barèmes, lettres, format de collage, conseils de rédaction
(rédigés pour QME), couleurs fixes des étiquettes, textes de source. **Aucune question.**

## Calculs (`regles.js`, fonctions pures testées : `outils/templates/quiz.test.mjs`, 14 tests)

- **Correction** : QCM juste si toutes les bonnes propositions et elles seules sont cochées (tout ou rien) ; vrai ou
  faux ; réponse courte reconnue sans majuscules, accents, espaces ni ponctuation, virgule décimale = point ; sinon
  « à vérifier » jusqu'à ce que le formateur tranche (correction manuelle prioritaire) ; blanc = faux ; non saisie =
  copie incomplète.
- **Note** : points obtenus ÷ points du quiz × barème, arrondie au demi-point (à l'unité sur 100).
- **Session** : moyenne, médiane, minimum, maximum sur les copies complètes ; répartition en 5 tranches.
- **Statistiques** : réussite par question (blancs comptés faux ; non saisies et « à vérifier » exclues), classe
  (trop facile, trop difficile, équilibrée, peu de réponses), distracteur le plus choisi ; réussite par étiquette ;
  moyennes des sessions dans l'ordre des dates ; parcours d'un apprenant (même nom d'une session à l'autre, sans
  accents ni majuscules).
- **Tirage** reproductible (générateur à graine), filtres, priorité aux moins posées, ordre par difficulté ; mélange des
  propositions mémorisé par quiz ; réponse lue dans l'ordre du sujet.
- **Collage** d'une liste au format `?`, `+`, `-`, `=`, `#`, `~`, `!` avec erreurs par ligne.
- Exports CSV (`;`, UTF-8 avec BOM, virgule décimale) et JSON ; effacements ; anonymisation ; conservation ;
  suppression d'une question utilisée = archivage (statistiques gardées) ; suppression d'un quiz avec ses sessions ;
  normalisation tolérante.

## Sources

- Aucune base externe. Notions de « taux de réussite » et de « distracteur » : connaissance générale de l'analyse des
  questions d'évaluation, aucune méthode publiée reprise ; seuils indicatifs et réglables.
- RGPD : règlement (UE) 2016/679 cité de façon générale (données personnelles, minimisation, effacement,
  portabilité) ; **non relu sur une source primaire dans cette session**, aucune promesse de conformité faite.
- Questions de la démo : rédigées pour QME ; faits vérifiés par calcul ou connaissance générale (pourcentages, unités,
  préfixes du Système international, accords courants) ; **à relire par Quentin**.

## Choix à valider par Quentin

- Prix 19 €, nom, permalien `banque-questions-quiz`, catégorie Gumroad.
- QCM à plusieurs bonnes réponses en tout ou rien (pas de points partiels) ; blanc compté faux ; points par question
  (0,5 à 20) ; note arrondie au demi-point.
- Réponses courtes : comparaison souple, sinon « à vérifier » (pas de correction approchée automatique).
- Seuils 85 % / 35 % et minimum de 5 réponses ; distracteur affiché à partir de 15 %.
- Saisie anonyme proposée par défaut ; conservation de 12 mois par défaut (durée à fixer par l'utilisateur selon son
  établissement : aucune durée légale n'est affirmée).
- Passation sur l'appareil du formateur seulement (pas de compte ni de lien apprenant : une seule clé).
- Thème catalogue « Associations, formation et événements » ; questions de la démo.

## Risques

- Données personnelles : l'outil minimise mais ne garantit pas la conformité ; mention renvoyant à l'établissement.
- Un seul utilisateur par clé (banque non partagée entre collègues) ; passation sur un seul appareil à la fois.
- Taille : environ 900 Ko par compte ; mesuré sur la démo, une copie de 8 à 10 questions pèse environ 0,3 Ko et une
  question 0,4 Ko (démo : 30 questions, 47 copies, 29 Ko) : environ 2 000 copies tiennent avec une banque de 500
  questions ; au-delà, message clair et invitation à exporter puis effacer.
- Sujet imprimé : mise en page vérifiée à l'écran en média « print », pas sur papier.

## État au 14/11/2026

Prêt (worktree du lot), « Mise en vente prochaine ». Tests `outils/templates/quiz.test.mjs` (14) ; Playwright ordinateur
1280 px, iPhone 13 et Pixel 7 (code faux, code valide, premier lancement, question, collage, tirage, session, copie,
réponse à vérifier, passation, synchronisation vers un second appareil, rechargement, export et effacement d'un
apprenant, anonymisation, effacement de tous les résultats, impression, écran d'accueil, démo, code ADM).
