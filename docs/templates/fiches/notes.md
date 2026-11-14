# T88 · Notes et moyennes

Slug `notes`, préfixe `NTS` (clés locales `qme-nts-*`, règles `window.NTS`), prix prévu 12 € (**à confirmer par
Quentin**), permalien Gumroad proposé `notes-moyennes`, catégorie Gumroad `education` (**à vérifier**), taille S,
priorité P2, thème Études. Catalogue : `data-pour="perso"`, thème « Organisation et études »
(`organisation-et-etudes`, `--c:var(--encre)`, comme le planning de révision). Pack visé : « Étudiant » (PET).
Origine : proposition validée par Quentin le 14/11/2026 ; cadrage délégué, fiche rédigée le 14/11/2026.
Aucun barème officiel d'examen, aucune règle de diplôme, aucune marque d'établissement, d'espace numérique de
travail ou de logiciel de scolarité, aucune automatisation ni lien externe.

## Pour qui

- **Étudiants de licence, master et écoles** : UE, crédits ECTS, compensation par semestre ou par année, note
  éliminatoire, seconde session. La question récurrente : « combien il me faut au partiel pour valider ? ».
- **Étudiants de BTS et BUT** : coefficients par unité, contrôle continu et épreuves finales.
- **Lycéens** (et leurs parents) : trimestres, coefficients, moyenne générale, objectifs pour le dossier de
  poursuite d'études.
- **Candidats aux concours et élèves de prépa** : concours blancs, notes sur 20, objectifs.

Même public que le planning de révision (T01), qu'il complète : le planning dit quoi réviser, Notes et moyennes
dit ce qu'il faut aller chercher. À distinguer de T55 (gestion de classe, côté enseignant).

## Promesse

« Ta moyenne, au centième près. » Tes matières avec leurs coefficients ou leurs crédits, tes notes, tes moyennes
par matière, UE, semestre et année selon les règles de ton diplôme, et la note qu'il te faut au prochain partiel
pour atteindre ton objectif.

## Décisions de cadrage (déléguées, 14/11/2026)

1. **Aucune règle de diplôme intégrée.** Les règlements varient d'un établissement à l'autre : seuil,
   compensation, note éliminatoire, rattrapage, compensation annuelle et mentions sont des réglages saisis, avec
   des valeurs proposées (10 sur 20, mentions 12 / 14 / 16) présentées comme modifiables. Rien n'est daté, rien
   n'est à sourcer.
2. **Trois règles de validation** couvrent les cas courants : compensation entre toutes les matières, à
   l'intérieur de chaque UE seulement, ou aucune. Plus : note éliminatoire facultative, rattrapage « remplace »
   ou « meilleure note », compensation entre les périodes d'une année (case à cocher).
3. **Pondération au choix par période** : coefficients ou crédits ECTS. Le poids d'une UE est son coefficient ou
   ses crédits saisis, sinon la somme de ceux de ses matières. Les notes ont leur propre coefficient dans la
   matière (partiel × 2).
4. **Chaque note garde son barème** (7/10 compte pour 14/20) ; échelles d'affichage sur 20, sur 10, sur 100 ou
   en lettres (table lettres → points saisie, proposée A 4 · B 3 · C 2 · D 1 · F 0, sans valeur officielle ; la
   notation ECTS en lettres repose sur un classement relatif, elle n'est donc pas convertie).
5. **Comparaison aux seuils au centième** : une moyenne de 9,996 s'affiche 10,00 et valide (règle courante de
   l'arrondi au centième ; l'utilisateur peut décaler son seuil si son règlement diffère).
6. **Simulateur** : la même note à chaque épreuve choisie (plus simple à lire qu'une répartition), trouvée par
   dichotomie, donc exacte même avec un rattrapage « meilleure note » ; statuts « assuré », « hors de portée »
   (avec la meilleure moyenne possible) et « aucune épreuve ».
7. **Évolution** : moyenne recalculée après chaque date de note (notes postérieures ignorées), une seule série,
   objectif et seuil en repères.
8. **Relevé personnel**, imprimable et exportable, présenté comme sans valeur officielle.
9. **Hors V1** : import depuis un espace numérique de travail ou un logiciel de scolarité, classement et rang,
   moyennes de classe, notes « bonus » au-delà du barème, règles du type « meilleure des deux notes de CC »,
   plusieurs élèves (prévu pour les parents de fratrie : un accès par enfant).

## Écrans (5 onglets + réglages)

1. **Bilan** (période choisie) : tuiles (moyenne, provisoire ou non, et statut ; objectif et écart ; crédits
   acquis sur total ; prochaine épreuve) ; bloc « Pour 12 de moyenne au semestre 4 » avec la note à viser à
   toutes les épreuves prévues ; « À surveiller » (matières sous la note éliminatoire, sous le seuil, compensées,
   sans note) ; moyennes par matière en barres avec le seuil en pointillés, statut (acquise, compensée, non
   acquise, en attente) ; tableau des UE (poids, moyenne, résultat, crédits).
2. **Notes** : règles de la période en une ligne ; UE avec leur moyenne et leur statut ; cartes de matières
   (coefficient, crédits, moyenne, statut, notes en pastilles : valeur et barème, intitulé, coefficient, date ;
   prévues en pointillés, neutralisées barrées) ; ajout de note, d'épreuve prévue, de matière, d'UE ; règles de la
   période ; reprise de la structure d'une autre période ; export CSV ; nouvelle année.
3. **Objectifs** (simulateur) : cible (période, année, UE ou matière), moyenne visée, épreuves à venir cochées,
   résultat, tableau « Et si tu avais… » (8, 10, 12, 14, 16) ; par matière, la note à viser à ses épreuves pour
   qu'elle atteigne l'objectif.
4. **Évolution** : courbe de la moyenne de la période ou de l'année après chaque note (infobulle, ligne de
   repère, tableau pour lecteurs d'écran, légende objectif et seuil) ; faits (progression, plus haut, nombre de
   notes) ; moyennes par matière ; 30 dernières notes.
