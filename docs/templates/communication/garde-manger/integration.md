# Intégration de T09 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html` :

```html
        <li class="carte prochaine" data-slug="garde-manger" data-pour="perso" data-theme="organisation-et-etudes" style="--c:var(--encre)"><a href="/catalogue/garde-manger/"><b>Garde-manger et dates de péremption</b><span class="phrase">DLC et DDM, à consommer en priorité, gaspillage suivi.</span><span class="theme">Organisation et études</span><em>Bientôt</em></a></li>
```

Thème existant `organisation-et-etudes` (comme repas, entretien et voiture). Penser au compteur de la puce
« Organisation et études » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Personal life, mention « in French »).

## connexion/index.html (objet `PRODUITS`)

```js
GRD:{nom:'Garde-manger et dates de péremption',url:'/templates/garde-manger/',cle:'qme-grd-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  'garde-manger': ['Garde-manger et dates de péremption', 'Rien ne se perd au fond du frigo.', 'DLC et DDM · priorités du jour · gaspillage suivi'],
```

(La couverture `assets/templates-garde-manger-couverture.png` est déjà générée avec cette ligne, sur une copie du
script dans le scratchpad, serveur statique sur le port 8901.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1200, permalien proposé
`garde-manger-dates-peremption`, catégorie `food-and-cooking` à vérifier).

## README.md (section « Templates payants », lot 7)

> `templates/garde-manger/` (GRD) **garde-manger et dates de péremption** (inventaire par lieu : réfrigérateur,
> congélateur, placard et lieux personnalisables ; quantité, catégorie, date imprimée ; DLC et DDM distinguées : DLC
> dépassée « ne pas consommer », DDM dépassée « à vérifier » ; date d'ouverture et délai de l'emballage ; décongelé à
> finir sous 3 jours ; au congélateur, date fixée par l'utilisateur ; vue « à consommer en priorité » (dépassé,
> aujourd'hui, 3 jours, semaine) ; consommé ou jeté avec motif et valeur, bilan du gaspillage sur six mois ; liste de
> courses issue des produits épuisés ; définitions et deux seules durées reprises de l'Anses, source et date
> affichées ; aucun scan ni base produit). Règles dans `regles.js`, tests `outils/templates/garde-manger.test.mjs`.
> « Mise en vente prochaine » : page `catalogue/garde-manger/`, pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T09 (tableau principal) : statut `prêt`.

Remarque T09 (tableau des bases, vers la ligne 800) : « Durées : source à vérifier. » →
« Durées : seules deux reprises de l'Anses (plat non préemballé sans date 3 j, décongelé 3 j ; page du 04/01/2021
consultée le 14/11/2026), affichées avec la source ; aucune durée après ouverture ni au congélateur fournie (pas de
tableau officiel trouvé), saisies par l'utilisateur. »

Table des slugs : `| T09 | \`garde-manger\` | GRD | garde-manger-dates-peremption (prévu) |`

Texte du statut (bloc du lot) :

> T09 Garde-manger et dates de péremption, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
> intéressé(e) », pas de fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application
> `templates/garde-manger/` (GRD, 12 €) ; page `catalogue/garde-manger/` ; fiche `fiches/garde-manger.md` ; livrables
> dans `communication/garde-manger/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et
> gumroad.json, cartes FR/EN, couverture.txt). Couverture `assets/templates-garde-manger-couverture.png`.
> **À faire valider par Quentin** : prix 12 €, nom, permalien `garde-manger-dates-peremption`, catégorie Gumroad
> (`food-and-cooking` à vérifier) ; choix de ne fournir que deux durées sourcées (Anses) et aucune durée après
> ouverture ni au congélateur ; DLC ignorée au congélateur (produit congelé avant sa DLC, d'après l'Anses) ; « Restes :
> 2 jours » dans la démo présenté comme la valeur du foyer fictif ; comptage du gaspillage en nombre de sorties
> (pas en quantité ni en poids) ; hashtags hors jeux du kit (`#AntiGaspillage`, `#Famille`) ; prospects (associations
> familiales nommées à vérifier).
> Non vérifiés : pages economie.gouv.fr (DGCCRF) inaccessibles depuis cette session (403), donc seule l'Anses est
> citée ; Safari réel ; organismes de `prospects.md` (« à vérifier »). Publications LinkedIn et Instagram non
> planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Garde-manger et dates de péremption QME : “Rien ne se perd au fond du frigo.” Liste des produits à consommer en
priorité, DLC dépassées signalées en rouge, produits à finir aujourd'hui et sous 3 jours, sur ordinateur et sur
téléphone. Données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans c43e312 (en-têtes `noindex` et `sw.js` pour `/templates/garde-manger/*`, `GRD` dans `PRODUITS`) :
rien à ajouter.
