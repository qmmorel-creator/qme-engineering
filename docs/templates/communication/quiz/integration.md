# Intégration de T58 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

**Préfixe : `QZZ`** (déjà réservé dans `PREVUS` de `outils/packs/donnees.mjs`) : l'application envoie `produit: 'QZZ'`
dans ses deux appels à `/connexion` et utilise les clés `qme-qzz-code`, `qme-qzz-cache`, `qme-qzz-demo`,
`qme-qzz-ecran-accueil`. Connexion avec le code ADM et `produit: 'QZZ'` vérifiée en local (200, `produit` = `QZZ`).

## netlify/lib/templates-acces.mjs (PRODUITS côté serveur)

Après la ligne `PRG` :

```js
  QZZ: { nom: 'Banque de questions et quiz', url: '/templates/quiz/' },
```

(Ajoutée localement pour les tests de ce worktree, **non commitée**.) Tant que `QZZ` est aussi dans `PREVUS`,
`outils/templates/packs.test.mjs` échoue (« QZZ existe : le retirer de PREVUS… ») : c'est attendu, les deux
changements vont ensemble (voir les packs ci-dessous).

## netlify.toml (en-têtes de l'application)

**À ajouter** (aucune entrée `/templates/quiz/*` n'existe), par exemple après le bloc `/templates/progression/sw.js` :

```toml
[[headers]]
  for = "/templates/quiz/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/templates/quiz/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

Démo ouverte : aucun blocage 404 à ajouter.

## outils/packs/donnees.mjs

1. `TEMPLATES` (après `PRG`) :

```js
  QZZ: { slug: 'quiz', prix: 1900, phrase: 'Questions taguées, quiz générés et corrigés.', pour: 'pro' },
```

2. `PREVUS` : retirer la ligne `QZZ: { nom: 'Banque de questions et quiz', … }` (garder le commentaire et `CRS`).
3. `PAGES.PNS` : `prevus: ['QZZ']` → `prevus: []` (étape `parcours` `['QZZ', …]` inchangée) ; l'argument
   « La banque de quiz à venir, avec l’option Pack évolutif » n'a plus lieu d'être : proposition
   « Questions, quiz et corrections dans le même pack » (**à valider par Quentin**).

## netlify/lib/packs.mjs

`PNS` : `produits: ['PRG', 'CSE', 'EDT']` → `produits: ['PRG', 'QZZ', 'CSE', 'EDT']` (ordre du parcours). Le pack n'a pas
de champ `gumroad` dans ce dépôt (non vendu au 14/11/2026, à vérifier) : pas de date dans `ajouts`. S'il est en vente au
moment de l'intégration : `ajouts: { QZZ: '<date de mise en vente de QZZ>' }`.

Puis `node outils/packs/generer.mjs` (régénère `packs/`) et `npm test` (`packs.test.mjs` doit repasser).

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html` :

```html
        <li class="carte prochaine" data-slug="quiz" data-pour="pro" data-theme="associations-formation-et-evenements" style="--c:var(--rouge)"><a href="/catalogue/quiz/"><b>Banque de questions et quiz</b><span class="phrase">Questions taguées, quiz générés et corrigés.</span><span class="theme">Associations, formation et événements</span><em>Bientôt</em></a></li>
```

Thème existant `associations-formation-et-evenements` (avec la gestion de classe, l'emploi du temps et la progression).
Penser au compteur de la puce « Associations, formation et événements » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Professional, mention « in French », un seul `<img`
et un seul `</article>` dans l'`<article class="mini-produit">`).

## index.html et en/index.html

Rien avant la mise en vente (le prix « dès … » ne change pas : 19 € n'est pas le moins cher). Cartes compactes prêtes
pour la mise en vente : `carte-accueil-fr.html`, `carte-accueil-en.html`.

## connexion/index.html (objet `PRODUITS`)

Après `PRG:{…}` :

```js
QZZ:{nom:'Banque de questions et quiz',url:'/templates/quiz/',cle:'qme-qzz-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  quiz: ['Banque de questions et quiz', 'Tes questions, tes quiz, tes résultats.', 'Questions taguées · quiz et corrigé · statistiques'],
```

(La couverture `assets/templates-quiz-couverture.png` est déjà générée avec cette ligne, placée en tête de la table
d'une copie du script dans le scratchpad, serveur local sur le port 8931 ; l'ambiance de couleur dépend du rang dans la
table.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (même format, `price_cents` 1900, permalien proposé `banque-questions-quiz`, catégorie
`education` à vérifier, bouton « Ouvrir ma banque »).

## README.md (section « Templates payants »)

> `templates/quiz/` (QZZ) **banque de questions et quiz** (questions étiquetées : QCM à une ou plusieurs bonnes réponses,
> vrai ou faux, réponse courte avec variantes acceptées, difficulté, points, explication ; collage d'une liste au format
> `?` `+` `-` `=` `#` `~` `!` ; quiz tirés par étiquettes, difficulté et type, priorité aux questions les moins posées,
> propositions mélangées de façon reproductible ; sujet imprimable et corrigé sur une page à part ; sessions anonymes ou
> nominatives (prénom et initiale, ou pseudonyme), saisie des réponses et note automatique sur 10, 20 ou 100, QCM en tout
> ou rien, réponses courtes comparées sans accents ni ponctuation sinon « à vérifier », passation sur l'appareil du
> formateur ; statistiques par question et par étiquette, questions trop faciles ou trop difficiles (seuils réglables),
> distracteur le plus choisi, moyenne de chaque session, parcours d'un apprenant ; RGPD : mention au premier lancement,
> export JSON et CSV puis effacement d'un apprenant, d'une session ou de tous les résultats, anonymisation d'une session,
> rappel de durée de conservation ; aucune question fournie). Règles dans `regles.js`, tests
> `outils/templates/quiz.test.mjs`. « Mise en vente prochaine » : page `catalogue/quiz/`, pas de fiche Gumroad. QZZ rejoint
> le pack Enseignant et formateur.

## docs/templates/IDEES.md

Ligne T58 (tableau principal, vers la ligne 138) : statut `idée` → `prêt`.

Remarque T58 (tableau des bases, vers la ligne 1050) : « Banque de questions taguée, génération de quiz, correction,
statistiques | à définir | Banque de questions d'élèves (artefact client) | Contenu de l'artefact non repris. **RGPD** si
résultats nominatifs. » → « Banque de questions taguée, génération de quiz, correction, statistiques | aucune question
fournie ; types, difficultés, format de collage et conseils rédigés pour QME | Banque de questions d'élèves (artefact
client) | Contenu de l'artefact non repris (mécanique générique seulement, démo de 30 questions génériques rédigées pour
QME). **RGPD** : copies anonymes par défaut ou pseudonymes, mention au premier lancement, export JSON et CSV, effacement
d'un apprenant, d'une session ou de tout, anonymisation, rappel de conservation. »

Tableau des packs (vers la ligne 273) : ligne PNS, T58 passe de la colonne « prévus » aux templates
(`T59, T58, T55, T56 | —`) ; prix et remises à recalculer selon la règle du tableau (**à vérifier**).

Table des slugs : `| T58 | \`quiz\` | QZZ | banque-questions-quiz (prévu) |`

Texte du statut (bloc du lot) :

> T58 Banque de questions et quiz formateur, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
> intéressé(e) », pas de fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application `templates/quiz/`
> (QZZ, 19 €, démo `/templates/quiz/?demo`) ; page `catalogue/quiz/` ; fiche `fiches/quiz.md` ; livrables dans
> `communication/quiz/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json,
> cartes FR/EN, couverture.txt, section-site.html, integration.md). Couverture `assets/templates-quiz-couverture.png`.
> Rejoint le pack Enseignant et formateur (retiré de `PREVUS`). **Exigences respectées** : aucun contenu d'artefact repris
> (aucune question fournie ; démo de 30 questions génériques rédigées pour QME, apprenants inventés) ; RGPD : mention
> explicite (case obligatoire au premier lancement), copies anonymes par défaut ou pseudonymes, export JSON et CSV,
> effacement d'un apprenant, d'une session ou de tous les résultats, anonymisation d'une session, rappel de conservation.
> **À faire valider par Quentin** : prix 19 €, nom, permalien `banque-questions-quiz`, catégorie Gumroad (`education` à
> vérifier) ; thème « Associations, formation et événements » ; QCM à plusieurs réponses en tout ou rien, blanc compté
> faux, note arrondie au demi-point ; réponses courtes comparées sans accents ni ponctuation, sinon « à vérifier » ; seuils
> 85 % / 35 %, minimum 5 réponses, distracteur affiché dès 15 % ; saisie anonyme proposée par défaut ; conservation de
> 12 mois par défaut (aucune durée légale affirmée) ; passation sur l'appareil du formateur seulement (pas de compte
> apprenant) ; un seul utilisateur par clé ; questions de la démo ; nouvel argument du pack PNS ; hashtags hors jeux
> habituels (LinkedIn `#Formation`, `#Enseignement`, `#Pédagogie` ; Instagram `#Formation`, `#Enseignement`) ; texte
> LinkedIn un peu long (environ 1 600 caractères).
> Non vérifiés : RGPD relu sur une source primaire (aucune promesse de conformité faite, seulement minimisation,
> export et effacement) ; impression papier réelle (mise en page vérifiée à l'écran en média « print ») ; Safari et
> Firefox réels (émulation Chromium seulement) ; ouverture des CSV dans un tableur ; organismes de `prospects.md`
> (« à vérifier ») ; état de vente du pack PNS.
> Publications LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Banque de questions et quiz QME : “Tes questions, tes quiz, tes résultats.” Tableau de bord avec les questions, les quiz,
les copies corrigées, la réussite moyenne et la liste des points à regarder (réponses à vérifier, questions trop
difficiles ou trop faciles), et sur téléphone la correction d'une session avec sa moyenne et deux réponses courtes à
vérifier. Données fictives. »
