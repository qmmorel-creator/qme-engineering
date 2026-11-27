# Mini-story QME · « Le salaire a disparu ! » (pilote, 27/11/2026)

Statut : **validé par Quentin le 27/11/2026**, voix ElevenLabs à intégrer (version légère à produire après réception du MP3).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 9,2 Mo) | `rendu/qme_ministory_le-salaire-a-disparu_final.mp4` |
| MP4 léger (2,77 Mo), déposé dans Drive | `rendu/qme_ministory_le-salaire-a-disparu_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1kKWPe25B_4DrLuBx_0ZH0oCuOA2-Jl2P/view) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, note d'intention | `script.md` |
| Découpage, continuité, plan audio, sous-titres | `decoupage.md` |
| Storyboard | `storyboard.png` |
| Sous-titres | `qme_ministory_le-salaire-a-disparu.srt` (incrustés aussi) |
| Projet d'animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py` |
| Voix | `audio/elevenlabs/` (MP3 source ElevenLabs et WAV 48 kHz) ; voix provisoire edge-tts conservée : `audio/voix/`, `sources/timeline-voix-provisoire.json` |
| Pistes | `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, musique source |
| Assets | `assets/` (carton officiel, logo, captures Mon Budget, police Outfit + OFL) |

## Voix et recalage

Voix définitive : ElevenLabs, « Caroline - Warm, Sweet and Soft », MP3 fourni par Quentin le 27/11/2026 (25,55 s,
44,1 kHz mono), placée d'un seul tenant à 0,20 s, sans découpe. Début et fin de chaque réplique relevés par détection
des silences et transcription horodatée. Le montage suit la voix : `timeline.json › montage` convertit le temps vidéo
vers le repère du premier montage (scènes et animations inchangées, recalées sur les mots ; la bouteille devient
« eau pétillante » sur le mot « eau »). L'alarme de la panique est retirée : elle aurait couvert « Avec Mon Budget ».
Le pschitt et le premier whoosh ont été déplacés après mesure (ils masquaient « eau pétillante » et « Mais »).

## Refaire ou corriger

```bash
E=docs/ministories/episodes/2026-11-27-le-salaire-a-disparu
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 30 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 30 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# puis assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée sur les fichiers)

| | Final | Léger (Drive) |
|---|---|---|
| Durée (vidéo / audio) | 30,000 s / 30,000 s | 30,000 s / 30,000 s |
| Image | H.264 High, 1080 × 1920, 30 i/s, yuv420p | idem, débit réduit |
| Audio | AAC LC, 48 kHz, stéréo, 192 kb/s | AAC LC, 48 kHz, stéréo, 112 kb/s |
| Sonie | -15,9 LUFS, crête -3,0 dBFS | -16,0 LUFS, crête -3,1 dBFS |
| Taille | 9,2 Mo | 2,77 Mo |

Voix seule : -15,7 LUFS, -2,0 dBTP.

## Contrôles réalisés (version ElevenLabs)

1. Décodage intégral des deux MP4 sans erreur ; flux audio et vidéo de même durée (30,000 s).
2. Planche d'aperçu aux instants clés : chaque scène tombe sur ses mots ; carton officiel intact de 26,0 à 30,0 s, sans
   sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons, latence AAC) ; rapport voix / fond par
   réplique de +5,8 dB (v03, qui contient une longue pause de jeu remplie par la musique) à +23,4 dB.
4. Transcription automatique (Vosk) du mix léger : toutes les répliques reconnues au bon moment, y compris « Mais »
   après correction ; écarts propres au modèle : « a faim » → « à fond », « QME » → « cœur m e ».
5. Netteté de la version légère vérifiée sur une image de la capture produit (texte de 14 px lisible).
6. Dépôt Drive vérifié par une recherche dans le dossier (taille identique, 2 765 798 octets).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et décisions

- **Musique** : « funny bouncy cartoon mischief » (alex-morgan), dossier Drive « QME - Musiques MiniStories », libre de droits (confirmé par Quentin le 27/11/2026).
- **Bruitages** : synthétisés, sans droits tiers.
- **Carreau** : module officiel ; fiche validée par Quentin le 27/11/2026.
- **Nom du produit** : « Mon Budget » (nom officiel publié), à la place de « Budget du foyer QME ».
- **Durée** : 30,0 s (la voix ElevenLabs, plus posée, dure 25,5 s).
