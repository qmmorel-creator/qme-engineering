# Mini-story QME · « Le salaire a disparu ! » (pilote, 27/11/2026)

Statut : **validé par Quentin le 27/11/2026**, voix ElevenLabs à intégrer (version légère à produire après réception du MP3).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final | `rendu/qme_ministory_le-salaire-a-disparu_final.mp4` |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, voix, note d'intention | `script.md` |
| Découpage, continuité, plan audio, plan de sous-titres | `decoupage.md` |
| Storyboard | `storyboard.png` |
| Sous-titres | `qme_ministory_le-salaire-a-disparu.srt` (incrustés aussi dans le MP4) |
| Projet d'animation (source réutilisable) | `sources/page.html` + `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py`, `sources/repliques.tsv` |
| Pistes audio | `audio/voix/v01…v13`, `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, musique source |
| Assets | `assets/` (carton officiel, logo, captures Mon Budget, police Outfit + OFL) |

## Refaire ou corriger

```bash
E=docs/ministories/episodes/2026-11-27-le-salaire-a-disparu
# 1. voix (si texte changé) : voir la commande du skill, puis
python3 $E/sources/audio.py                              # pistes + mix ; met à jour les fins de répliques
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 26.7 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
ffmpeg -i $E/rendu/master-image.mp4 -i $E/audio/mix-final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
  -ar 48000 -ac 2 -movflags +faststart -shortest $E/rendu/qme_ministory_le-salaire-a-disparu_final.mp4
```

Pour une voix ElevenLabs : remplacer `audio/voix/vNN.wav` (48 kHz mono, une réplique par fichier) ou décaler les `t`
de `timeline.json`, puis relancer les étapes 1 à 5. Toute l'image suit la timeline.

## Fiche technique (mesurée par ffprobe / ebur128 sur le fichier final)

| | |
|---|---|
| Durée | 26,700 s (vidéo 26,700 s, audio 26,700 s) |
| Image | H.264 High, 1080 × 1920, 30 i/s, yuv420p, 2,38 Mb/s |
| Audio | AAC LC, 48 kHz, stéréo, 196 kb/s |
| Sonie | mix -16,0 LUFS intégrés, LRA 4,5 LU, crête -3,4 dBFS ; voix seule -15,4 LUFS, -2,0 dBTP |
| Conteneur | MP4, faststart, 8,6 Mo |

## Contrôles effectivement réalisés

1. **Décodage intégral** du MP4 sans erreur (`ffmpeg -f null`).
2. **Flux** : durées audio et vidéo identiques (26,700 s) ; l'audio couvre le carton jusqu'au bout.
3. **Visionnage** : 53 images extraites du MP4 final (toutes les 0,5 s) examinées en planches, plus deux planches
   d'aperçu corrigées avant rendu (sous-titre sur 3 lignes, monstres superposés, « 3,00 € » qui débordait,
   enveloppes sur le téléphone, mascotte dans la zone des boutons, page de calendrier ratée).
4. **Voix présente et dominante** : la piste voix a été retrouvée dans le mix par corrélation (décalage 5 ms dû à
   l'AAC) ; rapport voix / fond par réplique de +9,5 dB (v04, sur le whoosh) à +29,3 dB.
5. **Intelligibilité** : transcription automatique (Vosk, modèle français) du mix final : tout le texte est reconnu
   aux bons instants (±0,1 s), sauf « a faim » lu « afin » (homophone) et le sigle « QME » transcrit « cœur et me ».
6. **Carton** : fichier officiel `qme-carton-final-9x16-official.png` (941 × 1672) mis à 1080 px de large, centré sur
   le noir de ses propres bandes, sans recadrage ni surimpression, 4,0 s ; aucun sous-titre dessus.
7. **Sous-titres** : orthographe, apostrophes typographiques, espaces insécables relues ; deux lignes au plus.

**Non réalisé** : écoute humaine au casque ou sur téléphone (Claude n'entend pas ; les points 4 et 5 la remplacent
partiellement). À faire par Quentin avant publication.

## Limites et décisions

- **Voix provisoire** : synthèse Microsoft Edge (edge-tts, voix Henri). Les conditions d'usage commercial de ce
  service ne sont pas établies : la remplacer par une voix ElevenLabs avant toute publication (texte prêt dans `script.md`).
- **Musique** : piste du dossier Drive « QME - Musiques MiniStories » ; le nom du fichier suggère Pixabay, provenance
  et licence à confirmer par Quentin.
- **Bruitages** : synthétisés pour l'épisode, sans droits tiers.
- **Carreau** : module officiel ; fiche validée par Quentin le 27/11/2026.
- **Nom du produit** : le brief dit « Budget du foyer QME » ; le nom officiel publié est « Mon Budget » (le slug Gumroad
  est `budget-foyer`). Arbitrage : nom officiel.
- **Pas d'appel à l'action** dans la voix : le carton officiel porte déjà le site et « démos gratuites ».
- Dépôt Drive du MP4 : **non fait** (27/11/2026) ; le fichier de 8,6 Mo dépasse la limite de 4,2 Mo par appel du connecteur Drive. En attente de la décision de Quentin.
