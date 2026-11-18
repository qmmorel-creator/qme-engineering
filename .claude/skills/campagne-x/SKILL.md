---
name: campagne-x
description: Produire et programmer les publications de la campagne X de QME (en anglais, uniquement sur le volet sur mesure), une par jour, avec une semaine d'avance, en variant les formats (post texte, image, vidéo), les accroches et les thèmes, pour alimenter la publication automatique par Instinct. À utiliser quand la tâche planifiée « Campagne X · contenu J+7 » se déclenche, ou quand Quentin demande « le post X du jour », « la vidéo X », « campagne X », « remplis X ».
---

# Campagne X quotidienne (anglais, sur mesure, une semaine d'avance)

Référence : `docs/templates/communication/x/README.md` (règles éditoriales, profil, planning). Journal :
`docs/templates/communication/x/journal-x.md`. Explique chaque étape en français, sans flatterie ; dis ce qui a été
vérifié et ce qui ne l'a pas été.

## Règles non négociables

1. **Anglais uniquement**, **sur mesure uniquement** : un template n'est qu'une preuve de savoir-faire. Jamais de prix
   de template, jamais de lien Gumroad.
2. **Honnêteté** : interface en français, toujours dite (« French interface · sample data » sur chaque capture) ;
   aucune version anglaise annoncée comme existante ; aucun client nommé (références décrites par leur métier, comme
   sur `/en/references/`) ; aucun chiffre inventé (valeurs lues dans les démos ou les captures, faits de `/en/method/` :
   appel de 30 min, prototype en quelques jours, automatisation 2-3 jours, outil 5-10 jours, 15 ans d'expérience dont 7
   en bureau d'études ; 97 templates, 34 sur règles françaises, nombre par thème de `/en/english-version/`).
3. **Texte** : 280 caractères au plus (une URL compte 23), contrôlé par
   `node docs/templates/communication/x/longueurs.mjs` après ajout au README sous `### X-nn · <date> · <format>` (bloc
   ```). Pas d'émoji, pas de superlatif, 0 à 2 hashtags. Lien en fin : `qm-engineering.fr/x` le plus souvent ;
   `/en/references/`, `/en/custom/` ou `/en/method/` quand le sujet s'y prête.
4. **Captures** : réelles (assets `templates-<slug>-<vue>.webp` des pages catalogue, ou démo `?demo` capturée avec
   Playwright), interface française acceptée ; l'écran le plus parlant visuellement (graphique, planning coloré, grand
   chiffre en titre ; `outils/x/templates-en.json` → `_captures`), jamais une fenêtre modale grisée ni une liste dense.
5. **Vidéo** : moteur unique `docs/videos/rendu.mjs` (page HTML animée, temps virtuel 30 i/s, sous 2,9 Mo), 1080 × 1920,
   20 à 30 s, **musique QME** (piste audio vérifiée avec `ffprobe`, jamais de vidéo muette), sous-titres anglais, carton
   final avec le lien. Ne jamais écrire un autre outil de capture vidéo. Modèle : `production/X-02.html`.
6. **Image** : 1600 × 900, page statique `production/X-nn.html` copiée de `production/gabarit-image.html`, rendue par
   `node docs/templates/communication/x/image.mjs production/X-nn.html` ; l'accroche correspond à la capture montrée.

## Horaire

Une publication par jour à **10:00 heure de Californie** (décision de Quentin du 18/11/2026) : colonne Heure du planning
= **19:00** (heure de Paris), **18:00** du 14 au 27/03/2027 et du 31/10 au 06/11/2027. Les années suivantes, recalculer
les deux périodes décalées (changement d'heure américain le 2e dimanche de mars et le 1er dimanche de novembre, européen
le dernier dimanche de mars et d'octobre).

## 1. Mesurer la réserve

Relire tout l'onglet `Planning` du Sheet « Planning publications X » `1lri4kqQO61Ei4s6w9za2UdudsPhdpas_zKuAIG5N8hM`
(le Sheet fait foi, le journal suit). Un jour est **couvert** s'il a une ligne au statut `Programmé`, `Publié` ou
`À produire` à l'heure quotidienne. Jours à remplir = jours non couverts de **demain à J+7** inclus.

- Une ligne `À produire` (vidéo prévue au README) dont la date est dans les 3 jours : la produire en priorité.
- Aucun jour à remplir et aucune vidéo urgente : ne rien produire ; une ligne de contrôle dans le journal ; résumé d'une
  ligne.
- **3 publications au plus par exécution**, dont **1 vidéo au plus** (coût et temps de rendu).

## 2. Choisir format, accroche, thème (rotation)

Lire les 14 dernières lignes du journal (colonnes Format, Accroche, Thème) avant de choisir.

- **Format** : `Post` (texte seul), `Image`, `Vidéo`. Jamais le même format deux jours de suite ; sur 7 jours : 2 ou 3
  posts, 2 ou 3 images, 1 ou 2 vidéos.
- **Accroche** (type, jamais le même dans les 4 derniers jours) : question directe · chiffre vrai · idée à contre-courant
  · avant / après · mini-histoire d'un projet · erreur fréquente · liste courte · coulisses (comment je l'ai construit)
  · conseil honnête (quand ne PAS faire de sur-mesure) · appel à réponse (« reply with… »).
- **Thème** (jamais le même dans les 3 derniers jours) : tableur qui déborde · rôles et droits d'accès · automatisation
  et IA · terrain et téléphone (chantier, atelier, entrepôt) · facturation et relances · planning et charge d'équipe ·
  maintenance et conformité · associations et clubs · méthode et délais · références par métier (`/en/references/`)
  · les 97 templates comme preuve (page `/en/english-version/`, demande de version anglaise) · règles d'un pays
  (pourquoi traduire ne suffit pas).
- **Template montré** (image ou vidéo) : jamais le même deux fois en 14 jours sur X.
- Sources possibles : anciens posts français sur le sur-mesure (`docs/templates/communication/sur-mesure/`, planning
  LinkedIn), adaptés en anglais en ne gardant que leurs faits ; références publiques ; démos.

## 3. Produire

ID = `X-nn` suivant (le plus grand numéro du Sheet + 1). Pour chaque publication :
1. Texte au README (`### X-nn · JJ/MM · <format> · <accroche> · <thème>` + bloc ```), puis `longueurs.mjs`.
2. Image : page `production/X-nn.html`, rendu, relecture de l'image (accroche lisible, capture nette, mention
   « French interface · sample data », rien de coupé).
3. Vidéo : page `production/X-nn.html`, `node docs/videos/rendu.mjs docs/templates/communication/x/production/X-nn.html
   <durée> <ms couverture> --sortie docs/templates/communication/x/production/X-nn-<sujet>.mp4`, puis `ffprobe`
   (1080 × 1920, durée, piste AAC sur toute la durée, < 2,9 Mo) et planche `ffmpeg -vf "fps=1,scale=216:-1,tile=11x3"`
   relue plan par plan.

## 4. Déposer et programmer (Instinct)

1. Image ou vidéo : dépôt dans le dossier Drive « QME – Publications X » `1W6TwJQC7BqoGBuoYJeLy62EOaXXroqyA`
   (`mcp__Google_Drive__create_file`, `base64Content` = `sha256:<empreinte>:<chemin absolu>`,
   `disableConversionToGoogleType: true`, `contentMimeType` `image/png` ou `video/mp4`), nom `X-nn-<sujet>.png|mp4` ;
   contrôler que la taille renvoyée égale celle du fichier.
2. Ligne du Sheet (colonnes A–K) : ID, date, heure quotidienne, statut, Type (`Post`, `Image` ou `Vidéo`), texte exact
   (identique au README), nom du fichier (G), ID Drive (H), I et J vides, remarque (K).
3. Statut `Programmé` si `journal-x.md` indique « Routine Instinct X transmise : oui » ; sinon `Prêt`. Ne jamais écrire
   `Publié` : c'est Instinct qui l'écrit (colonnes D, I, J). Ne déplacer ni supprimer aucune ligne existante.
4. Les vidéos X sont en anglais : elles ne vont **pas** dans le planning YouTube (chaîne en français).
5. Si une étape échoue (rendu, Drive, Sheets), ne rien programmer de partiel : noter l'échec dans le journal.

## 5. Journal et compte rendu

1. Ligne du journal `journal-x.md` : ID, date, heure, Format, Accroche, Thème, template, fichier / Drive, statut.
2. Commit sur la branche de travail. Une page publiée (`en/`, `assets/`, `outils/`) modifiée demande une PR et le feu
   vert de Quentin ; les fichiers de `docs/` et `.claude/` suivent les autres routines de contenu.
3. Résumé : réserve avant / après (premier jour non couvert), publications créées (ID, date, format, accroche, thème,
   texte), liens Drive, vérifications faites et non faites.
