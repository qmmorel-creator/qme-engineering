# Mini-story QME n° 18 · « La résolution du 2 janvier » (27/11/2026)

Statut : produit, **voix provisoire edge-tts** (Henri) ; voix ElevenLabs à générer par Quentin. Non programmé.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (6,5 Mo) | `rendu/qme_ministory_18-resolution-2-janvier_final.mp4` |
| MP4 léger (2,73 Mo), déposé dans Drive | `rendu/qme_ministory_18-resolution-2-janvier_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/11UwclWbjmWycPTR_JGpp49s6Q1T9ZilA/view) (id `11UwclWbjmWycPTR_JGpp49s6Q1T9ZilA`) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_18-resolution-2-janvier.srt` (incrustés aussi) |
| Projet | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés), `sources/audio.py`, `sources/repliques.tsv` |
| Audio | `audio/voix/v01–v11.wav`, `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-atlasaudio-funny-606256.mp3` |
| Assets | carton officiel (copie exacte), logo, captures `templates-habitudes-tel.webp` et `-bilan.webp`, police Outfit + OFL |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-18-resolution-2-janvier
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 28.3 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 28.3 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192k (final) / 112k (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 28,300 / 28,300 s | 28,300 / 28,300 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, débit réduit |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,3 LUFS, crête -4,5 dBFS | -16,3 LUFS, crête -4,5 dBFS |
| Taille | 6 516 091 o | 2 732 898 o |

Voix seule : -15,4 LUFS, -2,0 dBTP. Carton : 24,3–28,3 s (4 s).

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; durées audio et vidéo égales.
2. Aperçus avant rendu corrigés (bandeau qui chevauchait l'haltère, haltère caché derrière le canapé), puis planche du MP4 final toutes les 0,5 s : sous-titres sur 2 lignes au plus, zones sûres respectées, carton intact sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de **+5,9 dB** (v10, longues pauses de jeu remplies par la musique) à **+21,5 dB** (v08) ; v03 +7,7, v11 +9,9.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts propres au modèle : « Deux » → « de », « QME » → « cœur m », « tient » → « tia », « Carreau » → « car », « a gagné » → « à gagner ».
5. Dépôt Drive vérifié par recherche dans le dossier (2 732 898 octets, identique).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites

- Voix edge-tts provisoire (droits commerciaux non établis) ; voix définitive ElevenLabs à partir du texte continu de `script.md`.
- Le produit arrive à 11,1 s sur 24,3 s d'histoire (46 %), un peu avant la moitié.
- La coche bleue sur la case « Pas d'écran au lit » est une surimpression animée sur la capture réelle (geste « une touche pour cocher » de la fiche) ; les chiffres 74 % et 25 j sont ceux de la démo fictive.
- Musique : `atlasaudio-funny-606256.mp3`, Drive « QME - Musiques MiniStories » (id `1f-kN9Hog7H8i-a8Oz31QjGbUsUX6umqP`), libre de droits (confirmé par Quentin le 27/11/2026). Bruitages synthétisés ; police Outfit (OFL) ; carton : Drive « QME - Assets MiniStories ».
