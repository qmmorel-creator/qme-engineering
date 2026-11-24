---
name: nouveau-template
description: Développer un nouveau template QME vendu sur Gumroad (application web ouverte par clé de licence, données synchronisées, charte Bauhaus), de la fiche d'idée à la mise en vente et à sa communication (page du site, publications LinkedIn et Instagram, prospects). À utiliser quand Quentin demande de développer, lancer, créer ou prototyper un template (« lance T04 », « développe le template budget », « nouveau template »), ou d'en ajouter un au site ou à Gumroad.
---

# Nouveau template QME

> **Règles communes (18/11/2026)** : appliquer `docs/templates/communication/REGLES-CONTENU.md` (au moins 1 publication par jour et
> 7 jours d'avance par plateforme, problème posé puis résolu, accroche, rétention, couleur d'accent Bauhaus en rotation,
> aucune vidéo muette) et les heures de `docs/templates/communication/HEURES.md`. Elles priment sur ce skill.

Référence vivante : le **planning de révision** (`templates/revision/`, préfixe `REV`). Tout nouveau
template en reprend l'architecture, la charte et le niveau de finition. Avant de coder, lire
`reference.md` (architecture, contrats, pièges déjà rencontrés) dans ce dossier.

Langue : français partout (interface, commits, messages à Quentin). Tutoiement dans l'application,
vouvoiement sur le site QME.

> **Essai gratuit (décision de Quentin, 18/11/2026, étendu aux templates pro le 21/11/2026)** : tout template
> **vie personnelle ou professionnel** (`pour: 'perso'` ou `'pro'`) vendu payant s'ouvre à **14 jours d'essai gratuit sans carte**, puis 30 jours en lecture seule, avec reprise des données
> à l'achat et e-mails depuis la boîte de Quentin. Il entre dans l'essai **à sa mise en vente**, à chaque fois :
> étapes marquées « Essai » ci-dessous, détail dans `reference.md` § « Essai gratuit » et
> `docs/templates/essai-gratuit.md`.

## 0. Cadrer

1. Lire la fiche de l'idée dans `docs/templates/IDEES.md`. Si elle n'est qu'au statut `idée`, rédiger
   d'abord la fiche détaillée (public, écrans, base intégrée, calculs, sources, risques) et la faire
   valider par Quentin.
2. Passer le statut à `en cours` dans `IDEES.md`.
3. Choisir le **préfixe** (3 lettres, sans I, L, O, U) et le **slug** (`templates/<slug>/`).
4. Vérifier source et licence de toute base externe (aliments, MET, courbes…) **avant** de l'intégrer ;
   noter la source dans l'application (Réglages ou pied de page) et dans `IDEES.md`.
5. Lister les données qui se périment : les remplacer par du calcul ou par une saisie utilisateur.
6. **Choisir la requête principale** (référencement, règle du 15/11/2026, détail dans `reference.md`
   § « Référencement ») : interroger l'autocomplétion Google sur le sujet (seul, puis avec « modèle »,
   « tableau », « excel », « gratuit », « logiciel »), vérifier l'intention (« gestionnaire de tâches » =
   l'outil Windows, « temps de vie » = la durée de vie des animaux : à éviter), regarder les premiers
   résultats. Inscrire la ligne de la page dans `docs/seo/mots-cles.md`. **Aucun volume de recherche
   inventé** : « non mesuré » tant qu'il ne vient pas de la Search Console ou du Keyword Planner.

## 1. Construire

Partir d'une copie de `templates/revision/` et garder tel quel le socle commun :
écran de connexion (clé de licence ou code), mode démo (`?demo` et bouton), synchronisation
(`/api/templates/*`, cache local, hors ligne, conflit 409), modales `<dialog>`, toast avec « Annuler »,
réglages (export / import JSON, déconnexion), manifeste et service worker, icônes, et la **fenêtre
« Comme une application »** (ajout à l'écran d'accueil du téléphone), **obligatoire dans chaque
template** : voir `reference.md` § Ajout à l'écran d'accueil. Elle est déjà dans le socle copié ; la
vérifier à chaque fois (clé `qme-<pre>-ecran-accueil`, entrée « Sur téléphone » des réglages).

