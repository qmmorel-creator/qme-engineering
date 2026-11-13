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

Obligatoire, dans la même PR que le template (la plaquette et la vidéo ne changent pas, les références PDF seulement sur demande) :

- [ ] **Accueil `index.html`** : prix « dès … » de la porte « Templates » si le moins cher change.
- [ ] **Templates en anglais `en/templates/index.html`** : carte du template dans son groupe (travail /
      maison), mention « in French » ; « In preparation » mis à jour.
- [ ] **Catalogue** : page `catalogue/<slug>/index.html` complète (page d'atterrissage : boutons Acheter
      et Démo, captures, FAQ propres au produit) ; carte du kanban de `templates/index.html` activée
      (lien `/catalogue/<slug>/`, prix) dans la colonne de son thème ; compteur « en vente ».
- [ ] **Connexion `connexion/index.html`** : produit dans `PRODUITS` (nom, url, clé de stockage) ; textes
      d'aide qui nomment un template (« Ouvrir mon planning »).
- [ ] **Références de l'accueil** (`#references`) : ajouter le template aux « Autres outils construits »
      si c'est pertinent.
- **Plaquette PDF : ne pas la mettre à jour pour un nouveau template** (décision de Quentin, 12/11/2026).
  Elle présente l'offre Templates de façon générique (carte « Templates · dès … »). Seul changement admis :
  le prix « dès … » si le template le moins cher change, et seulement si Quentin le demande.
- [ ] **Références PDF** (facultatif, **sur demande de Quentin** seulement) : page dédiée sur le modèle de
      `docs/qme/references/Revision.dc.html` (dépôt Nexora), puis `node docs/qme/build.mjs` et
      `node docs/qme/en/build.mjs`, PDF recopiés dans `assets/`, `?v=` des liens mis à jour.
- [ ] **Vidéo de présentation** (facultatif, sur demande de Quentin) : générateur dans Nexora.
- [ ] **`netlify.toml`** : en-têtes `noindex` et `sw.js` pour `/templates/<slug>/*`.
- [ ] **`README.md`** et **`docs/templates/IDEES.md`** (statut, liens de communication).
- [ ] **Vérification** : toutes les pages modifiées en Playwright (1280 px et iPhone 13), aucun lien
      mort (boutons Acheter en 200), aucune page plus large que 390 px.

## Planning LinkedIn (à chaque template prêt)

Google Sheet « Planning publications LinkedIn »
(`1EejYs9y4AsdoAtQgHc2HzXK6LgWQHwNnZmqbesSxpWU`, onglet `Planning`, outils `mcp__Google_Sheets__*`).
Colonnes : ID · Date · Heure (Europe/Paris) · Statut · Thème · Titre interne · Doc texte (ID) ·
Doc texte (lien) · Fichier image (dossier Images) · Texte alternatif · Publié le · URL publication ·
Remarque · Format. Lignes triées par date ; une publication environ tous les deux jours.

1. **Relire tout l'onglet** (`get_values Planning!A1:N`) juste avant d'écrire : d'autres sessions le
   modifient (statuts, publications).
2. **Trouver le créneau** : en partant du début, la première paire de lignes **consécutives** dont les
   deux statuts sont « Programmé », dont la première date est **après aujourd'hui**, séparées d'au moins
   2 jours, et entre lesquelles aucune ligne n'est déjà intercalée. Date de l'article = le jour du milieu
   (pour un écart de 3 jours ou plus, le lendemain de la première). Ne jamais toucher une ligne
   « Publié », « Erreur » ou déjà passée. Chaque template suivant prend donc le créneau suivant.
3. **Heure** : celle des créneaux voisins la plus fréquente (08:30 ou 12:15) ; à défaut 12:15.
4. **ID** : `LI-` + (plus grand numéro existant + 1), sur deux chiffres au moins.
5. **Texte** : créer un Google Doc nommé `LI-nn · <titre interne>` dans le même dossier Drive que les
   autres docs du planning (le retrouver par les métadonnées d'un doc existant, colonne G), avec le texte
   de `docs/templates/communication/<slug>/linkedin.md` (accroche retenue, texte, hashtags ; le lien
   d'achat en premier commentaire, noté en fin de doc). Renseigner l'ID et le lien du doc.
6. **Image** : la couverture `assets/templates-<slug>-couverture.png`, déposée dans le dossier « Images »
   du planning sous le nom `LI-nn-<slug>.png` ; texte alternatif descriptif, mention « données fictives ».
7. **Insérer la ligne à sa place chronologique** (`insert_dimension` puis `update_values`), jamais en bas
   du tableau : Statut « Programmé », Thème « Template QME », Format « Image ».
8. **Relire** la plage écrite et vérifier l'ordre des dates ; donner à Quentin l'ID, la date, l'heure et
   le lien du doc.
9. Ne rien publier sur LinkedIn soi-même : la publication suit le processus habituel du planning.

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
