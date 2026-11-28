# Mini-story QME n° 8 · « La chaudière qui toussait » (27/11/2026)

Statut : produit avec la **voix définitive ElevenLabs « Caroline »**, **à valider par Quentin** (écoute, carte « Octobre »).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 8 971 991 o) | `rendu/qme_ministory_08-chaudiere-qui-toussait_final.mp4` |
| MP4 léger (2 797 171 o), déposé dans Drive | `rendu/qme_ministory_08-chaudiere-qui-toussait_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1SbqFeLYua-MWaGD5U8gz8i5A4ydkSkEK/view), nom `qme_ministory_08-chaudiere-qui-toussait.mp4` |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, note d'intention, texte ElevenLabs | `script.md` |
| Découpage | `decoupage.md` |
| Storyboard | `storyboard.png` (12 vignettes tirées du master) |
| Sous-titres | `qme_ministory_08-chaudiere-qui-toussait.srt` (incrustés aussi) |
| Projet d'animation | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés) |
| Projet audio | `sources/audio.py`, `sources/repliques.tsv` |
| Voix | `audio/elevenlabs/elevenlabs-caroline-source.mp3` (prise unique, 22,48 s), `voix-elevenlabs.wav` (48 kHz mono), `voix-montee.wav` (placée) |
| Pistes | `audio/piste-voix.wav`, `audio/piste-voix-brute.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, musique source |
| Assets | `assets/` (carton officiel et logo copiés du pilote, captures `templates-entretien-tel.webp` et `templates-entretien-annee.webp`, police Outfit + OFL) |

## Voix

ElevenLabs, `creative_generate_speech`, voix « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`), modèle
`eleven_v4`, **une seule génération** (349 crédits, flow `ZS6FE9VSjhJaISQaisCl`). Prise placée d'un seul tenant
(`timeline.json › voix_source`, décalage 0,2 s), avec deux silences insérés aux respirations : +1,0 s après « s'éteint »
(5,85 s de la source) et +2,0 s après « couvertures » (8,40 s), pour laisser vivre la panne et le grelottement.
Répliques relevées par `silencedetect` (-40 dB, 0,18 s) et transcription Vosk ; scènes calées directement sur ces temps
(pas de `montage`).

## Refaire ou corriger

```bash
E=docs/ministories/episodes/2026-11-27-08-chaudiere-qui-toussait
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 30 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 30 600 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, 48 kHz stéréo, -shortest, +faststart
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée (vidéo / audio) | 30,000 s / 30,000 s | 30,000 s / 30,000 s |
| Image | H.264, 1080 × 1920, 30 i/s, 2,18 Mb/s | idem, 621 kb/s |
| Audio | AAC, 48 kHz, stéréo, 199 kb/s | AAC, 48 kHz, stéréo, 115 kb/s |
| Sonie | -16,2 LUFS, crête -4,3 dBFS | -16,3 LUFS, crête -4,4 dBFS |
| Taille | 8 971 991 o | 2 797 171 o |

Voix seule : -15,7 LUFS, crête -2,0 dBFS. Carton officiel 26,0–30,0 s, sans sous-titre.

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; flux de même durée (30,000 s).
2. Planche d'aperçu avant rendu (corrections : Carreau visible sous les couvertures, écharpe retirée car elle masquait
   le visage, Carreau déplacé hors de la zone droite basse en S2, S4, S5), puis images du MP4 léger toutes les 0,5 s :
   sous-titres sur 2 lignes au plus, zones sûres respectées, carton intact.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de
   **+8,4 dB (v01 « Janvier », masquée en partie par le whoosh d'ouverture) puis +15,4 à +26,9 dB** pour les autres.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts propres au modèle :
   « Carreau » → « caro / carreaux », « QME » → « cœur m e », « tousse » → « tous ».
5. Dépôt Drive vérifié par recherche dans le dossier (id `1SbqFeLYua-MWaGD5U8gz8i5A4ydkSkEK`, 2 797 171 o).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et décisions

- **Musique** : `ikoliks_aj-funny-funny-music-634962 (1).mp3`, Drive `11wfe8hs39qJeSdb0EwMc1AeE8x1Rhu-X`, libre de droits.
- **Durée** : 30,0 s, la borne haute. Le produit arrive à 11,9 s (avant la moitié) : avec 54 mots et deux pauses de
  jeu, impossible de le repousser sans dépasser 30 s.
- **Captures produit** : vraies captures (Échéances au téléphone, Année 2027). Les vignettes cochées « Chaudière,
  Ramonage, VMC » (équipements cités par la fiche) et la carte « Octobre · Entretien de la chaudière » sont
  **dessinées au style de l'app** (donnée fictive de l'histoire), pas des captures. À valider par Quentin.
- **Affirmations produit** : uniquement « vous cochez vos équipements, le calendrier d'entretien se calcule seul »
  (fiche). Aucune obligation ni périodicité ; octobre, −2° et températures fictifs.
- Whoosh d'ouverture sur « Janvier » (+8,4 dB voix/fond) : à déplacer si l'écoute le juge gênant.
