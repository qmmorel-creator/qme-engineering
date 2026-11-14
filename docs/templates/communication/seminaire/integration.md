# Intégration de T54 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

**Préfixe : `SMN`** : l'application envoie `produit: 'SMN'` dans ses deux appels à `/connexion` et utilise les clés
`qme-smn-code`, `qme-smn-cache`, `qme-smn-demo`, `qme-smn-ecran-accueil` (et `qme-smn-ui`, préférence d'affichage).

## netlify/lib/templates-acces.mjs (PRODUITS côté serveur)

Ajouter en fin d'objet :

```js
  SMN: { nom: 'Séminaire / offsite', url: '/templates/seminaire/' },
```

(Ajoutée localement pour les tests de ce worktree, **non commitée**.) Le compteur d'intérêt (`/api/interets`, module
`seminaire`) en dépend : `MODULES` est dérivé de `PRODUITS`.

## outils/packs/donnees.mjs (TEMPLATES)

```js
  SMN: { slug: 'seminaire', prix: 3500, phrase: 'Participants, trajets, chambres, programme et coût par personne.', pour: 'pro' },
```

(Ajoutée localement, **non commitée** : `packs.test.mjs` exige une fiche courte pour chaque préfixe de `PRODUITS`.)

## netlify/lib/packs.mjs (rattachement, à décider)

Aucun pack « événements » n'existe (IDEES.md, § fusions : « vendue seule et dans le pack événements »). Proposition, **à
valider par Quentin** : `PMG` (Pack Moyens généraux, cible office managers) ou `PAS` (Associations et clubs, qui contient
déjà `EVT`). Si le pack choisi est déjà en vente, ajouter aussi l'entrée `ajouts` datée, puis
`node outils/packs/generer.mjs`. Non fait ici (fichier partagé, et `packs/` interdit dans ce lot).

## netlify.toml

À ajouter (même bloc que les autres templates, par exemple après `/templates/progression/sw.js`) :

```toml
[[headers]]
  for = "/templates/seminaire/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/templates/seminaire/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html` :

```html
        <li class="carte prochaine" data-slug="seminaire" data-pour="pro" data-theme="associations-formation-et-evenements" style="--c:var(--rouge)"><a href="/catalogue/seminaire/"><b>Séminaire / offsite</b><span class="phrase">Participants, trajets, chambres, programme et coût par personne.</span><span class="theme">Associations, formation et événements</span><em>Bientôt</em></a></li>
```

Thème existant `associations-formation-et-evenements` (comme le pilote événementiel). Penser au compteur de la puce
« Associations, formation et événements » (+1 ; 10 au 14/11/2026 dans ce worktree) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Professional, mention « in French », un seul `<img`
et un seul `</article>`).

## connexion/index.html (objet `PRODUITS`)

```js
SMN:{nom:'Séminaire / offsite',url:'/templates/seminaire/',cle:'qme-smn-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`, en fin de table)

```js
  seminaire: ['Séminaire / offsite', 'Tout le monde au bon endroit, au bon moment.', 'Réponses · qui voyage avec qui · chambres · coût par personne'],
```

(La couverture `assets/templates-seminaire-couverture.png` est déjà générée avec cette ligne placée en fin de table,
juste après `'etat-des-lieux'`, dans une copie du script au scratchpad servie par le serveur local du dépôt ; voir
`couverture.txt` pour l'ambiance qui dépend du rang.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 3500, permalien proposé `seminaire-offsite`, catégorie
`business-and-money` à vérifier, bouton « Ouvrir mon séminaire »).

## README.md (section « Templates payants »)

