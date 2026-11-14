# Intégration de T17 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## templates/index.html (liste « En préparation », `.liste-bientot`)

```html
        <li class="carte prochaine" data-slug="lecture" data-pour="perso" data-theme="organisation-et-etudes" style="--c:var(--encre)"><a href="/catalogue/lecture/"><b>Suivi de lecture</b><span class="phrase">Rythme, date de fin du livre, objectif de l'année au jour près.</span><span class="theme">Organisation et études</span><em>Bientôt</em></a></li>
```

(Aussi dans `carte-prochaine.html`.) Penser au compteur de la puce « Organisation et études » (+1) et au
sous-titre « N templates ». Pas de puce « Loisirs » existante : rattaché à « Organisation et études » (puce
existante, `--c:var(--encre)`). Si un autre template « Loisirs » arrive dans le lot, créer la puce
`data-pour="perso" data-theme="loisirs"` et y passer les deux cartes (à décider par Quentin).

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Personal life, `data-groupe="perso"`, mention
« in French »).

## connexion/index.html (objet `PRODUITS`)

```js
PGS:{nom:'Suivi de lecture',url:'/templates/lecture/',cle:'qme-pgs-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  'lecture': ["Suivi de lecture", "Lis, on compte.", "Rythme · date de fin · objectif au jour près"],
```

(La couverture `assets/templates-lecture-couverture.png` est déjà générée avec cette ligne, depuis une copie du
script sur le port 8902.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1200, permalien proposé `suivi-lecture`, catégorie
`self-improvement` à vérifier).

## README.md (section « Templates payants », bloc du lot 7)

> `templates/lecture/` (PGS) **suivi de lecture** (bibliothèque papier, numérique et audio avec genres modifiables,
> statuts à lire / en cours / lu / abandonné ; sessions en page atteinte, pages lues ou minutes écoutées, qui font
> suivre le statut ; progression, rythme sur 14 jours et date de fin estimée ; objectif annuel en livres et en
> pages avec l'avance ou le retard au jour près, projection et rythme nécessaire ; statistiques par mois, genre,
> format et auteur, pages par jour, séries de jours de lecture ; note, avis et citations ; liste à lire par
> priorité ; export CSV ; aucune base de livres ni couverture, aucune liseuse ni librairie). Règles dans
> `regles.js`, tests `outils/templates/lecture.test.mjs`. « Mise en vente prochaine » : page `catalogue/lecture/`,
> pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T17 (tableau principal) : statut `prêt`.

Table des slugs : `| T17 | \`lecture\` | PGS | suivi-lecture (prévu) |`

Texte du statut (bloc du lot) :

> T17 Suivi de lecture, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis intéressé(e) », pas de
> fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application `templates/lecture/` (PGS, 12 €) ;
> page `catalogue/lecture/` ; fiche `fiches/lecture.md` ; livrables dans `communication/lecture/` (linkedin.md,
> instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json, cartes FR/EN, couverture.txt).
> Couverture `assets/templates-lecture-couverture.png`.
> **À faire valider par Quentin** : prix 12 €, nom, permalien `suivi-lecture`, catégorie Gumroad
> (`self-improvement` ou `writing-and-publishing`) ; thème du catalogue (« Organisation et études » faute de
> « Loisirs ») ; choix de calcul (rythme sur 14 jours, objectif réparti uniformément, audio hors objectif en pages,
> livre lu sans sessions compté à sa date de fin, série qui court jusqu'à hier) ; périmètre V1 (pas de relecture, de
> séries de livres, de prêt, d'import) ; titres et auteurs inventés de la démo (homonymies non vérifiées) ;
> hashtags hors jeux habituels (`#Lecture`, `#Livres`, `#ObjectifLecture`, `#Bookstagram`).
> Non vérifiés : catégorie Gumroad, Safari réel, organismes de `prospects.md` (« à vérifier »). Publications
> LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Suivi de lecture QME : “Lis, on compte.” Livres en cours avec leur progression, leur rythme et leur date de fin
estimée, objectif de l'année et série de jours de lecture, sur ordinateur et sur téléphone. Livres inventés,
données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans c43e312 (en-têtes `noindex` et `sw.js`, `PGS` dans `PRODUITS`) : rien à ajouter.
