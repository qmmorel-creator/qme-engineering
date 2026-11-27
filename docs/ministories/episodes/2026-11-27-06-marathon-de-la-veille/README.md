# Mini-story QME n° 6 · « Le marathon de la veille » (27/11/2026)

Produit : **Plan d'entraînement course à pied** · Statut : produit, **à valider par Quentin** (voix définitive ElevenLabs « Caroline », 27/11/2026).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 8,1 Mo) | `rendu/qme_ministory_06-marathon-de-la-veille_final.mp4` |
| MP4 léger (2,82 Mo), déposé dans Drive | `rendu/qme_ministory_06-marathon-de-la-veille_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1YXCMgcclx7qllZSJWJsRab0w4voaEb3W/view) (`qme_ministory_06-marathon-de-la-veille.mp4`) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_06-marathon-de-la-veille.srt` (incrustés aussi) |
| Projet | `sources/page.html`, `sources/timeline.json` (voix provisoire : `sources/timeline-voix-provisoire.json`) (+ `timeline.js`, `carreau.js` générés), `sources/audio.py`, `sources/repliques.tsv` |
| Voix | `audio/elevenlabs/` : `voix-elevenlabs.mp3` (source ElevenLabs, 29,47 s, 44,1 kHz mono), `voix-elevenlabs.wav` (48 kHz mono), `voix-elevenlabs-resserree.wav` (pauses resserrées, utilisée) ; voix provisoire edge-tts conservée : `audio/voix/` |
| Audio | `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-atlasaudio-funny-funny-music-576636.mp3` |
| Assets | `assets/` (carton officiel, logo, captures `templates-course-a-pied-tel.webp`, `-tel-allures.webp`, `-plan.webp`, police Outfit + OFL) |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-06-marathon-de-la-veille
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 32 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 32 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

Particularité : `timeline.json › voix[].st` découpe une longue réplique en deux sous-titres successifs (décalage en s depuis le début de la réplique) ; `page.html` et le SRT l'utilisent.

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 32,000 s / 32,000 s | 32,000 s / 32,000 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, 581 kb/s |
| Audio | AAC LC 48 kHz stéréo, 192 kb/s | AAC LC 48 kHz stéréo, 112 kb/s |
| Sonie | -16,1 LUFS, crête -3,0 dBFS | -16,2 LUFS, crête -4,5 dBFS |
| Taille | 8 068 440 octets | 2 824 044 octets |

Voix seule : -15,9 LUFS, crête -2,0 dB.

## Voix et recalage

Voix définitive : ElevenLabs, « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`), modèle `eleven_v4`, une seule
génération le 27/11/2026 sur le texte de `docs/ministories/elevenlabs/qme_ministory_06-marathon-de-la-veille_elevenlabs.txt`
(29,47 s). Pour tenir 32 s carton compris, les 9 pauses entre répliques de plus de 0,30 s sont ramenées à 0,30 s
(coupes dans le silence, fondus de 5 ms, −1,66 s) ; la pause dramatique après « Premier kilomètre… » est gardée (0,47 s).
Voix placée d'un seul tenant à 0,15 s (fin à 27,90 s), carton 28–32 s. Début et fin de chaque réplique relevés par
`silencedetect` et transcription Vosk horodatée. `timeline.json › montage` convertit le temps vidéo vers le repère du
premier montage : chaque scène tombe sur ses mots (S-8 sur « Huit semaines avant », coches sur « cochées une à une »).
Bruitages recalés dans les pauses ; les quatre « pose » suivent les coches à l'image, à faible niveau.

## Contrôles réalisés (version ElevenLabs)

1. Décodage intégral des deux MP4 sans erreur ; vidéo et audio de 32,000 s, AAC 48 kHz stéréo.
2. Aperçu Playwright (16 instants) puis planche du MP4 final toutes les 0,5 s : sous-titres sur 2 lignes au plus, scènes
   calées sur la voix, carton intact 28–32 s sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de
   **+12,4 dB (v09, coches) à +21,5 dB (v01)**.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts propres au modèle :
   « QME » → « que m e », « rembobinons » → « rembobiner », « cochées » → « cocher », « Jour J » (v10) → « georgie »,
   « il arrive » → « hillary », « depuis son » → « de puissants ».
5. Dépôt Drive vérifié (2 824 044 octets, id `1YXCMgcclx7qllZSJWJsRab0w4voaEb3W`) ; ancienne version edge-tts
   (`1uIibwFs89KYxrX6Se_gUMgsFIKl397qm`) placée à la corbeille ensuite.

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites

- **Voix** : ElevenLabs « Caroline » ; durée 32 s (au-dessus de la cible 30 s, imposée par le débit plus posé de la voix).
- **Texte** : 69 mots, un peu au-dessus de la cible 45–65.
- **Capture « Plan »** réduite à 900 px de large : les libellés des séances sont petits sur téléphone ; les coches vertes portent l'action.
- **Musique** : atlasaudio « funny funny music » (576636), dossier Drive « QME - Musiques MiniStories », libre de droits (consigne de Quentin).
- **Bruitages** synthétisés ; **Carreau** module officiel ; captures du dépôt ; police Outfit (OFL) ; carton officiel non modifié.
- **Contenu** : données fictives ; aucune promesse de performance ni de santé ; le produit est montré huit semaines avant la course, conformément à la fiche (au moins trois semaines nécessaires).
