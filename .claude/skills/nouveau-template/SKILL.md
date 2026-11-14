---
name: nouveau-template
description: Développer un nouveau template QME vendu sur Gumroad (application web ouverte par clé de licence, données synchronisées, charte Bauhaus), de la fiche d'idée à la mise en vente et à sa communication (page du site, publications LinkedIn et Instagram, prospects). À utiliser quand Quentin demande de développer, lancer, créer ou prototyper un template (« lance T04 », « développe le template budget », « nouveau template »), ou d'en ajouter un au site ou à Gumroad.
---

# Nouveau template QME

Référence vivante : le **planning de révision** (`templates/revision/`, préfixe `REV`). Tout nouveau
template en reprend l'architecture, la charte et le niveau de finition. Avant de coder, lire
`reference.md` (architecture, contrats, pièges déjà rencontrés) dans ce dossier.

Langue : français partout (interface, commits, messages à Quentin). Tutoiement dans l'application,
vouvoiement sur le site QME.

## 0. Cadrer

1. Lire la fiche de l'idée dans `docs/templates/IDEES.md`. Si elle n'est qu'au statut `idée`, rédiger
   d'abord la fiche détaillée (public, écrans, base intégrée, calculs, sources, risques) et la faire
   valider par Quentin.
2. Passer le statut à `en cours` dans `IDEES.md`.
3. Choisir le **préfixe** (3 lettres, sans I, L, O, U) et le **slug** (`templates/<slug>/`).
4. Vérifier source et licence de toute base externe (aliments, MET, courbes…) **avant** de l'intégrer ;
   noter la source dans l'application (Réglages ou pied de page) et dans `IDEES.md`.
5. Lister les données qui se périment : les remplacer par du calcul ou par une saisie utilisateur.

## 1. Construire

Partir d'une copie de `templates/revision/` et garder tel quel le socle commun :
écran de connexion (clé de licence ou code), mode démo (`?demo` et bouton), synchronisation
(`/api/templates/*`, cache local, hors ligne, conflit 409), modales `<dialog>`, toast avec « Annuler »,
réglages (export / import JSON, déconnexion), manifeste et service worker, icônes, et la **fenêtre
« Comme une application »** (ajout à l'écran d'accueil du téléphone), **obligatoire dans chaque
template** : voir `reference.md` § Ajout à l'écran d'accueil. Elle est déjà dans le socle copié ; la
vérifier à chaque fois (clé `qme-<pre>-ecran-accueil`, entrée « Sur téléphone » des réglages).

Remplacer le métier :
- `donnees.js` : la **base intégrée** (`window.BASE`), sans logique ;
- `app.js` : état (`etatVide`, `normaliser` tolérant aux anciennes versions), règles métier en
  **fonctions pures** (testables), puis rendu par vues ;
- `donneesDemo()` : données d'exemple **relatives à aujourd'hui**, couvrant tous les états visibles
  (retard, fait aujourd'hui, à venir, vide d'une sous-partie, valeurs extrêmes).

Côté serveur, une seule ligne : ajouter le produit dans `PRODUITS` de
`netlify/lib/templates-acces.mjs` (`nom`, `url`, `gumroad` une fois la fiche créée). Rien d'autre à écrire :
connexion, licences Gumroad, stockage et conflits sont communs.

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
- Relire la liste des pièges de `reference.md` et vérifier chacun.

## 3. Intégrer au site et à Gumroad

**Règle : chaque nouveau template entraîne la mise à jour de tout le site QM Engineering.** Liste à cocher
complète dans `reference.md` § « Mise à jour du site » ; aucune PR de template sans elle.

1. Captures pour le site (`assets/templates-<slug>-*.webp`, ordinateur 1600 px et téléphone 780 px, en
   mode démo sans bandeau) et couverture Gumroad 1280 × 720 (`assets/templates-<slug>-couverture.png`).
2. Site : fiche dans `/templates/` (produit, galerie, FAQ si besoin), carte dans la section `#templates`
   de `index.html` et `en/index.html` (préciser « in French »), entrée dans `PRODUITS` du script de
   `connexion/index.html` (`nom`, `url`, clé de stockage `qme-<préfixe en minuscules>-code`).
3. Gumroad (outils `mcp__Gumroad__*`) : **confirmer nom et prix avec Quentin** (prix minimum 12 €, règle de
   Quentin du 13/11/2026 : aucun template vendu moins cher, hors gratuit), puis
   `create_draft_product`, `update_product` (permalien, catégorie, résumé, tags, détails, texte du reçu,
   bouton « Ouvrir mon … »), `add_content_link` vers `https://qm-engineering.fr/connexion/`,
   `add_cover` une fois l'image en ligne. Reporter l'identifiant produit dans `PRODUITS`.
   **Quentin active la clé de licence dans l'éditeur Gumroad** (aucun outil ne le fait) : onglet Content →
   Insert → License key, sans multi-postes. Sans ce bloc, l'acheteur ne reçoit aucune clé. Le bloc affiche le
   `product_id` : il doit être identique à `gumroad` dans `PRODUITS`. Ne publier la fiche qu'avec son accord explicite.
   Prérequis du compte (déjà fait une fois pour toutes) : un moyen de paiement connecté dans Gumroad
   (Settings → Payments), sinon `publish_product` est refusé.
