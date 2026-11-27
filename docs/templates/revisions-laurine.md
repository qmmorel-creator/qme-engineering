# Révisions QME X Laurine (version privée bêta)

Version privée du « Planning de révision » pour Laurine Mebs (Optimind Formation), puis des bêta-testeurs dans des
écoles (fonctionnalités validées après la visio du 26/11/2026).

- **URL non listée** : `https://qm-engineering.fr/prive/revisions-laurine/` (démo PASS médecine : bouton
  « Essayer avec un exemple PASS médecine », ou `?demo`). `noindex,nofollow` (meta + en-tête `/prive/*` dans
  `netlify.toml`), absente du sitemap, du catalogue, de `/connexion/`, de Gumroad et de l'essai gratuit.
- **Code** : `prive/revisions-laurine/` (copie de `templates/revision/`, qui reste le template vendu, inchangé),
  règles pures dans `laurine-regles.js`, tests `outils/templates/revisions-laurine.test.mjs`.
- **Produit `RVX`** (`PRODUITS_PRIVES` de `netlify/lib/templates-acces.mjs`) : même mécanisme de code signé que les
  autres templates, données serveur `RVX/…` et stockage local `qme-rvx-*`, séparés du template de base.

## Accès : parcours Gumroad (décision de Quentin du 27/11/2026)

Aucune clé générée à la main : chaque bêta-testeur suit le parcours d'achat classique.

1. Achat (ou obtention gratuite) sur Gumroad, qui génère la **clé de licence**.
2. Gumroad envoie son ping de vente à `https://qm-engineering.fr/api/achat` (le même ping que pour les templates en vente).
3. Le site vérifie la licence auprès de Gumroad, puis envoie le mail « Votre accès : Révisions QME X Laurine ». Ce mail
   contient le lien privé, jamais `/connexion/`. Quentin est en copie cachée (comportement par défaut de `mail.mjs`) et
   reçoit la notification de vente. Il n'y a ni accompagnement à J+3, ni ajout au compte de l'espace `/connexion/`.
4. L'élève colle sa clé sur `/prive/revisions-laurine/` : l'application s'ouvre, avec un compte vide (premier lancement).

**Configuration Netlify (variables d'environnement, aucune donnée personnelle dans le code) :**
- `RVX_GUMROAD_ID` : identifiant du produit Gumroad (le `product_id` du ping, à recopier depuis Gumroad). Tant que la
  variable est vide, RVX n'est relié à rien et les produits vendus se comportent exactement comme avant.
- `RVX_ACCES_DEMO` : accès de démonstration, au format `adresse:profil`, séparés par des virgules. Exemple :
  `<adresse Gumroad de Laurine>:pass,<adresse Gumroad de Quentin>:pcsi`. Quand l'acheteur a l'une de ces adresses
  (lue dans l'achat vérifié par Gumroad) et que son compte est encore vide, le compte s'ouvre sur le jeu de démo
  fictif correspondant : `pass` (PASS médecine) ou `pcsi` (classe prépa PCSI). Ce jeu est enregistré dans son compte :
  il est modifiable et synchronisé. Réglages › « Réinitialiser la démo » le régénère.
  Ce mécanisme ne demande aucune variante Gumroad, donc rien de visible pour les autres acheteurs.

### Ce que l'agent Gumroad doit créer

Seul l'agent Gumroad crée ou modifie quelque chose sur Gumroad. Les autres sessions n'y touchent pas.

- **Nom** : `Révisions QME X Laurine (bêta privée)`.
- **Permalink proposé** : `revisions-qme-laurine-beta`.
- **Visibilité** : non listé dans la boutique, pas de « Discover », lien partagé à la main uniquement.
- **Prix** : à décider par Quentin. Options : gratuit (0 €, « pay what you want » à 0) ou un prix symbolique de bêta.
- **Clés de licence** : activer « Generate a unique license key per sale ».
- **Ping** : déjà déclaré pour le compte (Settings › Advanced › Ping endpoint = `https://qm-engineering.fr/api/achat`).
  Rien à ajouter.
- **Variantes** : aucune.
- **Contenu à livrer** (page de contenu ou bouton) : le lien `https://qm-engineering.fr/prive/revisions-laurine/`,
  accompagné du texte « Ouvrez le lien et collez la clé de licence ci-dessus ».
- **Après création** : transmettre le `product_id` à Quentin, qui le renseigne dans `RVX_GUMROAD_ID` sur Netlify, avec
  `RVX_ACCES_DEMO`. Laurine et Quentin obtiennent ensuite leur accès par ce même produit, avec l'adresse e-mail
  déclarée dans `RVX_ACCES_DEMO`.
- **Hors site public** : ne pas ajouter le produit à `templates/`, au catalogue, aux packs ni à `outils/packs/donnees.mjs`.

## Codes manuels (secours)

Les codes RVX restent possibles (`TEMPLATES_SECRET=<secret Netlify> npm run code -- RVX 1`) pour un dépannage, mais
**le parcours normal est Gumroad**. Inscrire tout code manuel dans `docs/templates/codes-gratuits.md`.
Le code administrateur `ADM-…` de Quentin ouvre aussi la version privée.
