# Prompt · audit complet des templates étudiants avant le partenariat Odélia

> À coller dans une nouvelle session Claude Code sur le dépôt `qmmorel-creator/qme-engineering`. Rédigé le 22/11/2026.

---

Tu travailles sur le dépôt `qme-engineering` (site QME et templates vendus sur Gumroad). Lis d'abord `CLAUDE.md`,
`README.md` et `docs/templates/essai-gratuit.md`.

## Contexte

Une créatrice de contenu étudiante (Reel Instagram + story, fin décembre ou début janvier) va envoyer vers
`qm-engineering.fr/odelia` (→ `/packs/etudiant/?utm_source=instagram&utm_medium=influence&utm_campaign=odelia`) un public
de lycéens et d'étudiants, **presque tous sur téléphone**. Ce sont les premiers templates à recevoir un afflux massif :
tout doit fonctionner du premier coup, sans bug ni friction. Tu audites, puis **tu corriges toi-même tout ce que tu trouves**.

## Périmètre

Templates (application `templates/<slug>/`, page `catalogue/<slug>/`, test `outils/templates/<slug>.test.mjs`) :

| Template | Slug | Prix |
|---|---|---|
| Planning de révision | `revision` | 14,90 € |
| Notes et moyennes | `notes` | 12 € |
| Planner horaire | `planner` | 15 € |
| Suivi d'habitudes et routines | `habitudes` | 12 € |
| Suivi de lecture | `lecture` | 12 € |
| Candidatures études, stages, alternance | `candidatures` | 12 € |
| Planning de mémoire ou de thèse | `memoire` | 15 € |
| Mon Budget | `budget` | 15 € |
| Suivi des abonnements | `abonnements` | 9 € |
| Gestion Dépenses Communes | `budget-commun` | 15 € |
| Objectif d'épargne et fonds d'urgence | `epargne` | 12 € |
| Repas de la semaine et liste de courses | `repas` | 13 € |

Pages : `packs/etudiant/`, `packs/argent-du-quotidien/`, `demo/odelia/`, `essai/`, `connexion/`, la page d'accueil et
`templates/` (catalogue), plus la redirection `/odelia` de `netlify.toml`.

## Ce qu'il faut vérifier

1. **Fonctionnement** de chaque template, écran par écran et bouton par bouton : création, modification, suppression,
   calculs (vérifie les résultats à la main sur des cas types et des cas limites : valeurs vides, zéro, dates passées,
   années bissextiles, gros volumes de données, caractères spéciaux), import / export, impression, mode hors ligne,
   synchronisation entre deux appareils (même clé), installation sur l'écran d'accueil (manifeste, service worker,
   icônes), console du navigateur sans erreur.
2. **Démo** de chaque template (sans inscription) et la démo `/demo/odelia/` (profil `droit-l1`) : elle se charge,
   les données de départ sont cohérentes, `&reinit` repart bien de zéro.
3. **Essai gratuit et sa séquence complète** : démarrage de l'essai depuis la page catalogue, bandeau, 14 jours,
   passage en lecture seule, effacement après 30 jours, reprise des données à l'achat (clé saisie dans « J'ai
   acheté »), cas du pack, et **chaque e-mail de la séquence** (merci, prise en main J+2, rappels, fin d'essai, achat)
   : contenu, liens, prix, nom du template, arrêt de la séquence dès le paiement. Outils :
   `QME_LICENCES_TEST=1 PORT=8899 node outils/templates/serveur-local.mjs` (e-mails affichés dans la console, temps
   simulé par `/__dev/decalage?jours=N`), puis `node outils/essai/e2e.cjs <slug>` pour chacun des 12 slugs.
4. **Parcours d'achat** : bouton d'achat de chaque page (template seul et packs), lien Gumroad correct, prix affiché
   identique au prix Gumroad, clé de licence acceptée à la connexion, accès du pack à ses 7 outils.
5. **UI / UX, en priorité sur téléphone** (Playwright, appareils « iPhone 13 » et « Pixel 7 », plus 1440 px de large) :
   aucun débordement horizontal, cibles tactiles d'au moins 44 px, clavier qui ne masque pas les champs, textes
   lisibles, contrastes AA, thème sombre, états vides, chargement et erreurs explicites, libellés clairs pour un
   lycéen, accessibilité au clavier et au lecteur d'écran. Fais une capture de chaque écran avant et après correction.
6. **Pages de vente** (`packs/etudiant/`, catalogue des 12 templates) : arrivée depuis `/odelia` sur téléphone,
   compréhension en 5 secondes (prix à l'unité, pack, démo, essai), temps de chargement (Lighthouse mobile), liens
   morts, cohérence des prix et des textes entre site, packs et Gumroad (vérifier avec l'outil Gumroad
   `list_products`, en lecture seule).

## Règles

- Respecte la charte et l'architecture existantes (`templates/revision/` est la référence) ; ne change ni prix, ni
  nom, ni URL publiée.
- Toute correction est accompagnée d'un test dans `outils/templates/<slug>.test.mjs` quand c'est possible ;
  `npm test` doit passer en entier avant chaque push.
- Ne modifie rien sur Gumroad, n'envoie aucun e-mail réel, ne touche pas aux variables d'environnement Netlify.
- Travaille sur une branche, ouvre une PR vers `main`, **ne fusionne pas** : la fusion déclenche un déploiement
  facturé et attend le feu vert de Quentin.

## Livrable

Un rapport `docs/templates/audit-etudiants-<date>.md` : pour chaque template et chaque page, ce qui a été testé, les
défauts trouvés (gravité, capture), la correction faite (commit), et ce qui reste à décider par Quentin. Termine par
la liste des points non testables ici (vrai paiement Gumroad, vrai envoi SMTP) à vérifier par Quentin avant la
publication.
