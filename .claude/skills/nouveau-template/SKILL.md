---
name: nouveau-template
description: Développer un nouveau template QME vendu sur Gumroad (application web ouverte par clé de licence, données synchronisées, charte Bauhaus), de la fiche d'idée à la mise en vente et à sa communication (page du site, publication LinkedIn, prospects). À utiliser quand Quentin demande de développer, lancer, créer ou prototyper un template (« lance T04 », « développe le template budget », « nouveau template »), ou d'en ajouter un au site ou à Gumroad.
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
réglages (export / import JSON, déconnexion), manifeste et service worker, icônes.

Remplacer le métier :
- `donnees.js` : la **base intégrée** (`window.BASE`), sans logique ;
- `app.js` : état (`etatVide`, `normaliser` tolérant aux anciennes versions), règles métier en
  **fonctions pures** (testables), puis rendu par vues ;
- `donneesDemo()` : données d'exemple **relatives à aujourd'hui**, couvrant tous les états visibles
  (retard, fait aujourd'hui, à venir, vide d'une sous-partie, valeurs extrêmes).

Côté serveur, une seule ligne : ajouter le produit dans `PRODUITS` de
`netlify/lib/templates-acces.mjs` (`nom`, `url`, `gumroad` une fois la fiche créée). Rien d'autre à écrire :
connexion, licences Gumroad, stockage et conflits sont communs.

Charte : jetons et composants dans `reference.md` § Charte. Graphiques : charger le skill `dataviz`,
valider la palette avec son script et compenser ce qui échoue (contours, légende, tableau accessible).

## 2. Tester

- `npm test` (API) et tests `node --test` des règles métier du template (`outils/templates/<slug>.test.mjs`).
- `npm run dev:templates`, puis Playwright : ordinateur 1280 px et `devices['iPhone 13']` ; parcours
  complet (code faux refusé, code valide, premier lancement, saisie, synchronisation vers un second
  contexte, rechargement, démo) ; zéro `pageerror` ; aucune page plus large que 390 px.
- **Regarder chaque capture** (Read) et corriger : chevauchements, textes coupés, débordements. Les
  captures pleine page sur téléphone dupliquent les éléments fixes : faire aussi des captures d'écran
  simples après défilement.
- Relire la liste des pièges de `reference.md` et vérifier chacun.

## 3. Intégrer au site et à Gumroad

1. Captures pour le site (`assets/templates-<slug>-*.webp`, ordinateur 1600 px et téléphone 780 px, en
   mode démo sans bandeau) et couverture Gumroad 1280 × 720 (`assets/templates-<slug>-couverture.png`).
2. Site : fiche dans `/templates/` (produit, galerie, FAQ si besoin), carte dans la section `#templates`
   de `index.html` et `en/index.html` (préciser « in French »), entrée dans `PRODUITS` du script de
   `connexion/index.html` (`nom`, `url`, clé de stockage `qme-<préfixe en minuscules>-code`).
3. Gumroad (outils `mcp__Gumroad__*`) : **confirmer nom et prix avec Quentin**, puis
   `create_draft_product`, `update_product` (permalien, catégorie, résumé, tags, détails, texte du reçu,
   bouton « Ouvrir mon … »), `add_content_link` vers `https://qm-engineering.fr/connexion/`,
   `add_cover` une fois l'image en ligne. Reporter l'identifiant produit dans `PRODUITS`.
   **Quentin active la clé de licence dans l'éditeur Gumroad** (aucun outil ne le fait) : onglet Content →
   Insert → License key, sans multi-postes. Sans ce bloc, l'acheteur ne reçoit aucune clé. Le bloc affiche le
   `product_id` : il doit être identique à `gumroad` dans `PRODUITS`. Ne publier la fiche qu'avec son accord explicite.
   Prérequis du compte (déjà fait une fois pour toutes) : un moyen de paiement connecté dans Gumroad
   (Settings → Payments), sinon `publish_product` est refusé.
4. README : section « Templates payants » à compléter.

## 4. Préparer la communication

Livrables dans `docs/templates/communication/<slug>/` (non publiés), relus par Quentin avant usage :

1. **Page de présentation sur le site QM Engineering** : la section `#<slug>` de `/templates/` doit se
   suffire comme page d'atterrissage (lien direct `qm-engineering.fr/templates/#<slug>`) : promesse en une
   phrase, pour qui, 3 à 5 bénéfices concrets, captures, prix, « Acheter » et « Essayer la démo »,
   questions fréquentes propres au produit. Ajouter le lien `#<slug>` dans `/templates/` (sommaire) et
   la carte sur l'accueil si le produit est mis en avant.
2. **`linkedin.md`** : une publication de présentation (environ 1 200 à 1 500 caractères), à la première
   personne de Quentin, ton direct et sobre, sans superlatifs ni promesses chiffrées non vérifiées :
   accroche sur le problème, ce que fait le template (3 points), ce qui le distingue (base intégrée, tous
   appareils, achat unique), lien vers la démo, lien d'achat. Proposer 2 variantes d'accroche, l'image à
   joindre (couverture ou capture téléphone) et 3 à 5 hashtags. Prévoir aussi une version courte
   (3 lignes) pour un commentaire ou une story.
3. **`prospects.md`** : liste de prospects potentiels **sous forme de segments et d'organisations**
   (jamais de données personnelles collectées sur des particuliers) : pour chaque segment, pourquoi il a
   le problème, où le trouver (annuaires, réseaux, salons, groupes), qui contacter (fonction, pas nom),
   message d'approche en 3 lignes, canal (LinkedIn, e-mail professionnel public, partenariat, affiliation
   Gumroad), priorité. Distinguer acheteurs directs (B2C), prescripteurs (enseignants, coachs,
   associations, influenceurs du domaine) et partenaires (structures qui pourraient offrir le template).
   Tout organisme cité doit exister ; signaler ce qui est à vérifier.
4. Mettre à jour la ligne du template dans `docs/templates/IDEES.md` (liens vers ces livrables).

## 5. Publier

- Branche de travail, commits en français, PR vers `main`. **Aucune fusion sans feu vert explicite de
  Quentin** (déploiements Netlify facturés). Ordre : licence activée → fiche Gumroad publiée → fusion.
- Après fusion : attendre le déploiement, puis vérifier la page (200), les en-têtes (`noindex` sur
  l'application), l'API (`401` à une clé inventée, jamais `503`), la démo dans un navigateur mobile.
  Donner à Quentin l'URL, le SHA et le Deploy ID.
- Statut `prêt` puis `en vente` dans `docs/templates/IDEES.md`.
