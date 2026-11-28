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

Dates mises à jour le 24/11/2026 (règle « une publication par plateforme et par jour ») ; référence : `../CALENDRIER-UNE-PAR-JOUR.md`.

| ID | Date | Heure | Code | Pièce | Support | YouTube | Statut |
|---|---|---|---|---|---|---|---|
| IG-213 | 24/11 | 19:00 | F3 + F7 | 10 minutes perdues par jour : sur un an, 38 h 10 | Carrousel 6 vues + diaporama TikTok | YT-74 24/11 20:00 (diaporama) | Programmé |
| IG-214 | 26/11 | 12:30 | F10 | « Une date bouge. Regardez le reste. » (Gantt, boucle) | Reel 9 s | YT-69 26/11 12:00 | Programmé |
| IG-215 | 29/11 | 19:00 | F5 | Conversation de couple : « Tu me dois combien ? » « 50 €, à tout casser. » → 354,64 € | Reel 25 s | YT-70 29/11 12:00 | Programmé |
| IG-216 | 02/12 | 19:00 | F2 + F7 | Envoyez-moi votre pire tableur, épisode 1 (14 onglets, Hugo en #REF!) | Reel 28 s | YT-71 02/12 20:00 | Programmé |
| IG-217 | 03/12 | 12:30 | F8 | Défi : un outil pour un fleuriste en 60 minutes | Reel 28 s | YT-72 03/12 12:00 | Programmé |
| IG-218 | 06/12 | 12:30 | F4 | Le test en 1 minute (`/diagnostic/`) : exemple fictif, 1 480 € et 124 h par an | Reel 23 s | YT-73 06/12 12:00 | Programmé |
| IG-219 | 12/12 | 19:00 | F9 | Fin du régime simplifié de TVA au 01/01/2027 (impots.gouv.fr, 22/09/2026), cas fictif de Léa | Carrousel 6 vues + diaporama TikTok | — | Programmé |
| IG-226 | 01/12 | 21:00 | F3 + F7 | Le calcul que personne ne fait n°2 : règle de 72 (« Un prix qui monte de 3 % par an. Il double quand ? ») | Carrousel 6 vues + diaporama TikTok | YT-79 01/12 12:00 (diaporama) | Programmé |
| IG-227 | 09/12 | 19:00 | F3 + F7 | Le calcul que personne ne fait n°3 : « −20 %, puis +20 %. Vous revenez au même prix ? » (96 €) | Carrousel 6 vues + diaporama TikTok | YT-80 09/12 12:00 (diaporama) | Programmé |
| IG-228 | 15/12 | 21:00 | F3 + F7 | Le calcul que personne ne fait n°4 : « Mensuel ou annuel ? L'annuel n'est rentable qu'à une condition. » (11 mois) | Carrousel 6 vues + diaporama TikTok | YT-81 15/12 12:00 (diaporama) | Programmé |
| IG-168 → 175 | 23/11 puis 28/11 → 14/01 | 21:00 | F6 | Quiz (existant), étalés depuis le 24/11 | Reel | — | Programmé |

YT-71 est passé de 17:00 à 20:00 le 24/11 : YouTube ne passe qu'à 12:00, 12:15, 20:00 et 20:15 ; YT-51 (20:00) part au passage de 20:00 et YT-71 à celui de 20:15.

## Série « Le calcul que personne ne fait » (chaque mardi, automatisée)

Décision de Quentin du 24/11/2026 : la série est produite chaque semaine par l'agent de contenu (le lundi, pour le mardi
de la semaine suivante), sur le modèle de `IG-228/`. Couleur en rotation bleu → jaune → rouge. Sujets déjà traités (ne
jamais les reprendre) :

| N° | ID | Date | Sujet | Couleur |
|---|---|---|---|---|
| 1 | IG-213 | 24/11 | 10 minutes perdues par jour : 38 h 10 par an | bleu |
| 2 | IG-226 | 01/12 | Règle de 72 : un prix à +3 % par an double en ~24 ans | jaune |
| 3 | IG-227 | 09/12 | −20 % puis +20 % ne s'annulent pas (96 €) | rouge |
| 4 | IG-228 | 15/12 | Abonnement mensuel ou annuel : rentable dès 11 mois | bleu |
| 5 | à produire | 22/12 | (agent de contenu, lundi 14/12) | jaune |

## Vague 2 (à partir du 10/12, après le relevé du 07/12)

- Répétition des formats qui ressortent de la vague 1.
- **F11 · Mascotte Grillon** (anciennement Carreau, renommée par Quentin le 27/11/2026 ; même dessin, fiche validée par Quentin le 24/11/2026, `mascotte/`) : IG-224 le 14/12 19:00 (YT-77 20:00) et IG-225 le 18/12 19:00 (YT-78 20:00), refaits le 28/11/2026 sous le nom Grillon (`IG-224-grillon-1.mp4`, `IG-225-grillon-2.mp4`, musique d'origine conservée).
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
