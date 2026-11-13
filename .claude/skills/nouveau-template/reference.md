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

## Ajout à l'écran d'accueil (obligatoire, chaque template)

Décision de Quentin (13/11/2026) : chaque template publié explique comment l'enregistrer sur
l'écran d'accueil d'un téléphone pour l'utiliser comme une application. Référence :
`templates/gantt/app.js`, bloc « Ajout à l'écran d'accueil » (le reprendre tel quel).

- **Au démarrage** (fin de `demarrer()`, `proposerEcranAccueil()`) : fenêtre « Comme une application »
  sur téléphone et tablette (iOS, Android, ou écran ≤ 720 px), après 0,9 s, seulement si aucune autre
  modale n'est ouverte et si la page n'est pas déjà installée (`display-mode: standalone` ou
  `navigator.standalone`). Aussi en démo. Jamais seule sur ordinateur.
- **Contenu** : étapes selon l'appareil. iPhone/iPad : Safari, bouton Partager (sous « ··· » s'il n'est pas
  visible), « Sur l'écran d'accueil », laisser « Ouvrir comme app web », « Ajouter ». Android : Chrome,
  menu ⋮, « Ajouter à l'écran d'accueil » ou « Installer l'application ». Ordinateur : les deux. Si le
  navigateur propose l'installation (`beforeinstallprompt`), bouton « Ajouter à l'écran d'accueil » qui
  ouvre l'invite native. Libellés relevés sur des guides récents, pas sur une page officielle Apple ou
  Google : les revérifier si l'interface change.
- **Boutons** : « Plus tard » (revient au prochain lancement) et « Ne plus afficher » (clé locale
  `qme-<pre>-ecran-accueil` = `masque` ; `installe` après une installation acceptée).
- **Réglages** : groupe « Sur téléphone » avec « Voir comment faire » (`data-action="ecran-accueil"`).
- Le manifeste doit rester `display: standalone` avec les icônes 192 et 512 px.
- Aucune application externe : seule l'invite native du navigateur est utilisée.

## Charte (application) : Bauhaus « Pastel »

Décision de Quentin (13/11/2026) : site et templates passent à la variante « Pastel » (maquette
interactive, variante 2). Toujours Bauhaus (formes géométriques, Outfit, couleurs primaires), mais plus doux.
Référence : n'importe quelle application de `templates/` (bloc « Thème Pastel » en fin de `app.css`) et
`assets/site.css` pour le site.

- Jetons (`:root`) : `--papier #FBF7F1`, `--surface #FFFFFF`, `--encre #24221F`, `--texte-2 #514C44`,
  `--discret #6E685F`, `--trait #E4DCCE`, `--rouge #B84A34`, `--jaune #E8B93A`, `--bleu #2E5A88` ;
  fonds teintés `--rose #F8DCD3`, `--beurre #FBEBC2`, `--ciel #D8E4F0`, `--sable #F3EDE3` ; textes sur
  teinte `--rose-texte #8A3322`, `--beurre-texte #6E5310`, `--ciel-texte #22476E`.
- Police Outfit (400 à 800), chiffres tabulaires ; titres 700, interlettrage −0,025em.
- **Filets de 1 px `var(--trait)`**, jamais de cadre noir de 2 px ; **grands arrondis** (boutons en pilule
  `999px`, champs 12 px, cartes et tuiles 16 px, fenêtres 22 px) ; **aucune ombre pleine décalée** :
  au plus une ombre douce (`0 12px 32px rgba(36,34,31,.10)`).
- **Aplats en teintes** : en-têtes de fenêtre et panneau de l'écran de connexion sur `--ciel`, bandeau
  démo et surlignage (`mark`) sur `--beurre`, étiquettes en pilule sur teinte avec le texte foncé
  correspondant. Les couleurs vives (`--rouge`, `--jaune`, `--bleu`) restent pour les données, les
  graphiques, les statuts et les petites formes.
- Onglets : pilule `--beurre` pour l'onglet actif, `--sable` au survol (barre du bas sur téléphone :
  arrondi 16 px).
- Formes Bauhaus (cercle, carré, quart de cercle) pour l'écran de connexion, les états vides, les icônes
  de navigation (rond, grille, barres, triangle), en teintes adoucies (`#E58C74`, `#E8B93A`, `#2E5A88`).
- Le logo garde son rouge `#D9302A` ; son rond central prend la couleur du fond.
- Téléphone : barre d'onglets fixe en bas (5 onglets max), fenêtres en feuille du bas (arrondi en haut),
  cibles ≥ 44 px.
- Couleurs de catégories fixes, dans l'ordre de `BASE.couleurs`, jamais générées.
- Contrastes : texte ≥ 4,5:1 (texte blanc seulement sur `--rouge`, `--bleu` ou `--encre`).

## Mise à jour du site (à chaque nouveau template)

Obligatoire, dans la même PR que le template (la plaquette et la vidéo ne changent pas, les références PDF seulement sur demande) :

- [ ] **Accueil `index.html`** : prix « dès … » de la porte « Templates » si le moins cher change.
- [ ] **Templates en anglais `en/templates/index.html`** : carte du template dans son groupe (travail /
      maison), mention « in French » ; « In preparation » mis à jour.
- [ ] **Avant la mise en vente** (template prêt, fiche Gumroad pas encore publiée) : démo ouverte (pas de
      blocage 404 dans `netlify.toml`), page `catalogue/<slug>/` sans bouton Acheter ni prix, avec « Mise en
      vente prochaine » et la démo en bouton principal, carte `carte prochaine` dans le kanban (décision de
      Quentin, 13/11/2026). À la mise en vente, la page et la carte passent au prix et au bouton Acheter.
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
