# Journal des vidéos de démonstration

Mémoire des skills `idee-video` et `video-demo` : une ligne par vidéo, dans l'ordre. Le générateur
d'idées le lit (via `node docs/videos/catalogue.mjs`) pour alterner les produits et les types de vidéo.
Non publié (chemin `/docs/*` bloqué en 404).

## État de la routine de publication

- **Routine Instinct v4 transmise : oui (confirmé par Quentin le 15/11/2026).** Tant que Quentin n'a pas transmis
  `docs/templates/communication/instagram/PROMPT-INSTINCT-v4.md` à Instinct (deuxième publication par jour,
  vidéos LinkedIn), les lignes vidéo sont créées au statut **« Prêt »**, pas « Programmé ». Quand Quentin
  confirme la transmission, passer cette ligne à « oui » et les lignes « Prêt » des vidéos à « Programmé ».

## Créneaux

- LinkedIn : vidéo à **17:30** (les autres publications sont à 08:30 ou 12:15).
- Instagram : reel vidéo à **08:30** (les autres publications sont à 18:30).
- Une date reçoit une vidéo seulement si **aucun des deux plannings** n'a déjà une vidéo ce jour-là
  (LinkedIn format « Vidéo », Instagram format « Reel », statut autre que « Annulé »).

## Vidéos

Types : `démonstration`, `problème`, `question`, `paramétrage`, `interface`, `réglage`, `service rendu`,
`avant-après`, `astuce`, `pack`.

| N° | Date | Produit | Type | Titre | Scénario | Durée | Drive | LinkedIn | Instagram | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 2026-11-15 | GNT | question | Un retard décale-t-il la fin du chantier ? | `scenarios/gantt-retard.mjs` | 32,2 s | [v4](https://drive.google.com/file/d/1LSaJ5EYicetQzLSkGH35cbueV8rFQqYP/view) | [LI-143](https://www.linkedin.com/feed/update/urn:li:ugcPost:7527737799110983680) · publié 2026-11-15 15:23 | [IG-139](https://www.instagram.com/qmengineering/reel/Dfw_PBCuZuu/) · publié 2026-11-15 15:24 | Publié (test réussi : vidéo native LinkedIn et reel Instagram avec son et couverture) |
