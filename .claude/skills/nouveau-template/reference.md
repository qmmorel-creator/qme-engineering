# Référence technique des templates QME

## Architecture

```
templates/<slug>/          application (statique, non indexée : en-tête dans netlify.toml)
  index.html               coquille : #racine, #toast, <dialog id="modale">, scripts
  app.css                  charte Bauhaus de l'application
  donnees.js               base intégrée (window.BASE)
  app.js                   état, règles pures, synchronisation, vues, actions
  manifest.webmanifest, sw.js, icone.svg, icone-180/192/512.png
templates/index.html       catalogue public (indexé)
connexion/index.html       portail acheteurs (PRODUITS côté client)
netlify/functions/templates.mjs     branchement Netlify Blobs (store « templates-donnees »)
netlify/lib/templates-acces.mjs     codes, licences Gumroad, API ; PRODUITS côté serveur
outils/templates/          tests, serveur local, génération de codes
```

## Accès et données

- **Clé de licence Gumroad** (`XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`, hexadécimal) : vérifiée à chaque
  connexion par `POST https://api.gumroad.com/v2/licenses/verify` (`product_id`, `license_key`,
  `increment_uses_count=false`) ; remboursé, contesté ou rétrofacturé → 403. Convertie en code interne
  déterministe (HMAC) : mêmes données sur tous les appareils.
- **Code interne** `PRE-XXXX-XXXX-XXXX-XXXX` : 40 bits aléatoires + 40 bits de signature HMAC-SHA256
  (secret `TEMPLATES_SECRET`, jamais changé). Généré à la main par `generer-codes-REV.bat` ou
  `npm run code -- PRE n` pour les accès offerts.
- **API** : `POST /api/templates/connexion {code}` → `{produit, url, jeton, donnees}` ;
  `GET|PUT /api/templates/donnees` avec l'en-tête `x-code: <jeton>` ; `PUT {donnees, base}` renvoie 409
  avec la version du serveur si un autre appareil a écrit depuis `base`.
- **Client** : `session.code` = ce que l'acheteur a saisi (stocké, re-vérifié à chaque ouverture) ;
  `session.jeton` = code interne pour les données. Stockage local : `qme-<pre>-code` (local ou session
  selon « Rester connecté »), `qme-<pre>-cache` (état + jeton + `nonEnvoye`), `qme-<pre>-demo`.
- Enregistrement temporisé (≈ 600 ms) après chaque action ; indicateur Enregistré / Modifié /
  Enregistrement… / Hors ligne / Démo ; renvoi au retour du réseau ; relecture au retour sur l'onglet.

## Charte (application)

- Jetons : `--papier #F0EDE6`, `--surface #FBFAF6`, `--encre #141414`, `--texte-2 #45413A`,
  `--discret #5E5A52`, `--trait #D9D4C8`, `--rouge #D9302A`, `--jaune #F5B400`, `--bleu #1D4E89`.
- Police Outfit (400 à 800), chiffres tabulaires ; titres 800, interlettrage −0,025em.
- Angles droits partout, cadres de 2 px encre, ombres pleines décalées (`6px 6px 0 var(--encre)`),
  aplats de couleur pour les en-têtes de cartes ; jaune sous texte encre, rouge et bleu sous texte blanc.
- Formes Bauhaus (cercle, carré, quart de cercle) pour l'écran de connexion, les états vides, les icônes
  de navigation (rond, grille, barres, triangle).
- Téléphone : barre d'onglets fixe en bas (5 onglets max), modales en feuille du bas, cibles ≥ 44 px.
- Couleurs de catégories fixes, dans l'ordre de `BASE.couleurs`, jamais générées.

## Mise à jour du site (à chaque nouveau template)

Obligatoire, dans la même PR que le template (sauf PDF et vidéo, dans le dépôt Nexora) :

