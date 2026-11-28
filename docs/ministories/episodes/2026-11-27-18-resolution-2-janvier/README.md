# Mini-story QME n° 18 · « La résolution du 2 janvier » (27/11/2026)

Statut : produit, **voix définitive ElevenLabs « Caroline - Warm, Sweet and Soft »** (27/11/2026). Non programmé.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (6,5 Mo) | `rendu/qme_ministory_18-resolution-2-janvier_final.mp4` |
| MP4 léger (2,73 Mo), déposé dans Drive | `rendu/qme_ministory_18-resolution-2-janvier_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1gcALSUl8JcZH6ixYciTggdHW5fNtq-iJ/view) (id `1gcALSUl8JcZH6ixYciTggdHW5fNtq-iJ` ; version edge-tts `11UwclWbjmWycPTR_JGpp49s6Q1T9ZilA` mise à la corbeille) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_18-resolution-2-janvier.srt` (incrustés aussi) |
| Projet | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés), `sources/audio.py`, `sources/repliques.tsv` |
| Voix | `audio/elevenlabs/` (MP3 source ElevenLabs 44,1 kHz mono 24,03 s, WAV 48 kHz mono) ; voix provisoire edge-tts conservée : `audio/voix/v01–v11.wav`, `sources/timeline-voix-provisoire.json` |
| Audio | `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-atlasaudio-funny-606256.mp3` |
| Assets | carton officiel (copie exacte), logo, captures `templates-habitudes-tel.webp` et `-bilan.webp`, police Outfit + OFL |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-18-resolution-2-janvier
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 28.8 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 28.8 600 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192k (final) / 112k (léger), -c:v copy, -shortest
```

## Voix et recalage

Voix définitive : ElevenLabs, « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`), modèle `eleven_v4`, une seule
génération par le connecteur le 27/11/2026 (24,03 s), placée d'un seul tenant à 0,50 s (`voix_source`). Répliques
relevées par `silencedetect` (-40 dB, 0,18 s) et transcription Vosk horodatée. `timeline.json › montage` recale les
scènes (repère du premier montage) sur les mots ; le gag « Canapé 10 · Carreau 0 » est accéléré (×2 environ) entre
« le canapé a gagné » et « Avec le Suivi… ». Bruitages recalés dans les silences ; retirés car ils tombaient sur un
mot : chute, tic-tac, alarme et whoosh d'entrée de S5.

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 28,800 / 28,800 s | 28,800 / 28,800 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, débit réduit |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,1 LUFS, crête -4,6 dBFS | -16,1 LUFS, crête -4,4 dBFS |
| Taille | 6 176 225 o | 2 733 732 o |

Voix seule : -15,6 LUFS, -2,0 dBTP. Carton : 24,8–28,8 s (4 s).

## Contrôles réalisés (version ElevenLabs)

1. Décodage intégral des deux MP4 sans erreur ; durées audio et vidéo égales (28,800 s).
2. Planche d'aperçu avant rendu, puis planche du MP4 léger toutes les 0,5 s : chaque scène sur ses mots, carton intact sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de **+13,5 dB** (v10) à **+25,9 dB** (v03).
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts propres au modèle : « Deux janvier » → « de janvier », « Demain aussi » → « deux mains aussi », « QME » → « cœur m e », « tient » → « tiens », « a gagné » → « à gagner ».
5. Dépôt Drive vérifié par recherche dans le dossier (2 733 732 octets, identique), puis ancienne vidéo edge-tts mise à la corbeille.
6. SRT régénéré depuis la nouvelle timeline.

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites

- Le produit arrive à 12,3 s sur 24,8 s d'histoire (50 %), un peu avant la moitié.
- La coche bleue sur la case « Pas d'écran au lit » est une surimpression animée sur la capture réelle (geste « une touche pour cocher » de la fiche) ; les chiffres 74 % et 25 j sont ceux de la démo fictive.
- Musique : `atlasaudio-funny-606256.mp3`, Drive « QME - Musiques MiniStories » (id `1f-kN9Hog7H8i-a8Oz31QjGbUsUX6umqP`), libre de droits (confirmé par Quentin le 27/11/2026). Bruitages synthétisés ; police Outfit (OFL) ; carton : Drive « QME - Assets MiniStories ».
