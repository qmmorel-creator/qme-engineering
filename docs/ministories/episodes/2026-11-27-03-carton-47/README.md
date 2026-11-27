# Mini-story QME n° 3 · « Le carton n° 47 » (27/11/2026)

Statut : produit, **à valider par Quentin** (voix provisoire edge-tts ; voix ElevenLabs à générer à partir du texte continu).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 5,98 Mo) | `rendu/qme_ministory_03-carton-47_final.mp4` |
| MP4 léger (2,68 Mo), déposé dans Drive | `rendu/qme_ministory_03-carton-47_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1voArG9lysnEYZ2Tb86lBULGg9jVowVW9/view) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, note d'intention, texte ElevenLabs | `script.md` |
| Découpage | `decoupage.md` |
| Storyboard | `storyboard.png` (12 vignettes) |
| Sous-titres | `qme_ministory_03-carton-47.srt` (incrustés aussi) |
| Projet d'animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py`, `sources/repliques.tsv` |
| Voix provisoire | `audio/voix/v01–v08.wav` (edge-tts `fr-FR-HenriNeural`) |
| Pistes | `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, musique source |
| Assets | `assets/` (carton officiel et logo copiés du pilote, capture `templates-demenagement-cartons-tel.webp`, police Outfit + OFL) |

## Refaire ou corriger

```bash
E=docs/ministories/episodes/2026-11-27-03-carton-47
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 28 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 28 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée (vidéo / audio) | 28,000 s / 28,000 s | 28,000 s / 28,000 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, 641 kb/s |
| Audio | AAC LC, 48 kHz, stéréo, 196 kb/s | AAC LC, 48 kHz, stéréo, 116 kb/s |
| Sonie | -15,8 LUFS, crête -5,0 dBFS | -15,9 LUFS, crête -4,3 dBFS |
| Taille | 5 983 333 o | 2 681 578 o |

Voix seule : -15,5 LUFS, -2,0 dBTP. Carton officiel 24,0–28,0 s, sans sous-titre.

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; flux de même durée.
2. Planche d'aperçu avant rendu, puis images du MP4 léger toutes les 0,5 s : pas de chevauchement, sous-titres sur
   2 lignes au plus (v06 coupée en deux sous-titres successifs), zones sûres respectées, carton intact.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de
   **+20,1 dB (v08) à +25,1 dB (v06)**.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts du modèle : « thé » → « tes »,
   « Carton un » → « cartons un », « QME » → « cœur et me ».
5. Dépôt Drive vérifié par recherche dans le dossier (id `1voArG9lysnEYZ2Tb86lBULGg9jVowVW9`, 2 681 578 o).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et décisions

- **Musique** : `andriih-funny-funny-music-585934.mp3`, dossier Drive « QME - Musiques MiniStories »
  (`1RPgXGAAL4cq8c1R3YPRW2f1kmOSRAMB0`), libre de droits.
- **Voix** : edge-tts provisoire (usage commercial non établi) ; ElevenLabs à faire.
- **Capture produit** : vraie capture `templates-demenagement-cartons-tel.webp` (démo, recherche « vaisselle ») ; pendant
  la recherche, la saisie « bouilloire » et la carte « 47 · Bouilloire : thé, tasses, cuillères » sont **incrustées
  par-dessus** (donnée fictive de l'histoire, au style de l'app). À valider par Quentin.
- **Affirmations produit** : uniquement « chaque carton numéroté avec sa pièce et son contenu, retrouvé en une
  recherche » (fiche catalogue). Ni prix ni chiffre de résultat.
- Le téléphone reste sur la recherche « vaisselle » de 12,6 à 17,2 s avant la saisie (plan un peu statique).

## Texte continu pour ElevenLabs

> Vingt-deux heures. Il veut juste un thé. Carton un : des chaussettes. Carton douze : encore des chaussettes. Carton
> trente : un cactus ? Quarante-six cartons. Toujours pas de bouilloire. Avec Déménagement, de QME, chaque carton a son
> numéro et son contenu. Une recherche : bouilloire. Carton quarante-sept. Le dernier. Évidemment.
