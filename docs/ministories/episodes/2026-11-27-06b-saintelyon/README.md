# Mini-story QME n° 6 bis · « La SaintéLyon de la veille » (27/11/2026, clin d'œil prévu le 28/11/2026)

Produit : **Plan d'entraînement course à pied** · Voix : ElevenLabs « Caroline » (définitive) · Statut : produit, **à valider par Quentin** (écoute, publication).
Variante de l'épisode 06 (lu, non modifié).

## Fichiers
| Livrable | Chemin |
|---|---|
| MP4 final (11,8 Mo) | `rendu/qme_ministory_06b-saintelyon_final.mp4` |
| MP4 léger (2,76 Mo), Drive | `rendu/qme_ministory_06b-saintelyon_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1RWPABgsIXVHVE4vxVBGGxUpBlWI8r8ul/view) (`qme_ministory_06b-saintelyon.mp4`, id `1RWPABgsIXVHVE4vxVBGGxUpBlWI8r8ul`) |
| Master image muet + couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard (aperçu 16 instants) | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_06b-saintelyon.srt` (incrustés aussi) |
| Projet | `sources/page.html` (tenue `course()` reprise de `docs/ministories/carreau-chasuble-source.html`), `sources/timeline.json`, `sources/audio.py` |
| Audio | `audio/elevenlabs/voix-elevenlabs.mp3` (+ .wav 48 kHz), `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-alex-morgan-funny-bouncy-cartoon-mischief-578469.mp3` |

## Refaire
```bash
E=docs/ministories/episodes/2026-11-27-06b-saintelyon
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 29.2 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 29.2 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : -c:v copy, AAC 192k (final) / 112k (drive), 48 kHz stéréo, -shortest, +faststart
```

## Fiche technique (mesurée)
| | Final | Drive |
|---|---|---|
| Durée vidéo / audio | 29,200 s / 29,200 s | idem |
| Image | H.264 1080 × 1920, 30 i/s | idem |
| Audio | AAC 48 kHz stéréo 192 kb/s | AAC 48 kHz stéréo 112 kb/s |
| Sonie | -16,3 LUFS, crête -3,0 dBFS | -16,3 LUFS, crête -1,9 dBFS |
| Taille | 11 836 699 octets | 2 756 529 octets |

Voix seule : -16,1 LUFS, crête -2,0 dB (cible -15,5 : 0,6 dB en dessous).

## Contrôles
1. Décodage intégral des deux MP4 sans erreur.
2. Aperçu de 16 instants, corrigé (case « CE SOIR » qui débordait → « J-0 », Carreau qui masquait le stand du ravito, étiquette finale trop à droite), puis planche du MP4 Drive toutes les 0,5 s : sous-titres 2 lignes max, zones sûres, carton intact 25,2–29,2.
3. Corrélation voix/mix : décalage 239 échantillons ; rapport voix/fond par réplique de +8,8 dB (v03) à +23,6 dB (v10).
4. Vosk sur le MP4 Drive : toutes les répliques au bon moment. « SaintéLyon » transcrit « santé lyon » (prononcé « Sainté-Lyon », correct). Écarts du modèle : « QME » → « cœur et me », « Plan » → « camp », « il arrive » → « hillary ».
5. Drive vérifié par recherche dans le dossier (2 756 529 octets).

**Non réalisé** : écoute humaine.

## Limites
- Une seule génération ElevenLabs (366 crédits), prise non retouchée.
- Frontale et faisceau petits à l'écran (échelle de la mascotte) ; le clignotement se lit surtout par le texte.
- Données des captures fictives ; aucune distance citée ; aucune promesse de performance ni de santé ; aucun logo.
