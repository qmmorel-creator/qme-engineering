---
name: idee-video
description: Générer l'idée de la prochaine vidéo de démonstration QME (Reel LinkedIn / Instagram), en alternant les angles (démonstration, problème à résoudre, question précise, paramétrage, interface, réglage, service rendu, avant-après, astuce, pack), sur UN seul template ou pack en vente à l'instant t, écrire son scénario réel, puis appeler le skill video-demo pour la tourner, la déposer dans Drive et la programmer. À utiliser quand Quentin demande « une idée de vidéo », « la vidéo du jour », « génère la prochaine vidéo », ou depuis une tâche planifiée quotidienne.
---

# Générateur d'idées de vidéos QME

> **Règles communes (18/11/2026)** : appliquer `docs/templates/communication/REGLES-CONTENU.md` (au moins 1 publication par jour et
> 7 jours d'avance par plateforme, problème posé puis résolu, accroche, rétention, couleur d'accent Bauhaus en rotation,
> aucune vidéo muette) et les heures de `docs/templates/communication/HEURES.md`. Elles priment sur ce skill.

But : une vidéo par jour, en complément des publications déjà prévues, qui donne envie d'ouvrir la démo.
Chaque idée porte sur **un seul produit en vente au moment de la génération** et montre une **interaction
réelle** avec lui. Ensuite, le skill `video-demo` fait tout le reste (lire `.claude/skills/video-demo/`).

Explique chaque étape à Quentin, en français, sans flatterie ; dis clairement ce qui est vérifié.

## 1. État à l'instant t

1. `git pull` de la branche de travail, puis `node docs/videos/catalogue.mjs` : produits **en vente** maintenant
   (templates avec identifiant Gumroad ; packs dont la fiche et tous les templates sont en vente), nombre de
   vidéos déjà faites par produit, six derniers types.
2. Lire `docs/videos/journal.md` (vidéos faites, état de la routine) et
   `docs/templates/communication/calendrier-*.md` le plus récent (sujets déjà publiés ou prévus les jours
   proches : ne pas doubler un sujet programmé à ±3 jours sur le même produit).

## 2. Choisir le produit

- Le produit **le moins montré** (0 vidéo d'abord), puis le plus ancien ; jamais le même produit que l'une
  des **3 dernières** vidéos. Un pack compte comme un produit à part.
- Préférer, à égalité : une saison qui colle (budget en décembre, révision avant les partiels, impôts au
  printemps…), puis le prix le plus élevé.
- Vérifier que la page de démo s'ouvre (`/templates/<slug>/?demo` sur le serveur local) : sinon passer au
  suivant et le signaler.

## 3. Choisir l'angle (rotation)

Ne jamais reprendre le type de la vidéo précédente ; prendre le type le moins utilisé parmi :

| Type | Ce que la vidéo montre | Accroche type |
|---|---|---|
| `démonstration` | une fonctionnalité de bout en bout, du geste au résultat | « En 3 gestes : … » |
| `problème` | une situation qui coince, puis l'outil qui la résout | « Une date bouge et tout est à refaire ? » |
| `question` | la réponse à une question précise, prouvée à l'écran | « Un retard décale-t-il la fin ? » |
| `paramétrage` | adapter l'outil à son cas (catégories, taux, règles, liste) | « Vos catégories, pas les miennes. » |
| `interface` | la navigation : vues, onglets, filtres, mobile, impression | « Tout votre mois sur un écran. » |
| `réglage` | une option qui change le calcul ou l'affichage (jours ouvrés, arrondi, unité) | « Jours ouvrés ou calendaires ? » |
| `service rendu` | le gain concret : un document prêt, un oubli évité, un calcul fait | « La relance est déjà écrite. » |
| `avant-après` | l'état initial, un geste, l'état final côte à côte | « Avant : 20 cellules. Après : une. » |
| `astuce` | un raccourci peu connu (saisie en une ligne, annuler, export) | « Tapez une phrase, obtenez une tâche. » |
| `pack` | (packs seulement) le passage d'un template à l'autre du pack sur un même cas | « Du devis à l'encaissement. » |

## 4. Trouver le sujet DANS l'application

1. Lancer le serveur local et explorer la démo avec Playwright (captures de chaque vue, liste des boutons
   `data-action`, champs éditables, valeurs calculées). Lire le guide intégré (« Comment ça marche ») et la
   fiche du template (`docs/templates/communication/<slug>/` : linkedin.md, instagram.md, gumroad.md).
2. Retenir **un** sujet qui :
   - se montre en 30 à 40 s avec de vrais gestes (cliquer, taper, choisir, glisser) ;
   - produit un **résultat visible et lisible** (un chiffre, une date, un statut, une couleur qui change) ;
   - s'appuie sur les données de démo, ou sur des données saisies à l'écran pendant la vidéo ;
   - n'a pas déjà été fait (journal) et respecte les règles de QME (données fictives, aucune marque tierce,
     aucune promesse chiffrée, pas d'outil personnel de Quentin).
3. Tester le geste à la main (script Playwright rapide) et **relever les valeurs avant/après réelles**. Si
   le résultat n'est pas convaincant (rien ne change, chiffre illisible), changer de sujet.

## 5. Écrire le scénario

1. Fiche courte (dans la réponse à Quentin et en tête du fichier scénario) : produit, type, accroche
   (3 lignes max), question persistante, déroulé seconde par seconde, résultat montré, outro.
2. Écrire `docs/videos/scenarios/<nnn>-<slug>-<sujet>.mjs` selon `.claude/skills/video-demo/reference.md`
   (modèle : `scenarios/gantt-retard.mjs`) : `config` avec `produit`, `type`, `titre` ; `preparer` qui
   contrôle que la démo contient le cas ; `jouer` sur le tempo. Pour un pack : un template par séquence,
   changement par `S('volet')` puis `v.ouvrir(url)`.
3. Rédiger les textes des publications (LinkedIn, Instagram et YouTube Shorts), au vouvoiement, dans le style des
   `*/linkedin.md` existants : constat, ce que montre la vidéo, lien de la démo en premier commentaire.

## 6. Tourner, déposer, programmer

Appeler le skill **`video-demo`** à partir de son étape 2 (rendu, vérification image par image, Drive,
programmation LinkedIn 17:30 / Instagram 12:30 / YouTube Shorts 12:00 à la date la plus proche sans vidéo, journal, commit).

## Tâche quotidienne

Si Quentin le demande, une tâche planifiée peut lancer ce skill chaque jour (une vidéo par jour). Ne la
créer qu'à sa demande explicite, avec l'heure qu'il choisit.
