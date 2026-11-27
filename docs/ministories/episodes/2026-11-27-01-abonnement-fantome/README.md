# Mini-story QME n° 1 · « L'abonnement fantôme » (27/11/2026)

Statut : **produit, voix provisoire edge-tts** ; voix ElevenLabs, écoute et publication restent à Quentin.

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (8,9 Mo, AAC 192 kb/s) | `rendu/qme_ministory_01-abonnement-fantome_final.mp4` |
| MP4 léger (2,82 Mo), déposé dans Drive | `rendu/qme_ministory_01-abonnement-fantome_drive.mp4` · [Drive « QME - Vidéos Ministories »](https://drive.google.com/file/d/1HsX7PXg0_KCX44Y8LpmeL4a5v1uiDL8r/view) (id `1HsX7PXg0_KCX44Y8LpmeL4a5v1uiDL8r`) |
| Master image (muet) et couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard | `script.md`, `decoupage.md`, `storyboard.png` |
| Sous-titres | `qme_ministory_01-abonnement-fantome.srt` (incrustés aussi) |
| Projet | `sources/page.html`, `sources/timeline.json` (+ `timeline.js`, `carreau.js` générés), `sources/audio.py`, `sources/repliques.tsv` |
| Audio | `audio/voix/v01–v08.wav`, `audio/piste-voix.wav`, `audio/piste-bruitages.wav`, `audio/bruitages/`, `audio/mix-final.wav`, `audio/musique-nastelbom-comedy-comedy-music-617004.mp3` |
| Assets | carton officiel (copie identique au pilote), logo, captures `templates-abonnements-tel.webp` et `-apercu.webp` (copies du dépôt), police Outfit + OFL |

## Refaire

```bash
E=docs/ministories/episodes/2026-11-27-01-abonnement-fantome
python3 $E/sources/audio.py
echo "window.TL = $(cat $E/sources/timeline.json);" > $E/sources/timeline.js
sed 's/^export //' docs/templates/communication/formats-test/mascotte/carreau.js > $E/sources/carreau.js
node docs/videos/rendu.mjs $E/sources/page.html 29.6 600 --muet --taille-max 14 --sortie $E/rendu/master-image.mp4
node docs/videos/rendu.mjs $E/sources/page.html 29.6 --muet --taille-max 2.4 --sortie $E/rendu/leger-image.mp4
# assemblage avec audio/mix-final.wav : AAC 192k (final) ou 112k (léger), -c:v copy, -shortest
```

## Fiche technique (mesurée)

| | Final | Léger (Drive) |
|---|---|---|
| Durée vidéo / audio | 29,600 / 29,600 s | 29,600 / 29,600 s |
| Image | H.264 High, 1080 × 1920, 30 i/s | idem, 0,64 Mb/s |
| Audio | AAC LC 48 kHz stéréo 192 kb/s | AAC LC 48 kHz stéréo 112 kb/s |
| Sonie | -16,1 LUFS, crête -3,5 dBFS | -16,1 LUFS, crête -3,8 dBFS |
| Taille | 8 949 400 o | 2 819 338 o |

Voix seule : -15,5 LUFS, -2,0 dBTP.

## Contrôles réalisés

1. Décodage intégral des deux MP4 sans erreur ; flux de même durée.
2. Planche d'aperçu avant rendu (défaut corrigé : sous-titres sur 3 lignes → 50 px et coupes resserrées), puis planche du MP4 final toutes les 0,5 s : scènes calées sur les mots, zones sûres respectées, carton intact 25,6–29,6 sans sous-titre.
3. Voix retrouvée dans le mix léger par corrélation (décalage 239 échantillons) ; rapport voix / fond par réplique de +14,2 dB (v04) à +22,1 dB (v08).
4. Transcription Vosk du mix léger : les 8 répliques reconnues au bon moment ; écarts du modèle : « oublié » → « oublier », « QME » → « cœur et me », « au mois » → « au moins », « Caro » → « carreaux ».
5. Dépôt Drive vérifié par recherche dans le dossier (2 819 338 octets).

**Non réalisé** : écoute humaine (Claude n'entend pas).

## Limites et décisions

- **Voix** : edge-tts `fr-FR-HenriNeural`, provisoire (droits commerciaux non établis). Les sous-titres v01 et v05 affichent les montants en chiffres (« 9,99 € », « 87 € ») ; le SRT garde le texte dit.
- **Musique** : « nastelbom-comedy-comedy-music-617004 », Drive « QME - Musiques MiniStories » (id `1IfDUJueXz9DHZ0w1SVmVqBzYGs9Lcpx7`), libre de droits (confirmé par Quentin le 27/11/2026).
- **Bruitages** : synthétisés par `audio.py`. **Captures** : dépôt (démo fictive « Camille »). **Police** : Outfit (OFL).
- **Produit** : seules fonctions citées : total au mois et à l'année, alerte « à décider avant le … » avant la fin d'un essai, statut « résilié » (fiche catalogue). Montants de l'histoire fictifs ; aucune marque nommée (« Appli méditation », « streaming », « salle de sport », « magazine » génériques).
- **Payoff** : Carreau « médite » en lévitation avec l'expression `soulage` (pas de pose de méditation dans le module officiel ; rien de redessiné).

## Texte continu pour ElevenLabs

> Neuf euros quatre-vingt-dix-neuf. Pour méditer. Ouverte une fois. En 2024. Attendez… il y en a d'autres. Le streaming oublié. La salle de sport. Le magazine. Quatre-vingt-sept euros par mois. De fantômes. Le Suivi des abonnements, de QME, ramène tout au mois et à l'année. Un essai qui se termine ? L'alerte arrive avant le prélèvement. Cette fois, Caro médite… gratuitement.