- [ ] **Accueil `index.html`** : carte du template dans la section `#templates` (ou remplacement de la
      carte mise en avant + ajout à la ligne des autres templates) ; « En préparation » mis à jour ;
      prix « dès … » de la porte « Templates » si le moins cher change ; textes qui énumèrent les templates.
- [ ] **Accueil anglais `en/index.html`** : mêmes changements, mention « in French ».
- [ ] **Catalogue `templates/index.html`** : section `#<slug>` complète (page d'atterrissage), boutons
      Acheter et Démo, captures, FAQ propres au produit ; ordre des sections ; liens internes.
- [ ] **Connexion `connexion/index.html`** : produit dans `PRODUITS` (nom, url, clé de stockage) ; textes
      d'aide qui nomment un template (« Ouvrir mon planning »).
- [ ] **Références de l'accueil** (`#references`) : ajouter le template aux « Autres outils construits »
      si c'est pertinent.
- [ ] **Plaquette et références PDF** (`assets/QME-plaquette.pdf`, `QME-references.pdf`, versions
      anglaises) : sources et générateurs dans le dépôt Nexora, `docs/qme/` (`node docs/qme/build.mjs`,
      puis `node docs/qme/en/build.mjs`) ; mentionner l'offre Templates et le nouveau produit ; changer
      le `?v=` des liens dans les deux pages d'accueil. Si ce dépôt n'est pas disponible dans la
      session, le signaler à Quentin au lieu de l'ignorer.
- [ ] **Vidéo de présentation** (facultatif, sur demande de Quentin) : générateur dans Nexora.
- [ ] **`netlify.toml`** : en-têtes `noindex` et `sw.js` pour `/templates/<slug>/*`.
- [ ] **`README.md`** et **`docs/templates/IDEES.md`** (statut, liens de communication).
- [ ] **Vérification** : toutes les pages modifiées en Playwright (1280 px et iPhone 13), aucun lien
      mort (boutons Acheter en 200), aucune page plus large que 390 px.

## Pièges déjà rencontrés (vérifier à chaque template)

1. **Entrée dans un formulaire de modale** déclenche le premier bouton `submit` du DOM : mettre le bouton
   principal en premier dans le DOM (`.modale-pied` est en `row-reverse`), jamais « Supprimer ».
2. **`[hidden]` écrasé** par un `display` de classe : prévoir `[hidden]{display:none!important}` ou une
   règle `.classe[hidden]`.
3. **Noms de classes du site** : `site.css` utilise déjà `.case` (cartes de références), `.family`,
   `.steps`… Préfixer ou choisir un autre nom dans les pages du site.
4. **Lien `?demo`** : ne jamais écraser le code d'un acheteur enregistré ; la démo ouverte par lien n'est
   pas mémorisée.
5. **Formatage de la saisie** : accepter clé Gumroad et code interne, insensible à la casse et aux
   séparateurs ; message précis si incomplet.
6. **Données de démo** : simuler l'historique avec les vraies règles métier, à des dates relatives ;
   forcer au moins un élément de chaque état (sinon la démo paraît vide).
7. **Écran de connexion** : formes décoratives dans le flux (pas en absolu sous le texte) ; champ de
   code en 16 à 18 px sur téléphone (sinon débordement).
8. **Graphiques SVG** : dimensionner le `viewBox` selon la largeur de l'écran (sinon texte illisible
   sur téléphone) ; étiquettes d'axe comptées depuis la fin pour éviter les chevauchements.
9. **Cache** : `?v=AAAAMMJJ` sur CSS et JS, à changer à chaque version ; `sw.js` en réseau d'abord,
   API jamais mise en cache.
10. **Netlify publie tout le dépôt** : ne rien mettre de privé hors des chemins bloqués
    (`/docs/*`, `/.claude/*`, `/CLAUDE.md` renvoient 404).
11. **PowerShell** (machine de Quentin) : pas de `VAR=… commande` ; fournir des commandes Windows ou un
    `.bat`. Les commandes `npm` se lancent dans le dossier du dépôt.