> `templates/seminaire/` (SMN) **séminaire / offsite** (déclinaison du pilote événementiel pour les assistants de
> direction, RH et office managers : plusieurs séminaires par clé ; participants et réponses (saisie rapide depuis un
> tableur, relance après la date limite, suivi par service) ; trajets aller et retour avec places et passagers (qui
> voyage avec qui), participants sans trajet ou venant par leurs propres moyens, horaires comparés au programme
> (arrivée après l'ouverture, départ avant la clôture) ; chambres ajoutées en série, occupants, personnes à loger et
> répartition automatique des confirmés par service, liste imprimable pour l'hébergement ; programme jour par jour en
> salles parallèles, chevauchement dans une même salle, décalage en cascade, deux programmes types, impression ;
> budget prévu / engagé / payé par poste, paiements à venir ou en retard, budget cible, coût par participant confirmé ;
> **RGPD** : régime en liste fermée et cases allergie et accessibilité sans détail, saisie facultative, fiche traiteur
> en nombres seulement (CSV sans nom), export CSV des participants sans données sensibles par défaut, effacement des
> données sensibles d'un séminaire et alerte tant qu'il en reste après la date). Règles dans `regles.js`, tests
> `outils/templates/seminaire.test.mjs`. « Mise en vente prochaine » : page `catalogue/seminaire/`, pas de fiche
> Gumroad.

## docs/templates/IDEES.md

Ligne T54 (tableau principal, vers la ligne 134) : statut `idée` → `prêt`.

Remarque T54 (tableau des bases, vers la ligne 1046) : « Participants, transports, chambres, régimes, programme, budget
| à définir (reprend T51) | Organisateur de mariage (artefact client) | Déclinaison de T51. **RGPD** : … » →
« Participants, transports, chambres, régimes, programme, budget | 2 programmes types (journée, deux jours avec nuitée),
12 postes de budget sans montant, 5 types de chambre, 7 types de session, régimes en liste fermée (5), rédigés pour QME ;
aucun horaire ni tarif | Organisateur de mariage (artefact client) ; moteur du pilote événementiel | Déclinaison de T51.
**RGPD** : régime en liste fermée, allergie et accessibilité par une case sans détail, saisie facultative, traiteur
informé en nombres seulement, effacement par séminaire ; démo fictive. »

Table des slugs : `| T54 | \`seminaire\` | SMN | seminaire-offsite (prévu) |`

Texte du statut (bloc du lot) :

> T54 Séminaire / offsite, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis intéressé(e) », pas de
> fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application `templates/seminaire/` (SMN, 35 €,
> démo `/templates/seminaire/?demo`) ; page `catalogue/seminaire/` ; fiche `fiches/seminaire.md` ; livrables dans
> `communication/seminaire/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et
> gumroad.json, cartes FR/EN, section-site.html, couverture.txt, integration.md). Couverture
> `assets/templates-seminaire-couverture.png`. **RGPD** (exigence de Quentin) : mention à côté de la saisie, en tête
> des participants et dans les réglages ; saisie facultative ; aucune donnée de santé détaillée (liste fermée de
> 5 régimes, case « allergie ou intolérance à signaler au traiteur » et case « besoin d'accessibilité » sans détail,
> pas de champ libre médical, note marquée « logistique uniquement ») ; comptage agrégé pour le traiteur ; effacement
> par séminaire ; export CSV et copie JSON. Démo entièrement fictive (« Maison Tilleul (exemple) »).
> **À faire valider par Quentin** : prix 35 €, nom « Séminaire / offsite », permalien `seminaire-offsite`, catégorie
> Gumroad (`business-and-money` à vérifier) ; thème « Associations, formation et événements » ; rattachement à un
> pack (PMG ou PAS proposés, aucun pack événements n'existe) ; « sans porc » gardé dans la liste fermée (peut révéler
> une conviction, comme dans T51) et « sans gluten » non proposé (passe par la case allergie) ; tous les participants
> présents sur toute la durée (pas de présence par jour) ; « en attente » compté dans les couverts, les trajets et les
> chambres à prévoir, mais jamais placé par la répartition automatique ; répartition par service, sans critère de
> genre (aucune donnée de genre collectée) ; pas d'accès participant ni de formulaire d'inscription ; ni rétroplanning
> ni badges (renvoi vers T51) ; hashtags hors jeux habituels (LinkedIn `#OfficeManager`, `#AssistantDeDirection`,
> `#RessourcesHumaines` ; Instagram `#OfficeManager`).
> Non vérifiés : définition CNIL « Donnée sensible » non relue pour T54 (reprise de T51, consultée le 13/11/2026) ;
> impression papier réelle (programme vérifié à l'écran en média « print », liste des chambres non rendue) ; Safari et Firefox réels
> (émulation Chromium seulement) ; ouverture des CSV dans Excel ou LibreOffice ; organismes de `prospects.md`
> (« à vérifier ») ; libellés des étapes « Comme une application » (repris du socle). Publications LinkedIn et
> Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Séminaire / offsite QME : “Tout le monde au bon endroit, au bon moment.” Tableau de bord d'un séminaire de deux jours
avec les participants confirmés, les personnes à loger ou sans trajet, le coût par participant et les points à traiter,
et sur téléphone les passagers du train du matin. Données fictives. »
