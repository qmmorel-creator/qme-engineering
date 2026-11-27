# Contrôle qualité (à recopier dans le README de l'épisode, résultats mesurés)

| # | Contrôle | Méthode | Résultat |
|---|---|---|---|
| 1 | Décodage intégral | `ffmpeg -v error -i f.mp4 -f null -` | |
| 2 | 1080 × 1920, 30 i/s, H.264 High, yuv420p | ffprobe | |
| 3 | AAC 48 kHz stéréo ; durée audio = durée vidéo | ffprobe | |
| 4 | Sonie mix / voix, crête ≤ -1,5 dB | ebur128=peak=true | |
| 5 | Voix présente, dominante | corrélation + rapport voix/fond par réplique | |
| 6 | Intelligibilité | transcription Vosk horodatée | |
| 7 | Visionnage complet | images toutes les 0,5 s en planches | |
| 8 | Continuité Carreau / accessoires | planches | |
| 9 | Zones sûres, lisibilité mobile | planches | |
| 10 | Sous-titres : texte, accents, synchro, 2 lignes | SRT + planches | |
| 11 | Carton exact, non déformé, 4 s, sans surimpression | planches | |
| 12 | Faits produit conformes à la fiche | relecture | |
| 13 | Écoute humaine sur téléphone | Quentin | à faire / fait |
