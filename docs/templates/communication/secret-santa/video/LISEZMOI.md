# Vidéo Secret Santa · motion design de Noël (version 2, 13/11/2026)

`assets/secret-santa-noel.mp4` : 46 s, 1080 × 1920 (9:16), 30 i/s, H.264 + AAC, ≈ 7,7 Mo. Une seule
version verticale pour Instagram (IG-36) et LinkedIn (LI-99), reprise le 25/12 (IG-51, LI-102). Pas
d'image fixe (décision de Quentin). Version Drive allégée (2,9 Mo, deux passes à 430 kbit/s) déposée dans
les dossiers Images des deux plannings.

**Déroulé, calé sur la musique (130 BPM)** : intro calme, titre mot à mot et guirlande qui s'allume
ampoule par ampoule ; au départ du rythme (7,4 s), transition en disque de couleur ; quatre étapes de trois
mesures chacune, chacune ouverte par une transition (rouge, jaune, bleu, vert) ; « Gratuit, c'est notre
cadeau de Noël » avec une pluie de cadeaux ; passage à la nuit, grand sapin assemblé en triangles sur les
temps, étoile qui s'allume sur le coup de cymbale (38,8 s), « Joyeux Noël de la part de QME » ; crédit
musical ; fondu. Neige en trois couches et grands flocons géométriques. Participants fictifs.

**Musique** : « Christmas is coming » (Long Version), Alex-Productions, 2023, fichier fourni par Quentin
(chosic.com). Musique libre de droits, confirmé par Quentin le 13/11/2026 ; crédit conservé (licence CC BY habituelle
chez chosic.com). Crédit affiché à la fin de la vidéo et à mettre dans chaque légende :
« Musique : Christmas is coming par Alex-Productions | onsound.eu | Music promoted by chosic.com | CC BY 3.0 ».

## Régénérer

Montage (extraits coupés aux limites de mesure : 9,68 → 39,22 s, 122,30 → 127,83 s, 133,37 s → fin) :

```
ffmpeg -i "Christmas-is-coming-Long-Version.mp3" -filter_complex "\
[0]atrim=start=9.680769:end=39.219231,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=29.5185:d=0.02[a];\
[0]atrim=start=122.296154:end=127.834615,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=5.5185:d=0.02[c];\
[0]atrim=start=133.373077:end=145.0,asetpts=PTS-STARTPTS,afade=t=in:d=0.02[d];\
[a][c][d]concat=n=3:v=0:a=1,atrim=end=46,afade=t=out:st=43.5:d=2.5,loudnorm=I=-14:TP=-1.5:LRA=11[o]" \
  -map "[o]" -ar 44100 musique.wav
mkdir images && node rendu.cjs "$PWD" 1080 1920 30 46        # scene.html, rendu image par image
ffmpeg -framerate 30 -i images/%05d.jpg -i musique.wav -c:v libx264 -preset slow -tune animation -crf 23 \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest secret-santa-noel.mp4
```

`scene.html` charge la police Outfit depuis `/home/user/qme-engineering/assets/fonts/` (chemin absolu à
adapter). Les repères de temps sont en tête du script (`T.drop`, `T.e2`… `T.cymbale`).
