# Mini-story QME n° 7 · « Révisions : la nuit blanche » (27/11/2026)

Statut : **produite, voix provisoire edge-tts** ; voix ElevenLabs à générer par Quentin (texte continu dans `script.md`). Non programmée (agent de contenu unique).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 7,0 Mo) | `rendu/qme_ministory_07-nuit-blanche_final.mp4` |
| MP4 léger (2,72 Mo), déposé dans Drive | `rendu/qme_ministory_07-nuit-blanche_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1Zq-MgMkj8nGefcXWJEnNBto2ZhXHbYVh/view) (id `1Zq-MgMkj8nGefcXWJEnNBto2ZhXHbYVh`) |
| Master image (muet), couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard, sous-titres | `script.md`, `decoupage.md`, `storyboard.png`, `qme_ministory_07-nuit-blanche.srt` |
| Animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Audio | `sources/audio.py`, `sources/repliques.tsv`, `audio/voix/v01–v10.wav`, pistes, `audio/mix-final.wav`, musique |
| Assets | carton officiel, logo, captures `templates-revision-{tel,planning,jour}.webp`, police Outfit + OFL |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-07-nuit-blanche
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 27.4 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 27.4 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192k (final) / 112k (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 27,400 / 27,400 s | 27,400 / 27,400 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,0 LUFS, crête -4,3 dBFS | -16,1 LUFS, crête -4,3 dBFS |
| Taille | 7,01 Mo | 2,72 Mo (2 719 496 octets) |

Voix seule : -15,3 LUFS, crête -2,0 dB.

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; durées des flux égales.
2. Planche d'aperçu avant rendu, corrigée (lune doublée, Carreau entièrement caché sous les fiches, Carreau sur les sous-titres en S4, cadrage du planning) ; planche du MP4 final toutes les 0,5 s examinée : sous-titres sur 2 lignes au plus, zones sûres respectées, carton intact sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix/fond par réplique de +12,3 dB (v04) à +25,0 dB (v02).
4. Transcription Vosk : toutes les répliques reconnues au bon moment ; écarts du modèle : « QME » → « cœur me », « J+1 » → « j plus sain », « J+7 » → « j plus cette ».
5. Dépôt Drive vérifié par recherche dans le dossier (taille identique).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et provenance

- Voix : edge-tts `fr-FR-HenriNeural`, **provisoire** (usage commercial non établi). Définitive : ElevenLabs.
- Musique : `viacheslavstarostin-funny-funny-music-634353.mp3`, Drive « QME - Musiques MiniStories » (id `1p6_Kd5BdbzZe4fgczwLufkskQnMwe7pj`), libre de droits.
- Bruitages synthétisés ; captures produit du dépôt ; Carreau module officiel ; police Outfit (OFL) ; carton officiel.
- Aucune promesse de réussite, aucun prix ; heures et chapitres fictifs. « CE SOIR : 1 » est une donnée de l'histoire, pas une fonction affirmée.

## Texte continu pour ElevenLabs

> Veille d'examen. Quatorze chapitres. Une seule nuit. Chapitre un… deux… trois… Café. Encore un café. Quatre heures du matin. Chapitre quoi, déjà ?! Version deux : le Planning de révision, de QME. Chaque chapitre revient au bon moment : J plus un, J plus trois, J plus sept. Et la veille d'examen… devient une soirée normale.
