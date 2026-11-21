# Jeux et quiz d'acquisition · Instagram et TikTok

Demande de Quentin du 21/11/2026 : accrocher avec un jeu ou un quiz ludique qui montre ce que font les templates.
Précisions du même jour : **Instagram et TikTok uniquement** (pas de LinkedIn ni de X), public **étudiants et jeunes
adultes** (18 ans et plus : pas de ciblage des mineurs, cf. `../canaux-publicite.md`), produits mis en avant :
**Gestionnaire de tâches (19 €), Mon Budget (15 €), Suivi d'habitudes (12 €)**. Ton : vouvoiement, comme toute légende
Instagram (`../instagram/README.md`).

| # | Format | Statut | Date |
|---|---|---|---|
| A | 7 stories quiz Instagram + 6 vidéos quiz « devinez la réponse » (TikTok, et Reel si voulu) | **prêt**, dans Drive | semaine du 23/11/2026 |
| B | Test « Combien vous coûte votre désorganisation ? » (`/diagnostic/`, lien court `/jeu`) | **prêt, PR ouverte** (fusion sur feu vert) | dès la fusion ; lien en bio |
| C | Défi à envoyer à un ami (« Qui tient le mieux ses habitudes ? », duel de scores) | idée | mi-décembre 2026 |
| E | Quiz de profil « Quel organisateur êtes-vous ? » (profils → tâches, budget, habitudes, pack) | idée | prêt le 28/12, lancé le 02/01/2027 |

Règles : `../REGLES-CONTENU.md` (problème chiffré, bascule, solution ; aucun chiffre inventé ; exemples fictifs ;
accroche entière dès la première image) ; appel à l'action : essai gratuit 14 jours, sans carte (§ 7).

## Fichiers

- Drive : dossier « Quiz Instagram et TikTok · semaine du 23-11 (stories et vidéos) »
  (`1-ykOzLMJmspY3HRfCSr85f_iDU3zdIwy`), 7 stories question, 7 stories réponse, 6 vidéos.
- Sources : `stories.html` (données des quiz, stories, vidéos, aperçu du lien) ; rendu
  `node docs/templates/communication/jeux/rendre.mjs --videos` (vidéos par le moteur unique `docs/videos/rendu.mjs`,
  13 s, 1080 × 1920, musique QME vérifiée par `ffprobe`). PNG et MP4 dans `png/`.

## A · Semaine du 23/11/2026

**Instagram, stories, à la main, chaque soir à 19:30** (après la publication de 19:00) : la story réponse de la veille
(autocollant Lien), puis la story question du jour (autocollant **Quiz**, bonne réponse cochée, posé sur la zone vide).
À ma connaissance l'API Instagram ne pose pas d'autocollant interactif : Instinct ne peut pas les publier.

