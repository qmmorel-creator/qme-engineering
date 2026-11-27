# Mini-story QME n° 2 · « Qui a payé les croissants ? » (27/11/2026)

Statut : **produite avec la voix définitive ElevenLabs « Caroline »** (27/11/2026) ; écoute humaine à faire par Quentin.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 6,9 Mo) | `rendu/qme_ministory_02-qui-a-paye-les-croissants_final.mp4` |
| MP4 léger (2,75 Mo), déposé dans Drive | `rendu/qme_ministory_02-qui-a-paye-les-croissants_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1NUNdP_WjPDXLVVx5Hg7wZ111a71XjIeq/view) (`qme_ministory_02-qui-a-paye-les-croissants.mp4`) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_02-qui-a-paye-les-croissants.srt` (incrustés aussi) |
| Projet d'animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py` (ajout d'un bruitage « marteau » synthétisé), `sources/repliques.tsv` |
| Voix / pistes | `audio/elevenlabs/` (MP3 source ElevenLabs et WAV 48 kHz mono) ; voix provisoire edge-tts conservée : `audio/voix/v01–v10.wav`, `sources/timeline-voix-provisoire.json` ; `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav` |
| Musique | `audio/musique-alex-morgan-funny-funny-music-545489.mp3` (Drive `1DQL9fLyb2A2vfby-MFEDfLHiGkb0trld`, « QME - Musiques MiniStories », libre de droits) |
| Assets | `assets/` (carton officiel, logo, captures `templates-budget-commun-tel` et `-soldes`, police Outfit + OFL) |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-02-qui-a-paye-les-croissants
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 28.3 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 28.3 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 28,300 s / 28,300 s | 28,300 s / 28,300 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, débit réduit |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,0 LUFS (mix) | -16,0 LUFS, crête -4,0 dBFS |
| Taille | 6 911 811 o | 2 749 385 o |

Voix seule : -15,8 LUFS (loudnorm crête -2 dBTP).

## Voix et recalage

Voix définitive : ElevenLabs, « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`), modèle `eleven_v4`, une seule
génération le 27/11/2026 (23,84 s, texte de `docs/ministories/elevenlabs/qme_ministory_02-qui-a-paye-les-croissants_elevenlabs.txt`),
placée d'un seul tenant à 0,20 s (`timeline.json › voix_source`). Débuts et fins des répliques relevés par `silencedetect` et
transcription Vosk horodatée. `timeline.json › montage` convertit le temps vidéo vers le repère du premier montage
(`scenes` reste dans ce repère, comme le lit `page.html`) ; points ajoutés pour que les tampons « PAYÉ », le marteau
d'« Affaire classée » et le pop des croissants tombent dans les silences. Bruitages recalés hors des mots ; la « chute »
du tribunal est retirée (elle aurait couvert « Avec Gestion… »), le whoosh suit le marteau. Carton 24,3 → 28,3 s.
Musique : plus de boucle arbitraire ; elle repart du début au carton (fondu croisé 0,3 s, `audio.py`).

## Contrôles réalisés (version ElevenLabs)

1. ffprobe et décodage intégral des deux MP4 sans erreur ; vidéo et audio de 28,300 s, 48 kHz stéréo.
2. Planche d'aperçu aux instants clés puis images du MP4 final toutes les 0,5 s : chaque scène tombe sur ses mots,
   carton officiel intact de 24,3 à 28,3 s, sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix/fond par réplique de
   **+9,6 dB** (v10, pauses remplies par musique, marteau et pop) à **+24,7 dB** (v09) ; v03–v05 vers +14 à +15 dB.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts propres au modèle : « coloc »
   → « colloque », « payé » → « payer », « qu'il paie » → « qu'ils paient ».
5. Dépôt Drive vérifié (métadonnées : dossier « QME - Vidéos Ministories », 2 749 385 octets) ; ancienne version
   (`1LRaRUjW0Zu68bG4G0hvOnLKyR2SIizpp`) placée à la corbeille ensuite.

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites

- 69 mots, légèrement au-dessus de la cible 45–65.
- La musique (24,96 s) repart du début au carton (24,3 s), en fondu croisé : à écouter.
- Deux colocataires (prénoms et couleurs de la démo) plutôt que trois, pour coller à la capture réelle.
