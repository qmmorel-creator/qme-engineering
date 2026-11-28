# Mini-story QME n° 10 · « Le carnet de la voiture » · format v2 (28/11/2026)

Produit : Carnet de voiture (`catalogue/voiture/`, 13 €, en vente). Texte dit et accroche : `script.md`. Texte ElevenLabs :
`docs/ministories/elevenlabs/qme_ministory_10-carnet-voiture_elevenlabs.txt` (flow `3nUhohzzYLjXUSAY4LJ0`, 246 crédits,
une génération, voix « Caroline - Warm, Sweet and Soft », eleven_v4).

## Fichiers
- `rendu/qme_ministory_10-carnet-voiture_final.mp4` (7 101 959 o, AAC 192k), `_drive.mp4` (2 541 625 o, 112k),
  `_tiktok.mp4` (2 229 954 o, 18,5 s, 1,5 s de carton), `_couverture.png` (image à 1,2 s : accroche + voyant allumé),
  `_tiktok-legende.txt`.
- Drive « QME - Vidéos Ministories » : vidéo `1UmUt9bqhLLEdu3tTi0l9V8vUDnK2LM45`, TikTok `1CLiFWt0wJofu-DDFKBZOi0gsRVTR3QyA`,
  légende TikTok `1gw8VHvcCK7pcE9qVFRrLgUuX8y0Bt7Fv` ; couverture `1dVhzMIdIusqU7o6GdsC4hZMl_bKfx161` ;
  Doc légende `1FVd3po0ufCd6bWbcTfu-sS78TwThk0Nh_Wu2bsgVJXs`. (Premiers dépôts `1fUoi3Gf…` et `1Qc7JJsT…` mis à la
  corbeille : remplacés après correction d'une crête de bruitage.)

## Provenance
Voix : ElevenLabs (Caroline), une prise. Musique : `atlasaudio-funny-funny-music-576636.mp3`, Drive « QME - Musiques
MiniStories » (libre de droits, confirmé par Quentin le 27/11/2026). Bruitages synthétisés (`sources/audio.py`). Capture :
`assets/templates-voiture-tel.webp` du dépôt (démo, foyer fictif), sans masque. Police Outfit (OFL). Carton officiel (Drive
« QME - Assets MiniStories »). Grillon : module officiel `carreau.js`, sans accessoire.

## Contrôle qualité
| # | Contrôle | Méthode | Résultat |
|---|---|---|---|
| 1 | Décodage intégral | `ffmpeg -f null` | OK (final, drive, tiktok) |
| 2 | 1080 × 1920, 30 i/s, H.264 High, yuv420p | ffprobe | OK |
| 3 | AAC 48 kHz stéréo ; durée audio = vidéo | ffprobe | OK, 21,000 s / 21,000 s (TikTok 18,5 s) |
| 4 | Sonie, crête ≤ -1,5 dB | ebur128 | final -16,3 LUFS, -4,9 dBTP ; drive -16,3 LUFS, -3,5 dBTP ; TikTok -16,1 LUFS, -3,5 dBTP ; voix seule -15,7 LUFS |
| 5 | Voix présente, dominante | corrélation (décalage 240 éch.) + rapport voix/fond | corrélation 0,86 ; +4,9 à +17,7 dB selon la réplique (la plus faible : « Personne ne sait. », compréhensible à la transcription) |
| 6 | Intelligibilité | Vosk small-fr 0.22 sur le final | toutes les répliques au bon moment ; écarts du modèle : « fouille » → « fouilla », « fossilisé » → « fossilisés » |
| 7 | Visionnage complet | planche toutes les 0,5 s | OK ; correction faite : voyant allumé dès la 1re image |
| 8 | Continuité Grillon / accessoires | planches | OK (même tableau de bord en ouverture et en boucle) |
| 9 | Zones sûres, lisibilité mobile | planches | OK ; carte « Vidange et filtre à huile · EN RETARD » agrandie (zoom) et encadrée |
| 10 | Sous-titres | planches | OK, accents, 2 lignes au plus |
| 11 | Carton 4 s, non déformé | planches | OK (17,0–21,0 s) |
| 12 | Faits produit conformes | fiche `catalogue/voiture/` | échéances à la date ou au km, statut en retard : capture réelle de la démo |
| 13 | Écoute humaine sur téléphone | Quentin | à faire |
