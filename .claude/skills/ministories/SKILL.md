---
name: ministories
description: Produire une mini-story publicitaire QME (micro-histoire drôle de 20 à 30 s, verticale 1080 × 1920, avec la mascotte Carreau dite « Caro ») de l'idée au MP4 final contrôlé - script, découpage, storyboard, animation vectorielle par le moteur docs/videos/rendu.mjs, voix française, musique, bruitages, sous-titres, carton final officiel. À utiliser quand Quentin écrit « fais une mini-story QME sur <sujet> », « une mini-story avec Caro / Carreau sur <sujet> », « QME MiniStories », ou demande de corriger, décliner ou refaire un épisode de docs/ministories/episodes/.
---

# Mini-stories QME (avec Carreau, « Caro »)

Une mini-story raconte en 20 à 30 s une situation reconnaissable qui dégénère, puis un produit QME **réel** la résout
dans l'histoire. Ce skill est la procédure ; les données permanentes sont dans `references/`, les modèles à remplir
dans `modeles/`, et l'épisode pilote complet sert de gabarit : `docs/ministories/episodes/2026-11-27-le-salaire-a-disparu/`.

**Une seule marque, un seul personnage.** « Caro » est **Carreau**, la mascotte QME (cellule de tableur « A1 ») : ce
n'est pas une seconde marque. Une demande « mini-story Caro » est une mini-story QME où Carreau tient le rôle principal
(c'est le cas par défaut). Charte : `references/charte-qme.md` ; personnage : `references/carreau.md`.

## 0. Avant tout

1. Lire `references/charte-qme.md`, `references/carreau.md`, `references/ecriture.md`, `references/production.md`.
2. Règles du dépôt qui s'appliquent ici : moteur vidéo unique `docs/videos/rendu.mjs` (jamais d'autre outil de
   capture) ; aucune vidéo muette ; une publication par plateforme et par jour (la programmation passe par l'agent de
   contenu unique, ce skill ne programme rien) ; rien de fusionné dans `main` sans Quentin.
3. Le skill `qme-ministories` (compte claude.ai, flux ElevenLabs manuel) reste valable pour ses règles de carton et de
   musique ; ce skill-ci les reprend et y ajoute la production automatisée.

## Liste des sujets et réserve (décision de Quentin du 27/11/2026)

**Suivre toujours `docs/ministories/sujets.md`**, la liste gérée avec Quentin dans ses conversations : il ne valide que
les pitchs ; un sujet `retenu` se produit directement, dans l'ordre du rang, **sans validation du scénario** (le
scénario est écrit dans `script.md` de l'épisode). **Réserve : 7 vidéos d'avance** dans le dossier Drive « QME - Vidéos
Ministories » (fichiers `qme_ministory_*.mp4`) ; produire chaque jour ce qui manque pour revenir à 7. Moins de 5 sujets
`retenu` : proposer 10 pitchs (`proposé`) pour classement. Branche de production : `claude/mini-stories-qme-caro-b07mx2`.

## 1. Brief (5 minutes)

Copier `modeles/brief.md` dans un nouveau dossier `docs/ministories/episodes/AAAA-MM-JJ-<slug>/` et le remplir :
sujet, produit, **bénéfices vérifiés** (lire la fiche `catalogue/<produit>/index.html` : FAQ et JSON-LD), ce qui est
interdit d'affirmer. Un produit doit être **en vente** (`node outils/gumroad/ecart.mjs` ou la fiche catalogue). Ne
rien inventer : ni fonction, ni prix, ni chiffre de résultat, ni témoignage. Le nom du produit est celui de la fiche.

## 2. Écriture (voir `references/ecriture.md`)

Structure : accroche (0–2 s) → situation → escalade en 3 ou 4 temps qui accélèrent → ellipse ou moment de vérité →
gag central → solution intégrée (le produit agit à l'écran, capture réelle) → payoff qui rappelle le gag → carton 4 s.
Écrire dans `script.md` (modèle `modeles/script.md`) : note d'intention en 4 lignes, répliques courtes (narrateur hors
champ ; **Carreau ne parle jamais**), bruitages, silences. 45 à 65 mots. Lire à voix haute ; couper toute réplique
qui dit ce que l'image montre.

## 3. Découpage et continuité

`decoupage.md` (modèle `modeles/decoupage.md`) : plan par plan (temps, action, cadrage, intention, son, transition),
fiche de continuité (expressions de Carreau par plan, formes et couleurs fixes des accessoires), plan audio, plan de
sous-titres. Tous les temps vivent dans **`sources/timeline.json`** (scènes, voix, bruitages) : c'est la source unique.

