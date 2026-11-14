# T75 · Calendrier éditorial des réseaux professionnels

Slug `calendrier-editorial`, préfixe `CED`, prix 15 €, permalien Gumroad prévu `calendrier-editorial`. Usage
`pro`, catalogue « Clients et prospection ». Taille S, P2. Origine : proposition validée par Quentin le
14/11/2026 (pack « Freelance : trouver ses clients », PFC), numérotée T73 puis **T75** (renumérotation du
14/11/2026, main utilisant déjà T71 et T72). Cadrage délégué par Quentin : fiche rédigée et appliquée sans
validation intermédiaire. Marques de risque : **confidentiel** (démo fictive), aucune donnée **datée** intégrée.

## Pour qui

- **Consultants indépendants** dont le réseau professionnel est le premier canal d'acquisition.
- **Freelances du numérique** (développeurs, designers, rédacteurs) qui publient « quand ils ont le temps ».
- **Coachs, formateurs, photographes, indépendants du marketing** qui doivent rester visibles entre deux missions.

Aujourd'hui : pas d'idée le jour J, des brouillons dans plusieurs applications, des publications en rafale puis
plus rien, et aucune idée de ce qui a vraiment apporté un rendez-vous.

## Règles de cadrage

- **Aucune marque de réseau social** dans le nom du produit, l'application, la base, la fiche Gumroad (tests :
  aucune marque dans `donnees.js`). Les canaux sont nommés par l'utilisateur (« Réseau professionnel » par défaut).
- **Aucune automatisation ni connexion** : rien n'est publié, aucune statistique n'est lue, aucun accès aux
  comptes. Partage par « Copier le texte ».
- **Aucune règle de réseau intégrée** : la limite de caractères de chaque canal est **saisie par
  l'utilisateur** (aucune par défaut ; la démo en saisit une). Les durées de préparation des formats et la
  longueur repère de l'accroche (150 caractères) sont des **repères d'écriture QME**, modifiables, présentés comme tels.
- Le taux d'interaction est calculé par l'outil (réactions + commentaires + partages ÷ vues) et annoncé comme
  différent du calcul de chaque réseau.

## Base intégrée (`donnees.js`, contenu original QME)

- 6 piliers types avec couleur fixe et part visée (expertise 35, cas clients 25, coulisses 20, conseils 20 ;
  points de vue et parcours facultatifs). Palette validée avec le validateur du skill dataviz (couleur
  moutarde sous 3:1 : toujours accompagnée du nom du pilier).
- 8 formats (texte, texte et image, carrousel ou document, vidéo courte, sondage, article long, ressource
  commentée, lettre d'information) avec temps de préparation indicatif, et une table de recyclage (format
  proposé pour reprendre un contenu).
- 11 trames de texte avec passages [entre crochets] à remplacer.
- 8 métiers et **92 sujets** (12 pour tous, 10 par métier), chacun avec pilier, format et trame.
- 5 statistiques saisies : vues, réactions, commentaires, partages, contacts générés.

## Écrans (5 onglets + réglages)

- **Tableau** : semaine en cours face à l'objectif, série, contacts sur 30 jours, banque d'idées ; à faire
  (programmé passé non marqué publié, statistiques à saisir, texte manquant ou à compléter dans les 2 jours,
  limite dépassée, semaine en cours ou suivante sous l'objectif) ; deux prochaines semaines ; prochains jours
  préférés libres ; pilier à privilégier avec idées ; graphique de régularité.
- **Calendrier** : mois (étiquettes colorées par pilier, forme par statut, colonne publiés/objectif par
  semaine, impression) et semaine (liste par jour, semaine de pause). Un jour vide ouvre un contenu programmé.
- **Idées** : colonnes idée, brouillon, programmé (ou filtre par statut), filtre par pilier, recherche,
  bouton « avancer d'un cran » ; banque de sujets par métier.
- **Statistiques** : période, totaux, contenus à compléter, meilleurs contenus selon un critère (contacts,
  taux, interactions, vues), à recycler, moyennes par pilier et par format, régularité, tous les publiés, CSV.
- **Ligne** : répartition par pilier face à la part visée, rythme et repères, piliers, canaux (limite saisie),
  formats.
- **Fiche d'un contenu** : sujet, statut, date et heure, pilier, format, canal, texte avec compteur (caractères
  visibles, mots, hashtags, accroche, crochets restants, limite et jauge), trame à insérer, copier, notes ;
  statistiques et recyclage pour un publié.
- **Premier lancement** : prénom, métier, objectif par semaine, jours préférés ; piliers, réseau principal,
  ajout des sujets du métier.

## Mécanique (fonctions pures, `regles.js`, `window.CED`, tests `outils/templates/calendrier-editorial.test.mjs`)

1. Statuts `idee → brouillon → programme → publie` ; programmé et publié exigent une date ; publié sans date
   ou à une date future prend la date du jour ; les statistiques n'existent que pour un publié.
2. Régularité : semaine lundi → dimanche « tenue » si les publiés atteignent l'objectif ; série = semaines
   tenues consécutives ; la semaine en cours ne casse pas la série tant qu'elle n'est pas finie ; une pause
   est sautée ; rien avant la date de début du suivi.
3. Répartition par pilier sur 8 semaines passées et 2 à venir, parts visées ramenées à 100 % ; pilier à
   privilégier si l'écart atteint 5 points.
4. Classement par critère puis taux puis vues ; moyennes par pilier et format.
5. Recyclage : meilleur tiers selon le critère, critère > 0, publié depuis au moins 90 jours (réglable), sans
   reprise depuis ce délai ; la reprise garde pilier et canal, prend le format suivant et le texte en brouillon.
6. Compteur : graphèmes (`Intl.Segmenter`), hashtags commençant par une lettre, première ligne non vide comme accroche.

## Accès

Le préfixe `CED` n'a que des lettres hexadécimales (A–F) : une clé Gumroad peut commencer par « CED ». Le
formatage de la saisie (application et `/connexion/`) traite donc une saisie de plus de 19 caractères comme
une clé Gumroad. Le serveur n'est pas concerné (il compare la longueur exacte d'un code interne).

## Restes

Fiche Gumroad (permalien `calendrier-editorial`) et clé de licence (Quentin) ; entrée dans
`communication/gumroad-a-creer.json` ; ajout du préfixe au pack PFC (`netlify/lib/packs.mjs`, `ajouts`) et
régénération des pages de packs ; plannings LinkedIn et Instagram ; version anglaise ; passage en vente du site.
