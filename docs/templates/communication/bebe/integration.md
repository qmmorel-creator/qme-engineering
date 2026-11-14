# Intégration de T19 (pour l'orchestrateur)

Fichiers partagés **non modifiés** dans ce worktree : à intégrer à la main. `netlify.toml` (en-têtes `noindex` et
`sw.js` pour `/templates/bebe/*`) et `PRODUITS` côté serveur (`BBE` dans `netlify/lib/templates-acces.mjs`) sont
déjà faits dans 7a3bbd4 : rien à ajouter.

## templates/index.html (liste « En préparation », `.liste-bientot`)

Ligne prête dans `carte-prochaine.html` :

```html
        <li class="carte prochaine" data-slug="bebe" data-pour="perso" data-theme="sante-et-forme" style="--c:var(--rouge)"><a href="/catalogue/bebe/"><b>Suivi du bébé</b><span class="phrase">Tétées, sommeil, couches, à deux parents, d'une main.</span><span class="theme">Santé et forme</span><em>Bientôt</em></a></li>
```

Thème existant `sante-et-forme` (comme nutrition, habitudes, musculation). Penser au compteur de la puce
« Santé et forme » (+1) et au sous-titre « N templates ».

## en/templates/index.html

Carte « Coming soon » prête dans `carte-en-prochaine.html` (groupe Personal life, mention « in French »,
`<article class="mini-produit">` avec une seule `<img` et une seule `</article>`).

## connexion/index.html (objet `PRODUITS`)

```js
BBE:{nom:'Suivi du bébé',url:'/templates/bebe/',cle:'qme-bbe-code'}
```

## outils/templates/couvertures-gumroad.cjs (table `T`)

```js
  'bebe': ["Suivi du bébé", "Ses journées, notées d'une main.", "Tétées · sommeil · couches · à deux parents"],
```

(La couverture `assets/templates-bebe-couverture.png` est déjà générée avec cette ligne, ajoutée en dernière
position de `T` sur une copie du script dans le scratchpad, serveur statique sur le port 8924 ; l'ambiance de
couleurs dépend de la position de la ligne dans `T`.)

## docs/templates/communication/gumroad-a-creer.json

Entrée prête dans `gumroad.json` (mêmes clés que les autres entrées, `price_cents` 1300, permalien proposé
`suivi-bebe`, catégorie `fitness-and-health` **à vérifier**).

## README.md (section « Templates payants », lot 9)

> `templates/bebe/` (BBE) **suivi du bébé** (un ou plusieurs enfants, prénom ou surnom et date de naissance
> seulement ; vue « Aujourd'hui » à une main : tétée gauche ou droite avec minuteur hors ligne et changement de
> côté, biberon en ml, sommeil démarré et terminé, couche pipi, selle ou les deux ; dernier repas, dernier côté,
> éveil et dernière couche « il y a… » ; journal jour par jour ; résumés 7 ou 14 jours : totaux et moyennes des
> jours notés sans comparaison à une norme, rythme du sommeil et des repas sur 24 h ; mesures poids, taille,
> périmètre crânien tracées selon l'âge **sans courbe de référence** (licences OMS et AFPA–Inserm incompatibles ou
> non établies) ; rendez-vous saisis avec questions et compte rendu, notes, récapitulatif imprimable, export CSV ;
> deux parents sur deux appareils avec fusion des saisies (union par élément, suppressions suivies) ; **données de
> santé d'un enfant : consentement explicite avant tout enregistrement**, version de l'accord, effacement complet,
> retour à l'écran de consentement si les données sont effacées depuis un autre appareil ; aucun diagnostic, aucune
> alerte, aucune norme de lait ou de sommeil, aucun calendrier vaccinal, aucune marque ; avertissement « ne remplace
> pas l'avis du médecin, de la sage-femme ou de la PMI »). Règles dans `regles.js`, tests
> `outils/templates/bebe.test.mjs`. « Mise en vente prochaine » : page `catalogue/bebe/`, pas de fiche Gumroad ;
> **RGPD à trancher par Quentin avant la vente**.

## confidentialite/index.html (proposition, non modifiée ici)

À ajouter après le bloc « Template « Nutrition et dépense énergétique » », **si Quentin valide la vente** :

```html
<h3>Template « Suivi du bébé »</h3>
<p>Ce template traite des <strong>données de santé d'un enfant</strong> au sens de l'article 9 du RGPD (repas,
sommeil, couches, poids, taille, périmètre crânien, notes et rendez-vous), avec son prénom ou surnom et sa date de
naissance. Leur traitement repose sur le <strong>consentement explicite</strong> (article 9, paragraphe 2, a) du
parent ou du titulaire de l'autorité parentale, donné au premier lancement en cochant deux cases dédiées : rien
n'est enregistré en ligne avant. Elles sont enregistrées chez l'hébergeur Netlify, <strong>dans l'Union européenne
(Francfort, Allemagne)</strong>, rattachées à l'identifiant technique de la clé, et ne servent qu'à faire fonctionner
le suivi : jamais vendues, partagées ni utilisées pour de la publicité. Toute personne à qui la clé est confiée
(l'autre parent, par exemple) accède au même suivi. Le bouton « Effacer toutes mes données » des réglages supprime
la version en ligne et celle de l'appareil ; il vaut retrait du consentement, possible à tout moment.</p>
```

