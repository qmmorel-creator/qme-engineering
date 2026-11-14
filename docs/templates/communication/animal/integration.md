# Intégration de T20 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## templates/index.html (liste « En préparation », `.liste-bientot`)

```html
        <li class="carte prochaine" data-slug="animal" data-pour="perso" data-theme="organisation-et-etudes" style="--c:var(--encre)"><a href="/catalogue/animal/"><b>Suivi d'un animal de compagnie</b><span class="phrase">Soins aux dates du vétérinaire, poids, visites, frais par an.</span><span class="theme">Organisation et études</span><em>Bientôt</em></a></li>
```

(Même ligne dans `kanban.txt`.) Penser au compteur de la puce « Organisation et études » (+1) et au
sous-titre « N templates ». Aucun thème « Animaux » existant : rattaché à « Organisation et études », comme le
carnet de voiture ; créer un thème « Animaux » seulement s'il réunit un jour au moins deux templates.

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Personal life, mention « in French »).

## connexion/index.html (objet `PRODUITS`)

```js
ANM:{nom:'Suivi d’un animal de compagnie',url:'/templates/animal/',cle:'qme-anm-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  'animal': ["Suivi d'un animal de compagnie", "Ses soins, à temps.", "Soins · poids · visites · frais"],
```

(La couverture `assets/templates-animal-couverture.png` est déjà générée avec cette ligne, copie du script avec le
port 8903, script non commité.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1200, permalien proposé `suivi-animal-compagnie`,
catégorie `self-improvement/productivity` à vérifier).

## README.md (section « Templates payants », bloc du lot 7)

> `templates/animal/` (ANM) **suivi d'un animal de compagnie** (un ou plusieurs animaux, chien, chat ou autre,
> identification en saisie libre ; soins récurrents avec dernière date et intervalle saisi d'après le vétérinaire,
> date fixée par le vétérinaire prioritaire, prochaine échéance, retards et à venir ; courbe de poids SVG sans
> interprétation ; visites et traitements recopiés de l'ordonnance ; frais par catégorie, par mois et par an,
> dépenses communes, coût annuel ; carnet imprimable ; aucun calendrier vaccinal ou antiparasitaire intégré,
> aucune posologie, aucune marque ; avertissement « ne remplace pas l'avis du vétérinaire »). Règles dans
> `regles.js`, tests `outils/templates/animal.test.mjs`. « Mise en vente prochaine » : page `catalogue/animal/`,
> pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T20 (tableau principal) : statut `prêt`.

Table des slugs : `| T20 | \`animal\` | ANM | suivi-animal-compagnie (prévu) |`

Ligne T20 du tableau des bases et remarques (vers la ligne 811) : compléter la remarque par « Fait : aucun
calendrier intégré (modèles de soins = noms seuls, intervalles saisis d'après le vétérinaire), avertissement
médical dans l'application, la page catalogue et la fiche Gumroad ; aucune source vétérinaire intégrée, donc
rien de daté. »

Texte du statut (bloc du lot) :

> T20 Suivi d'un animal de compagnie, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
> intéressé(e) », pas de fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application
> `templates/animal/` (ANM, 12 €) ; page `catalogue/animal/` ; fiche `fiches/animal.md` ; livrables dans
> `communication/animal/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et
> gumroad.json, cartes FR/EN, kanban.txt, couverture.txt). Couverture `assets/templates-animal-couverture.png`.
> **À faire valider par Quentin** : prix 12 €, nom, permalien `suivi-animal-compagnie`, catégorie Gumroad
> (`self-improvement/productivity` proposée) ; thème « Organisation et études » faute de thème « Animaux » ;
> parti pris « aucun calendrier intégré » (modèles de soins sans durée, base intégrée donc mince) ; traitement en
> texte libre ; un seul accès par foyer ; hashtags `#AnimauxDeCompagnie` et `#Chien` hors jeux habituels.
> Non vérifiés : impression papier réelle, Safari réel, organismes et règles de partenariat de `prospects.md`
> (« à vérifier »). Publications LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette
> session).

## Texte alternatif de la couverture

« Suivi d'un animal de compagnie QME : “Ses soins, à temps.” Tableau de bord avec les soins en retard et à venir
de trois animaux fictifs (chien, chat, lapin), coût annuel et coût mensuel, sur ordinateur et sur téléphone.
Données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans c43e312 (en-têtes `noindex` et `sw.js` pour `/templates/animal/*`, `ANM` dans `PRODUITS`) :
rien à ajouter.
