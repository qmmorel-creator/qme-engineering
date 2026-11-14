# Intégration de T56 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## templates/index.html (liste « En préparation », `.liste-bientot`)

```html
        <li class="carte prochaine" data-slug="emploi-du-temps" data-pour="pro" data-theme="associations-formation-et-evenements" style="--c:var(--rouge)"><a href="/catalogue/emploi-du-temps/"><b>Emploi du temps d'établissement</b><span class="phrase">Groupes, formateurs, salles, conflits détectés, heures suivies.</span><span class="theme">Associations, formation et événements</span><em>Bientôt</em></a></li>
```

Penser au compteur de la puce « Associations, formation et événements » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Professional, mention « in French »).

## connexion/index.html (objet `PRODUITS`)

```js
EDT:{nom:'Emploi du temps d’établissement',url:'/templates/emploi-du-temps/',cle:'qme-edt-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  'emploi-du-temps': ["Emploi du temps d'établissement", "Ton planning, sans conflit.", "Groupes · formateurs · salles · heures suivies"],
```

(La couverture `assets/templates-emploi-du-temps-couverture.png` est déjà générée avec cette ligne.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 4500, permalien proposé
`emploi-du-temps-etablissement`, catégorie `education` à vérifier).

## README.md (section « Templates payants », après T33 et T55)

> `templates/emploi-du-temps/` (EDT) **emploi du temps d'établissement** (organismes de formation, écoles privées :
> groupes avec effectif, formateurs avec disponibilités, absences et quota, salles avec capacité et équipements,
> modules avec volume prévu ; séances placées à la main sur une grille semaine aux créneaux paramétrables, vues par
> groupe, formateur et salle, téléphone jour par jour ; conflits détectés à la saisie : formateur, salle ou groupe
> en double, capacité, équipement, indisponibilité, jour fermé, volume ou quota dépassé ; heures réalisées, placées
> et prévues ; semaines A/B, fermetures, jours fériés calculés ; duplication de semaine ; impression A4 paysage ;
> export CSV ; aucun nom d'apprenant, aucune optimisation automatique). Règles dans `regles.js`, tests
> `outils/templates/emploi-du-temps.test.mjs`. « Mise en vente prochaine » : page `catalogue/emploi-du-temps/`,
> pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T56 (tableau principal) : statut `prêt`.

Table des slugs : `| T56 | \`emploi-du-temps\` | EDT | emploi-du-temps-etablissement (prévu) |`

Texte du statut (bloc du lot) :

> T56 Emploi du temps d'établissement, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
> intéressé(e) », pas de fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application
> `templates/emploi-du-temps/` (EDT, 45 €) ; page `catalogue/emploi-du-temps/` ; fiche `fiches/emploi-du-temps.md` ;
> livrables dans `communication/emploi-du-temps/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md,
> gumroad.md et gumroad.json, cartes FR/EN, couverture.txt). Couverture `assets/templates-emploi-du-temps-couverture.png`.
> **À faire valider par Quentin** : prix 45 €, nom, permalien `emploi-du-temps-etablissement`, catégorie Gumroad
> (`education` ou `business-and-money`) ; périmètre V1 (placement manuel seulement, pas de demi-groupes
> hiérarchiques, une séance = un groupe, accès unique sans comptes formateurs) ; alternance A/B qui saute les
> semaines fermées ; « réalisé » = séance terminée ; limite de taille (≈ 200 séances par semaine sur l'année,
> purge des semaines passées) ; hashtags LinkedIn hors jeux habituels ; nom de l'organisme fictif de la démo.
> Non vérifiés : article L3133-1 non relu sur Légifrance (liste reprise du template congés), impression papier
> réelle, Safari réel, organismes et réseaux de `prospects.md` (« à vérifier »). Publications LinkedIn et
> Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Emploi du temps d'établissement QME : “Ton planning, sans conflit.” Grille de la semaine d'un groupe de
formation, séances colorées par module avec formateur et salle, conflits signalés en rouge et jaune, sur
ordinateur et sur téléphone. Données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans b5e660e (en-têtes `noindex` et `sw.js`, `EDT` dans `PRODUITS`) : rien à ajouter.
