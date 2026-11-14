# Intégration de T59 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

**Préfixe : `PRG`** (et non `SQC`, déclaré au lot 9 dans 7a3bbd4) : l'application envoie `produit: 'PRG'` dans ses deux
appels à `/connexion` et utilise les clés `qme-prg-code`, `qme-prg-cache`, `qme-prg-demo`, `qme-prg-ecran-accueil`.

## netlify/lib/templates-acces.mjs (PRODUITS côté serveur)

Remplacer la ligne `SQC` par :

```js
  PRG: { nom: 'Progression pédagogique', url: '/templates/progression/' },
```

(Changée localement pour les tests de ce worktree, **non commitée**.) `netlify.toml` (noindex, `sw.js`) porte sur le
chemin `/templates/progression/*` : rien à changer.

## outils/packs/donnees.mjs (TEMPLATES)

```js
  PRG: { slug: 'progression', prix: 1500, phrase: 'Séquences et séances, prévu face au réel, fin projetée.', pour: 'pro' },
```

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html` :

```html
        <li class="carte prochaine" data-slug="progression" data-pour="pro" data-theme="associations-formation-et-evenements" style="--c:var(--rouge)"><a href="/catalogue/progression/"><b>Progression pédagogique</b><span class="phrase">Séquences et séances, prévu face au réel, fin projetée.</span><span class="theme">Associations, formation et événements</span><em>Bientôt</em></a></li>
```

Thème existant `associations-formation-et-evenements` (comme la gestion de classe et l'emploi du temps). Penser au
compteur de la puce « Associations, formation et événements » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Professional, mention « in French », un seul
`<img` et un seul `</article>`).

## connexion/index.html (objet `PRODUITS`)

```js
PRG:{nom:'Progression pédagogique',url:'/templates/progression/',cle:'qme-prg-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  progression: ['Progression pédagogique', 'Ton programme, séance après séance.', 'Prévu et réel · retard en heures · fin projetée'],
```

(La couverture `assets/templates-progression-couverture.png` est déjà générée avec cette ligne, placée en tête de la
table d'une copie du script dans le scratchpad, serveur statique sur le port 8922 ; l'ambiance de couleur dépend du
rang dans la table.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1500, permalien proposé `progression-pedagogique`,
catégorie `education` à vérifier, bouton « Ouvrir ma progression »).

## README.md (section « Templates payants », lot 9)

> `templates/progression/` (PRG) **progression pédagogique** (année avec vacances et jours sans cours saisis, jours
> fériés calculés, Alsace-Moselle en option ; classes et groupes avec leurs créneaux, semaines A et B, alternance qui
> saute ou non les vacances ; séquences ordonnées avec objectifs, compétences visées, durée en heures et fenêtre de fin
> (jalon à plage) ; séances faites, prévues, reportées (replacées au prochain créneau libre) ou annulées ; prévu posé
> sur tous les créneaux de l'année, avancement réel plafonné à la durée de chaque séquence, retard en heures et en
> séances, projection des heures restantes sur les créneaux à venir, marge et alerte « le programme ne tient pas » ;
> créneaux passés à renseigner ; frise prévu / réalisé / projeté ; cahier de textes imprimable ; 5 modèles de
> structure calculés sur les heures réelles ; banque de 73 verbes d'objectifs rangés selon les six niveaux de la
> taxonomie de Bloom révisée, objectifs flous signalés ; duplication d'une classe ou reprise d'une année ; export CSV ;
> aucune donnée d'élève, aucun programme officiel, aucun calendrier de vacances intégré). Règles dans `regles.js`,
> tests `outils/templates/progression.test.mjs`. « Mise en vente prochaine » : page `catalogue/progression/`, pas de
> fiche Gumroad.

## docs/templates/IDEES.md

Ligne T59 (tableau principal) : statut `prêt`.

Remarque T59 (tableau des bases, vers la ligne 891) : « Séquences, séances, objectifs, avancement réel et prévu | à
définir | Jalons à plage | **confidentiel** : artefact professionnel ; mécanique seulement. » →
« Séquences, séances, objectifs, avancement réel et prévu | 5 modèles de structure génériques, déroulé type de
séquence, 73 verbes d'objectifs selon la taxonomie de Bloom révisée (rédigés pour QME), fériés calculés ; aucun
programme officiel ni calendrier de vacances | Jalons à plage | **confidentiel** : artefact professionnel ; mécanique
seulement (fenêtres de fin des séquences) ; démo fictive ; aucune donnée d'élève. »

Table des slugs : `| T59 | \`progression\` | PRG | progression-pedagogique (prévu) |`

Texte du statut (bloc du lot 9) :

> T59 Progression pédagogique, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis intéressé(e) », pas de
> fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application `templates/progression/` (PRG, 15 €,
> démo `/templates/progression/?demo`) ; page `catalogue/progression/` ; fiche `fiches/progression.md` ; livrables dans
> `communication/progression/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et
> gumroad.json, cartes FR/EN, couverture.txt, integration.md). Couverture `assets/templates-progression-couverture.png`.
> Préfixe `PRG` (au lieu de `SQC`, réservé dans les packs). **Confidentiel** respecté : mécanique des jalons à plage
> seulement, démo entièrement fictive (trois classes inventées, vacances inventées relatives à aujourd'hui), aucun
> intitulé de programme recopié, aucune donnée d'élève.
> **À faire valider par Quentin** : prix 15 €, nom, permalien `progression-pedagogique`, catégorie Gumroad (`education`
> à vérifier) ; thème « Associations, formation et événements » ; choix de calcul (prévu = séquences à la suite sur
> tous les créneaux depuis le premier cours, sans étaler la réserve ; séquence terminée comptée pour sa durée prévue ;
> séquence en cours plafonnée à sa durée ; retard en séances = heures ÷ durée moyenne d'un créneau) ; alternance A/B qui
> saute par défaut les semaines sans cours ; Lundi de Pentecôte compté sans cours par défaut (décochable) ; date de
> « début du suivi » au premier lancement en cours d'année (les cours passés ne comptent pas) ; un seul utilisateur par
> clé (pas de progression partagée) ; titres des séquences de la démo (notions courantes de mathématiques,
> d'histoire-géographie et de tableur, génériques) ; hashtags hors jeux habituels (LinkedIn `#Enseignement`,
> `#Formation`, `#Pédagogie` ; Instagram `#Enseignement`, `#Formation`).
> Non vérifiés : taxonomie de Bloom relue sur une source primaire (noms des niveaux de connaissance générale, verbes
> rédigés pour QME) ; article L3133-1 du Code du travail non relu sur Légifrance (liste reprise des autres templates) ;
> impression papier réelle (mise en page vérifiée à l'écran en média « print ») ; Safari et Firefox réels (émulation
> Chromium seulement) ; ouverture des CSV dans Excel ou LibreOffice ; organismes de `prospects.md` (« à vérifier »).
> Publications LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Progression pédagogique QME : “Ton programme, séance après séance.” Tableau de bord avec les heures faites, le
plus fort retard, les créneaux à renseigner et l'alerte “le programme ne tient pas”, et sur téléphone deux classes avec
leur avancement face à l'attendu et la date de fin projetée. Données fictives. »

## netlify.toml

Déjà fait dans 7a3bbd4 (en-têtes `noindex` et `sw.js` pour `/templates/progression/*`) : rien à ajouter.