Écrire le **guide « Comment ça marche »** (grands principes, ouvert seul au premier lancement puis
par le bouton `?` et les réglages), **obligatoire dans chaque template** : voir `reference.md` § Guide
« Comment ça marche ».

Remplacer le métier :
- `donnees.js` : la **base intégrée** (`window.BASE`), sans logique ;
- `app.js` : état (`etatVide`, `normaliser` tolérant aux anciennes versions), règles métier en
  **fonctions pures** (testables), puis rendu par vues ;
- `donneesDemo()` : données d'exemple **relatives à aujourd'hui**, couvrant tous les états visibles
  (retard, fait aujourd'hui, à venir, vide d'une sous-partie, valeurs extrêmes).

Côté serveur, une seule ligne : ajouter le produit dans `PRODUITS` de
`netlify/lib/templates-acces.mjs` (`nom`, `url`, `gumroad` une fois la fiche créée). Rien d'autre à écrire :
connexion, licences Gumroad, stockage, conflits et essai gratuit sont communs.

**Essai (tout template payant)** : dans `templates/<slug>/index.html`, charger le module commun **avant**
`donnees.js` et `app.js` :
`<script src="/assets/essai.js?v=…" data-produit="PRE" data-slug="<slug>"></script>`. Le socle copié
(`qme-<pre>-code`, `qme-<pre>-cache`, `/api/templates`, `.formulaire-acces`) doit rester intact : le module s'y
appuie (bandeau, lecture seule, « J'ai acheté », lien d'essai sur l'écran de connexion). Une action qui ne modifie
rien (navigation, filtre, export) et dont le nom n'est pas dans la liste `PERMIS` de `assets/essai.js` y est ajoutée,
sinon elle serait bloquée en lecture seule. Dans `outils/packs/donnees.mjs`, l'entrée du template porte
`pour`, son `prix` et, à la mise en vente, son `permalien` Gumroad (lien d'achat du bandeau et des e-mails : sans lui,
le template n'entre pas dans l'essai). Ajouter sa fiche dans `netlify/lib/essais-prise-en-main.mjs` (premier pas, deux
fonctions peu visibles, question d'aide ; tirées de la page catalogue, sans libellé de bouton non vérifié) : elle nourrit
l'e-mail J+2, l'e-mail d'achat direct et l'accompagnement J+3 après achat (24/11/2026) ; sans elle, `npm test` échoue.

Charte : **Bauhaus « Pastel »** (filets de 1 px, grands arrondis, fonds teintés, aucune ombre dure),
jetons et composants dans `reference.md` § Charte ; partir du socle copié, qui l'applique déjà. Graphiques : charger le skill `dataviz`,
valider la palette avec son script et compenser ce qui échoue (contours, légende, tableau accessible).

## 2. Tester

- `npm test` (API) et tests `node --test` des règles métier du template (`outils/templates/<slug>.test.mjs`).
- `npm run dev:templates`, puis Playwright : ordinateur 1280 px et `devices['iPhone 13']` ; parcours
  complet (code faux refusé, code valide, premier lancement, saisie, synchronisation vers un second
  contexte, rechargement, démo) ; zéro `pageerror` ; aucune page plus large que 390 px.
- **Regarder chaque capture** (Read) et corriger : chevauchements, textes coupés, débordements. Les
  captures pleine page sur téléphone dupliquent les éléments fixes : faire aussi des captures d'écran
  simples après défilement.
- **Fenêtre « Comme une application »** : sur `devices['iPhone 13']` et `devices['Pixel 7']`, elle
  s'ouvre seule en démo avec les bonnes étapes (Safari / Chrome) ; « Ne plus afficher » tient après
  rechargement ; « Réglages > Sur téléphone > Voir comment faire » la rouvre ; à 1280 px elle ne s'ouvre
  pas seule. Regarder la capture.
- **Guide « Comment ça marche »** : il s'ouvre seul au premier lancement (vrai code et démo), pas au
  rechargement ni sur un second appareil avec le même code ; `?` et « Revoir le guide » le rouvrent ;
  sur téléphone, « Comme une application » suit sa fermeture. Relire chaque phrase contre le code.
  Script : `node outils/templates/guide-e2e.cjs <slug> <dossier-captures>` (démo, ordinateur, iPhone,
  Pixel), serveur local lancé ; le premier lancement avec un vrai code se teste à part.
- **Essai** : `QME_LICENCES_TEST=1 PORT=8899 node outils/templates/serveur-local.mjs`, puis
  `node outils/essai/e2e.cjs <slug> <dossier-captures>` : essai lancé depuis `/essai/`, bandeau, données, lecture
  seule 15 jours plus tard (onglets libres, modifications bloquées, aucun enregistrement envoyé), « J'ai acheté »,
  données reprises ; téléphone sans débordement. Regarder les captures. `npm test` couvre le serveur
  (`essai.test.mjs` compte les templates ouverts à l'essai par public : mettre à jour le nombre attendu).
- Relire la liste des pièges de `reference.md` et vérifier chacun.

## 3. Intégrer au site et à Gumroad

**Règle : chaque nouveau template entraîne la mise à jour de tout le site QM Engineering.** Liste à cocher
complète dans `reference.md` § « Mise à jour du site » ; aucune PR de template sans elle.

1. Captures pour le site (`assets/templates-<slug>-*.webp`, ordinateur 1600 px et téléphone 780 px, en
   mode démo sans bandeau) et couverture Gumroad 1280 × 720 (`assets/templates-<slug>-couverture.png`).
2. Site : fiche dans `/templates/` (produit, galerie, FAQ si besoin), carte dans la section `#templates`
   de `index.html` et `en/index.html` (préciser « in French »), puis `node outils/connexion/generer.mjs`
   (régénère la liste de l'espace acheteurs `connexion/index.html` et `assets/espace-donnees.js` depuis
   `PRODUITS` et les cartes du catalogue : nom, thème, phrase, vignette ; contrôlé par
   `outils/templates/connexion.test.mjs`). L'application charge `/assets/mes-templates.js` (balise
   `<script src="/assets/mes-templates.js?v=…" defer></script>` avant `</body>`) : son logo d'en-tête
   (`.barre .marque`) ouvre le panneau « Mes templates » (autres templates de l'appareil, badges Acheté / Essai).
3. Gumroad (outils `mcp__Gumroad__*`) : **confirmer nom et prix avec Quentin** (prix minimum 12 €, règle de
   Quentin du 13/11/2026 : aucun template vendu moins cher, hors gratuit), puis
   `create_draft_product`, `update_product` (permalien, catégorie, résumé, tags, détails, texte du reçu,
   bouton « Ouvrir mon … » ; nom, résumé, tags et catégorie selon `reference.md` § « Référencement »), `add_content_link` vers `https://qm-engineering.fr/connexion/`,
   `add_cover` une fois l'image en ligne. Reporter l'identifiant produit dans `PRODUITS`.
   **Quentin active la clé de licence dans l'éditeur Gumroad** (aucun outil ne le fait) : onglet Content →
   Insert → License key, sans multi-postes. Sans ce bloc, l'acheteur ne reçoit aucune clé. Le bloc affiche le
   `product_id` : il doit être identique à `gumroad` dans `PRODUITS`. Ne publier la fiche qu'avec son accord explicite.
   **Vérifier la clé avant de publier** (règle du 14/11/2026) : la page de la fiche
   (`https://qmengineering.gumroad.com/l/<permalien>`) contient `"is_licensed":true` quand le bloc License key
   est en place : `curl -s <url> | grep -o 'is_licensed&quot;:[a-z]*'` (vérifié sur les 20 produits en vente ;
   pour un brouillon, si la page n'est pas accessible, demander à Quentin). L'API
   `licenses/verify` ne permet pas de le savoir (même message d'erreur avec ou sans clé). `false` ou absent :
   ne pas publier, demander à Quentin d'activer la clé. Les brouillons dont la clé est active sont publiés
   au fil de l'eau (au plus 10 par jour), puis le site passe en vente (`reference.md`, vitrine).
   Prérequis du compte (déjà fait une fois pour toutes) : un moyen de paiement connecté dans Gumroad
   (Settings → Payments), sinon `publish_product` est refusé.
4. Tout le site QM Engineering : appliquer la liste à cocher de `reference.md` § « Mise à jour du site »
   (accueil FR et EN, catalogue, connexion, références de l'accueil, README). La plaquette PDF ne
   change pas à chaque template ; les références PDF seulement sur demande de Quentin.
5. README : section « Templates payants » à compléter.
6. **Essai (tout template payant, à la mise en vente)** : `node outils/essai/generer.mjs` (ajoute le template au
   formulaire `/essai/` et l'essai à sa page catalogue : premier bouton « Essai gratuit 14 jours », « Acheter » en
   second, mention sous le prix, question « Y a-t-il un essai gratuit ? », rappel), puis les deux commandes du point 7.
7. **Référencement de la page catalogue** (`reference.md` § « Référencement », obligatoire) : title et
   description construits sur la requête principale, FAQ dans `div.faq`, puis
   `node outils/seo/donnees-structurees.mjs` et `node outils/sitemap/generer.mjs` ;
   `outils/templates/seo.test.mjs` et `sitemap.test.mjs` échouent sinon.

## 4. Préparer la communication

Livrables dans `docs/templates/communication/<slug>/` (non publiés), relus par Quentin avant usage :

1. **Page de présentation sur le site QM Engineering** : la page `/catalogue/<slug>/` (générée depuis
   `section-site.html`) doit se suffire comme page d'atterrissage (lien direct
   `qm-engineering.fr/catalogue/<slug>/`) : promesse en une
   phrase, pour qui, 3 à 5 bénéfices concrets, captures, prix, « Acheter » et « Essayer la démo »,
   questions fréquentes propres au produit. Mettre sa carte dans le catalogue de `/templates/` (liste
   « En préparation » puis vitrine « Disponibles maintenant » à la mise en vente ; voir `reference.md`
   § « Mise à jour du site ») et ajouter sa carte sur `/en/templates/`.
2. **`linkedin.md`** : une publication de présentation (environ 1 200 à 1 500 caractères), à la première
   personne de Quentin, ton direct et sobre, sans superlatifs ni promesses chiffrées non vérifiées :
   accroche sur le problème, ce que fait le template (3 points), ce qui le distingue (base intégrée, tous
   appareils, achat unique), lien vers la démo, lien d'achat. **Template vie personnelle** : l'appel à l'action
   principal est l'essai (« 14 jours d'essai gratuit, sans carte : vos données sont reprises si vous achetez »,
   `qm-engineering.fr/essai/`), l'achat en second (`REGLES-CONTENU.md` § 7). Proposer 2 variantes d'accroche, l'image à
   joindre (couverture ou capture téléphone) et 3 à 5 hashtags. Prévoir aussi une version courte
   (3 lignes) pour un commentaire ou une story.
3. **`instagram.md`** : la publication Instagram du template, selon le kit
   `docs/templates/communication/instagram/README.md` (charte, formats, ton, hashtags) :
   - **carrousel de 5 vues en 1080 × 1350** générées en copiant les gabarits `car-1`, `car-2`, `car-3` de
     `docs/templates/communication/instagram/gabarits.html` (vraies captures du template, « Données
     fictives »), rendues en PNG (`rendre.mjs`) et **regardées** avant usage ;
   - légende au vouvoiement : accroche en première ligne (2 variantes), 3 à 6 phrases (template vie
     personnelle : « 14 jours d'essai gratuit, sans carte » dans l'appel à l'action), une phrase de
     pont vers le sur mesure (« Besoin de plus ? … je construis la version sur mesure »), « Démo libre et
     contact : lien en bio », 5 hashtags au plus (jeux du kit) ; aucun lien dans la légende ;
   - texte alternatif de chaque vue ; story d'annonce (gabarit `story`, autocollant lien vers la démo).
4. **`prospects.md`** : liste de prospects potentiels **sous forme de segments et d'organisations** ; tout e-mail
   qui en découle suit la règle absolue de `docs/templates/communication/REGLES-PROSPECTION.md` (vérifier la liste
   d'opposition, mention « Ne plus recevoir les informations » en dernier paragraphe)
   (jamais de données personnelles collectées sur des particuliers) : pour chaque segment, pourquoi il a
   le problème, où le trouver (annuaires, réseaux, salons, groupes), qui contacter (fonction, pas nom),
   message d'approche en 3 lignes, canal (LinkedIn, e-mail professionnel public, partenariat, affiliation
   Gumroad), priorité. Distinguer acheteurs directs (B2C), prescripteurs (enseignants, coachs,
   associations, influenceurs du domaine) et partenaires (structures qui pourraient offrir le template).
   Tout organisme cité doit exister ; signaler ce qui est à vérifier.
5. **Planifier l'article LinkedIn** dès que le template est prêt (règle de Quentin, 12/11/2026) : l'intercaler
   **entre deux publications déjà prévues**, en partant du début du planning. Procédure détaillée dans
   `reference.md` § « Planning LinkedIn ».
6. **Planifier le post Instagram** le lendemain de l'article LinkedIn, à 19:00 : procédure dans
   `reference.md` § « Planning Instagram » (publication par Instinct, comme LinkedIn). Motion design
   possible : reel 1080 × 1920 animé en HTML, rendu en MP4 par `docs/templates/communication/instagram/video.mjs`.
   TikTok : un carrousel reçoit aussi sa vidéo `IG-nn-<slug>-tiktok.mp4` (`reference.md` § « Planning Instagram »).
7. Mettre à jour la ligne du template dans `docs/templates/IDEES.md` (liens vers ces livrables, dates et ID
   des publications LinkedIn et Instagram).

## 5. Publier

- Branche de travail, commits en français, PR vers `main`. **Aucune fusion sans feu vert explicite de
  Quentin** (déploiements Netlify facturés). Ordre : licence activée → fiche Gumroad publiée → fusion.
- Après fusion : attendre le déploiement, puis vérifier la page (200), les en-têtes (`noindex` sur
  l'application), l'API (`401` à une clé inventée, jamais `503`), la démo dans un navigateur mobile.
  Donner à Quentin l'URL, le SHA et le Deploy ID, et lui demander l'indexation de la page catalogue dans
  la Search Console (Inspection d'URL → Demander l'indexation : aucun accès à son compte Google).
- **À chaque publication d'une fiche Gumroad, le site retire aussitôt le statut « bientôt »** (règle de
  Quentin, 13/11/2026) : dans la même session, une PR qui fait passer le template de « Mise en vente
  prochaine » à « en vente » partout (page catalogue, carte du catalogue FR et EN, bandeau de la démo,
  connexion, `PRODUITS`), sans attendre le prochain lot. Liste à cocher : `reference.md`
  § « À chaque publication Gumroad ». Un template publié sur Gumroad ne doit jamais rester affiché
  « Bientôt » sur le site, et inversement aucun bouton Acheter n'apparaît avant la publication.
- **Essai** : après la fusion, lancer un essai réel sur `/essai/` avec une adresse de
  Quentin (e-mail « Merci d'essayer… » reçu, expéditeur correct), puis vérifier le bandeau dans l'application.
- Statut `prêt` puis `en vente` dans `docs/templates/IDEES.md`.
