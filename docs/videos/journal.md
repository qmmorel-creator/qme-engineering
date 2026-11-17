# Journal des vidéos de démonstration

Mémoire des skills `idee-video` et `video-demo` : une ligne par vidéo, dans l'ordre. Le générateur
d'idées le lit (via `node docs/videos/catalogue.mjs`) pour alterner les produits et les types de vidéo.
Non publié (chemin `/docs/*` bloqué en 404).

## État de la routine de publication

- **Routine Instinct v4 transmise : oui (confirmé par Quentin le 15/11/2026).** Tant que Quentin n'a pas transmis
  `docs/templates/communication/instagram/PROMPT-INSTINCT-v4.md` à Instinct (deuxième publication par jour,
  vidéos LinkedIn), les lignes vidéo sont créées au statut **« Prêt »**, pas « Programmé ». Quand Quentin
  confirme la transmission, passer cette ligne à « oui » et les lignes « Prêt » des vidéos à « Programmé ».

- **Routine Instinct YouTube transmise : oui (test YT-01 réussi le 16/11/2026 à 22:21, https://youtube.com/shorts/drvtpjP64oM ; YT-02 à YT-37 passés à « Programmé »).** Tant que Quentin n'a pas transmis
  `docs/templates/communication/youtube/PROMPT-INSTINCT-YOUTUBE.md` (et confirmé la réponse d'Instinct), les lignes
  du planning YouTube sont au statut **« Prêt »**. Après confirmation : passer cette ligne à « oui » et les lignes
  « Prêt » à « Programmé ». TikTok est abandonné (16/11/2026).

## Créneaux

- LinkedIn : vidéo à **17:30** (les autres publications sont à 08:30 ou 12:15).
- Instagram : reel vidéo à **08:30** (les autres publications sont à 18:30).
- YouTube Shorts : vidéo démo à **12:00** le même jour (les autres reels à 20:00).
- Une date reçoit une vidéo seulement si **aucun des deux plannings** n'a déjà une vidéo ce jour-là
  (LinkedIn format « Vidéo », Instagram format « Reel », statut autre que « Annulé »).

## Vidéos

Types : `démonstration`, `problème`, `question`, `paramétrage`, `interface`, `réglage`, `service rendu`,
`avant-après`, `astuce`, `pack`.

Correspondance YouTube Shorts (16/11/2026) : 001 YT-01 (publié le 16/11 à 22:21, test), 002 YT-03, 003 YT-07, 004 YT-08, 005 YT-09,
006 YT-10, 007 YT-13, 008 YT-14, 010 planning d'équipe YT-16, 011 budget YT-20 (planning YouTube, statut « Prêt »).

| N° | Date | Produit | Type | Titre | Scénario | Durée | Drive | LinkedIn | Instagram | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 2026-11-15 | GNT | question | Un retard décale-t-il la fin du chantier ? | `scenarios/gantt-retard.mjs` | 32,2 s | [v4](https://drive.google.com/file/d/1LSaJ5EYicetQzLSkGH35cbueV8rFQqYP/view) | [LI-143](https://www.linkedin.com/feed/update/urn:li:ugcPost:7527737799110983680) · publié 2026-11-15 15:23 | [IG-139](https://www.instagram.com/qmengineering/reel/Dfw_PBCuZuu/) · publié 2026-11-15 15:24 | Publié (test réussi : vidéo native LinkedIn et reel Instagram avec son et couverture) |
| 002 | 2026-11-15 | TCH | astuce | Une tâche complète en une seule ligne (touche N) | `scenarios/002-taches-saisie-une-ligne.mjs` | 36,0 s | [Drive](https://drive.google.com/file/d/1_C6dSUx9s87jnTGFZ8R_g7iZdc7wqtzn/view) | LI-144 · 2026-11-18 17:30 | IG-140 · 2026-11-18 08:30 | Programmé |
| 008 | 2026-11-15 | CRM | interface | CRM freelance : par qui commencer aujourd'hui ? | `scenarios/008-crm-priorite-du-jour.mjs` | 26,8 s | [Drive](https://drive.google.com/file/d/1dV2EIIoPz_aeCJORsvB6nTm0u1pwt6JL/view) | LI-145 · 2026-11-27 17:30 | IG-141 · 2026-11-27 08:30 | Programmé |
| 007 | 2026-11-15 | TRS | problème | Un client paie 3 mois plus tard : le compte tient-il ? | `scenarios/007-tresorerie-client-retard.mjs` | 37,1 s | [Drive](https://drive.google.com/file/d/1LPBpvs6rYJDWoYt_mQSyH-QFUuOisYRO/view) | LI-146 · 2026-11-26 17:30 | IG-142 · 2026-11-26 08:30 | Programmé |
| 003 | 2026-11-15 | REV | démonstration | 8 chapitres ajoutés d'un coup : tout tombe le même jour ? | `scenarios/003-revision-chapitres.mjs` | 33,3 s | [Drive](https://drive.google.com/file/d/1yDYqEPG4iQQnsWJ8bQsCj4PtejgDsK2c/view) | LI-147 · 2026-11-20 17:30 | IG-143 · 2026-11-20 08:30 | Programmé |
| 006 | 2026-11-15 | ABN | réglage | Un abonnement partagé : seule votre part compte | `scenarios/006-abonnements-partage.mjs` | 31,1 s | [Drive](https://drive.google.com/file/d/1ata8mjjWk13bHGvzk-DSL0EakXMY_xMO/view) | LI-148 · 2026-11-23 17:30 | IG-144 · 2026-11-23 08:30 | Programmé |
| 004 | 2026-11-15 | DVS | service rendu | Une ligne ajoutée, le devis recalculé au centime | `scenarios/004-devis-ligne-ajoutee.mjs` | 36,6 s | [Drive](https://drive.google.com/file/d/1uR8htKdr1MNdmhYIHnX4ZUlqnGLnuY5J/view) | LI-149 · 2026-11-21 17:30 | IG-145 · 2026-11-21 08:30 | Programmé |
| 005 | 2026-11-15 | PAQ | pack | Le mois de Camille et Sami en trois gestes (abonnements, budget, budget commun) | `scenarios/005-pack-argent-mois-a-deux.mjs` | 38,8 s | [Drive](https://drive.google.com/file/d/1vbzysdlK63pSwkxKCUCm4_0qfGIA0cF7/view) | LI-150 · 2026-11-22 17:30 | IG-146 · 2026-11-22 08:30 | Programmé |
| 009 | 2026-11-16 | REV | démonstration (privée) | Laurine, la journée d'une étudiante en PASS (proposition de partenariat : jauge jour J, rattrapage, session guidée, bilan, pack) | `scenarios/009-revision-laurine.mjs` | 45,9 s | non déposée | non programmée | non programmée | Privée : jointe au mail de partenariat, jamais publiée |
| 010 | 2026-11-16 | REV | démonstration (privée) | Yves, la journée d'une candidate au concours d'attaché territorial (proposition de partenariat : retards, jauge jour J, rattrapage, session guidée sur l'oral, série) | `scenarios/010-revision-yves.mjs` | 37,1 s | non déposée | non programmée | non programmée | Privée : jointe au mail de partenariat, jamais publiée |
| 011 | 2026-11-16 | BDG | problème | 380 € de cadeaux de Noël sur un mois déjà plein ? (angle « problème vécu », modèle du Reel du 13/11) | `scenarios/011-budget-cadeaux-noel.mjs` | 33,9 s | [Drive](https://drive.google.com/file/d/1awUKiW7CYnL-D_s3gmp5LSRKcntEEehZ/view) | LI-152 · 2026-11-25 17:30 | IG-148 · 2026-11-25 08:30 | Programmé (avancé du 04/12 au 25/11 le 16/11 sur décision de Quentin, à la place de IG-42 annulé : doublon du Reel publié le 13/11) |
| 012 | 2026-11-16 | BCM | paramétrage | Les cadeaux de Noël à deux : moitié-moitié ? (une règle de partage par dépense : égale puis prorata) | `scenarios/012-budget-commun-regle-par-depense.mjs` | 31,1 s | [Drive](https://drive.google.com/file/d/1yrQ0rWZD0x9ZoyIVYIeWfXAjpOQvNjBk/view) | LI-153 · 2026-12-04 17:30 | IG-149 · 2026-12-04 08:30 | Programmé |
| 013 | 2026-11-16 | EPG | avant-après | Avant : mai 2031. Un clic. Après : mars 2030. (apport en retard remis dans les temps par le versement nécessaire ; tourné avec la correction de versementPour) | `scenarios/013-epargne-apport-dans-les-temps.mjs` | 26,2 s | [Drive](https://drive.google.com/file/d/1oXKT4j4IYSK4uW2Yp56WhlfkhaBXEHwU/view) | LI-154 · 2026-12-31 17:30 | IG-150 · 2026-12-31 18:30 (remplace IG-60, annulé) | Prêt : à passer en Programmé une fois la correction d'Objectif d'épargne en production |
| 014 | 2026-11-17 | NTS | démonstration (privée) | Partiels de L1 : quelle note me faut-il ? (vue ordinateur, profil droit-l1 : moyenne 9,42, note à viser 10,47 à chaque partiel) | `scenarios/014-notes-odelia.mjs` | 8,2 s (muette) | non déposée | non programmée | non programmée | Privée : vidéo type d'utilisation pour le partenariat Odélia (Yuzu Agency), version brute seule (sans texte, musique ni son), moteur en temps virtuel du 17/11/2026 ; jamais publiée |
| 015 | 2026-11-17 | REV | démonstration (privée) | Partiels dans 55 jours : je révise quoi ? (vue téléphone : J-55, session guidée, feuille blanche, 2/4 mots-clés) | `scenarios/015-revision-session-odelia.mjs` | 13,4 s (muette) | non déposée | non programmée | non programmée | Privée : vidéo type d'utilisation pour le partenariat Odélia (Yuzu Agency), version brute seule (sans texte, musique ni son), moteur en temps virtuel du 17/11/2026 ; jamais publiée |
| 016 | 2026-11-17 | PHR | démonstration (privée) | Cours, TD, BU : ma semaine tient dans un écran (vue ordinateur : semaine de L1, bilan de la semaine précédente, 16 h 30 de révisions sur 18 h) | `scenarios/016-planner-semaine-odelia.mjs` | 9,0 s (muette) | non déposée | non programmée | non programmée | Privée : vidéo type d'utilisation pour le partenariat Odélia (Yuzu Agency), version brute seule (sans texte, musique ni son), moteur en temps virtuel du 17/11/2026 ; jamais publiée |
| 017 | 2026-11-17 | HBT | démonstration (privée) | Réviser chaque jour sans casser la série (vue téléphone : session de révision cochée, série 12 → 13 jours) | `scenarios/017-habitudes-serie-odelia.mjs` | 6,3 s (muette) | non déposée | non programmée | non programmée | Privée : vidéo type d'utilisation pour le partenariat Odélia (Yuzu Agency), version brute seule (sans texte, musique ni son), moteur en temps virtuel du 17/11/2026 ; jamais publiée |
