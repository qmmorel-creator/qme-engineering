# Vidéo Secret Santa · motion design de Noël

`assets/secret-santa-noel.mp4` : 35 s, 1080 × 1920 (9:16), 30 i/s, H.264 + AAC, ≈ 5,5 Mo. Une seule
version verticale pour Instagram (Reels) et LinkedIn (vidéo native). Pas d'image fixe pour cette
publication (décision de Quentin, 13/11/2026).

Déroulé, calé sur les mesures de la musique : neige, guirlande et sapins ; « Secret Santa · notre
cadeau de Noël » ; 1 · créer l'échange ; 2 · partager le lien, chacun s'inscrit ; 3 · tirage secret
(même l'organisateur ne voit pas) ; 4 · chacun découvre sa page ; « Gratuit : c'est notre cadeau de
Noël » ; « Joyeux Noël de la part de QME ». Participants et données fictifs.

**Musique** : « Jingle Bells » (James Lord Pierpont, 1857, domaine public), arrangement et synthèse
originaux (`musique.py` : célesta, basse, nappe, grelots), normalisée à -14 LUFS. Aucune licence tierce.

## Régénérer

```
python3 musique.py brut.wav
ffmpeg -i brut.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 44100 musique.wav
mkdir images && node rendu.cjs "$PWD" 1080 1920 30 34.98      # scene.html, rendu image par image
ffmpeg -framerate 30 -i images/%05d.jpg -i musique.wav -c:v libx264 -preset slow -crf 20 \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest secret-santa-noel.mp4
```

`scene.html` charge la police Outfit depuis `/home/user/qme-engineering/assets/fonts/` (chemin
absolu à adapter si le dépôt est ailleurs).
