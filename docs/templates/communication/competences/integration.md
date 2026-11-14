# Intégration de T49 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main.

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html`, à placer après la carte `conges` (même thème) :

```html
        <li class="carte prochaine" data-slug="competences" data-pour="pro" data-theme="organisation-et-reunions" style="--c:var(--rouge)"><a href="/catalogue/competences/"><b>Matrice compétences et formations</b><span class="phrase">Niveaux, écarts au poste, compétences fragiles, plan de formation.</span><span class="theme">Organisation et réunions</span><em>Bientôt</em></a></li>
```

Thème existant `organisation-et-reunions` (comme l'onboarding et les congés, RH). Compteur de la puce
« Organisation et réunions » : `<small>4</small>` → `<small>5</small>` (si d'autres cartes du lot rejoignent ce
thème, recompter). Le sous-titre « N templates · achat unique » compte la vitrine : inchangé tant que le template
n'est pas en vente (à vérifier selon la règle appliquée au lot).

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Professional, mention « in French »,
`<article class="mini-produit">` avec une seule `<img` et une seule `</article>`), à placer après la carte
« Employee onboarding and offboarding ».

## connexion/index.html (objet `PRODUITS`)

```js
FRM:{nom:'Matrice compétences et formations',url:'/templates/competences/',cle:'qme-frm-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  competences: ['Matrice compétences et formations', 'Qui sait faire quoi, et qui former.', 'Écarts au poste · compétences fragiles · formations'],
```

(La couverture `assets/templates-competences-couverture.png` est déjà générée avec cette ligne, sur une copie du
script dans le scratchpad, serveur statique sur le port 8921 ; aucun débordement signalé, Outfit chargée.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (mêmes clés que les entrées existantes, `price_cents` 2500, permalien proposé
`matrice-competences-formations`, catégorie `business-and-money/management-and-leadership`, bouton « Ouvrir ma
matrice »). À ajouter à la liste.

## README.md (section « Templates payants », lot 9)

> `templates/competences/` (FRM) **matrice compétences et formations** (référentiel intégré de 44 compétences
> transverses en 8 domaines, dont 8 critiques, et 9 modèles de postes avec niveau requis, rédigés pour QME sans
> source externe ; échelle 0 à 4 réglable de 0 à 3 ou 0 à 5 ; matrice personnes × compétences en couleur, en niveaux
> ou en écarts, filtrable par équipe et domaine ; écarts au poste par personne, équipe et entreprise ; couverture
> par compétence et compétences critiques fragiles sous un seuil réglable ; plan de formation relié aux compétences
> (modalité, date, durée, coût, statut, niveau visé et atteint), budget de l'année prévu, engagé et réalisé ;
> historique des évaluations et réévaluations dues ; impression de la matrice et de la fiche, CSV de la matrice, du
> plan et de l'historique ; données minimales, rappel RGPD, effacement de la fiche au départ). Règles dans
> `regles.js`, tests `outils/templates/competences.test.mjs`. « Mise en vente prochaine » : page
> `catalogue/competences/`, pas de fiche Gumroad.

## docs/templates/IDEES.md

Ligne T49 (tableau principal) : statut `en cours` → `prêt`.

Remarque T49 (tableau des bases, vers la ligne 881), colonne « Base intégrée » : « à définir » →
« Référentiel générique de 44 compétences en 8 domaines (8 critiques) et 9 modèles de postes, rédigé pour QME sans
source externe » ; colonne « Remarques » : « Backlog : tableur seul. **RGPD**. » → « Backlog : tableur seul (fait en
application web ; modèle tableur non fait, à trancher). **RGPD** : données minimales (prénom et initiale, poste,
équipe, niveaux), aucune donnée sensible, « une évaluation n'est jamais une sanction », effacement de la fiche au
départ, rappel CNIL général à vérifier. Pas un outil de conformité (formations obligatoires, habilitations,
entretiens professionnels hors champ). Aucune donnée datée. »

Table des slugs : `| T49 | \`competences\` | FRM | matrice-competences-formations (prévu) |`

Texte du statut (bloc du lot 9) :

> T49 Matrice compétences et formations, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
> intéressé(e) », pas de fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application
> `templates/competences/` (FRM, 25 €) ; page `catalogue/competences/` ; fiche `fiches/competences.md` ; livrables
> dans `communication/competences/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et
> gumroad.json, cartes FR/EN, couverture.txt). Couverture `assets/templates-competences-couverture.png`.
> **À faire valider par Quentin** : prix 25 €, nom, permalien `matrice-competences-formations`, catégorie Gumroad ;
> application web au lieu du « tableur seul » du backlog (modèle tableur non fait) ; contenu du référentiel générique
> (44 compétences, 9 postes, niveaux requis, choix des 8 critiques) ; libellés prudents « consignes de sécurité
> électrique » et « conduite d'équipements de manutention » (aucune habilitation ni certificat nommé) ; seuil de
> couverture 2 et réévaluation à 12 mois par défaut ; formations sans date exclues du budget ; une seule clé partagée
> entre managers, sans droits par personne ; hashtags hors jeux du kit (`#RessourcesHumaines`, `#Formation`,
> `#Compétences`) ; prospects (organismes à vérifier).
> Non vérifiés : renvoi au référentiel CNIL « Gestion des ressources humaines » (repris de T46, non relu) ; Safari
> réel (iPhone simulé par Playwright) ; impression réelle de la matrice (aperçu non contrôlé) ; organismes de
> `prospects.md`. Publications LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette session).

## Texte alternatif de la couverture

« Matrice compétences et formations QME : “Qui sait faire quoi, et qui former.” La matrice des compétences d'une
équipe, niveaux en cases bleues du clair au foncé, écarts au niveau requis par le poste entourés de rouge, sur
ordinateur et sur téléphone. Données fictives. »

## netlify.toml, netlify/lib/templates-acces.mjs

Déjà faits dans 7a3bbd4 (en-têtes `noindex` et `sw.js` pour `/templates/competences/*`, `FRM` dans `PRODUITS`) :
rien à ajouter. Note : `catalogue/competences/` est une page publique indexable, comme les autres pages catalogue.