## 4. Voix : ElevenLabs, voix « Caroline » (décision de Quentin du 27/11/2026)

Voix définitive générée par le **connecteur ElevenLabs** (outils `mcp__ElevenLabs__*`, à charger par ToolSearch
« elevenlabs ») avec la voix **« Caroline - Warm, Sweet and Soft »** (celle du pilote), en français :
`creative_generate_speech` avec `voice_id: "kwhMCf63M8O3rCfnQ3oQ"` (relevé le 27/11/2026 par `creative_list_voices`,
recherche « Caroline », langue `fr` ; le revérifier si l'appel échoue), `model_id: "eleven_v4"`, **`generations_count: 1`**,
`prompt` = texte continu du script. Puis `creative_get_flow_run_status` (flow_id, session_ids) en attendant
`poll_after_seconds` entre deux appels, jusqu'à `all_completed` ; télécharger l'audio par l'URL de la génération.
Ne jamais relancer une génération pour « réessayer » : chaque appel est facturé. Générer le **texte
continu** du script en une seule prise (meilleure interprétation), récupérer le MP3, puis le recaler comme le pilote
(`references/production.md` § Voix ElevenLabs : `voix_source`, répliques relevées par silences et transcription,
`montage` si la durée change). Copie du MP3 dans `audio/elevenlabs/`. Consomme les crédits ElevenLabs de Quentin : une
seule génération par épisode, sauf défaut audible ou transcription en échec.

**Si le connecteur ne répond pas** : voix provisoire edge-tts (`references/production.md` § Voix) et, à côté de la vidéo
dans le Drive, un fichier `qme_ministory_NN-<slug>_elevenlabs.txt` contenant le texte à coller dans ElevenLabs. Dès que
la version avec la voix Caroline existe (connecteur revenu ou MP3 fourni par Quentin) : déposer le MP4 final, puis
**supprimer du Drive le MP4 provisoire et le fichier texte** ; seul reste le MP4 avec la bonne voix (même nom de fichier).

## 5. Image

Copier `sources/page.html` du pilote et réécrire seulement les fonctions de scène `S.Sn(t, l)` : décor, accessoires,
Carreau (`mascotte({x, y, s, expr, bras})`, qui appelle le module officiel `carreau.js`), captures réelles du produit
(`assets/templates-<produit>-*.webp`). Tout est fonction du temps (`window.placer(ms)`) : rendu exact et rejouable.
Faire une **planche d'aperçu** (`references/production.md` § Aperçu) et la corriger avant le rendu complet.

## 6. Audio

`python3 sources/audio.py` : place les répliques, normalise la voix (-15,5 LUFS, -2 dBTP), synthétise les bruitages,
mixe la musique avec ducking, limiteur. Musique libre de droits, différente à chaque épisode (`references/production.md` § Musique) : Drive « QME - Musiques MiniStories » ou
`docs/videos/musique/` (provenance consignée dans le README de l'épisode).

## 7. Rendu et assemblage

```bash
E=docs/ministories/episodes/<dossier>
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html <durée> 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
ffmpeg -i $E/rendu/master-image.mp4 -i $E/audio/mix-final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
  -ar 48000 -ac 2 -movflags +faststart -shortest $E/rendu/qme_ministory_<slug>_final.mp4
```

Version Drive ou réseaux sous 2,9 Mo si nécessaire : relancer le rendu sans `--taille-max`.

## 8. Contrôle qualité obligatoire

Remplir `modeles/controle-qualite.md` dans le README de l'épisode. Rien n'est « livré » tant que chaque ligne n'a pas
son résultat mesuré, et chaque contrôle impossible est écrit comme tel (Claude n'entend pas : l'écoute humaine reste à
Quentin ; la corrélation voix/mix et la transcription automatique la complètent sans la remplacer).

## 9. Livraison

README de l'épisode (modèle : celui du pilote) : fichiers, fiche technique mesurée, contrôles, limites. Dépôt du MP4
final dans le dossier Drive « QME - Vidéos Ministories » (`1lpoKvq5L43X8gm9TZKcslXMwkYViOtOr`), vérifié par une
recherche dans ce dossier. Commit sur la branche de travail. Compte rendu à Quentin : liens, contrôles, ce qui reste à
valider (voix, musique, publication).