## docs/templates/IDEES.md

Ligne T19 (tableau principal) : statut `prêt` (ou laisser `en cours` tant que le RGPD n'est pas tranché, au choix
de Quentin).

Remarque T19 (tableau des bases, vers la ligne 851) : « Courbes de référence poids et taille (source à vérifier) »
→ « Aucune courbe de référence intégrée : normes OMS sous CC BY-NC-SA 3.0 IGO (usage commercial soumis à
autorisation, page copyright OMS consultée le 14/11/2026) ; courbes AFPA–Inserm/CRESS–CompuGroup Medical 2018 sans
licence de réutilisation trouvée (communiqués AFPA et Inserm du 05/03/2018). Mesures saisies tracées seules, sans
percentile. »

Table des slugs : `| T19 | \`bebe\` | BBE | suivi-bebe (prévu) |`

Texte du statut (bloc du lot) :

> T19 Suivi du bébé, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis intéressé(e) », pas de fiche
> Gumroad : entrée dans `communication/gumroad-a-creer.json`). Application `templates/bebe/` (BBE, 13 €) ; page
> `catalogue/bebe/` ; fiche `fiches/bebe.md` ; livrables dans `communication/bebe/` (linkedin.md, instagram.md +
> carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json, cartes FR/EN, couverture.txt). Couverture
> `assets/templates-bebe-couverture.png`. Marques **médical** et **RGPD** traitées comme T04 : avertissement sur
> chaque vue, au premier lancement, dans les réglages, la page catalogue et la fiche Gumroad ; consentement
> explicite avant tout enregistrement (repris de T04, version `2026-11-14`), effacement complet, retour au
> consentement si effacé ailleurs ; démo à consentement simulé.
> **À faire valider par Quentin** : (1) **RGPD** : vendre un outil qui héberge des données de santé d'enfants
> (consentement du titulaire de l'autorité parentale, certification HDS non vérifiée comme pour T04, paragraphe de
> confidentialité proposé dans `communication/bebe/integration.md`) ; (2) absence de courbes de référence (ou
> demande d'autorisation à l'OMS ou aux auteurs AFPA–Inserm) ; (3) nom, prix 13 €, permalien `suivi-bebe`,
> catégorie Gumroad `fitness-and-health` (à vérifier) ; (4) numéros d'urgence 15 et 112 dans l'avertissement ;
> (5) fusion des saisies de deux appareils (choix « la dernière modification gagne » par élément) ; (6) hashtags
> hors kit `#JeunesParents`, `#Parentalité` ; (7) prospects (organismes « à vérifier »).
> Non vérifiés : Safari et Chrome réels sur téléphone (seulement l'émulation Playwright) ; impression réelle du
> récapitulatif (aperçu seulement) ; tenue de la taille des données sur un an d'usage réel ; conditions exactes de
> réutilisation des courbes AFPA–Inserm (aucune licence trouvée, contact Inserm non sollicité) ; organismes de
> `prospects.md`. Publications LinkedIn et Instagram non planifiées (aucun accès aux plannings depuis cette
> session).

## Texte alternatif de la couverture

« Suivi du bébé QME : “Ses journées, notées d'une main.” Sommeil en cours depuis 38 minutes avec le bouton Réveil,
gestes rapides pour noter une tétée à gauche ou à droite, un biberon ou une couche, dernier repas, dernier côté et
dernière couche, sur ordinateur et sur téléphone. Données fictives. »

## Vérifications faites dans ce worktree

- `npm test` : 812 tests, 811 réussis, 1 ignoré (préexistant), 0 échec ; dont 16 tests `bebe.test.mjs`.
- Playwright (serveur local port 8914) : code faux refusé ; code BBE valide ; écran de consentement (bouton
  désactivé tant que les deux cases ne sont pas cochées) ; **refus → aucun `PUT`, aucun cache local** ; accord puis
  premier enfant → premier `PUT` ; gestes (tétée, couche, sommeil qui termine la tétée, biberon) ; second contexte
  iPhone 13 avec le même code ; saisies simultanées sur les deux contextes → 5 saisies des deux côtés (fusion) ;
  rechargement ; effacement depuis le téléphone → l'ordinateur revient à l'écran de consentement, cache vidé ; code
  ADM accepté avec `produit: "BBE"` dans l'appel. Démo `?demo` à 1280 px et sur iPhone 13 : 5 onglets, zéro
  `pageerror`, zéro erreur console, aucune page plus large que 390 px. Fenêtre « Comme une application » : iPhone 13
  (Safari) et Pixel 7 (Chrome), « Ne plus afficher » tient, rouverte depuis les Réglages, absente à 1280 px.
  Page `catalogue/bebe/` : 200 (ordinateur et iPhone 13), largeur 390 px, images chargées, bouton « Je suis
  intéressé(e) » → `/api/interets` 200.
