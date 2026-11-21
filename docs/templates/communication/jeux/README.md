# Jeux et quiz d'acquisition · plan et calendrier

Demande de Quentin du 21/11/2026 : accrocher sur les réseaux avec un jeu ou un quiz ludique, qui montre ce que font les
templates. Recommandation retenue, en trois temps :

| # | Format | Statut | Date visée |
|---|---|---|---|
| A | Quiz natifs (stories Instagram, sondages LinkedIn), zéro développement | **prêt** (visuels et textes ci-dessous) | semaine du 23/11/2026 |
| B | Test « Combien vous coûte votre désorganisation ? » (`/diagnostic/`, lien court `/jeu`) | **prêt, sur branche** : à fusionner (feu vert de Quentin) | en ligne dès la fusion ; relais à partir du 30/11 |
| C | « 50/50 ou prorata ? » à envoyer à son/sa partenaire (le partage fait partie du jeu) | idée | mi-décembre 2026 |
| E | Quiz de profil « Quel organisateur êtes-vous ? » (4 profils → 4 packs) | idée | prêt le 28/12, lancé le 02/01/2027 |

Règles communes : `../REGLES-CONTENU.md` (problème chiffré, bascule, solution ; aucun chiffre inventé ; données fictives) ;
appel à l'action = essai gratuit 14 jours (§ 7).

## Mesure

- GoatCounter (sans cookie) : événements `diagnostic-debut`, `diagnostic-passer`, `diagnostic-resultat`,
  `diagnostic-image`, `diagnostic-partage`, `diagnostic-essai-<abonnements|tjm|retards|couple>` ; visites de
  `/diagnostic/` avec `utm_campaign=diagnostic` (lien `/jeu`).
- Le chiffre qui compte : **résultats affichés → clics « Essayer »**, puis essais ouverts (`/admin/` essais) et achats.
  Relevé hebdomadaire, le lundi. Rien ne garantit à l'avance qu'un jeu convertisse : on décide C et E sur ces chiffres.
- Stories et sondages : réponses par option (statistiques Instagram et LinkedIn), à noter ci-dessous chaque soir.

## A · Semaine du 23/11/2026 : quiz en story et sondages

À ma connaissance, l'API de publication d'Instagram ne pose pas d'autocollant Quiz ou Sondage : ces stories se publient
**à la main depuis le téléphone**, pas par Instinct. Visuels : `png/quiz-<n>-question.png` et `png/quiz-<n>-reponse.png`
(1080 × 1920, `node docs/templates/communication/jeux/rendre.mjs`). La zone vide au milieu de la story question
accueille l'autocollant.

