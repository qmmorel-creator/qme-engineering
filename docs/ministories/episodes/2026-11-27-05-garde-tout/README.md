# Mini-story QME 05 · « Garde tout, on sait jamais » (27/11/2026)

Statut : produite, **voix définitive ElevenLabs « Caroline - Warm, Sweet and Soft »** (27/11/2026), en attente de l'écoute de Quentin. Rien n'est programmé.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 11,1 Mo) | `rendu/qme_ministory_05-garde-tout_final.mp4` |
| MP4 léger (2,68 Mo), déposé dans Drive | `rendu/qme_ministory_05-garde-tout_drive.mp4` · Drive « QME - Vidéos Ministories » : `qme_ministory_05-garde-tout.mp4`, id `1XV3B36kL9h_lFhMCt1YJYHWGMUAt4zF9` (la version voix provisoire `1IeJ0zKA5ytQKfLiUJFBcItKwP_NYG8YN` est à la corbeille) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, texte ElevenLabs | `script.md` |
| Découpage | `decoupage.md` |
| Storyboard | `storyboard.png` (14 images du MP4 final) |
| Sous-titres | `qme_ministory_05-garde-tout.srt` (incrustés aussi) |
| Animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Audio | `sources/audio.py`, `sources/repliques.tsv`, `audio/voix/`, `audio/bruitages/`, pistes et `audio/mix-final.wav` |
| Assets | carton officiel (copie du pilote), logo, captures `templates-papiers-tel/documents/echeances.webp`, police Outfit + OFL |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-05-garde-tout
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 29.4 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 29.4 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Voix et recalage

Voix ElevenLabs « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`), modèle `eleven_v4`, une seule génération
(texte exact de `docs/ministories/elevenlabs/qme_ministory_05-garde-tout_elevenlabs.txt`), 24,96 s, MP3 44,1 kHz mono :
`audio/elevenlabs/voix-elevenlabs.mp3` (+ WAV 48 kHz mono), placée d'un seul tenant à 0,20 s. Débuts et fins des
répliques relevés par `silencedetect` et transcription Vosk horodatée. `timeline.json › montage` recale les scènes sur
les mots ; l'ancienne timeline est gardée dans `sources/timeline-voix-provisoire.json`. La voix étant plus serrée entre
« l'avis d'imposition » et « Il est tout en bas » (0,3 s), l'avalanche (S4) est jouée en accéléré et la fin muette de
S5 est sautée (whoosh). Bruitages recalés dans les silences ; le tick de S5 et le whoosh de l'avalanche sont retirés
faute de place. Carton de 25,4 à 29,4 s.

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 29,400 / 29,400 s | 29,400 / 29,400 s |
| Image | H.264, 1080 × 1920, 30 i/s | idem |
| Audio | AAC 48 kHz stéréo 192 kb/s | AAC 48 kHz stéréo 112 kb/s |
| Sonie | -15,9 LUFS, crête -4,6 dBFS | -16,0 LUFS, crête -4,6 dBFS |
| Taille | 11 560 667 o | 2 677 622 o |

Voix seule : -15,6 LUFS, -2,0 dBTP.

## Contrôles réalisés (version ElevenLabs)

1. Décodage intégral des deux MP4 sans erreur ; durées des flux égales (29,400 s).
2. Planche d'aperçu avant rendu, puis images du MP4 final toutes les 0,5 s : chaque scène tombe sur ses mots, sous-titres
   sur 2 lignes au plus, carton intact de 25,4 à 29,4 s sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix/fond par réplique :
   +14,0 dB (v06, chute de l'avalanche juste avant) à +28,0 dB (v03).
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts du modèle : « QME » → « cœur m »,
   « recyclage » → « haut-rhin clash », « part » → « par ».
5. Dépôt Drive vérifié par lecture des métadonnées (dossier « QME - Vidéos Ministories », 2 677 622 octets), puis ancienne
   version mise à la corbeille. SRT régénéré depuis la nouvelle timeline.

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Provenance et limites

- **Voix** : ElevenLabs « Caroline », générée le 27/11/2026 (flow `Jfx5Mfh01g9XACZvhePx`, 385 crédits). L'ancienne voix provisoire edge-tts (`audio/voix/`, `piste-voix-brute` des versions précédentes) n'est plus utilisée.
- **Musique** : `starostin-funny-funny-music-638426.mp3`, Drive « QME - Musiques MiniStories » (`1HTPERCBJeY3G1U51WtQ8RJ9n8QLBpjBV`), libre de droits (confirmé par Quentin le 27/11/2026).
- **Bruitages** : synthétisés (`audio.py`). **Captures** : dépôt (`assets/templates-papiers-*.webp`). **Police** : Outfit (OFL). **Carton** : fichier officiel copié du pilote, non modifié.
- **Produit** : seules les fonctions de la fiche sont évoquées (durée de conservation de chaque papier, liste « peut être jeté » qui se remplit seule). Aucune durée précise ni prix cité. Garantie du grille-pain et données : fictives.
- Le produit arrive à 13,0 s (moitié de l'histoire hors carton ; 43 % de la vidéo carton compris).