4. Tout le site QM Engineering : appliquer la liste à cocher de `reference.md` § « Mise à jour du site »
   (accueil FR et EN, catalogue, connexion, références de l'accueil, README). La plaquette PDF ne
   change pas à chaque template ; les références PDF seulement sur demande de Quentin.
5. README : section « Templates payants » à compléter.

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
   appareils, achat unique), lien vers la démo, lien d'achat. Proposer 2 variantes d'accroche, l'image à
   joindre (couverture ou capture téléphone) et 3 à 5 hashtags. Prévoir aussi une version courte
   (3 lignes) pour un commentaire ou une story.
3. **`instagram.md`** : la publication Instagram du template, selon le kit
   `docs/templates/communication/instagram/README.md` (charte, formats, ton, hashtags) :
   - **carrousel de 5 vues en 1080 × 1350** générées en copiant les gabarits `car-1`, `car-2`, `car-3` de
     `docs/templates/communication/instagram/gabarits.html` (vraies captures du template, « Données
     fictives »), rendues en PNG (`rendre.mjs`) et **regardées** avant usage ;
   - légende au vouvoiement : accroche en première ligne (2 variantes), 3 à 6 phrases, une phrase de
     pont vers le sur mesure (« Besoin de plus ? … je construis la version sur mesure »), « Démo libre et
     contact : lien en bio », 5 hashtags au plus (jeux du kit) ; aucun lien dans la légende ;
   - texte alternatif de chaque vue ; story d'annonce (gabarit `story`, autocollant lien vers la démo).
4. **`prospects.md`** : liste de prospects potentiels **sous forme de segments et d'organisations**
   (jamais de données personnelles collectées sur des particuliers) : pour chaque segment, pourquoi il a
   le problème, où le trouver (annuaires, réseaux, salons, groupes), qui contacter (fonction, pas nom),
   message d'approche en 3 lignes, canal (LinkedIn, e-mail professionnel public, partenariat, affiliation
   Gumroad), priorité. Distinguer acheteurs directs (B2C), prescripteurs (enseignants, coachs,
   associations, influenceurs du domaine) et partenaires (structures qui pourraient offrir le template).
   Tout organisme cité doit exister ; signaler ce qui est à vérifier.
5. **Planifier l'article LinkedIn** dès que le template est prêt (règle de Quentin, 12/11/2026) : l'intercaler
   **entre deux publications déjà prévues**, en partant du début du planning. Procédure détaillée dans
   `reference.md` § « Planning LinkedIn ».
6. **Planifier le post Instagram** le lendemain de l'article LinkedIn, à 18:30 : procédure dans
   `reference.md` § « Planning Instagram » (publication par Instinct, comme LinkedIn). Motion design
   possible : reel 1080 × 1920 animé en HTML, rendu en MP4 par `docs/templates/communication/instagram/video.mjs`.
7. Mettre à jour la ligne du template dans `docs/templates/IDEES.md` (liens vers ces livrables, dates et ID
   des publications LinkedIn et Instagram).

## 5. Publier

- Branche de travail, commits en français, PR vers `main`. **Aucune fusion sans feu vert explicite de
  Quentin** (déploiements Netlify facturés). Ordre : licence activée → fiche Gumroad publiée → fusion.
- Après fusion : attendre le déploiement, puis vérifier la page (200), les en-têtes (`noindex` sur
  l'application), l'API (`401` à une clé inventée, jamais `503`), la démo dans un navigateur mobile.
  Donner à Quentin l'URL, le SHA et le Deploy ID.
- **À chaque publication d'une fiche Gumroad, le site retire aussitôt le statut « bientôt »** (règle de
  Quentin, 13/11/2026) : dans la même session, une PR qui fait passer le template de « Mise en vente
  prochaine » à « en vente » partout (page catalogue, carte du catalogue FR et EN, bandeau de la démo,
  connexion, `PRODUITS`), sans attendre le prochain lot. Liste à cocher : `reference.md`
  § « À chaque publication Gumroad ». Un template publié sur Gumroad ne doit jamais rester affiché
  « Bientôt » sur le site, et inversement aucun bouton Acheter n'apparaît avant la publication.
- Statut `prêt` puis `en vente` dans `docs/templates/IDEES.md`.
