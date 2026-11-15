# Référence · vidéos de démonstration

## Architecture

```
docs/videos/
  moteur.mjs            node docs/videos/moteur.mjs <scenario.mjs> [--brouillon] [--garder]
  studio/index.html     toile 1080 × 1920 : en-tête (marque + question), fenêtre navigateur + iframe, calques
  studio/studio.js      API window.S (caméra, curseur, emphases, textes)
  studio/studio.css     charte Bauhaus « Pastel » (papier, encre, rouge, jaune, bleu, vert ; Outfit)
  scenarios/*.mjs       une vidéo par fichier : export config, preparer(v), jouer(v)
  musique/              corporate-litesaturation.m4a (110 BPM, 1er temps 0,534 s)
  catalogue.mjs         produits en vente + historique du journal
  journal.md            mémoire des vidéos, état de la routine, créneaux
  sortie/               rendus (ignoré par git)
```

Le moteur lance son propre serveur local (`outils/templates/serveur-local.mjs`, port 8897, stockage en
mémoire), ouvre le studio dans Chromium (1080 × 1920), exécute `preparer` hors caméra, puis enregistre
(screencast CDP horodaté, ~45 i/s) pendant `jouer`. Montage : images à leur rythme réel → 30 i/s,
720 × 1280, H.264 deux passes au débit calculé pour < 2,9 Mo ; bruitages synthétisés placés aux instants
réels ; musique (`-ss debut`) ; `loudnorm` -14 LUFS.

## config du scénario

```js
export const config = {
  nom: 'gantt-retard',                 // nom des fichiers de sortie
  produit: 'GNT', type: 'question', titre: '…',
  app: '/templates/gantt/?demo',       // page ouverte dans la fenêtre
  largeur: 1280, hauteur: 1600,        // taille CSS de l'iframe (vue bureau ; la caméra zoome)
  marque: 'QME · Planning Gantt', url: 'qm-engineering.fr/templates/gantt',
  affiche: 1.8,                        // instant (s) de l'image de couverture
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
  // dureeMax: 40, tailleMaxMo: 2.9
};
```

`debut` doit tomber sur un temps : `0.534 + k × 60/110` (k = 36 → 20,170 s, partie pleine du morceau ;
la piste fait 60 s avec un fondu final à 57 s : `debut + durée` ≤ 56 s).

## Outils `v` (moteur)

| Appel | Effet |
|---|---|
| `v.S(nom, …args)` | appelle `S[nom]` dans le studio |
| `v.son(type, volume)` | bruitage à l'instant courant : `clic`, `touche`, `pop`, `whoosh`, `zoom`, `dezoom`, `glisse`, `eclat`, `trait`, `ding`, `alerte`, `tampon` |
| `await v.temps(sub)` | attend le prochain temps (sub = 2 : demi-temps) |
| `await v.viser(sel, {ms})` | curseur jusqu'à l'élément (la caméra suit), attend que la caméra se pose |
| `await v.cliquer(sel, {ms, fx, fy})` | viser + vrai clic souris au point exact, onde + à-coup de zoom + son |
| `await v.saisir(sel, texte, {ms})` | clic, Ctrl+A, frappe réelle caractère par caractère, touches affichées |
| `await v.valider()` | touche Entrée (affichée) |
| `await v.lire(sel)` | valeur ou texte d'un élément de l'application |
| `await v.ouvrir(url, barre)` | change de template (vidéo de pack) ; à faire derrière `S('volet')` |
| `await v.fermerDialogues()` | ferme les `<dialog>` ouverts (guide du premier lancement) |
| `v.appli`, `v.page` | cadre Playwright de l'application, page du studio |

## API du studio `S`

Sélecteurs = sélecteurs CSS **dans l'application**. Tout ce qui est ancré suit la caméra et disparaît
quand l'élément sort du champ.

- Caméra : `cadrer(zone, {tau, marge, max})` (zone = sélecteur, liste de sélecteurs, rectangle, ou `null`
  pour le plan large ; attend qu'elle se pose), `suivre(zoom = 2.2, tau = 0.15, dx = -150)` (suit le
  curseur, cadré un peu à gauche pour garder les libellés), `coup(a)` (à-coup de zoom), `attendreCamera()`.
