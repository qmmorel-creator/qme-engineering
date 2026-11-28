# Mini-story QME n° 09 · « Le café à 54 heures » · format v2 (28/11/2026)

Produit : **Temps de vie** (`catalogue/temps-de-vie/`, en vente, 19 €). Texte dit, accroche et intention : `script.md`.
Texte ElevenLabs : `docs/ministories/elevenlabs/qme_ministory_09-cafe-temps-de-vie_elevenlabs.txt`
(flow `679ibHex66w2m4Vt4iuu`, 269 crédits, une seule génération).

## Fichiers
- `rendu/qme_ministory_09-cafe-temps-de-vie_final.mp4` (5 079 747 o, AAC 192k, 19,7 s), `_drive.mp4` (2 611 180 o,
  H.264 820k 2 passes, AAC 112k), `_tiktok.mp4` (841 305 o, 17,2 s, 1,5 s de carton), `_couverture.png`.
- Drive « QME - Vidéos Ministories » : vidéo `1Md1IyPMuNj3aEo5JDLQlwBGZMiHXIwA2`, TikTok `1MPtFk1wM_3nSDcdpa8riOkAF-telI9oD`,
  légende TikTok `10bdq53_hBGZuTE4bM1REHvYDd8J7GTbZ` ; couverture `1YIamQdazf4ajE-dv7Fr0g6jpwmJi9G3O` ; Doc légende
  `1CgBifRsNvNrszOe1mmzoJqAOFKAFRhuaVqiR5juOxn4` (« Mini-story 09 · Le café à 54 heures (v3) », à préfixer de l'IG à la programmation).
- `assets/temps-de-vie-cafe-capture.webp` : capture réelle de l'application (mode exemple, Playwright, 390 px ×2),
  calcul « Café à emporter · 3,50 €/jour », sans retouche des valeurs.

## Provenance
Voix ElevenLabs « Caroline - Warm, Sweet and Soft » (eleven_v4), prise unique 19,12 s, silences resserrés et tempo
×1,07 (ffmpeg) sans regénération. Musique : `ikoliks_aj-funny-funny-music-634962` (Drive « QME - Musiques MiniStories »,
libre de droits, confirmé par Quentin le 27/11/2026). Bruitages synthétisés (`sources/audio.py`). Police Outfit (OFL).
Carton officiel (Drive « QME - Assets MiniStories »). Grillon : module officiel `carreau.js`, sans accessoire porté
(le gobelet est un objet du décor).

## Contrôle qualité (modèle `modeles/controle-qualite.md`)
| Contrôle | Résultat |
|---|---|
| Durée 15-22 s, carton 4 s (TikTok 1,5 s) | 19,7 s ; carton 15,7-19,7 s ; TikTok 17,2 s |
| Accroche écrite dès la 1re image, ≤ 12 mots | « 3,50 € par jour. Tu as fait le calcul ? » (9 mots), 0-2,6 s |
| 1re réplique = tension, pas de pub au milieu | « Trois euros cinquante. C'est rien, un café. » ; produit seulement à 10,5 s |
| Produit : capture réelle lisible, une réplique ≤ 8 mots | « Un an : cinquante-quatre heures de travail. » (6 mots) ; ligne « Un an » entourée |
| Chute qui boucle | « C'est rien, un café… Neuf minutes. » au comptoir du début |
| Mots de voix 30-45 | 36 |
| Codecs, décodage intégral | H.264 1080 × 1920 30 i/s + AAC 48 kHz stéréo, `ffmpeg -f null` OK sur les trois MP4 |
| Sonie | mix -15,8 LUFS, crête -3,9 dBFS ; voix seule -15,7 LUFS |
| Intelligibilité (Vosk sur `_drive.mp4`) | toutes les répliques au bon moment (seul écart : « c'est » → « sais ») |
| Sous-titres | une réplique = un sous-titre, deux lignes au plus, calés sur la transcription |
| Bruitages hors des mots | placés dans les silences mesurés |
| Aperçu corrigé avant rendu | planche de 14 images ; corrigés : gobelet géant (débordait), téléphone agrandi |
| Planche du final (toutes les 0,5 s) | examinée |
| Taille Drive < 2,9 Mo | 2 611 180 o |
| Écoute humaine | **non faite** (à Quentin) |
