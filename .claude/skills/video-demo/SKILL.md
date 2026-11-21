---
name: video-demo
description: Réaliser une vidéo courte (Reel Instagram / LinkedIn, 30 à 40 s, vertical) qui montre une interaction RÉELLE avec un template ou un pack QME en vente (navigation, UI, UX), habillée en motion design (caméra qui suit la souris, zooms, emphases du résultat, bruitages, musique QME calée sur le tempo), puis la déposer dans Google Drive et la programmer sur LinkedIn, Instagram et YouTube Shorts. À utiliser quand Quentin demande une vidéo de démonstration d'un template, de tourner / rendre / programmer un scénario de `docs/videos/scenarios/`, ou quand le skill `idee-video` l'appelle.
---

# Vidéo de démonstration d'un template QME

> **Règles communes (18/11/2026)** : appliquer `docs/templates/communication/REGLES-CONTENU.md` (au moins 1 publication par jour et
> 7 jours d'avance par plateforme, problème posé puis résolu, accroche, rétention, couleur d'accent Bauhaus en rotation,
> aucune vidéo muette) et les heures de `docs/templates/communication/HEURES.md`. Elles priment sur ce skill.

Outillage dans `docs/videos/` (privé, 404 sur le site) : `studio/` (toile 1080 × 1920 + habillage),
`moteur.mjs` (pilotage Playwright, capture, montage ffmpeg ; s'appuie sur `rendu.mjs`, le moteur vidéo unique de QME :
temps virtuel, encodage, musique), `scenarios/*.mjs` (une vidéo = un fichier),
`musique/` (piste de la présentation QME), `journal.md` (mémoire), `catalogue.mjs` (produits en vente).
Lire `reference.md` (API du studio et du moteur, règles de mise en scène) avant d'écrire un scénario.
Modèle complet : `docs/videos/scenarios/gantt-retard.mjs` (prototype validé par Quentin le 15/11/2026).

Explique chaque étape à Quentin en français, sans flatterie ; dis ce qui a été vérifié et ce qui ne l'a pas été.

## Règles non négociables

1. **Interaction réelle** : l'application du template tourne vraiment (serveur local, `?demo`). La vraie
   souris clique, le vrai clavier tape, l'application calcule. Aucun écran truqué, aucune valeur écrite
   en dur dans l'habillage : tout chiffre affiché (date, total, marge, écart) est **lu dans l'application**
   (`v.lire`) après le geste. Si la démo ne contient pas le cas voulu, le créer par des gestes réels à
   l'écran ou changer d'idée, jamais simuler.
2. **Un seul sujet** par vidéo : une fonctionnalité, un problème résolu, une question précise, ou un mode
   de fonctionnement. Accroche = le problème ou la question ; fin = la réponse montrée.
3. **Produit en vente** à l'instant du tournage (`node docs/videos/catalogue.mjs`). Jamais un template
   « bientôt ».
4. **Durée** : 30 s visé, **40 s au maximum** si la cohérence l'exige (le moteur avertit au-delà).
5. **Confidentialité et charte** (`docs/templates/IDEES.md`) : données de démo fictives uniquement, aucune
   marque tierce, aucun client ou projet réel, pas l'outil personnel de Quentin. Argent / santé : pas de
   promesse ; « ne remplace pas un avis professionnel » dans le texte de la publication si utile.
6. **Ton** : vouvoiement dans les textes à l'écran et les publications, phrases courtes, constat → geste →
   résultat. Pas d'émoji, pas de superlatif.
7. **Son** : jamais muet. `musique: 'auto'` dans le scénario : le moteur choisit un morceau de la bibliothèque QME
   (`docs/videos/musique/README.md` : « Corporate » et les quatre morceaux fournis par Quentin le 18/11/2026), varié
   d'une vidéo à l'autre et calé sur son tempo. Les quatre nouveaux font 30 s : avec `dureeMax: 29`, les cinq morceaux
   sont candidats ; au-delà, « Corporate ». Bruitages synthétisés sur les gestes. **Pas** de bruitage à chaque mot de l'accroche (un seul son d'entrée).
8. **Formes du fond calmes** : elles flottent lentement ; aucun battement ni clignotement sur elles.

## 1. Écrire le scénario

1. Ouvrir le template en démo (`npm run dev:templates`, puis `http://localhost:8888/templates/<slug>/?demo`)
   et l'explorer avec Playwright (captures, sélecteurs, valeurs) : trouver l'écran, le geste et le résultat.
   Relever les sélecteurs **stables** (attributs `data-*`, noms de tâches via `:has(input[value="…"])`,
   jamais un identifiant généré).
2. Créer `docs/videos/scenarios/<nnn>-<slug>-<sujet>.mjs` en partant du modèle : `config` (nom, produit,
   type, titre, app, musique, affiche), `preparer(v)` hors caméra (fermer les dialogues, lire les données
   de référence, contrôler que la démo contient bien le cas — sinon lever une erreur), `jouer(v)`.
3. **Référence (20/11/2026) : les 7 Reels de `REGLES-CONTENU.md` § 3 bis** (vrai problème chiffré lu dans la démo → bascule →
   solution ; accroche entière dès la première image : `S('accroche', lignes, 0)` et `waitForTimeout(1500)` après
   `S('fenetre', false)` dans `preparer`). Trame type (sur le tempo, `v.temps()`) : accroche plein écran → fenêtre →
   zoom sur l'élément clé → geste(s) suivis par la caméra (`S('suivre')`) → emphase du résultat sur la
   ligne (`avantApres`, `flash`) → panoramique vers le résultat global (`cadrer`) → verdict (`tampon`,
   `eclat` si bonne nouvelle, `secouer` si mauvaise) → éventuel deuxième cas ou navigation vers un autre
   écran → outro (`volet`, `outro` : nom du produit, bénéfice en une ligne, « Essai gratuit 14 jours ·
   qm-engineering.fr/essai » pour un template en vente, sinon « Démo gratuite · qm-engineering.fr »).

