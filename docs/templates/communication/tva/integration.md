# Intégration de T44 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## templates/index.html (liste « En préparation », `.liste-bientot`)

```html
        <li class="carte prochaine" data-slug="tva" data-pour="pro" data-theme="independants" style="--c:var(--jaune)"><a href="/catalogue/tva/"><b>Suivi de TVA</b><span class="phrase">Collectée, déductible, crédit reporté, échéances et contrôles.</span><span class="theme">Indépendants</span><em>Bientôt</em></a></li>
```

(aussi dans `carte-prochaine-fr.html`). Thème : pas de puce « Comptabilité » ; rattaché à la puce existante
« Indépendants » (`data-theme="independants"`, `--c:var(--jaune)`), voisine (devis, trésorerie, micro-entreprise).
Penser au compteur de la puce « Indépendants » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Professional, mention « in French »).

## connexion/index.html (objet `PRODUITS`)

```js
TVA:{nom:'Suivi de TVA',url:'/templates/tva/',cle:'qme-tva-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  tva: ['Suivi de TVA', 'Ta TVA, période par période.', 'Collectée · déductible · échéances · contrôles'],
```

(La couverture `assets/templates-tva-couverture.png` est déjà générée avec cette ligne, insérée après
`'emploi-du-temps'` dans une copie du script.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1900, permalien proposé `suivi-tva`, catégorie
`business-and-money` à vérifier).

## README.md (section « Templates payants »)

> `templates/tva/` (TVA) **suivi de TVA** (petites sociétés au réel : ventes, achats, frais et immobilisations
> saisis en HT ou TTC, TVA calculée au centime et écarts signalés ; régime réel normal mensuel ou trimestriel, ou
> réel simplifié avec acomptes et CA12 ; par période : TVA collectée et déductible par taux, crédit antérieur,
> nette à payer ou crédit reporté, remboursement demandé ; échéancier paramétrable avec report des week-ends et
> jours fériés, pointage déclarée et payée ; contrôles : TVA ≠ HT × taux, HT + TVA ≠ TTC, taux inhabituel,
> opération hors période ou saisie après la déclaration, échéance non déclarée ou non payée, crédit non imputé,
> déductible > collectée et crédit reporté plusieurs périodes, seuil du trimestriel, fin annoncée du simplifié ;
> taux et échéances par défaut sourcés et datés, modifiables ; export CSV (opérations, périodes, échéancier) et
> import CSV ; outil d'aide, pas un conseil fiscal, aucune connexion externe). Règles dans `regles.js`, tests
> `outils/templates/tva.test.mjs`. « Mise en vente prochaine » : page `catalogue/tva/`, pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T44 (tableau principal) : statut `prêt`.

Table des slugs : `| T44 | \`tva\` | TVA | suivi-tva (prévu) |`

Texte du statut (bloc du lot) :

> T44 Suivi de TVA, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis intéressé(e) », pas de fiche
> Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application web (et non tableur seul, comme prévu
> par la décision « tableur seul → application web ») `templates/tva/` (TVA, 19 €) avec export et import CSV ;
> page `catalogue/tva/` ; fiche `fiches/tva.md` ; livrables dans `communication/tva/` (linkedin.md, instagram.md +
> carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json, cartes FR/EN, couverture.txt). Couverture
> `assets/templates-tva-couverture.png`. Mentions **daté** et **fiscal** appliquées : taux et échéances en
> Réglages avec source, statut et date de vérification (14/11/2026) ; avertissement « outil d'aide, pas un conseil
> fiscal » dans l'application, la page catalogue et la fiche Gumroad.
> **À faire valider par Quentin** : prix 19 €, nom, permalien `suivi-tva`, catégorie Gumroad ; rattachement au
> thème « Indépendants » ; valeurs « à vérifier » (jour d'échéance CA3 par défaut 15, acomptes 55 / 40 % au 15,
> dispense 1 000 €, CA12 au 2e jour ouvré après le 1er mai, fin du régime simplifié au 01/01/2027 et ce qui le
> remplace) ; base des acomptes (collectée − déductible biens et services de l'exercice précédent) ; seuil
> trimestriel testé sur la TVA nette des 4 derniers trimestres ; seuils des contrôles ; garder ou non un modèle
> tableur ; hashtags LinkedIn hors jeux habituels.
> Non vérifiés : pages officielles des acomptes, de la CA12 et de la réforme 2027 (sources secondaires
> seulement) ; jour d'échéance réel (dépend de l'entreprise) ; recodification du CGI (numéros d'articles) ;
> calendrier de la facturation électronique ; Safari réel ; organismes de `prospects.md` (« à vérifier »).
> Publications LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Suivi de TVA QME : “Ta TVA, période par période.” Synthèse d'une menuiserie fictive : TVA du mois, prochaine
échéance, crédit reporté, contrôles, graphique de la TVA collectée et déductible, sur ordinateur et sur
téléphone. Données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans c43e312 (en-têtes `noindex` et `sw.js` pour `/templates/tva/*`, `TVA` dans `PRODUITS`) : rien à
ajouter.
