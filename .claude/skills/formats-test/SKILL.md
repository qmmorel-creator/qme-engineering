---
name: formats-test
description: Produire et programmer les publications du test de nouveaux formats QME (décision de Quentin du 24/11/2026) — pire tableur, calcul que personne ne fait, test gratuit en lien, conversation de couple, série numérotée, défi chronométré, réaction à l'actualité chiffrée, format « satisfaisant » (le quiz existe déjà) — animées entièrement par Claude, sur la case Instagram 19:00 (reprise TikTok) avec jumeau YouTube Short pour les vidéos, puis mesurer lequel marche. À utiliser quand Quentin demande « nouveaux formats », « test des formats », « vague 2 », « la publication format test », ou quand une ligne « À produire » de thème « Test formats » apparaît dans le planning Instagram.
---

# Test des nouveaux formats (Instagram 19:00 + TikTok + YouTube Shorts)

Décision de Quentin du 24/11/2026 : « je poste toujours le même type de contenu ». Tout le contenu suivait une seule
recette (problème chiffré → bascule → capture du template → essai) en motion design Bauhaus, sans visage, et vendait à
chaque fois. On teste 9 formats, **sans visage ni voix de Quentin** (il a refusé le face caméra) : **Claude fait toutes
les animations**, avec le moteur unique `docs/videos/`.

Règles communes, qui priment : `docs/templates/communication/REGLES-CONTENU.md` (accroche entière dès la première
image, aucune vidéo muette, couleur Bauhaus en rotation, données fictives, aucun chiffre inventé), `HEURES.md`,
`CLAUDE.md`. Ce skill assouplit **une seule** règle : les formats « utile » (F3, F9) n'ont pas à montrer un produit ni à
finir sur l'essai ; ils finissent sur « Enregistrez-le » / « Envoyez-le à … » puis, en dernière ligne, QME discret.

## Les formats