- Curseur : `curseurVers(x, y, ms)` (coordonnées de l'application), `pointeur(sel)`, `appui()`,
  `cacherCurseur()`, `touche(texte)`.
- Emphases : `anneau(id, sel, {couleur, etiquette, cote, pulse, marge})`, `couleurRepere(id, couleur,
  etiquette)`, `avantApres(id, sel, avant, apres, {couleur, cote, note})` (valeur barrée → nouvelle valeur
  qui rebondit ; identiques : seule la valeur), `flash(sel, couleur)`, `souligner(id, sel, couleur)`,
  `eclat(sel, couleurs)` (formes qui jaillissent : bonne nouvelle), `secouer(id)` (mauvaise nouvelle),
  `retirer(id?)`.
- Textes : `accroche(lignes, pas)` (`*mot*` surligné, `_` = espace insécable pour garder « 3_jours »
  dans une seule pastille, ligne commençant par `!` : surlignage rouge), `accrocheSortie()`,
  `question(texte)` (titre persistant en haut), `legende(html, pastille)` (`<b>` en jaune ; pastille
  « Cas 1 »…), `tampon(titre, sous, couleur, y = 1530)` (masque la légende le temps du verdict),
  `tamponFin()`, `fenetre(visible)`, `volet()`, `outro({titre, sous, url})`.
- Couleurs : `var(--jaune)`, `var(--rouge)`, `var(--bleu)`, `var(--vert)`, `var(--ciel)`, `var(--rose)`,
  `var(--encre)`.

## Mise en scène (ce qui a été validé)

- Rythme : chaque apparition importante sur un temps (`await v.temps()`), attentes comptées en temps
  (`T = 60000/110` ms). Gestes rapides (curseur 450–650 ms), frappe 150 ms par caractère.
- Caméra : plan large seulement à l'entrée de la fenêtre ; ensuite zoom 2,2–2,6 sur ce qui compte. Pendant
  un geste, `suivre` ; pour montrer un résultat ailleurs, `retirer` les étiquettes de la ligne **avant**
  le panoramique, puis `cadrer` sur le résultat.
- Emphase en deux temps : le changement local (ligne : `flash` + `avantApres`) puis l'effet global
  (total, date de fin : `flash` + `avantApres` + `souligner` + `eclat`/`secouer`) puis le verdict
  (`tampon`, vert ou rouge).
- Accroche : 3 lignes maximum, question ou problème concret, un mot fort surligné.
- Outro : nom du produit, bénéfice en une ligne, « Démo gratuite · qm-engineering.fr ».

## Pièges déjà rencontrés

1. L'habillage ne doit **jamais** intercepter la souris (`pointer-events:none` sur tous les calques) :
   sinon le clic tombe sur le curseur dessiné et l'application ne change pas, sans erreur visible.
2. Toujours relire la valeur **après** le geste et contrôler qu'elle a changé comme prévu (sinon
   l'habillage dirait le contraire de l'écran).
3. Les identifiants de lignes des templates sont générés à chaque démo : viser par nom
   (`[data-ligne]:has(input[data-champ="nom"][value="…"])`) ou par attribut `data-*`.
4. Un tampon au centre de la fenêtre cache le résultat : il est placé sur la zone de légende (y 1530).
5. Le guide « Comment ça marche » s'ouvre au premier lancement : `v.fermerDialogues()` dans `preparer`.
6. `attendreCamera` a un seuil de 6 px : ne pas exiger une précision au pixel (vidéo trop lente).
7. Limite Drive du connecteur ≈ 3,1 Mo par fichier : ne pas monter la résolution sans réduire ailleurs.
8. Langue : le moteur lance Chromium en français (`--lang=fr-FR`, `LANG=fr_FR.UTF-8`) ; sans cela les champs natifs
   de mois et de date s'affichent en anglais (« April 2027 »). Contrôler ces champs dans `preparer`.
9. Le « aujourd'hui » de l'application est la date réelle du tournage : des états (« retard 2 j ») peuvent
   changer d'un jour à l'autre ; `preparer` doit contrôler les données attendues.

## Programmation

Sheets (outils `mcp__Google_Sheets__*`, onglet `Planning`, `sheetId` à lire si besoin) :

- LinkedIn `1EejYs9y4AsdoAtQgHc2HzXK6LgWQHwNnZmqbesSxpWU`, colonnes A–N : ID · Date (AAAA-MM-JJ) · Heure ·
  Statut · Thème · Titre interne · Doc texte (ID) · Doc texte (lien) · Fichier image (dossier Images) ·
  Texte alternatif · Publié le · URL publication · Remarque · Format.
  Ligne vidéo : Thème « Vidéo démo », Fichier `LI-nn-<slug>-video.mp4`, Remarque
  « ID Drive vidéo : <ID> · vidéo démo <n°> (docs/videos/journal.md) », Format « Vidéo », Heure 17:30.
  Dossiers : Textes `19-LC3WoXSV6njvAiwUuoArup-5jpa12K`, Images `1QTuTihvIcKxLpFSU7xfACyVeXxYA9N_j`.
  Titre du doc : `LI-nn – <titre interne>`.
- Instagram `1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8`, colonnes A–P : … · Format (`Reel`) ·
  LinkedIn associé · IDs Drive des médias. Ligne vidéo : Heure 08:30, Fichier(s)
  `IG-nn-<slug>.mp4 | couverture : IG-nn-<slug>-couverture.png`, P `<ID vidéo> | couverture : <ID image>`,
  O = ID LinkedIn, Thème « Vidéo démo ».
  Dossiers : Textes `1uOEyjI7iKVDVu9qXxRcxwGvoNouP-ORd`, Images `1ALPahoZEKdYjG5iUnPfa5aYubsOPWN3m`.
  Titre du doc : `IG-nn · <titre interne> · légende`.
- Doc de texte (règle stricte de la routine, PROMPT-INSTINCT v3 § 3) : texte à publier, ligne `———`,
  `PREMIER COMMENTAIRE`, le commentaire (lien `https://qm-engineering.fr<url>?demo` et page catalogue).
  Interdits dans le texte : « ===== », « TEXTE DE LA PUBLICATION », « À VÉRIFIER », « Prévu le »,
  « [à compléter] ». Hashtags `#Mot`, 3 à 5. Instagram : « Lien en bio » au lieu d'une URL.
- Texte alternatif (colonne J) : description de ce que montre la vidéo, mention « données fictives ».
- La routine (Instinct) publie : jamais nous. Statuts : `Prêt` (attente) → `Programmé` → `Publié`/`Erreur`
  (écrits par Instinct) ; `Annulé`.
