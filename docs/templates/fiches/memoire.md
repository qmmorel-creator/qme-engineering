# T90 · Planning de mémoire ou de thèse

Slug `memoire`, préfixe `MMR` (clés locales `qme-mmr-*`), prix 15 €, usage `perso`, permalien Gumroad proposé
`planning-memoire`, catégorie Gumroad `education`, taille S, priorité P3. Origine : proposition validée par Quentin
le 14/11/2026 (pack « Étudiant », `PET`). Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et décisions
prises le 14/11/2026. Marques de risque : aucune réglementaire ; **daté** évité (aucune règle d'établissement ni
d'école doctorale intégrée, tout calendrier officiel est saisi).

## Pour qui

Étudiants de master (mémoire de M1 ou M2), élèves ingénieurs en projet de fin d'études (rapport de PFE) et
doctorants (manuscrit de thèse) qui ont une date de rendu, un volume à écrire et un directeur ou tuteur à tenir
informé. Distinct du **Planning de révision** (T01, mémoriser pour un examen), du **Planning Gantt** (T08, tâches
et dépendances d'un projet) et du **Suivi de lecture** (T17, livres lus pour soi) : ici, un seul long écrit, son plan,
son rythme d'écriture et le suivi avec le directeur.

## Promesse

Le plan, le rythme, la date : chaque jour, combien de mots il reste à écrire pour finir à temps, et où en est
chaque chapitre.

## Décisions de cadrage (14/11/2026)

1. **Aucun accès au texte** : le mémoire reste dans le traitement de texte. On saisit les mots par élément
   (compteur de mots sur la sélection) ; une fenêtre « Mots écrits » permet de tout mettre à jour d'un coup. Pas
   d'import de fichier, pas de connexion à un service de documents.
2. **Plan hiérarchique à trois niveaux** : partie (1), chapitre (2), section (3). Un élément de la racine est une
   partie ou un chapitre ; ses enfants prennent le niveau suivant (plafonné à la section). Un élément parent totalise
   ses mots propres et ceux de ses enfants ; ses mots visés valent sa saisie ou, à défaut, la somme de ses enfants ; son
   statut affiché est celui du moins avancé de ses éléments terminaux (« Relu au moins », ou « En cours » si certains
   sont commencés et d'autres encore à écrire). Réparation automatique : parent inconnu ou boucle → racine.
3. **Statuts et avancement** : à écrire (0), brouillon (50 %), relu (80 %), final (100 %). Avancement du plan =
   moyenne pondérée par les mots visés des éléments terminaux quand tous en ont, sinon à parts égales. Les poids sont
   affichés, fixes en V1.
4. **Projet** : type (mémoire de master, PFE, thèse, autre travail long), titre, formation, établissement,
   directeur (texte libre), dates de début, de rendu et de soutenance, mots visés, mots par page (300 par défaut,
   pour une estimation en pages), jours de travail de la semaine (lundi à vendredi par défaut). Mots visés proposés
   au premier lancement (20 000, 12 000, 80 000, 15 000) : **valeurs de départ sans valeur officielle**, présentées
   comme à remplacer par la consigne de l'établissement.
5. **Rétroplanning** : jalons types par type de travail (`donnees.js`), chacun ancré au rendu ou à la soutenance avec
   un décalage en jours, ou fixé à une date. Quand le modèle commence avant la date de début du projet, les jalons
   ancrés au rendu sont **resserrés à la même proportion** (message affiché). Statuts : fait (date), en retard, bientôt
   (≤ 14 jours), à venir, sans date (soutenance non saisie). Un seul jalon « fin de la rédaction » (premier jet
   complet) : c'est l'échéance du rythme. « Rétablir les jalons types » garde les jalons faits. Les délais types
   sont des **repères écrits pour ce template, sans valeur réglementaire** ; pour la thèse, le dépôt et l'envoi aux
   rapporteurs dépendent de l'école doctorale : saisis, jamais intégrés.
6. **Rythme** : mots restants ÷ jours de travail d'aujourd'hui (inclus) à l'échéance de rédaction (incluse), arrondi
   au mot supérieur. Le total est **relevé chaque jour** (un relevé par jour au plus, inutile s'il ne change rien) :
   rythme réel = mots gagnés depuis le relevé d'il y a 14 jours ÷ jours de travail écoulés ; date projetée = n-ième jour
   de travail à ce rythme ; « en retard » si elle dépasse l'échéance.
7. **Graphique** (skill dataviz) : courbe des mots écrits en cumul (trait plein bleu `#2E62A8`) et rythme nécessaire
   jusqu'à l'échéance (tirets rouges `#B84A34`), objectif en repère, aujourd'hui en pointillés, valeur du jour écrite,
   viseur et infobulle au survol, tableau des relevés pour les lecteurs d'écran. Palette validée par le script du skill
   (fond blanc : bande de luminance, chroma, séparation daltonisme ΔE 18, contraste). Barres empilées des mots par
   élément de premier niveau selon le statut, en rampe séquentielle d'un seul bleu, piste en tirets pour les mots visés,
   légende et tableau accessible.
8. **Directeur** : rendez-vous (date, forme, points abordés ou à aborder, ce qui a été dit, actions avec échéance et
   date de réalisation). Actions ouvertes regroupées, retards signalés au tableau de bord. « Préparer le prochain
   rendez-vous » : ordre du jour à copier (avancement depuis le rendez-vous précédent, statuts du plan, actions du
   dernier rendez-vous, autres actions ouvertes, jalons des 45 prochains jours, points prévus). Rien n'est envoyé.
9. **Bibliographie simple** : auteurs (« Nom, Prénom ; Nom, Prénom », organisation gardée entière), année, titre,
   source, type, adresse web et date de consultation, statut à lire / en cours / lu, notes, sections où la référence
   est citée. Export texte **auteur-date simple** (Nom, initiales (année). Titre. Source.) trié par auteur puis année,
   suffixes a, b pour un même auteur la même année, citation dans le texte « (Nom, année) », « (A et B, année) »,
   « (A et al., année) ». **Aucune norme revendiquée** (ni APA ni ISO 690) : le texte le dit dans l'application, la
   page, la fiche Gumroad.
10. **Journal de travail** : séance datée, durée, section, mots écrits (négatifs si coupe), note ; les mots peuvent
    s'ajouter à la section travaillée. Bilan 7 jours, total, section la plus travaillée. Purge des séances anciennes.
11. **Export et impression** : synthèse imprimable (projet, plan avec statuts et mots, rétroplanning, actions ouvertes,
    bibliographie), CSV du plan, de la bibliographie, du journal, des actions ; copie JSON et restauration.
12. **Données personnelles** : rien de sensible demandé ; un avertissement invite à ne pas noter de données
    personnelles de personnes enquêtées. Aucune donnée de santé.

## Écrans

Suivi (tableau de bord : mots, rythme nécessaire, plan, rendu ; courbe ; à suivre ; dernières séances ; barres du plan),
Plan, Planning (rétroplanning, rythme, journal), Directeur, Biblio. Premier lancement en deux étapes (type, titre,
dates, mots visés, plan type ou vide). Impression. Réglages (projet, exports, sauvegarde, compte, « Sur téléphone »).

## Base intégrée (`donnees.js`)

4 types de travaux, 4 modèles de jalons (13, 12, 14 et 5 jalons), 4 plans de départ avec part des mots visés, statuts et
poids, 9 types de références, rampe de couleurs, conseils. Aucune donnée datée, aucune source externe.

## Démo

Étudiante fictive de master 2 en sciences de l'éducation (« Parler en îlots »), université, directrice et 13 références
inventées ; début il y a 110 jours, rendu dans 75, soutenance dans 92 ; 10 600 mots sur 20 000 ; sections à chaque statut ;
relevés sur 100 jours avec une pause de deux semaines ; trois jalons faits, un en retard, un jalon personnel proche ; quatre
rendez-vous passés et un prévu, actions faites, en retard et à venir ; séances des quatre dernières semaines.

## Risques

- Utilisateurs qui attendent un gestionnaire bibliographique complet : la page et la FAQ renvoient vers un logiciel
  dédié pour les gros volumes.
- Délais types pris pour des règles : mention « repères indicatifs, sans valeur officielle » dans l'accueil, le
  planning, l'avertissement de chaque vue, la page et Gumroad.

## Livrables

Application `templates/memoire/`, tests `outils/templates/memoire.test.mjs` (16 tests), page `catalogue/memoire/`
(« Mise en vente prochaine »), communication `docs/templates/communication/memoire/`.
