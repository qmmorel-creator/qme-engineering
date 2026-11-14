# Intégration de T18 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## Décision sur la source des données de culture (à lire d'abord)

**Aucune période de semis, de plantation ou de récolte et aucune association n'est intégrée.** Recherche du
14/11/2026 :

- data.gouv.fr : aucun jeu de données « calendrier de semis » trouvé (recherche web ; API du portail non interrogée).
- Seule source publique française trouvée : DRAAF Auvergne-Rhône-Alpes, « Calendrier des semis, plantations et
  récoltes » (PDF, `https://draaf.auvergne-rhone-alpes.agriculture.gouv.fr/IMG/pdf/FICHE_TECH_CALENDRIER_SEMIS_PLANTATIONS_RECOLTES-2_cle091634.pdf`,
  consulté le 14/11/2026). **Écartée** : le pied de page du site indique « Sauf mention contraire, tous les contenus de
  ce site sont sous licence etalab-2.0 », mais les mentions légales du même site (mises à jour le 13/01/2026) disent
  « Toute reprise est dès lors conditionnée à l'accord de l'auteur », sauf documents officiels ; le PDF a pour titre
  de métadonnées « MARAICHAGE SOLIDAIRE » (auteur probablement tiers, aucune mention d'auteur ni de licence dedans) ;
  il ne couvre qu'une trentaine de légumes, en cases colorées, pour une seule région.
- Jeux internationaux (FAO, JRC, DIAS en CC BY 4.0) : grandes cultures, pas de légumes du potager.
- Calendriers de sites commerciaux, semenciers, jardineries : pas de licence de réutilisation, et marques exclues.

Base intégrée réduite à la connaissance botanique générale : 60 légumes avec nom courant, nom latin et famille
(classification APG IV), 16 familles. Fenêtres et associations saisies par l'utilisateur (modèles vides). Expliqué
dans l'application (premier lancement, Cultures, Réglages > À propos), la page catalogue (FAQ) et la fiche Gumroad.

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html` :

```html
        <li class="carte prochaine" data-slug="potager" data-pour="perso" data-theme="organisation-et-etudes" style="--c:var(--encre)"><a href="/catalogue/potager/"><b>Calendrier du potager</b><span class="phrase">Vos semis à leur date, la rotation de vos planches suivie.</span><span class="theme">Organisation et études</span><em>Bientôt</em></a></li>
```

Thème existant `organisation-et-etudes` (comme repas, entretien, voiture, garde-manger ; pas de puce Jardin ni Maison).
Penser au compteur de la puce « Organisation et études » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Personal life, mention « in French », une seule
`<img` et une seule `</article>`).

## connexion/index.html (objet `PRODUITS`)

```js
PTG:{nom:'Calendrier du potager',url:'/templates/potager/',cle:'qme-ptg-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  potager: ['Calendrier du potager', 'Chaque semis à sa date.', 'Tes dates · cette semaine · rotation · récoltes'],
```

(La couverture `assets/templates-potager-couverture.png` est déjà générée avec cette ligne placée en fin de table, sur
une copie du script dans le scratchpad, serveur statique sur le port 8923.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1300, permalien proposé `calendrier-potager`, catégorie
`self-improvement/productivity` à vérifier, bouton « Ouvrir mon potager »).

## README.md (section « Templates payants », lot 9)

> `templates/potager/` (PTG) **calendrier du potager** (cultures avec les fenêtres saisies par le jardinier : semis sous
> abri, semis en pleine terre, plantation, récolte, par quinzaine, passage d'année permis ; décalage en semaines réglé
> par l'utilisateur ; « cette semaine » : fenêtres qui s'ouvrent, en cours, qui finissent, faites d'après le journal,
> passées depuis 3 semaines sans rien noter, le mois prochain ; frise des 12 mois imprimable ; parcelles (planche,
> carré, serre, bac) et placements par année, alerte de rotation (même famille au même endroit dans les 1 à 5 années
> précédentes, réglable) et alerte « à éloigner » d'après les voisins notés par l'utilisateur ; journal (semis, levée,
> repiquage, plantation, récolte avec quantité, note) et bilan des récoltes en kg par culture et par mois ; exports CSV ;
> base : 60 légumes avec nom latin et famille botanique, **aucune période ni association fournie** faute de source
> réutilisable vérifiée ; aucune météo). Règles dans `regles.js`, tests `outils/templates/potager.test.mjs`.
> « Mise en vente prochaine » : page `catalogue/potager/`, pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T18 (tableau principal, ligne 98) : statut `en cours` → `prêt`.

Remarque T18 (tableau des bases, ligne 850) : « Source des données de culture à vérifier. » →
« Aucune période ni association intégrée : seule source publique trouvée (DRAAF Auvergne-Rhône-Alpes, PDF
« Calendrier des semis, plantations et récoltes », consulté le 14/11/2026) écartée, licence contradictoire (pied de page
etalab-2.0, mentions légales « reprise conditionnée à l'accord de l'auteur ») et auteur probablement tiers ; rien sur
data.gouv.fr. Base : 60 légumes avec nom latin et famille botanique (APG IV, connaissance générale) ; fenêtres et voisins
saisis par l'utilisateur. » Et la colonne « Base intégrée envisagée » : « 60 légumes : semis, récolte, associations »
→ « 60 légumes : nom latin et famille botanique (sans périodes) ».

Table des slugs : `| T18 | \`potager\` | PTG | calendrier-potager (prévu) |`

Texte du statut (bloc du lot 9) :

> T18 Calendrier du potager, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis intéressé(e) », pas de fiche
> Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application `templates/potager/` (PTG, 13 €, démo
> `/templates/potager/?demo`) ; page `catalogue/potager/` ; fiche `fiches/potager.md` ; livrables dans
> `communication/potager/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json,
> cartes FR/EN, couverture.txt, integration.md). Couverture `assets/templates-potager-couverture.png`. Thème
> « Organisation et études ».
> **À faire valider par Quentin** : prix 13 €, nom, permalien `calendrier-potager`, catégorie Gumroad
> (`self-improvement/productivity` à vérifier) ; **choix de ne fournir aucune période ni association** (promesse « vos
> dates », base réduite aux noms, noms latins et familles) ; rotation par défaut à 1 an (réglable de 1 à 5) ; dates de
> la démo fictives et calées sur le jour d'ouverture (marquées « pas des conseils de culture ») ; associations de la
> démo (tomate et basilic « bons voisins », oignon et fève « à éloigner ») présentées comme notes du jardinier fictif ;
> familles botaniques de la base (relecture, en particulier mâche en Caprifoliacées et blette, betterave, épinard en
> Amaranthacées selon APG IV) ; thème du catalogue ; hashtags hors jeux du kit (`#Potager`, `#Jardinage`) ; prospects
> (organismes « à vérifier »).
> Non vérifiés : API de data.gouv.fr (recherche web seulement) ; existence d'une autre source publique sous licence
> ouverte non trouvée par la recherche ; noms latins et familles (connaissance générale, non recoupés avec une base
> botanique) ; impression papier réelle de la frise (aperçu non testé) ; Safari et Firefox réels (émulation Chromium) ;
> ouverture des CSV dans un tableur ; organismes de `prospects.md`. Publications LinkedIn et Instagram non planifiées
> (aucun accès aux plannings dans ce lot). Palette des graphiques non passée au validateur du skill `dataviz` (barres
> à une seule série, valeurs écrites, tableau accessible).

## Texte alternatif de la couverture

« Calendrier du potager QME : “Chaque semis à sa date.” Semis, plantations et récoltes de la semaine sur ordinateur, et
frise de l'année culture par culture sur téléphone. Données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans 7a3bbd4 (en-têtes `noindex` et `sw.js` pour `/templates/potager/*`, `PTG` dans `PRODUITS`) : rien à
ajouter.
