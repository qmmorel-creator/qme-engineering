# Mini-story QME n° 13 · « Liste de courses : le retour » · format v2 (28/11/2026)

Produit : **Repas de la semaine et liste de courses** (`catalogue/repas/`). Texte dit, accroche et « à qui l'envoyer ? » :
`script.md`. Texte ElevenLabs : `docs/ministories/elevenlabs/qme_ministory_13-liste-de-courses_elevenlabs.txt`
(flow ElevenLabs `c5Xw8NtN0h4rNumqCKiq`, 270 crédits, une seule génération, voix « Caroline - Warm, Sweet and Soft »,
eleven_v4). Prise de 21,04 s resserrée à 16,98 s par `sources/voix_montage.py` (silences > 0,3 s ramenés à 0,2 s,
tempo × 1,06 sans changement de hauteur ; aucune syllabe coupée).

## Fichiers
- `rendu/qme_ministory_13-liste-de-courses_final.mp4` (4 378 595 o, AAC 192k, 21,5 s), `_drive.mp4` (2 296 387 o,
  H.264 720k deux passes, AAC 112k), `_tiktok.mp4` (880 881 o, 19,0 s, 1,5 s de carton, fondu audio final),
  `_couverture.png` (image à 0,8 s, accroche visible), `_tiktok-legende.txt`, `qme_ministory_13-liste-de-courses.srt`.
- Drive « QME - Vidéos Ministories » : vidéo `16d-EzgieuOUBajvGFo946oixcihprFPD`, TikTok `1_0Szw75g_hmLlcmCgTWxnYIUOdky5ZZK`,
  légende TikTok `1MaqCB7gz_R7rTSL00bKuHDeQMbGFlgIw` ; couverture `1XucxMJVBMqnlyjUPH1GzOhn8j3coxWqD` (dossier couvertures) ;
  Doc légende `1QqtVuncTvlIgSagUqfPD-yLuDbyN_sEyimvbFGRJwaA` (dossier Docs). Non programmée à la production.

## Provenance
Voix : ElevenLabs (Caroline). Musique : `starostin-funny-funny-music-638426.mp3`, Drive « QME - Musiques MiniStories »
(libre de droits, confirmé par Quentin le 27/11/2026). Bruitages : synthétisés par `sources/audio.py`. Capture produit :
`assets/templates-repas-tel.webp` du dépôt (démo, famille fictive ; seuls ajouts : cadre rouge autour du rayon
« Fruits et légumes » et coche sur « Ail », geste de l'utilisateur). Police Outfit (OFL). Carton officiel (Drive Assets).
Grillon : module officiel `carreau.js`, sans accessoire (chariot et produits sont des objets du décor).

## Contrôle qualité

| # | Contrôle | Méthode | Résultat |
|---|---|---|---|
| 1 | Décodage intégral | `ffmpeg -v error -f null` | OK sur final, drive et TikTok |
| 2 | 1080 × 1920, 30 i/s, H.264 | ffprobe | OK (3 fichiers) |
| 3 | AAC 48 kHz stéréo ; durée audio = vidéo | ffprobe | OK : 21,500 s (final, drive), 19,000 s (TikTok) |
| 4 | Sonie, crête ≤ -1,5 dB | ebur128=peak=true | Mix -15,5 LUFS (final), -15,6 (drive), -15,4 (TikTok) ; crête vraie -3,1 / -3,2 dBTP ; voix seule -15,5 LUFS |
| 5 | Voix présente, dominante | corrélation + rapport voix/fond | Corrélation 0,959 (décalage 239 éch.) ; voix/fond +8,7 à +10,7 dB selon la réplique |
| 6 | Intelligibilité | Vosk (small-fr 0.22) sur le final | Les 45 mots au bon moment ; écarts du modèle : « pâtes » → « pattes », « il était » → « visiter », « traversée » → « traverser » |
| 7 | Visionnage complet | images toutes les 0,5 s (planche 9 × 5) | Examiné ; aperçu corrigé avant rendu (étiquettes ENTRÉE / JUSTE DEVANT superposées, Grillon sur le chariot, téléphone sous les sous-titres) |
| 8 | Continuité Grillon / accessoires | planches | OK : chariot, brique de lait, pâtes, boîte d'œufs identiques d'un plan à l'autre |
| 9 | Zones sûres, lisibilité mobile | planches | OK ; capture du téléphone agrandie (échelle 0,92) : rayon, articles et quantités lisibles |
| 10 | Sous-titres | SRT + planches | 7 répliques, accents OK, 2 lignes au plus, calés sur la voix réelle |
| 11 | Carton exact, 4 s | planches | 17,5–21,5 s, plein cadre, sans surimpression ; TikTok 1,5 s |
| 12 | Faits produit conformes à la fiche | relecture | « rangée par rayon » (FAQ de la fiche) ; aucune autre fonction, aucun prix dit |
| 13 | Écoute humaine sur téléphone | Quentin | à faire |

Format v2 : 21,5 s ; accroche écrite dès la 1re image (9 mots) ; 1re réplique = tension ; produit à 11,5 s en une
réplique de 8 mots ; 45 mots ; chute qui boucle sur la 1re réplique et la même allée.