5. **Relevé** (par année) : identité facultative, moyenne et statut de l'année, crédits ; par période, UE et
   matières (poids, crédits, moyenne, résultat, crédits acquis), moyenne, résultat, mention ; impression et CSV.
6. **Réglages** : identité pour le relevé, années, mentions (seuils sur 20), table des lettres, exports,
   sauvegarde et restauration JSON, compte, « Sur téléphone », données personnelles, à propos.

Saisies : **note** (matière, obtenue ou prévue, note « 14,5 », « 7/10 », « 85 % » ou lettre, barème,
coefficient, type, date, intitulé, neutralisée ; aperçu de la moyenne de la matière et de la période avant /
après) ; **matière** (nom avec suggestions, UE, coefficient, crédits, couleur) ; **UE** ; **période** (nom,
année, notation, pondération, règle de validation, seuil, note éliminatoire, moyenne visée, rattrapage) ;
**année** (modèle de périodes, notation, reprise de la structure de l'année précédente, compensation entre
périodes).

Premier lancement en 2 étapes : présentation et 4 conseils ; formation (lycée, BTS/BUT, licence/master/école,
prépa/concours), nom de l'année, notation, moyenne visée.

## Base intégrée (`templates/notes/donnees.js`)

4 systèmes de notation (max, seuil et objectif proposés), table de lettres proposée, 9 types d'évaluation,
3 règles de validation, 4 modèles de structure, 26 noms de matières suggérés, 3 mentions proposées, 8 couleurs
fixes, 4 conseils. Aucune donnée datée ni réglementaire.

## Calculs (règles pures, `templates/notes/regles.js`, `window.NTS`)

- Fraction de chaque note (valeur / barème, ou points de la lettre / plus grand nombre de points).
- Moyenne de matière : notes pondérées par leur coefficient ; rattrapages en seconde moyenne (remplace, ou
  meilleure des deux). Coefficient 0 : la note ne compte pas ; tous les poids nuls : moyenne simple.
- UE : matières pondérées comme la période ; période : UE (poids saisi ou somme) et matières hors UE ; année :
  périodes pondérées par leurs crédits si toutes en ont, sinon à parts égales.
- Validation et crédits selon la règle de la période ; compensation annuelle si activée (moyenne de l'année au
  seuil, aucune note éliminatoire, toutes les périodes notées).
- Note nécessaire par dichotomie ; note à viser arrondie au centième supérieur.
- Évolution, épreuves à venir, période du moment, copie de structure, suppressions en cascade, CSV (notes et
  relevé, point-virgule, BOM, formules neutralisées).
- Tests : `outils/templates/notes.test.mjs` (20 tests).

## Démo

Étudiante fictive « Camille Exemple », licence d'économie-gestion d'un établissement inventé, deux années à des
dates relatives : L1 (S1 sous 10 avec un rattrapage, validé par compensation annuelle), L2 (S3 terminé, S4 en
cours avec notes sur 20, 10 et 40, oral, absence neutralisée, 7 épreuves à venir, deux matières sous le seuil,
une matière sans note). Règles : compensation totale, note éliminatoire 6, rattrapage « meilleure note »,
crédits ECTS, objectif 12.

## Risques

- **Erreur de règle** : un utilisateur qui saisit mal son règlement obtient un résultat faux. Parade :
  avertissement sur chaque vue, relevé « sans valeur officielle », règle affichée en tête de la vue Notes.
- **Mineurs** : pas de prospection directe des lycéens (voir `communication/notes/prospects.md`).
- **Concurrence gratuite** (calculateurs de moyenne) : différence par la tenue sur l'année, les UE et crédits,
  les règles saisies et le simulateur multi-épreuves.

## Points à valider par Quentin

Prix 12 € ; nom ; permalien `notes-moyennes` ; catégorie Gumroad ; thème du catalogue ; valeurs proposées
(seuil 10, mentions 12 / 14 / 16, table de lettres) ; hashtags Instagram (`#Étudiant #Partiels #Révisions
#Organisation #Études`) ; périmètre V1 (point 9).
