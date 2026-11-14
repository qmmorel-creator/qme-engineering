# Intégration · Pilotage de parcs multi-sites (T60, PRK)

Pour l'orchestrateur du lot : éléments à reporter dans les fichiers partagés, que ce worktree ne modifie pas.
`PRODUITS` (`netlify/lib/templates-acces.mjs`) et les en-têtes `netlify.toml` pour `/templates/parcs-multi-sites/*`
sont déjà en place (commit b5e660e).

## 1. `templates/index.html` · liste « En préparation » (`.liste-bientot`)

À placer avec les deux autres cartes du thème (après `parc-informatique`), puis passer le compteur de la puce
« Équipements et véhicules » de `<small>2</small>` à `<small>3</small>` (et le compteur général s'il y en a un).

```html
      <li class="carte prochaine" data-slug="parcs-multi-sites" data-pour="pro" data-theme="equipements-et-vehicules" style="--c:var(--bleu)"><a href="/catalogue/parcs-multi-sites/"><b>Pilotage de parcs multi-sites</b><span class="phrase">Sites, équipements, préventif, pannes et coût par site.</span><span class="theme">Équipements et véhicules</span><em>Bientôt</em></a></li>
```

(La même ligne est dans `kanban.txt`.)

## 2. `en/templates/index.html` · groupe Professional, état « Coming soon »

Bloc complet dans `carte-en-prochaine.html` (mention « in French », démo en bouton principal, sans prix).

## 3. `connexion/index.html` · `PRODUITS`

À ajouter en fin d'objet, après `CSE:{…}` (et après `EDT:{…}` si le lot l'ajoute) :

```js
PRK:{nom:'Pilotage de parcs multi-sites',url:'/templates/parcs-multi-sites/',cle:'qme-prk-code'}
```

## 4. `README.md` · section « Templates payants », lot du 14/11/2026

> `templates/parcs-multi-sites/` (PRK) **pilotage de parcs multi-sites** (sites avec région, responsable et
> coordonnées GPS facultatives, équipements par site avec catégorie, criticité et périodicité du préventif ;
> préventif calculé depuis le dernier passage, pannes du signalement à la résolution avec arrêt ou non ;
> disponibilité, délai moyen de résolution, taux de préventif à temps, coût par site et par catégorie ; alertes
> retard, arrêt depuis N jours, site sans visite depuis N mois ; liste triable et filtrable, carte schématique
> en SVG sans fond de carte ni géocodage ; import et export CSV point-virgule UTF-8 avec BOM, modèles vides ;
> aucune périodicité réglementaire en base). Règles dans `regles.js`, tests
> `outils/templates/parcs-multi-sites.test.mjs`.

## 5. `docs/templates/IDEES.md`

- Tableau principal (l. 140) : statut `en cours` → **`prêt`** (49 €, L, P2 inchangés).
- Ligne T60 des remarques (l. 821) : base « Types de sites, catégories d'équipements, criticités, régions
  proposées ; aucune périodicité réglementaire, aucune marque » ; ajouter : « Fiche `fiches/parcs-multi-sites.md`.
  Prêt le 14/11/2026, mise en vente prochaine. Application `templates/parcs-multi-sites/` (PRK), page
  `catalogue/parcs-multi-sites/`, communication `communication/parcs-multi-sites/` (section-site, cartes
  accueil FR/EN et EN « Coming soon », fiche Gumroad `gumroad.json` / `gumroad.md`, LinkedIn, Instagram
  avec carrousel 5 vues, prospects). Format « modèle tableur » : import et export CSV avec modèles vides. »
- Tableau des produits Gumroad prévus : `| T60 | \`parcs-multi-sites\` | PRK | pilotage-parcs-multi-sites (prévu) |`
- Points à faire valider par Quentin :
  1. nom et **prix de 49 €** ;
  2. périmètre volontairement léger (pas de périodicité réglementaire, pas de pièces jointes ni de bons
     d'intervention, un accès sans droits par personne) ;
  3. démo : villes réelles (Rennes, Lille, Lyon, Toulouse, Marseille, Nantes, Strasbourg, Dijon) comme
     simples repères géographiques avec des sites inventés et des coordonnées approximatives de centre-ville,
     ou passage à des villes fictives ;
  4. thème « Équipements et véhicules » ;
  5. permalien `pilotage-parcs-multi-sites`, catégorie Gumroad `business-and-money/management-and-leadership`
     (à vérifier) ;
  6. hashtags Instagram `#Maintenance` et `#ServicesGénéraux` hors jeux du kit.
- Publications : LinkedIn et Instagram **non planifiées** (aucun accès aux Google Sheets dans ce worktree) ;
  couverture à déposer sous `LI-nn-parcs-multi-sites.png`, carrousel
  `communication/parcs-multi-sites/instagram/parcs-multi-sites-1…5.png` sous `IG-nn-parcs-multi-sites-1…5.png`.

## 6. `docs/templates/communication/gumroad-a-creer.json`

Ajouter l'objet de `gumroad.json` (mêmes clés que les autres entrées, `price_cents` 4900).

## 7. `outils/templates/couvertures-gumroad.cjs` · objet `T`

```js
  'parcs-multi-sites': ["Pilotage de parcs multi-sites", "Tous tes sites, une seule vue.", "Préventif · pannes · disponibilité · coût par site"],
```

La couverture `assets/templates-parcs-multi-sites-couverture.png` est déjà générée (copie du script hors dépôt,
port 8902, `SEUL=parcs-multi-sites`) ; sa position dans `T` change seulement l'ambiance de couleur si elle est
régénérée plus tard (rendu actuel : 47e entrée, juste avant `repas`, index 46, ambiance rose).

## 8. Texte alternatif de la couverture

« Pilotage de parcs multi-sites QME : tous tes sites, une seule vue. Préventif, pannes, disponibilité et coût
par site. Tableau de bord d'un parc de dix sites (alertes en retard, équipements à l'arrêt, préventifs en
retard, disponibilité de 99,3 %) sur ordinateur et téléphone, données fictives. »

## 9. Bandeau de démo et vitrine

Le bandeau `.bientot-demo` « Bientôt en vente · Être prévenu de la sortie » renvoie déjà vers
`/catalogue/parcs-multi-sites/`. À la mise en vente : appliquer `reference.md` § « À chaque publication
Gumroad » (section en vente prête dans `section-site.html`, cartes d'accueil `carte-accueil-fr.html` et
`carte-accueil-en.html`).
