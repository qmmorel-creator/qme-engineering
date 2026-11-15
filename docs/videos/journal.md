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
| 002 | 2026-11-15 | TCH | astuce | Une tâche complète en une seule ligne (touche N) | `scenarios/002-taches-saisie-une-ligne.mjs` | 36,0 s | [Drive](https://drive.google.com/file/d/1_C6dSUx9s87jnTGFZ8R_g7iZdc7wqtzn/view) | LI-144 · 2026-11-18 17:30 | IG-140 · 2026-11-18 08:30 | Programmé |
| 008 | 2026-11-15 | CRM | interface | CRM freelance : par qui commencer aujourd'hui ? | `scenarios/008-crm-priorite-du-jour.mjs` | 26,8 s | [Drive](https://drive.google.com/file/d/1dV2EIIoPz_aeCJORsvB6nTm0u1pwt6JL/view) | LI-145 · 2026-11-27 17:30 | IG-141 · 2026-11-27 08:30 | Programmé |
| 007 | 2026-11-15 | TRS | problème | Un client paie 3 mois plus tard : le compte tient-il ? | `scenarios/007-tresorerie-client-retard.mjs` | 37,1 s | [Drive](https://drive.google.com/file/d/1LPBpvs6rYJDWoYt_mQSyH-QFUuOisYRO/view) | LI-146 · 2026-11-26 17:30 | IG-142 · 2026-11-26 08:30 | Programmé |
| 003 | 2026-11-15 | REV | démonstration | 8 chapitres ajoutés d'un coup : tout tombe le même jour ? | `scenarios/003-revision-chapitres.mjs` | 33,3 s | [Drive](https://drive.google.com/file/d/1yDYqEPG4iQQnsWJ8bQsCj4PtejgDsK2c/view) | LI-147 · 2026-11-20 17:30 | IG-143 · 2026-11-20 08:30 | Programmé |
| 006 | 2026-11-15 | ABN | réglage | Un abonnement partagé : seule votre part compte | `scenarios/006-abonnements-partage.mjs` | 31,1 s | [Drive](https://drive.google.com/file/d/1ata8mjjWk13bHGvzk-DSL0EakXMY_xMO/view) | LI-148 · 2026-11-23 17:30 | IG-144 · 2026-11-23 08:30 | Programmé |
| 004 | 2026-11-15 | DVS | service rendu | Une ligne ajoutée, le devis recalculé au centime | `scenarios/004-devis-ligne-ajoutee.mjs` | 36,6 s | [Drive](https://drive.google.com/file/d/1uR8htKdr1MNdmhYIHnX4ZUlqnGLnuY5J/view) | LI-149 · 2026-11-21 17:30 | IG-145 · 2026-11-21 08:30 | Programmé |
