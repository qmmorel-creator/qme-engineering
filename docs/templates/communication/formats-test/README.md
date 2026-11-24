# Test des nouveaux formats (vague 1 : 24/11 → 09/12/2026)

Demande de Quentin du 24/11/2026 : « je poste toujours le même type de contenu ». Il a écarté le face caméra (format 1)
et demandé un mélange des 9 autres, **animés entièrement par Claude**, pour mesurer ce qui marche. Procédure de
production : skill `.claude/skills/formats-test/`.

## Choix de placement

- Case principale : **Instagram** (TikTok reprend chaque publication, YouTube reçoit un Short jumeau pour chaque vidéo).
  LinkedIn n'est pas touché en vague 1 : sa réserve est pleine jusqu'en mars et la mesure se fait sur Instagram.
- **Rien n'a été décalé.** Les carrousels de 19:00 jusqu'au 07/12 (IG-151, IG-08, IG-30, IG-09, IG-10, IG-12, IG-13,
  IG-14, IG-17…) servent au **test des fonds** en cours (`instagram/tests-fonds/README.md`) : les déplacer fausserait
  ce test. Les 7 pièces occupent des cases libres (19:00 libres, et 12:30, case des Reels, pour les vidéos).
- Le **quiz** (format 6) existe déjà : IG-168 à IG-175, tous les soirs à 21:00 jusqu'au 30/11. Il est mesuré, pas
  refait.
- La **série numérotée** (format 7) est un habillage, testé sur F3 (« n°1 ») et F2 (« épisode 1 »).

## Calendrier

| ID | Date | Heure | Code | Pièce | Support | YouTube | Statut |
|---|---|---|---|---|---|---|---|
| IG-213 | 24/11 | 19:00 | F3 + F7 | 10 minutes perdues par jour : sur un an, 38 h 10 | Carrousel 6 vues + diaporama TikTok | YT-74 24/11 20:00 (diaporama) | Programmé |
| IG-214 | 25/11 | 12:30 | F10 | « Une date bouge. Regardez le reste. » (Gantt, boucle) | Reel 9 s | YT-69 25/11 12:00 | Programmé |
| IG-215 | 29/11 | 19:00 | F5 | Conversation de couple : « Tu me dois combien ? » « 50 €, à tout casser. » → 354,64 € | Reel 25 s | YT-70 29/11 12:00 | Programmé |
| IG-216 | 02/12 | 19:00 | F2 + F7 | Envoyez-moi votre pire tableur, épisode 1 (14 onglets, Hugo en #REF!) | Reel 28 s | YT-71 02/12 20:00 | Programmé |
| IG-217 | 03/12 | 12:30 | F8 | Défi : un outil pour un fleuriste en 60 minutes | Reel 28 s | YT-72 03/12 12:00 | Programmé |
| IG-218 | 06/12 | 12:30 | F4 | Le test en 1 minute (`/diagnostic/`) : exemple fictif, 1 480 € et 124 h par an | Reel 23 s | YT-73 06/12 12:00 | Programmé |
| IG-219 | 09/12 | 19:00 | F9 | Fin du régime simplifié de TVA au 01/01/2027 (impots.gouv.fr, 22/09/2026), cas fictif de Léa | Carrousel 6 vues + diaporama TikTok | — | Programmé |
| IG-168 → 175 | 23/11 → 30/11 | 21:00 | F6 | Quiz (existant) | Reel | — | déjà programmés |

YT-71 est passé de 17:00 à 20:00 le 24/11 : YouTube ne passe qu'à 12:00, 12:15, 20:00 et 20:15 ; YT-51 (20:00) part au passage de 20:00 et YT-71 à celui de 20:15.

## Vague 2 (à partir du 10/12, après le relevé du 07/12)

- Répétition des formats qui ressortent de la vague 1.
- **F11 · Mascotte Carreau** (fiche validée par Quentin le 24/11/2026, `mascotte/`) : IG-224 le 14/12 19:00 (YT-77 20:00) et IG-225 le 18/12 19:00 (YT-78 20:00).
- **F12 · Voix de Quentin** (ElevenLabs, sa propre voix) : 2 Reels sur le même sujet, avec et sans voix (A/B).
  Préalables : voix clonée par Quentin, offre ElevenLabs autorisant l'usage commercial, clé saisie dans le formulaire
  sécurisé de l'environnement, évolution de `docs/videos/rendu.mjs` pour mixer une voix.

## Mesure

Ratios comparés (pas les vues brutes, trop faibles à 53 abonnés) : **envois / portée**, **enregistrements / portée**,
commentaires, abonnés gagnés, part de vues complètes (vidéos) ; site : visites `/diagnostic` (F4) et `/sur-mesure`,
`/contact` (F2, F8). Témoin : la médiane des publications classiques de la même période. Limites connues : volumes
faibles (une seule pièce par format en vague 1), heures différentes (12:30 contre 19:00) ; la vague 2 répète les
formats qui ressortent pour confirmer.

Règle de décision : au moins 2 fois la médiane des classiques sur un ratio → vague 2 ; sous la médiane deux fois de
suite → arrêt.

## Résultats

(à remplir au relevé du 07/12, puis du 14/12)

| ID | Code | Portée | Vues | Enregistrements | Envois | Commentaires | Abonnés | Clics site | Verdict |
|---|---|---|---|---|---|---|---|---|---|
