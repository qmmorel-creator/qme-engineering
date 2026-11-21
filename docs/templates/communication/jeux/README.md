# Jeux et quiz d'acquisition · Instagram et TikTok

Demande de Quentin du 21/11/2026 : accrocher avec un jeu ou un quiz ludique qui montre ce que font les templates.
Décisions du même jour :

- **Instagram et TikTok uniquement** (ni LinkedIn ni X) ;
- public **étudiants et jeunes adultes**, 18 ans et plus (aucun ciblage des mineurs, cf. `../canaux-publicite.md`) ;
- produits mis en avant : **Planning de révision (14,90 €), Mon Budget (15 €), Gestionnaire de tâches (19 €), Suivi
  d'habitudes (12 €)** ;
- **tutoiement** (exception à la règle de vouvoiement d'Instagram, notée dans `../instagram/README.md`).

| # | Format | Statut | Date |
|---|---|---|---|
| A | 9 stories quiz Instagram (à la main) + 8 Reels quiz « devine la réponse » (IG-168 à IG-175, repris sur TikTok) | **programmé** | du 23/11 au 02/12/2026 |
| B | Test « Combien te coûte ta désorganisation ? » (`/diagnostic/`, lien court `/jeu`) | **en ligne** (PR #200 fusionnée le 21/11/2026) | lien en bio |
| C | Défi à envoyer à un pote (« Qui tient le mieux ses habitudes ? », duel de scores) | idée | mi-décembre 2026 |
| E | Quiz de profil « Quel organisateur es-tu ? » (profils → révision, budget, tâches, habitudes, pack) | idée | prêt le 28/12, lancé le 02/01/2027 |

Règles : `../REGLES-CONTENU.md` (problème chiffré, bascule, solution ; aucun chiffre inventé ; exemples fictifs ;
accroche entière dès la première image) ; appel à l'action : essai gratuit 14 jours, sans carte (§ 7) ; les quatre
templates sont dans `PRODUITS_ESSAI` (vérifié le 21/11/2026).

## Fichiers

- Drive : dossier « Quiz Instagram et TikTok · 23-11 au 02-12 (tutoiement) » : 9 stories question, 9 stories réponse,
  8 vidéos, nommées dans l'ordre de publication.
- Sources : `stories.html` (données des quiz, stories, vidéos, aperçu du lien) ; rendu
  `node docs/templates/communication/jeux/rendre.mjs --videos` (vidéos par le moteur unique `docs/videos/rendu.mjs`,
  13 s, 1080 × 1920, musique QME vérifiée par `ffprobe`). PNG et MP4 dans `png/`.

## A · Du 23/11 au 02/12/2026

**Instagram, stories, à la main, chaque soir à 19:30** (après la publication de 19:00) : la story réponse de la veille
(autocollant Lien), puis la story question du jour (autocollant **Quiz**, bonne réponse cochée, posé sur la zone vide).
À ma connaissance l'API Instagram ne pose pas d'autocollant interactif : Instinct ne peut pas les publier.

**Reels Instagram, programmés, 21:00** (décision de Quentin du 21/11/2026) : IG-168 à IG-175, du 23/11 au 30/11, un
par jour, dans le planning Instagram (statut « Programmé », Thème « Quiz étudiants », légendes en tutoiement dans le
dossier Textes Instagram, vidéos et couvertures dans Images Instagram). Instinct les publie au passage de 21:00.
**TikTok** : rien à faire à la main, Instinct reprend chaque Reel publié sur TikTok dans l'heure, vidéo seule
(`../tiktok/PROMPT-INSTINCT-TIKTOK.md`). **YouTube** : pas de ligne `YT-nn`, la campagne étant réservée à Instagram et
TikTok (exception à la règle de CLAUDE.md « tout format vidéo… », décidée par Quentin le 21/11/2026).

| Reel | Date | Vidéo | Doc légende |
|---|---|---|---|
| IG-168 | lun. 23/11 | `IG-168-quiz-revision-quand.mp4` | `1AkFwTUuOHlIpq2AaUsdTuTd4xdxETkCrFcMiidfGGjc` |
| IG-169 | mar. 24/11 | `IG-169-quiz-budget-snack.mp4` | `12RFy81Klg9hI5_sHq3J-90Qxgeiq4IxBDHVRJJanUlQ` |
| IG-170 | mer. 25/11 | `IG-170-quiz-taches-80-lignes.mp4` | `1Pz-EUdST6xhAEmLPhAC_Te_QOqolo5SijlPVq4Mts6M` |
| IG-171 | jeu. 26/11 | `IG-171-quiz-habitudes-seances.mp4` | `1iyciYK0hLTSQtqVr8zSCsWe0xwwBtxHUJ_SCjHPhcQc` |
| IG-172 | ven. 27/11 | `IG-172-quiz-revision-charge.mp4` | `1eTotofzEwUBkb__24GDLypJfuS-nYP8z12BXywZxQfg` |
| IG-173 | sam. 28/11 | `IG-173-quiz-budget-50-30-20.mp4` | `1GtahX4vxRTf_dgv8wqW4xuEyLEgvvXlGywDW60LcETQ` |
| IG-174 | dim. 29/11 | `IG-174-quiz-taches-urgent.mp4` | `1xqPLVhnPoTSYusiJ5bGzvabs3qAJnAt8fZ1qVzRZ-wM` |
| IG-175 | lun. 30/11 | `IG-175-quiz-habitudes-lecture.mp4` | `1jlnD27bsP6OKczftCiW8kEYxjQj2isJJSCgWTu3ZEJc` |

Les Reels du soir automatiques (lundi, mercredi, vendredi, 21:00) ne prendront pas ces dates : leur skill ne
programme qu'un soir sans Reel à 19:00 ou plus tard.

| Jour | Thème | Question (bonne réponse en gras) | Produit | Source du chiffre |
|---|---|---|---|---|
| lun. 23/11 | Révisions | Tu as vu un chapitre en cours aujourd'hui. Tu le revois quand ? la veille de l'examen / tous les soirs / **demain, puis de plus en plus espacé** / quand j'ai le temps | Planning de révision | intervalles 1, 3, 7, 14, 30 de `templates/revision/donnees.js` |
| mar. 24/11 | Budget | 5 € de snack ou de café, du lundi au vendredi. Combien par an ? 260 € / 650 € / **1 300 €** / 1 825 € | Mon Budget | 5 × 5 × 52, exemple fictif |
| mer. 25/11 | Tâches | Ta liste fait 80 lignes et tu ne sais pas par où commencer. Le vrai problème ? la liste est trop longue / **le tri** / le manque de temps / la motivation | Gestionnaire de tâches | Reel IG-56 |
| jeu. 26/11 | Habitudes | Objectif : 3 séances de sport par semaine. Tu en fais 2. Combien de ratées sur un an ? 12 / 26 / **52** / 104 | Suivi d'habitudes | 1 × 52, exemple fictif |
| ven. 27/11 | Révisions | Partiels dans 30 jours, 40 chapitres. En répétition espacée, combien de révisions à caser ? 40 / 80 / **200** / 1 200 | Planning de révision | logique de `R.planifier` (`templates/revision/regles.js`) : J+1, J+4, J+11, J+25, puis la veille ; vérifié par `outils/templates/diagnostic.test.mjs` |
| sam. 28/11 | Budget | Règle 50/30/20 : sur 1 200 € par mois, combien pour tes envies ? 240 € / **360 €** / 400 € / 600 € | Mon Budget | repère 50/30/20 de `templates/budget/regles.js` |
| dim. 29/11 | Tâches | Une tâche urgente, mais pas importante. Tu… ? la fais tout de suite / la planifies / **l'expédies ou la délègues** / l'abandonnes | Gestionnaire de tâches | Reel IG-56 (tri urgent / important) |
| lun. 30/11 | Habitudes | 10 minutes de lecture par jour. Combien d'heures sur un an ? 12 h / 30 h / **environ 61 h** / 120 h | Suivi d'habitudes | 10 × 365 / 60 |
| mar. 01/12 | Sondage | Ce que tu lâches en premier ? les révisions / le budget / le sport / la to-do list | — | — |
| mer. 02/12 | — | Story « Merci pour tes réponses » + lien `/jeu` | — | — |

Le lien des stories réponse (autocollant Lien) : `qm-engineering.fr/jeu`, en ligne depuis le 21/11/2026.

Note sur la répétition espacée : les intervalles du template sont des **écarts entre deux révisions** (1, 3, 7, 14,
30 jours), pas des jours comptés depuis le cours ; les textes des quiz le disent ainsi (« demain, puis 3, 7, 14 et
30 jours après chaque révision »).

### Relevé (à remplir chaque soir)

| Jour | Story : vues / réponses / bonne réponse (%) / clics | TikTok : vues / visionnage complet / commentaires |
|---|---|---|
| 23/11 | | |
| 24/11 | | |
| 25/11 | | |
| 26/11 | | |
| 27/11 | | |
| 28/11 | | |
| 29/11 | | |
| 30/11 | | |
| 01/12 | | — |

Le thème qui fait le plus réagir passe en tête du test B et oriente C et E.

## B · Le test `/diagnostic/`

- Page `diagnostic/index.html`, script `assets/diagnostic.js` (calcul pur `DIAG.calculer`, testé par
  `outils/templates/diagnostic.test.mjs`), styles `assets/diagnostic.css`, lien court `/jeu` (`netlify.toml`).
- 4 questions, chacune peut être passée ; aucune statistique extérieure :
  - **révisions** : chapitres à revoir et jours avant l'examen → révisions à caser et nombre par jour, selon la logique
    du Planning de révision (chaque révision faite le jour prévu avec « Moyen », hypothèse de la jauge du template) ;
    c'est une charge, pas une perte : hors total ;
  - **budget** : petits achats non prévus par semaine × 52 + abonnements non utilisés par mois × 12 → euros par an ;
  - **tâches** : minutes perdues par jour × 365 → heures par an ;
  - **habitudes** : (objectif − ce qui est tenu) par semaine × 52 → séances ratées par an.
- Résultat : par exemple « 200 révisions à caser (≈ 6,7 par jour) » puis « 1 160 € · 91 h perdues · 104 séances ratées
  par an » ; chaque ligne mène à l'essai gratuit du template. Image story à partager (« Ma désorganisation me coûte,
  par an : … Et toi ? »).
- Mesure GoatCounter (sans cookie) : `diagnostic-debut`, `diagnostic-passer`, `diagnostic-resultat`,
  `diagnostic-image`, `diagnostic-partage`, `diagnostic-essai-<revisions|budget|taches|habitudes>`. Le chiffre qui
  compte : résultats affichés → clics « Essayer », puis essais ouverts et achats ; relevé le lundi.

## À faire par Quentin

1. Mettre `qm-engineering.fr/jeu` en lien de bio Instagram (et TikTok), puisque les Reels et le test y renvoient.
2. Stories quiz du 23/11 au 02/12 à 19:30 (à la main, visuels dans le dossier Drive « Quiz Instagram et TikTok ·
   23-11 au 02-12 (tutoiement) »).