**TikTok, vidéo, à la main, chaque jour à 18:00** (créneau libre, avant la reprise TikTok d'Instagram) : la vidéo quiz
du jour (la question s'affiche entière, 4 choix, compte à rebours, réponse, appel « le test en 1 minute · lien en
bio »). Légende courte : la question, puis « Réponse en commentaire si vous l'avez trouvée avant la fin ». Ces vidéos
peuvent aussi partir en Reel Instagram ; je ne les ai pas ajoutées aux plannings Sheets (voir « À décider »).

| Jour | Thème | Question (bonne réponse en gras) | Produit | Source du chiffre |
|---|---|---|---|---|
| lun. 23/11 | Budget | 5 € de snack ou de café, du lundi au vendredi. Combien par an ? 260 € / 650 € / **1 300 €** / 1 825 € | Mon Budget | 5 × 5 × 52, exemple fictif |
| mar. 24/11 | Tâches | Votre liste fait 80 lignes et vous ne savez pas par où commencer. Le vrai problème ? la liste est trop longue / **le tri** / le manque de temps / la motivation | Gestionnaire de tâches | Reel IG-56 |
| mer. 25/11 | Habitudes | Objectif : 3 séances de sport par semaine. Vous en faites 2. Combien de ratées sur un an ? 12 / 26 / **52** / 104 | Suivi d'habitudes | 1 × 52, exemple fictif |
| jeu. 26/11 | Budget | Règle 50/30/20 : sur 1 200 € par mois, combien pour vos envies ? 240 € / **360 €** / 400 € / 600 € | Mon Budget | repère 50/30/20 de `templates/budget/regles.js` |
| ven. 27/11 | Tâches | Une tâche urgente, mais pas importante. Vous… ? la faites tout de suite / la planifiez / **l'expédiez ou la déléguez** / l'abandonnez | Gestionnaire de tâches | Reel IG-56 (tri urgent / important) |
| sam. 28/11 | Habitudes | 10 minutes de lecture par jour. Combien d'heures sur un an ? 12 h / 30 h / **environ 61 h** / 120 h | Suivi d'habitudes | 10 × 365 / 60 |
| dim. 29/11 | Sondage | Ce que vous lâchez en premier ? le budget / le sport / la to-do list / le sommeil | — | — |
| lun. 30/11 | — | Story « Merci pour vos réponses » + lien `/jeu` | — | — |

Tant que `/diagnostic/` n'est pas en ligne, le lien des stories réponse pointe vers `/catalogue/budget/`,
`/catalogue/taches/` ou `/catalogue/habitudes/` (le premier bouton y est l'essai gratuit).

### Relevé (à remplir chaque soir)

| Jour | Story : vues / réponses / bonne réponse (%) / clics | TikTok : vues / taux de visionnage complet / commentaires |
|---|---|---|
| 23/11 | | |
| 24/11 | | |
| 25/11 | | |
| 26/11 | | |
| 27/11 | | |
| 28/11 | | |
| 29/11 | | — |

Le thème qui fait le plus réagir (budget, tâches ou habitudes) passe en tête du test B et oriente C et E.

## B · Le test `/diagnostic/`

- Page `diagnostic/index.html`, script `assets/diagnostic.js` (calcul pur `DIAG.calculer`, testé par
  `outils/templates/diagnostic.test.mjs`), styles `assets/diagnostic.css`, lien court `/jeu` (`netlify.toml`).
- 3 questions, chacune peut être passée ; aucune statistique extérieure, seulement les réponses multipliées sur un an :
  - **budget** : petits achats non prévus par semaine × 52 + abonnements non utilisés par mois × 12 → euros par an
    (Mon Budget) ;
  - **tâches** : minutes perdues par jour à chercher par quoi commencer × 365 → heures par an (Gestionnaire de tâches) ;
  - **habitudes** : (objectif − ce qui est tenu) par semaine × 52 → séances ratées par an (Suivi d'habitudes).
- Résultat : « 1 160 € · 91 h perdues · 104 séances ratées par an », détail ligne par ligne, chaque ligne mène à
  l'essai gratuit du template. Image story à partager (« Ma désorganisation me coûte, par an : … Et vous ? »).
- Mesure GoatCounter (sans cookie) : `diagnostic-debut`, `diagnostic-passer`, `diagnostic-resultat`,
  `diagnostic-image`, `diagnostic-partage`, `diagnostic-essai-<budget|taches|habitudes>`. Le chiffre qui compte :
  résultats affichés → clics « Essayer », puis essais ouverts et achats ; relevé le lundi.

## À décider par Quentin

1. Fusion de la PR (mise en ligne de `/diagnostic/` et `/jeu`).
2. Vidéos quiz aussi en **Reel Instagram** ? Si oui, elles entrent au planning Instagram, et la règle du dépôt veut
   alors aussi une ligne `YT-nn` (CLAUDE.md, « tout format vidéo ajouté à un planning ») : à lever explicitement pour
   cette campagne, puisqu'elle est réservée à Instagram et TikTok.
3. **Planning de révision** (14,90 €), seul template conçu pour les étudiants, en pleine période de partiels : l'ajouter
   aux thèmes (quiz et quatrième question du test) ?