| Code | Format | Support | Ce qu'on teste | Fin / appel |
|---|---|---|---|---|
| F2 | « Envoyez-moi votre pire tableur » : un tableur fictif typique (couleurs partout, fusions, `#REF!`) transformé en app QME, avant → après | Reel 20–29 s | interaction (messages, commentaires) + prospection sur mesure | « Envoyez-moi le vôtre en message : je choisis le prochain épisode » |
| F3 | « Le calcul que personne ne fait » : un calcul de la vie courante, vérifiable, **sans produit** | Carrousel 5–6 vues | enregistrements, envois | « Enregistrez-le. Envoyez-le à quelqu'un qui … » |
| F4 | Test gratuit en lien : `qm-engineering.fr/diagnostic/` (« Combien te coûte ta désorganisation ? », 4 questions, en ligne) | Reel ou carrousel | clics vers le site (GoatCounter `/diagnostic`) | « Faites le test : 1 minute, lien en bio » |
| F5 | Scène de vie en conversation (faux SMS de couple ou de colocs, bulles animées) | Reel 15–25 s | envois en message (« envoie-le à ton conjoint ») | chute drôle + l'outil en une phrase |
| F6 | Quiz qui fige l'image | Reel | rétention, commentaires | **existe déjà** : IG-168 à IG-175 (thème « Quiz étudiants », 21:00) ; ne pas le refaire, le mesurer |
| F7 | Série numérotée (« n°1 », « épisode 1/10 ») | habillage de F2 et F3 | abonnements (rendez-vous) | « Épisode 2 : … » annoncé |
| F8 | Défi chronométré : « Un outil pour un fleuriste en 60 minutes », accéléré animé (chrono à l'écran, étapes, résultat) | Reel 25–29 s | crédibilité ingénierie, sur mesure | « Votre métier, prochain défi ? Dites-le en commentaire » |
| F9 | Réaction à l'actualité chiffrée (changement daté du 1er janvier, échéance, barème) | Carrousel ou Reel | portée sur un sujet chaud | utile d'abord, l'outil en dernière vue |
| F10 | « Satisfaisant » : un tri, un recalcul, un planning qui se recale, 8–12 s en boucle, très peu de texte | Reel 8–12 s | taux de visionnage complet, rejeu | aucune ; nom de l'outil en pied |

Règles propres au test :
- **Faits vérifiés** : F3 et F9 citent une source officielle (service-public.fr, legifrance, impots.gouv, URSSAF, INSEE)
  dans le Doc (section `NOTES`) ; tout calcul est refait en code et le résultat collé dans `NOTES`. Aucun chiffre
  inventé ; un exemple fictif est dit fictif.
- **Personnages fictifs** (prénoms courants, aucune personne réelle), aucune marque tierce (pas « Excel » : « tableur »).
- F2 : le tableur « avant » est fabriqué par nous (HTML imitant un tableur, données fictives), jamais un fichier reçu
  sans l'accord écrit de son auteur. Les vrais envois d'abonnés deviennent les épisodes suivants, anonymisés, avec accord.
- Vidéos : `node docs/videos/rendu.mjs <page.html> <durée> <ms couverture> --sortie <mp4>` (page animée exposant
  `window.placer(ms)`, modèle `docs/templates/communication/instagram/production/IG-46.html`) ; démo réelle d'un
  template : `docs/videos/moteur.mjs` + scénario. Contrôles : `ffprobe` (1080 × 1920, piste audio, < 2,9 Mo), planche
  d'images relue, image à 0,05 s lisible.
- Carrousels : 1080 × 1350, `instagram/rendre.mjs` ; diaporama TikTok `node docs/videos/diaporama.mjs … --sortie
  docs/videos/sortie/IG-nn-<slug>-tiktok.mp4` déposé sous ce nom exact.
- Sources dans `docs/templates/communication/formats-test/IG-nn/` (HTML, script, textes) ; médias rendus hors dépôt ou
  dans `docs/videos/sortie/` (non suivis).

## Programmation

- Case : **Instagram 19:00**, Thème `Test formats`, Titre interne `<code> · <titre>` (ex. `F3 · Calcul n°1 · …`),
  colonne M (Remarque) : `Test formats <code> · vague <n>`. TikTok suit seul (Reel tel quel, carrousel via le
  diaporama). Vidéo : jumeau YouTube Short le même jour (12:00 si libre, sinon 17:00), Thème = `test-formats`.
- Dossiers Drive, colonnes, format strict des Docs : `.claude/skills/video-demo/reference.md` § Programmation et
  `.claude/skills/publication-classique/SKILL.md` § 6. Légende Instagram : accroche, 3 à 5 lignes, appel du format,
  3 à 5 hashtags. Statut `Programmé` une fois les médias et le Doc vérifiés.
- Une publication remplacée n'est jamais supprimée : sa ligne est **décalée** à la fin de la réserve Instagram
  (premier jour libre à 19:00), avec la remarque `décalé le <date> (test formats)`.

## Mesure (chaque lundi, et bilan à 4 semaines)

Relever pour chaque ligne `Test formats` et, en témoin, les publications classiques de la même semaine : vues, portée,
enregistrements, **envois**, commentaires, abonnés gagnés (statistiques Instagram, relevé d'Instinct), visites
`/diagnostic` et `/sur-mesure` (GoatCounter). Comparer en **envois / portée** et **enregistrements / portée** (pas en
vues brutes, trop faibles à 53 abonnés). Écrire le relevé dans `docs/templates/communication/formats-test/README.md`
§ Résultats. Règle de décision : un format qui fait au moins 2 fois la médiane des classiques sur l'un de ces ratios
passe en vague suivante ; un format sous la médiane deux fois de suite est arrêté.

## Journal

Une ligne par publication dans `docs/templates/communication/formats-test/README.md` § Calendrier (ID, date, code,
titre, support, IDs YouTube, statut). Commit sur la branche de travail ; aucune fusion dans `main` sans Quentin.
