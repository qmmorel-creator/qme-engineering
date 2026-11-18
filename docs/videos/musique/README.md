# Bibliothèque musicale QME

Décision de Quentin du 18/11/2026 : **aucune vidéo muette** (sauf vidéo privée remise à un partenaire pour son
montage), et des musiques **variées** d'une vidéo à l'autre. Le choix est automatique : `choisirMusique(nom, durée)`
de `docs/videos/rendu.mjs` (utilisé par `rendrePage`, `ajouterMusique`, `diaporama.mjs`, et par `moteur.mjs` avec
`musique: 'auto'`). Même nom de vidéo, même morceau ; seuls les morceaux assez longs depuis leur départ sont candidats.

| Fichier | Morceau | Durée | Tempo | 1er temps | Départ | Origine |
|---|---|---|---|---|---|---|
| `corporate-litesaturation.m4a` | Corporate (litesaturation) | 60 s | 110 BPM | 0,534 s | 20,17 s (plus tôt si la vidéo est longue) | Pixabay, usage commercial sans attribution. Déclenche une revendication Content ID sur YouTube (sans effet sur la visibilité). |
| `product-launch.m4a` | Product Launch Mini Set | 30 s | 120 BPM | 0,017 s | 1er temps | Fourni par Quentin le 18/11/2026 |
| `productive-flow.m4a` | Productive Flow | 30 s | 96 BPM | 0,308 s | 1er temps | Fourni par Quentin le 18/11/2026 |
| `professional-momentum.m4a` | Professional Momentum | 30 s | 118 BPM | 0,505 s | 1er temps | Fourni par Quentin le 18/11/2026 |
| `product-motion.m4a` | Product Motion | 30 s | 100 BPM | 0,592 s | 1er temps | Fourni par Quentin le 18/11/2026 |

Tempo et premier temps mesurés le 18/11/2026 par autocorrélation du flux spectral (méthode validée sur « Corporate » :
110 BPM et 0,54 s mesurés pour 110 BPM et 0,534 s connus). Convertis en AAC 160 kb/s depuis les MP3 d'origine.
Une vidéo de 30 s ou plus ne peut utiliser que « Corporate » : pour varier, viser 29 s au plus.
