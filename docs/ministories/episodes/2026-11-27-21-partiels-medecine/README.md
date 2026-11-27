# Mini-story QME n° 21 · « Les partiels de médecine » (27/11/2026)

Statut : **produite, voix ElevenLabs « Caroline - Warm, Sweet and Soft »**. Non programmée (agent de contenu unique). Accessoire **blouse + stéthoscope TEMPORAIRE, à valider par Quentin** (`blouse-apercu.png`).

## Fichiers

| Livrable | Chemin |
|---|---|
| MP4 final (7,69 Mo) | `rendu/qme_ministory_21-partiels-medecine_final.mp4` |
| MP4 Drive (2 757 288 octets) | `rendu/qme_ministory_21-partiels-medecine_drive.mp4` · Drive « QME - Vidéos Ministories », `qme_ministory_21-partiels-medecine.mp4`, id `1-FHeMuVj2VxMj9yWDKg1KDIwJjspFHdz` |
| Master image muet, couverture | `rendu/master-image.mp4`, `rendu/master-image-couverture.png` |
| Script, découpage, storyboard, sous-titres | `script.md`, `decoupage.md`, `storyboard.png`, `qme_ministory_21-partiels-medecine.srt` |
| Aperçu accessoire | `blouse-apercu.png` (inquiet, panique, fier) |
| Animation | `sources/page.html` (fonction `blouse()` par-dessus `carreau()`, modèle `course()`), `sources/timeline.json` |
| Voix | `audio/elevenlabs/voix-elevenlabs.mp3` (25,44 s) et `.wav` 48 kHz ; flow ElevenLabs `JPmATgZ1AnosIhUkGZ32`, 343 crédits, une seule génération |
| Audio | `sources/audio.py`, pistes, `audio/mix-final.wav`, `audio/musique-atlasaudio-funny-606256.mp3` (Drive `1f-kN9Hog7H8i-a8Oz31QjGbUsUX6umqP`) |

## Fiche technique (mesurée)

| | Final | Drive |
|---|---|---|
| Durée vidéo / audio | 29,600 / 29,600 s | idem |
| Image | H.264 1080 × 1920, 30 i/s | idem |
| Audio | AAC 48 kHz stéréo 192 kb/s | AAC 112 kb/s |
| Sonie | -16,4 LUFS, crête -3,9 dBFS | -16,3 LUFS, crête -4,7 dBFS |

Voix seule : -15,9 LUFS, crête -2,0 dB.

## Contrôles

1. Décodage intégral des deux MP4 sans erreur ; flux de durées égales.
2. Planche d'aperçu corrigée (étiquettes de matières qui chevauchaient la montagne) ; planche du MP4 Drive toutes les 0,5 s examinée : sous-titres 2 lignes max, zones sûres, carton 4 s intact.
3. Voix retrouvée dans le mix par corrélation (décalage 239 échantillons) ; voix/fond par réplique +15,7 dB (v10) à +23,7 dB (v02).
4. Vosk sur le mix : toutes les répliques au bon moment ; écarts du modèle : « QME » → « que m », « à viser » → « à visée », « Étudiant » → « étudiants ».
5. Dépôt Drive vérifié par métadonnées (dossier `1lpoKvq5L43X8gm9TZKcslXMwkYViOtOr`, taille identique).

Non réalisé : écoute humaine.

## Limites et provenance

- Fonctions citées : répétition espacée J+1/J+3/J+7 (page du pack, Planning de révision), « note à viser au prochain partiel » (Notes et moyennes). Captures réelles du dépôt : `templates-revision-tel`, `templates-revision-planning`, `templates-notes-objectifs`. Aucun prix, aucune promesse, aucun contenu médical ; matières génériques.
- Payoff court (« on dort » ≈ 0,6 s avant le carton). Personnages d'arrière-plan : aucun. Bruitages synthétisés ; police Outfit (OFL) ; carton officiel.
