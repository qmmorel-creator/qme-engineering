# Production : outils réellement disponibles et réglages

Testé le 27/11/2026 dans une session cloud Claude Code. Aucun outil de génération d'image ou de vidéo par IA n'y est
disponible : l'animation est **dessinée en SVG** (formes Bauhaus, `carreau.js`) et rendue par le moteur du dépôt.

## Arborescence d'un épisode

```
docs/ministories/episodes/AAAA-MM-JJ-<slug>/
  README.md  script.md  decoupage.md  storyboard.png  qme_ministory_<slug>.srt
  sources/  page.html timeline.json timeline.js carreau.js audio.py repliques.tsv
  audio/    voix/vNN.wav piste-voix.wav piste-bruitages.wav bruitages/ mix-final.wav musique-*.mp3
  assets/   carton officiel, logo, captures produit, police
  rendu/    master-image.mp4 (+ couverture) qme_ministory_<slug>_final.mp4
```

Partir d'une copie du pilote ; ne jamais modifier les fichiers de référence d'origine (assets du site, Drive, module
Carreau) : on copie dans `assets/` de l'épisode.

## Assets de référence

Drive « QME - Assets MiniStories » (`1LdRDE1pYzZ-2quAi1HW3Y3IW2uLWTGc2`) : `qme-carton-final-9x16-official.png`,
`qme-logo-original.png`, `qme-mascot-original-reference.jpeg`, `qme-typography-reference.png`, bannière.
Téléchargement : connecteur Google Drive, `download_file_content` (fichier enregistré localement). Captures produit :
`assets/templates-<produit>-*.webp` du dépôt.

## Voix

```bash
pip install edge-tts
cat /root/.ccr/ca-bundle.crt >> "$(python3 -c 'import certifi;print(certifi.where())')"   # proxy de la session
while IFS=$'\t' read id rate pitch txt; do
  edge-tts --voice fr-FR-HenriNeural --rate=$rate --pitch=$pitch --text "$txt" --write-media audio/voix/$id.mp3
  ffmpeg -nostdin -v error -y -i audio/voix/$id.mp3 -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" -ar 48000 -ac 1 audio/voix/$id.wav
done < sources/repliques.tsv
```

`-nostdin` est indispensable dans la boucle (sinon ffmpeg mange l'entrée). Voix françaises : Henri, Remy (hommes),
Denise, Eloise, Vivienne (femmes). **Provisoire** : usage commercial non établi. Définitif : ElevenLabs, fichiers déposés
par Quentin, un par réplique ou un seul fichier à découper aux silences.

## Image

- `sources/page.html` : 1080 × 1920, `window.placer(ms)` dessine l'image exacte ; scènes `S.Sn(t, l)` ; `pose(ms)`
  quantifie le mouvement à 12 poses/s ; sous-titres HTML dans `#st` ; carton dans `#carton`.
- Zones sûres : rien d'important au-dessus de y = 220, sous y = 1540, ni à droite de x = 930 dans la moitié basse.
  Sous-titres : haut du bloc à y = 1350, 56 px, deux lignes au plus (coupes forcées dans `COUPES`).
- **Aperçu** (avant le rendu complet) : script Playwright qui charge la page, appelle `placer(t)` pour 12 instants et
  assemble une planche (voir le pilote) ; l'examiner et corriger.
- **Rendu** : `node docs/videos/rendu.mjs <page> <durée> 600 --muet --taille-max 14 --sortie <master>` (master de
  qualité ; sans `--taille-max`, vise 2,9 Mo pour le connecteur Drive).

## Audio

`sources/audio.py` (numpy + ffmpeg) : voix normalisée par réplique, compresseur 3:1 puis `loudnorm` I=-15,5 TP=-2 ;
bruitages synthétisés (ka-ching, pop, whoosh, croc, zap, blips, tic-tac, chute, alarme, pose, ding) ; musique en
boucle, volume 0,22, `sidechaincompress` déclenché par la voix (seuil 0,015, ratio 10, attaque 15 ms, relâche 350 ms),
remontée sur le carton, fondu final ; `alimiter` 0,78. Cibles : voix -15 à -16 LUFS, mix ≈ -16 LUFS, crête ≤ -1,5 dB.

## Contrôles automatiques possibles

- `ffprobe` (codecs, tailles, durées des flux), `ffmpeg -f null` (décodage complet), `ebur128=peak=true` (sonie).
- Présence de la voix : corrélation piste voix / mix (le mix AAC est décalé d'environ 240 échantillons), puis rapport
  voix / fond par réplique (le pilote obtient +9,5 à +29 dB).
- Intelligibilité : Vosk (`pip install --no-deps vosk tqdm cffi`, module `srt` vide sur le PYTHONPATH, modèle
  `vosk-model-small-fr-0.22` d'alphacephei.com), transcription du mix avec horodatage.
- Visionnage : images du MP4 final toutes les 0,5 s (`fps=2,tile=9x3`) examinées en planches.

## Manuel (reste à Quentin)

Écoute humaine sur téléphone, voix ElevenLabs définitive, validation de la musique, publication (agent de contenu).

## Droits et traçabilité

Consigner dans le README de l'épisode la provenance de chaque son et image : voix (outil, voix), musique (fichier,
dossier, licence connue ou non), bruitages (synthétisés), captures (dépôt), police (Outfit, OFL), carton (Drive).
