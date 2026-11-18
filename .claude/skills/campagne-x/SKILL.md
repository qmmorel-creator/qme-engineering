---
name: campagne-x
description: Produire la publication quotidienne de la campagne X de QME (en anglais, uniquement sur le volet sur mesure), en alternant un post et une vidéo d'un jour à l'autre, avec renvoi vers qm-engineering.fr/x (page des 97 templates en français et bouton « I'd like it in English »). À utiliser quand Quentin demande « le post X du jour », « la vidéo X », « campagne X », « remplis X », ou depuis la tâche planifiée « Campagne X ».
---

# Campagne X quotidienne (anglais, sur mesure)

Référence complète : `docs/templates/communication/x/README.md` (règles éditoriales, profil, planning). Journal :
`docs/templates/communication/x/journal-x.md`. Explique chaque étape en français, sans flatterie ; dis ce qui a été
vérifié et ce qui ne l'a pas été.

## Règles non négociables

1. **Anglais uniquement**, **sur mesure uniquement** : un template n'est qu'une preuve de savoir-faire. Jamais de prix
   de template, jamais de lien Gumroad. Lien unique : `qm-engineering.fr/x`.
2. **Honnêteté** : interface en français, toujours dit (« French interface ») ; aucune version anglaise annoncée comme
   existante ; aucun client nommé ; aucun chiffre inventé (valeurs lues dans les démos, faits de `/en/method/`).
3. **Alternance** : le type du jour est l'inverse de celui de la veille dans le journal (post → vidéo → post…).
4. **Rotation** : jamais le même template deux fois en 7 jours sur X ; thèmes de la page en alternance.
5. **Post** : 280 caractères au plus, contrôlés par `node docs/templates/communication/x/longueurs.mjs` (le texte est
   d'abord ajouté au README sous `### X-nn`). Pas d'émoji, pas de superlatif, 0 à 2 hashtags.
6. **Vidéo** : moteur unique `docs/videos/rendu.mjs` (page HTML animée, temps virtuel 30 i/s, sous 2,9 Mo), 1080 × 1920,
   20 à 30 s, **musique QME** (piste audio vérifiée avec `ffprobe`, jamais de vidéo muette), captures réelles de la démo
   (`?demo`, serveur local, Playwright), sous-titres anglais, mention « French interface · sample data » sur chaque
   capture, carton final « qm-engineering.fr/x ». Ne jamais écrire un autre outil de capture.
7. **Captures** : interface en français acceptée ; prendre l'écran le plus parlant visuellement (graphique, planning
   coloré, grand chiffre en titre), jamais une fenêtre modale grisée ni une liste dense.

## Horaire

Publication quotidienne à **10:00 heure de Californie** (décision de Quentin du 18/11/2026) : colonne Heure du planning
= **19:00** (heure de Paris), **18:00** du 14 au 27/03/2027 et du 31/10 au 06/11/2027. Pour les années suivantes,
recalculer les deux périodes décalées (changement d'heure américain le 2e dimanche de mars et le 1er dimanche de
novembre, européen le dernier dimanche de mars et d'octobre).

## 1. Choisir la date et le type

Lire `journal-x.md`. Date = le premier jour sans ligne au statut `Prêt`, `Programmé` ou `Publié`, entre demain et J+14.
Une ligne `À produire` déjà prévue à cette date est produite telle quelle (sujet du README) ; sinon, créer la ligne suivante
(ID `X-nn` suivant, type alterné, sujet nouveau). Aucune date libre : ne rien produire, le dire.

## 2. Produire

- **Post** : écrire le texte dans le README (`### X-nn · <date> · post` + bloc ```), lancer `longueurs.mjs`.
  Angles en rotation : problème concret d'une petite entreprise, méthode, honnêteté (quand le sur-mesure ne vaut pas
  la peine), chiffre vrai du catalogue (97 outils, 34 sur règles françaises, nombre par thème de la page), question
  ouverte, coulisses de construction d'un outil.
- **Vidéo** : suivre les étapes 2 à 5 de `.claude/skills/reel-du-soir/SKILL.md` § Fabriquer (captures, page animée,
  rendu, vérifications), avec des textes anglais. Page source : `docs/templates/communication/x/production/X-nn.html`,
  vidéo `docs/templates/communication/x/production/X-nn-<slug>.mp4` + couverture. Texte d'accompagnement (≤ 280,
  contrôlé) noté dans le README sous la ligne de scénario (`Texte : \`…\``).
- Si un template a été mis en vente depuis la dernière génération : ajouter sa ligne à `outils/x/templates-en.json` et
  relancer `node outils/x/generer.mjs` (PR vers `main`, aucune fusion sans le feu vert de Quentin).

## 3. Déposer et programmer (Instinct)

Planning : Sheet « Planning publications X » `1lri4kqQO61Ei4s6w9za2UdudsPhdpas_zKuAIG5N8hM`, onglet `Planning`
(colonnes A–K, détail dans le README). Relire tout l'onglet **juste avant d'écrire**.

1. Vidéo : dépôt dans le dossier Drive « QME – Publications X » `1W6TwJQC7BqoGBuoYJeLy62EOaXXroqyA` comme dans
   `video-demo` § 3 (`mcp__Google_Drive__create_file`, `base64Content` = `sha256:<empreinte>:<chemin absolu>`,
   `disableConversionToGoogleType: true`), sous le nom `X-nn-<slug>.mp4` ; noter le nom en G et l'ID Drive en H.
2. Écrire ou compléter la ligne : A à F (texte exact, identique au README), K (remarque utile, « Épingler ce post »
   pour un post à épingler).
3. Statut D : « Programmé » si `journal-x.md` indique « Routine Instinct X transmise : oui » ; sinon « Prêt ».
4. Ne jamais publier soi-même ni écrire « Publié » : c'est Instinct qui l'écrit (colonnes D, I, J).
5. Les vidéos X sont en anglais : elles ne vont **pas** dans le planning YouTube (chaîne en français), sauf décision
   contraire de Quentin.

## 4. Journal et compte rendu

1. Mettre à jour la ligne de `journal-x.md` (fichier, lien Drive, statut).
2. Commit sur la branche de travail, PR vers `main` si un fichier publié (`en/`, `assets/`, `outils/`) a changé.
3. Résumé à Quentin : date, type, texte exact à publier, lien Drive de la vidéo, vérifications faites, statut.