**Chaque soir à 19:30** (après la publication de 19:00) : la story **réponse** de la veille (avec un autocollant Lien),
puis la story **question** du jour (avec l'autocollant Quiz, bonne réponse cochée). Tant que `/diagnostic/` n'est pas
en ligne, le lien de la story réponse pointe vers la page catalogue du template (colonne « Lien en attendant »).

| Jour | Story question (autocollant Quiz : 4 choix, **bonne réponse en gras**) | Lien en attendant `/jeu` | Source du chiffre |
|---|---|---|---|
| lun. 23/11 | En 2027, combien de jours un freelance facture-t-il vraiment ? 261 / 254 / 229 / **environ 183** | `/catalogue/tjm/` | Reel IG-46, `templates/tjm/calculs.js` |
| mar. 24/11 | 7 petits abonnements : 88,34 € par mois. Combien par an ? 530 € / 880 € / **1 060 €** / 1 400 € | `/catalogue/abonnements/` | Reel IG-131 |
| mer. 25/11 | 2 400 € et 1 600 € de revenus, 1 500 € de dépenses communes. Au prorata, la personne à 1 600 € paie… ? 750 € / 640 € / **600 €** / 500 € | `/guides/budget-couple-50-50-ou-prorata/` | guide 50/50 ou prorata |
| jeu. 26/11 | Un client professionnel vous paie en retard. Vous avez droit à… ? rien / **40 € par facture** / 40 € par mois / 10 % du montant | `/guides/facture-impayee/` | art. L441-10 et D441-5 C. com. |
| ven. 27/11 | Voiture 5 CV, 10 002 km pro, comptés à 0,636 € le km toute l'année. Combien en trop ? 0 € / environ 400 € / **environ 1 395 €** / environ 3 000 € | `/catalogue/notes-de-frais/` | Reel IG-155 (barème fiscal 2025) |
| sam. 28/11 | Une tâche urgente, mais pas importante. Vous… ? la faites tout de suite / la planifiez / **la déléguez** / l'abandonnez | `/catalogue/taches/` | Reel IG-56 (matrice urgent / important) |
| dim. 29/11 | Sondage : Votre budget, vous le tenez où ? un tableur / une appli / sur papier / nulle part | — | — |
| lun. 30/11 | Story « Merci pour vos réponses » (`quiz-7-reponse.png`) + lien `/jeu` | `/jeu` si en ligne | — |

### Sondages LinkedIn (page QME, à la main, durée 3 jours, 14:00 pour ne pas croiser 10:00, 12:15 et 17:30)

- **mar. 24/11, 14:00** : « Freelances : pour fixer votre TJM, vous divisez votre objectif par… » 254 jours ouvrés /
  220 jours / environ 183 jours / je n'ai pas de méthode. Premier commentaire à la clôture : le calcul d'IG-46
  (261 − 7 fériés = 254 − 25 congés = 229 − un jour par semaine ≈ 183), puis le lien du test.
- **jeu. 26/11, 14:00** : « Un client professionnel paie en retard. Réclamez-vous l'indemnité de 40 € ? » toujours /
  parfois / jamais / je ne savais pas. Premier commentaire à la clôture : articles L441-10 et D441-5, lien du guide
  `/guides/facture-impayee/`.

### Relevé des réponses (à remplir)

| Jour | Vues | Réponses | Bonne réponse (%) | Clics sur le lien |
|---|---|---|---|---|
| 23/11 | | | | |
| 24/11 | | | | |
| 25/11 | | | | |
| 26/11 | | | | |
| 27/11 | | | | |
| 28/11 | | | | |
| 29/11 | | | — | |

Les questions qui font le plus réagir orientent la suite : ordre des questions du test B, accroches des Reels.

## B · Le test `/diagnostic/`

- Page : `diagnostic/index.html`, `assets/diagnostic.js` (calcul pur `DIAG.calculer`, testé par
  `outils/templates/diagnostic.test.mjs`), `assets/diagnostic.css`. Lien court `/jeu` (`netlify.toml`).
- 4 questions, chacune peut être passée : abonnements non utilisés (× 12) ; TJM divisé par les jours ouvrés 2027 (254,
  calculés par le module du template TJM) au lieu des jours facturables (manque à gagner par rapport à l'objectif) ;
  factures payées en retard × 40 € d'indemnité non réclamée ; budget à deux (écart 50/50 contre prorata, **hors total**,
  car ce n'est pas une perte pour le foyer).
- Résultat : total en euros par an, détail ligne par ligne, chaque ligne renvoie à l'essai gratuit du template
  (Suivi des abonnements, Calculateur de TJM, Relance des impayés, Gestion Dépenses Communes).
- Partage : image story 1080 × 1920 générée dans le navigateur (« Ma désorganisation me coûte X € par an. Et vous ? »),
  partage natif sur mobile, sinon copie du lien. Aperçu du lien : `assets/diagnostic-partage.png`.
- Confidentialité : calcul dans le navigateur, rien n'est envoyé ; seuls les événements GoatCounter sont comptés.

Relais à prévoir une fois en ligne (à intégrer aux plannings par les skills de publication) : lien `/jeu` en bio
Instagram et TikTok ; un Reel « J'ai fait le test : X € par an » à partir d'un exemple fictif rendu par
`docs/videos/` ; un post LinkedIn « erreur courante » renvoyant au test ; publication dans les communautés qui
acceptent un outil gratuit (lire leur règlement d'abord, cf. `../canaux-publicite.md`) ; test Meta de 50 € vers
`/jeu`, à décider par Quentin.

## C et E · à faire

- **C** (mi-décembre) : variante du calculateur du guide 50/50 avec un bouton « Envoyer à mon/ma partenaire » qui
  transmet les montants dans le lien (aucune donnée stockée), puis l'essai de Gestion Dépenses Communes.
- **E** (prêt le 28/12, lancé le 02/01/2027, saison des résolutions) : 8 questions, 4 profils reliés chacun à un pack
  existant (`/packs/`), carte de profil partageable sur le modèle de B.
