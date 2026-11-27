# Mini-story QME n° 2 · « Qui a payé les croissants ? » (27/11/2026)

Statut : **produite, voix provisoire edge-tts** ; voix ElevenLabs à intégrer, écoute humaine à faire par Quentin.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 8,0 Mo) | `rendu/qme_ministory_02-qui-a-paye-les-croissants_final.mp4` |
| MP4 léger (2,76 Mo), déposé dans Drive | `rendu/qme_ministory_02-qui-a-paye-les-croissants_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1LRaRUjW0Zu68bG4G0hvOnLKyR2SIizpp/view) (`qme_ministory_02-qui-a-paye-les-croissants.mp4`) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_02-qui-a-paye-les-croissants.srt` (incrustés aussi) |
| Projet d'animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py` (ajout d'un bruitage « marteau » synthétisé), `sources/repliques.tsv` |
| Voix / pistes | `audio/voix/v01–v10.wav`, `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav` |
| Musique | `audio/musique-alex-morgan-funny-funny-music-545489.mp3` (Drive `1DQL9fLyb2A2vfby-MFEDfLHiGkb0trld`, « QME - Musiques MiniStories », libre de droits) |
| Assets | `assets/` (carton officiel, logo, captures `templates-budget-commun-tel` et `-soldes`, police Outfit + OFL) |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-02-qui-a-paye-les-croissants
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 29.4 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 29.4 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 29,400 s / 29,400 s | 29,400 s / 29,400 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, débit réduit |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,3 LUFS, crête -3,3 dBFS | -16,3 LUFS, crête -3,5 dBFS |
| Taille | 8 026 349 o | 2 760 252 o |

Voix seule : -15,8 LUFS, crête -2,0 dB.

## Contrôles réalisés

1. ffprobe et décodage intégral des deux MP4 sans erreur ; flux de même durée.
2. Planches d'aperçu puis images du MP4 final toutes les 0,5 s : corrigés avant livraison un carré du décor qui
   chevauchait les tasses, un sous-titre sur 3 lignes (v07, passé en 46 px), un extrait de capture rogné, des tampons
   « PAYÉ » visibles 0,2 s (recalés sur le mot « payé »). Carton officiel intact de 25,4 à 29,4 s, sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix/fond par réplique de
   **+8,9 dB** (v10, longues pauses de jeu remplies par la musique et le marteau) à **+25,4 dB** (v06).
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment. Écarts propres au modèle : « coloc »
   → « colloque », « à qui » → « acquis », « payé » parfois « payer ».
5. Dépôt Drive vérifié par recherche dans le dossier (2 760 252 octets, identique).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites

- Voix **provisoire** edge-tts (fr-FR-HenriNeural), droits commerciaux non établis : à remplacer par ElevenLabs (texte continu dans `script.md`).
- 69 mots, légèrement au-dessus de la cible 45–65.
- La musique (24,96 s) est bouclée par `audio.py` : la reprise tombe vers 25 s, à l'entrée du carton (à écouter).
- Deux colocataires (prénoms et couleurs de la démo) plutôt que trois, pour coller à la capture réelle.
