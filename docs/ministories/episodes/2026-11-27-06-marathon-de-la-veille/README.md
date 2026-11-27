# Mini-story QME n° 6 · « Le marathon de la veille » (27/11/2026)

Produit : **Plan d'entraînement course à pied** · Statut : produit, **à valider par Quentin** (voix provisoire edge-tts).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (master, 7,8 Mo) | `rendu/qme_ministory_06-marathon-de-la-veille_final.mp4` |
| MP4 léger (2,84 Mo), déposé dans Drive | `rendu/qme_ministory_06-marathon-de-la-veille_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1uIibwFs89KYxrX6Se_gUMgsFIKl397qm/view) (`qme_ministory_06-marathon-de-la-veille.mp4`) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_06-marathon-de-la-veille.srt` (incrustés aussi) |
| Projet | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés), `sources/audio.py`, `sources/repliques.tsv` |
| Audio | `audio/voix/v01–v11.wav`, `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-atlasaudio-funny-funny-music-576636.mp3` |
| Assets | `assets/` (carton officiel, logo, captures `templates-course-a-pied-tel.webp`, `-tel-allures.webp`, `-plan.webp`, police Outfit + OFL) |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-06-marathon-de-la-veille
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 30 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 30 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192 kb/s (final) ou 112 kb/s (léger), -c:v copy, -shortest
```

Particularité : `timeline.json › voix[].st` découpe une longue réplique en deux sous-titres successifs (décalage en s depuis le début de la réplique) ; `page.html` et le SRT l'utilisent.

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 30,000 s / 30,000 s | 30,000 s / 30,000 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, 632 kb/s |
| Audio | AAC LC 48 kHz stéréo, 192 kb/s | AAC LC 48 kHz stéréo, 112 kb/s |
| Sonie | -15,8 LUFS, crête -2,4 dBFS | -15,8 LUFS, crête -3,6 dBFS |
| Taille | 7 785 086 octets | 2 838 374 octets |

Voix seule : -15,1 LUFS, crête -2,0 dB.

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; flux de même durée.
2. Aperçu Playwright (18 instants) puis planche de 60 images du MP4 léger (toutes les 0,5 s) : sous-titres sur 2 lignes au plus, zones sûres respectées, carton intact 26–30 s sans sous-titre. Corrigé après aperçu : texte « REPOS » qui débordait de sa case, position de Carreau dans l'escalier.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de **+10,3 dB (v07) à +26,3 dB (v11)**.
4. Transcription Vosk du mix léger : toutes les répliques reconnues au bon moment ; écarts propres au modèle : « QME » → « cœur et me », « rembobinons » → « rembobiner », « cochées » → « cocher ». Bruitages déplacés ou retirés avant rendu pour ne couvrir aucun mot (alarme, tic-tac, blips, ka-ching retirés).
5. Dépôt Drive vérifié par recherche dans le dossier (2 838 374 octets, id `1uIibwFs89KYxrX6Se_gUMgsFIKl397qm`).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites

- **Voix provisoire** edge-tts `fr-FR-HenriNeural` (droits commerciaux non établis) ; définitive : ElevenLabs sur le texte continu de `script.md`.
- **Texte** : 69 mots, un peu au-dessus de la cible 45–65.
- **Capture « Plan »** réduite à 900 px de large : les libellés des séances sont petits sur téléphone ; les coches vertes portent l'action.
- **Musique** : atlasaudio « funny funny music » (576636), dossier Drive « QME - Musiques MiniStories », libre de droits (consigne de Quentin).
- **Bruitages** synthétisés ; **Carreau** module officiel ; captures du dépôt ; police Outfit (OFL) ; carton officiel non modifié.
- **Contenu** : données fictives ; aucune promesse de performance ni de santé ; le produit est montré huit semaines avant la course, conformément à la fiche (au moins trois semaines nécessaires).