## 2. Rendre et vérifier

1. `node docs/videos/moteur.mjs docs/videos/scenarios/<fichier>.mjs` (`--brouillon` pour itérer vite).
   Sortie : `docs/videos/sortie/<nom>.mp4` (720 × 1280, < 2,9 Mo), `<nom>-couverture.png` (1080 × 1920),
   `<nom>.json`. En cas d'échec, `sortie/<nom>-erreur.png` montre l'état de l'écran.
2. **Vérifier image par image** (planche `ffmpeg -vf "fps=1,scale=180:-1,tile=11x4"` puis lecture) :
   les gestes ont bien modifié l'application, chaque étiquette est à côté de son élément et dans la
   fenêtre, aucune légende ou tampon ne masque le résultat, textes lisibles, durée ≤ 40 s.
3. Mesurer le son : `ffmpeg -i <mp4> -af ebur128=framelog=quiet -f null -` → environ -14 LUFS.
4. Envoyer la vidéo à Quentin (`SendUserFile`) avec ce qui a été vérifié.

## 3. Déposer dans Google Drive

Dossier « QME – Vidéos démo templates » : `1-gRUlryvfCvIwyR8EGklh0adot9YRCIF`.
Envoi par `mcp__Google_Drive__create_file` avec `base64Content` = `sha256:<empreinte>:<chemin absolu>`,
`contentMimeType: video/mp4`, `disableConversionToGoogleType: true`, titre `AAAA-MM-JJ_<nom>.mp4` (copie
locale à ce nom avant l'envoi, supprimée après). Limite du connecteur : environ 3,1 Mo par fichier (d'où
la sortie < 2,9 Mo). Déposer aussi la couverture (`…-couverture.png`).

## 4. Programmer sur LinkedIn, Instagram et YouTube Shorts

Détail des colonnes et des dossiers : `reference.md` § Programmation. Résumé :

1. Relire **juste avant d'écrire** les trois onglets `Planning` (LinkedIn `A1:N`, Instagram `A1:P`, YouTube
   `A1:O`) : d'autres sessions les modifient.
2. **Date** : la plus proche, à partir de demain, où **aucun des deux plannings** n'a déjà une vidéo
   (LinkedIn format « Vidéo », Instagram format « Reel », statut ≠ « Annulé »). Même date sur les deux.
3. **Heures** : LinkedIn **17:30** (fin d'après-midi ; les autres posts sont à 10:00 ou 12:15) ;
   Instagram **12:30** (pause déjeuner ; les autres sont à 19:00). Deux publications par jour et par réseau.
4. Copier la vidéo (et la couverture pour Instagram) dans les dossiers Images de chaque réseau
   (`mcp__Google_Drive__copy_file`), aux noms `LI-nn-<slug>-video.mp4`, `IG-nn-<slug>.mp4`,
   `IG-nn-<slug>-couverture.png`.
5. Créer les Google Docs de texte (LinkedIn : dossier Textes LinkedIn ; Instagram : dossier Textes Instagram)
   au format strict de la routine : texte à publier, puis ligne `———`, puis `PREMIER COMMENTAIRE` avec le
   lien de la démo (et du produit), rien d'autre. Jamais « [à compléter] ». Template en vente (vie personnelle ou pro) : le lien
   principal est l'essai gratuit (`qm-engineering.fr/essai/?t=<slug>`, « 14 jours d'essai gratuit, sans carte »),
   la démo en second (`REGLES-CONTENU.md` § 7).
6. Insérer chaque ligne **à sa place chronologique** (`insert_dimension` puis `update_values`), ID suivant
   (`LI-` / `IG-` + plus grand numéro + 1), colonne O d'Instagram = l'ID LinkedIn.
7. **Statut** : « Programmé » si `journal.md` indique « Routine Instinct v4 transmise : oui » (instruction
   de Quentin du 15/11/2026 : les vidéos sont programmées sans relecture intermédiaire) ; sinon « Prêt »,
   et rappeler à Quentin de transmettre `PROMPT-INSTINCT-v4.md`.
8. **YouTube Shorts** (TikTok repris le 18/11/2026 : Instinct reprend lui-même le Reel Instagram sur TikTok, vidéo seule, rien à ajouter ici) : une ligne `YT-nn` dans le planning
   YouTube, même date, heure **12:00**, à sa place chronologique ; titre (100 caractères au plus) et description
   complète dans la ligne (modèle : `docs/templates/communication/youtube/README.md`), ID Drive = la vidéo
   Instagram, colonnes J/K = IDs Instagram et LinkedIn. Statut « Programmé » si `journal.md` indique « Routine
   Instinct YouTube transmise : oui », sinon « Prêt ».
9. Relire les plages écrites (ordre des dates, IDs Drive). Ne jamais publier soi-même ni écrire « Publié ».

## 5. Clore

1. Ajouter la ligne de la vidéo dans `docs/videos/journal.md` (n°, date, produit, type, titre, scénario,
   durée, lien Drive, ID LinkedIn + date, ID Instagram + date, ID YouTube + date, statut).
2. Commit sur la branche de travail (scénario, journal ; `sortie/` est ignoré par git), push. **Aucune
   fusion dans `main`** sans feu vert de Quentin.
3. Résumé à Quentin : sujet, durée, ce qui est vérifié, lien Drive, dates et heures programmées (LinkedIn, Instagram, YouTube), statut.
