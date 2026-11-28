# Mini-story QME n° 3 · « Le carton n° 47 » (27/11/2026)

Statut : produit avec la **voix définitive ElevenLabs « Caroline »** (27/11/2026), **à valider par Quentin**.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 5,73 Mo) | `rendu/qme_ministory_03-carton-47_final.mp4` |
| MP4 léger (2,64 Mo), déposé dans Drive | `rendu/qme_ministory_03-carton-47_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1A0EwIRGneO0qBpe0hucbJHg80A4lAUQP/view) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, note d'intention, texte ElevenLabs | `script.md` |
| Découpage | `decoupage.md` |
| Storyboard | `storyboard.png` (12 vignettes) |
| Sous-titres | `qme_ministory_03-carton-47.srt` (incrustés aussi) |
| Projet d'animation | `sources/page.html`, `sources/timeline.json` (ancien montage voix provisoire : `timeline-voix-provisoire.json` ; `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py`, `sources/repliques.tsv` |
| Voix définitive | `audio/elevenlabs/voix-elevenlabs.mp3` (source, 23,04 s, 44,1 kHz mono) et `.wav` (48 kHz mono) |
| Ancienne voix provisoire (plus utilisée) | `audio/voix/v01–v08.wav` (edge-tts `fr-FR-HenriNeural`) |
| Pistes | `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, musique source |
| Assets | `assets/` (carton officiel et logo copiés du pilote, capture `templates-demenagement-cartons-tel.webp`, police Outfit + OFL) |

## Refaire ou corriger

```bash
E=docs/ministories/episodes/2026-11-27-03-carton-47
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 27.5 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 27.5 600 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Voix et recalage

Voix définitive : ElevenLabs, « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`, modèle `eleven_v4`), une seule
génération le 27/11/2026 (330 crédits, 23,04 s), texte de `docs/ministories/elevenlabs/qme_ministory_03-carton-47_elevenlabs.txt`.
Placée d'un seul tenant à 0,30 s (`timeline.json › voix_source`), sans découpe. Début et fin de chaque réplique relevés
par `silencedetect` et transcription Vosk horodatée. Le montage suit la voix : `timeline.json › montage` convertit le
temps vidéo vers le repère de l'ancien montage (scènes et animations inchangées, recalées sur les mots). Bruitages
recalés dans les silences ; le second whoosh (avant « Avec Déménagement ») est retiré faute de place. Sous-titre v06
coupé à 15,1 s (sur « chaque »). Durée ramenée à 27,5 s, carton officiel 23,5–27,5 s.

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée (vidéo / audio) | 27,500 s | 27,500 s |
| Image | H.264, 1080 × 1920, 30 i/s, 1 463 kb/s | idem, 645 kb/s |
| Audio | AAC, 48 kHz, stéréo, 194 kb/s | AAC, 48 kHz, stéréo, 115 kb/s |
| Sonie | -15,8 LUFS, crête -3,7 dBFS | -15,8 LUFS, crête -4,5 dBFS |
| Taille | 5 729 457 o | 2 643 919 o |

Voix seule : -15,6 LUFS, -2,0 dBFS crête. Carton officiel 23,5–27,5 s, sans sous-titre.

## Contrôles réalisés (version ElevenLabs)

1. ffprobe et décodage intégral des deux MP4 sans erreur ; flux de même durée (27,500 s).
2. Planche d'aperçu avant rendu, puis images du MP4 final toutes les 0,5 s : chaque scène tombe sur ses mots, la carte
   « 47 » apparaît sur « Carton quarante-sept », carton officiel intact, sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de
   **+14,7 dB (v08, « Le dernier. Évidemment. », recouverte par la montée du ding) à +25,5 dB (v07)**, autres répliques
   entre +23,1 et +24,5 dB.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts du modèle : « thé » → « tes »,
   « QME » → « cœur m e ».
5. Dépôt Drive vérifié par les métadonnées du fichier dans le dossier (id `1A0EwIRGneO0qBpe0hucbJHg80A4lAUQP`,
   2 643 919 o) ; l'ancienne version (voix provisoire, `1voArG9lysnEYZ2Tb86lBULGg9jVowVW9`) est à la corbeille.

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et décisions

- **Musique** : `andriih-funny-funny-music-585934.mp3`, dossier Drive « QME - Musiques MiniStories »
  (`1RPgXGAAL4cq8c1R3YPRW2f1kmOSRAMB0`), libre de droits.
- **Voix** : ElevenLabs « Caroline » (définitive).
- **Capture produit** : vraie capture `templates-demenagement-cartons-tel.webp` (démo, recherche « vaisselle ») ; pendant
  la recherche, la saisie « bouilloire » et la carte « 47 · Bouilloire : thé, tasses, cuillères » sont **incrustées
  par-dessus** (donnée fictive de l'histoire, au style de l'app). À valider par Quentin.
- **Affirmations produit** : uniquement « chaque carton numéroté avec sa pièce et son contenu, retrouvé en une
  recherche » (fiche catalogue). Ni prix ni chiffre de résultat.
- Le téléphone reste sur la recherche « vaisselle » de 13,0 à 18,4 s environ avant la saisie (plan un peu statique).

## Texte continu pour ElevenLabs

> Vingt-deux heures. Il veut juste un thé. Carton un : des chaussettes. Carton douze : encore des chaussettes. Carton
> trente : un cactus ? Quarante-six cartons. Toujours pas de bouilloire. Avec Déménagement, de QME, chaque carton a son
> numéro et son contenu. Une recherche : bouilloire. Carton quarante-sept. Le dernier. Évidemment.
