# Mini-story QME n° 1 · « L'abonnement fantôme » (27/11/2026)

Statut : **produit avec la voix définitive ElevenLabs « Caroline »** (27/11/2026) ; écoute et publication restent à Quentin.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (8,9 Mo, AAC 192 kb/s) | `rendu/qme_ministory_01-abonnement-fantome_final.mp4` |
| MP4 léger (2,85 Mo), déposé dans Drive | `rendu/qme_ministory_01-abonnement-fantome_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1Oj-e_UnjLzxwBteDY94mmwvSGt921IeW/view) (id `1Oj-e_UnjLzxwBteDY94mmwvSGt921IeW` ; l'ancienne version edge-tts `1HsX7PXg0_KCX44Y8LpmeL4a5v1uiDL8r` est à la corbeille) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_01-abonnement-fantome.srt` (incrustés aussi) |
| Projet | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés), `sources/audio.py`, `sources/repliques.tsv` |
| Voix | `audio/elevenlabs/voix-elevenlabs.mp3` (source ElevenLabs, 26,20 s, 44,1 kHz mono) et `voix-elevenlabs.wav` (48 kHz mono) ; voix provisoire edge-tts conservée : `audio/voix/`, `sources/timeline-voix-provisoire.json` |
| Audio | `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-nastelbom-comedy-comedy-music-617004.mp3` |
| Assets | carton officiel (copie identique au pilote), logo, captures `templates-abonnements-tel.webp` et `-apercu.webp` (copies du dépôt), police Outfit + OFL |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-01-abonnement-fantome
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 30.5 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 30.5 600 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192k (final) ou 112k (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 30,500 / 30,500 s | 30,500 / 30,500 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, 0,64 Mb/s |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,2 LUFS, crête -4,5 dBFS | idem (voix/fond mesurés sur ce fichier) |
| Taille | 8 919 981 o | 2 848 747 o |

Voix seule : -15,7 LUFS, -2,0 dBTP.

## Voix et recalage

Voix définitive : ElevenLabs, « Caroline - Warm, Sweet and Soft » (`kwhMCf63M8O3rCfnQ3oQ`), modèle `eleven_v4`, une seule
génération le 27/11/2026 (texte de `docs/ministories/elevenlabs/qme_ministory_01-abonnement-fantome_elevenlabs.txt`), placée d'un
seul tenant à 0,20 s. Début et fin de chaque réplique relevés par `silencedetect` et transcription Vosk horodatée. `timeline.json ›
montage` convertit le temps vidéo vers le premier montage (fantômes sur « streaming », « salle de sport », « magazine », cadres
« au mois » / « à l'année », alerte sur « l'alerte »). Bruitages recalés dans les silences. Carton 26,5–30,5 s (voix finie à 26,13 s).

## Contrôles réalisés (version ElevenLabs)

1. Décodage intégral des deux MP4 sans erreur ; flux de même durée.
2. Planche d'aperçu avant rendu, puis planche du MP4 final toutes les 0,5 s : scènes calées sur les mots, carton intact 26,5–30,5 sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de +15,7 dB (v03) à +24,3 dB (v02).
4. Transcription Vosk du mix léger : les 8 répliques reconnues au bon moment ; écarts du modèle : « oublié » → « oublier », « QME » → « m e », « Caro » → « carreaux ».
5. Dépôt Drive vérifié par recherche dans le dossier (2 848 747 octets), puis ancienne vidéo mise à la corbeille.

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et décisions

- **Durée** : 30,5 s (la voix ElevenLabs dure 26,2 s). - **Voix** : ElevenLabs Caroline (l'ancienne edge-tts `fr-FR-HenriNeural` est abandonnée). Les sous-titres v01 et v05 affichent les montants en chiffres (« 9,99 € », « 87 € ») ; le SRT garde le texte dit.
- **Musique** : « nastelbom-comedy-comedy-music-617004 », Drive « QME - Musiques MiniStories » (id `1IfDUJueXz9DHZ0w1SVmVqBzYGs9Lcpx7`), libre de droits (confirmé par Quentin le 27/11/2026).
- **Bruitages** : synthétisés par `audio.py`. **Captures** : dépôt (démo fictive « Camille »). **Police** : Outfit (OFL).
- **Produit** : seules fonctions citées : total au mois et à l'année, alerte « à décider avant le … » avant la fin d'un essai, statut « résilié » (fiche catalogue). Montants de l'histoire fictifs ; aucune marque nommée (« Appli méditation », « streaming », « salle de sport », « magazine » génériques).
- **Payoff** : Carreau « médite » en lévitation avec l'expression `soulage` (pas de pose de méditation dans le module officiel ; rien de redessiné).

## Texte continu pour ElevenLabs

> Neuf euros quatre-vingt-dix-neuf. Pour méditer. Ouverte une fois. En 2024. Attendez… il y en a d'autres. Le streaming oublié. La salle de sport. Le magazine. Quatre-vingt-sept euros par mois. De fantômes. Le Suivi des abonnements, de QME, ramène tout au mois et à l'année. Un essai qui se termine ? L'alerte arrive avant le prélèvement. Cette fois, Caro médite… gratuitement.
