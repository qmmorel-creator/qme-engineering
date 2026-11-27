# Mini-story QME 05 · « Garde tout, on sait jamais » (27/11/2026)

Statut : produite, **voix provisoire edge-tts** (Henri), en attente de la voix ElevenLabs et de l'écoute de Quentin. Rien n'est programmé.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 11,1 Mo) | `rendu/qme_ministory_05-garde-tout_final.mp4` |
| MP4 léger (2,71 Mo), déposé dans Drive | `rendu/qme_ministory_05-garde-tout_drive.mp4` · Drive « QME - Vidéos Ministories » : `qme_ministory_05-garde-tout.mp4`, id `1IeJ0zKA5ytQKfLiUJFBcItKwP_NYG8YN` |
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
node docs/videos/rendu.mjs $E/sources/page.html 30 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 30 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 30,000 / 30,000 s | 30,000 / 30,000 s |
| Image | H.264, 1080 × 1920, 30 i/s | idem |
| Audio | AAC 48 kHz stéréo 192 kb/s | AAC 48 kHz stéréo 112 kb/s |
| Sonie | -15,8 LUFS, crête -4,9 dBFS | -15,9 LUFS, crête -4,8 dBFS |
| Taille | 11 062 839 o | 2 711 191 o |

Voix seule : -15,3 LUFS, -2,0 dBTP.

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; durées des flux égales (30,000 s).
2. Planches d'aperçu avant rendu, puis images du MP4 final toutes les 0,5 s : zones sûres respectées, sous-titres sur 2 lignes au plus, carton intact 26–30 s sans sous-titre. Corrigé après visionnage : l'étiquette « AVIS D'IMPOSITION » de S5 passait sous les sous-titres (remontée), cartes de captures recadrées pour être lisibles, étiquette RECYCLAGE sortie de la zone des sous-titres.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix/fond par réplique : +22,3 dB (v02, v08) à +28,4 dB (v03).
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts du modèle : « QME » → « cœur et me », « se remplit seule » → « se remplissage », « part » → « par ».
5. Dépôt Drive vérifié par recherche dans le dossier (taille identique, 2 711 191 octets).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Provenance et limites

- **Voix** : edge-tts `fr-FR-HenriNeural`, provisoire (droits commerciaux non établis). Voix définitive : ElevenLabs à partir du texte continu de `script.md`, puis recalage (`voix_source`, `montage`) comme le pilote.
- **Musique** : `starostin-funny-funny-music-638426.mp3`, Drive « QME - Musiques MiniStories » (`1HTPERCBJeY3G1U51WtQ8RJ9n8QLBpjBV`), libre de droits (confirmé par Quentin le 27/11/2026).
- **Bruitages** : synthétisés (`audio.py`). **Captures** : dépôt (`assets/templates-papiers-*.webp`). **Police** : Outfit (OFL). **Carton** : fichier officiel copié du pilote, non modifié.
- **Produit** : seules les fonctions de la fiche sont évoquées (durée de conservation de chaque papier, liste « peut être jeté » qui se remplit seule). Aucune durée précise ni prix cité. Garantie du grille-pain et données : fictives.
- Le produit arrive à 13,0 s (moitié de l'histoire hors carton ; 43 % de la vidéo carton compris).
