# T86 · Cadeaux reçus et remerciements

Slug `remerciements`, préfixe `CDX` (clés locales `qme-cdx-*`, règles `window.CDX`), prix 12 €, permalien
Gumroad prévu `cadeaux-remerciements`, catégorie Gumroad prévue `self-improvement` ou `design` (à confirmer à la
création de la fiche), taille S, priorité P3, usage `perso`. Origine : proposition validée par Quentin le
14/11/2026 (pack « Mariage et installation à deux », PMR, où T86 est prévu ; utile aussi au pack Famille). Fiche
rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de validation à attendre).
Catalogue : `data-pour="perso"`, thème `projets-de-vie` (`--c:var(--bleu)`), à côté de l'organisateur de
mariage (T15), du déménagement et du voyage. Marques de risque : **RGPD** (noms et adresses de tiers :
minimisés, effaçables par événement). Aucune donnée datée ni règle légale intégrée. **Confidentiel vérifié** :
démo entièrement fictive (prénoms courants, villes et adresses inventées, codes postaux fictifs).

## Pour qui

- Jeunes mariés : 60 à 150 foyers, une cagnotte, des cadeaux de la liste et hors liste, des cartes à envoyer
  dans les semaines qui suivent.
- Jeunes parents (naissance, baptême) : cadeaux qui arrivent pendant des semaines, à des parents fatigués.
- Anniversaires marquants (30, 40, 50, 60 ans…), départs à la retraite (cadeau collectif du service, mots
  personnels).
- Familles en deuil : fleurs, messages, dons à une association, présence aux obsèques ; remerciements de
  condoléances au ton sobre, sans rien de festif dans l'interface ni dans les modèles.

Complète T15 (organisateur de mariage, liste d'invités) : même charte, même logique d'import d'une liste collée
(un nom par ligne), mais un produit séparé et autonome (12 €) : pas besoin d'avoir organisé son mariage avec QME.

## Promesse

« Qui a offert quoi, et à qui il reste à dire merci. » Chaque cadeau noté en deux secondes, un message prêt à
partir pour chaque foyer (modèles par événement et par ton), les étiquettes d'adresses imprimées sur une
planche A4, et un compteur « reste à remercier » qui descend jusqu'à zéro.

## Décisions de cadrage

- **Unité de remerciement = le foyer** (une personne ou une famille : « Tante Agnès et Paul »), pas le cadeau :
  on envoie une carte par foyer, qui remercie pour tous ses cadeaux. Le statut (à écrire, écrit, envoyé) et le
  message sont portés par le foyer ; les cadeaux s'y rattachent.
- **Plusieurs événements** dans le même espace (mariage puis naissance, par exemple), chacun avec ses foyers ;
  un sélecteur d'événement en tête de chaque écran. Un foyer appartient à un seul événement (simplicité,
  effacement par événement).
- **Types d'événement** : mariage, naissance ou baptême, anniversaire, retraite, obsèques, autre. Le type règle
  le vocabulaire (« marques de sympathie » au lieu de « cadeaux » pour des obsèques), les types de cadeaux
  proposés en premier, les tons disponibles (pas de ton léger pour des obsèques) et la palette (sobre, sans
  forme colorée festive pour des obsèques).
- **Types de cadeaux ou d'attentions** : objet, argent (chèque, virement, espèces), participation à une
  cagnotte (nom de la cagnotte facultatif, totaux par cagnotte), bon ou expérience, fleurs, message ou carte,
  présence, aide (un service rendu), don à une association. Montant facultatif, jamais obligatoire ; option
  « masquer les montants » (écran montré à d'autres personnes, captures).
- **Canal du remerciement** : carte par la poste, carte remise en main propre, message (texte à copier, aucun
  envoi par l'outil), de vive voix. L'adresse n'est utile que pour la poste : elle est facultative.
- **Modèles de messages** : base intégrée originale, rédigée pour QME, par type d'événement et par ton
  (chaleureux, sobre, bref, léger), deux variantes chacun : 44 modèles. Champs remplis automatiquement : formule
  d'appel, cadeaux reçus (« pour la machine à pain et votre présence »), projet financé par l'argent reçu,
  prénom de l'enfant ou de la personne disparue, signature. Le texte généré reste modifiable et se copie ;
  modèles personnels ajoutables.
- **Objectif d'envoi** : un délai choisi par l'utilisateur (6 semaines par défaut, modifiable de 1 à 26) après
  la date de l'événement ou de réception du cadeau ; c'est un objectif personnel, pas une règle (aucune règle de
  savoir-vivre présentée comme une norme).
- **Étiquettes d'adresses A4** : 4 formats de planches courants décrits par leurs dimensions (3 × 8 de
  70 × 37 mm, 3 × 7 de 70 × 42,3 mm, 2 × 7 de 99,1 × 38,1 mm, 2 × 8 de 99,1 × 33,9 mm), sans nom de marque ;
  départ à la position N (planche entamée), décalage d'impression réglable en millimètres, sélection « à envoyer
  par la poste » ou « tous les foyers avec adresse ». Impression par le navigateur, taille réelle.
- **Import d'une liste collée** : une ligne par cadeau, colonnes séparées par tabulation (copie d'un tableur)
  ou point-virgule : nom ; cadeau ; montant ; adresse ; code postal ; ville. Seul le nom est obligatoire ; ligne
  d'en-tête ignorée ; plusieurs lignes au même nom regroupées sur un foyer ; aperçu avant import.
- **Aucune automatisation** : pas d'envoi d'e-mail, de SMS ni de lien de messagerie (règle de Quentin du
  13/11/2026) ; message à copier, impression, export CSV et JSON.

## Écrans

1. **Aperçu** : sélecteur d'événement, tuiles (reste à remercier, écrits à envoyer, envoyés et progression,
   total reçu), alerte « objectif d'envoi dépassé », liste « à remercier en priorité » (cadeau le plus ancien
   d'abord), totaux par cagnotte et par type, événements de l'espace.
2. **Cadeaux** : foyers et leurs cadeaux, filtres (à écrire, écrits, envoyés, sans adresse), recherche,
   ajout d'un foyer avec son premier cadeau, ajout rapide d'un cadeau, import d'une liste collée. Fiche du foyer :
   cadeaux, adresse facultative, remerciement (statut, canal, date d'envoi), message.
3. **Merci** : la file des remerciements en trois colonnes (à écrire, écrits à envoyer, envoyés) ; rédaction
   guidée : choix du ton et de la variante, message généré, modifiable, copié, puis « écrit » et « envoyé ».
4. **Modèles** : la base intégrée par événement et par ton, aperçu rempli avec un foyer de l'événement,
   modèles personnels.
5. **Étiquettes** : format de planche, sélection, départ, décalage, aperçu de la planche, impression.

Réglages : objectif d'envoi, masquer les montants, export CSV de l'événement, copie JSON, restauration,
effacement des adresses des remerciements envoyés, effacement d'un événement, « Sur téléphone », compte.

## Règles métier (`regles.js`, testées)

- Normalisation tolérante (identifiants, statuts, montants en centimes, dates, liens orphelins supprimés).
- Montants saisis en euros (« 50 », « 50,00 € », « 1 200 ») convertis en centimes ; formatage français.
- Indicateurs par événement : foyers, cadeaux, à écrire, écrits, envoyés, progression, total, par type, par
  cagnotte, en retard sur l'objectif d'envoi, sans adresse (envoi par la poste).
- File « à remercier » triée par date de premier cadeau ; un foyer sans cadeau n'y entre pas.
- Phrase des cadeaux (« la machine à pain, votre participation à la cagnotte « Voyage » et votre présence ») ;
  remplissage des modèles avec blocs conditionnels (argent reçu, projet, prénom).
- Analyse d'une liste collée (séparateurs, en-tête, montants, regroupement par nom) et import sans doublon.
- Pagination des étiquettes (positions sautées, plusieurs planches), lignes d'adresse.
- Effacement d'un événement (foyers et cadeaux), effacement des adresses déjà utilisées, CSV (point-virgule,
  BOM UTF-8).

## Données personnelles (RGPD)

Les foyers sont des tiers : l'outil ne demande que le nom d'usage (« Famille Martin », « Tante Agnès ») et,
facultativement, une adresse postale ; aucun téléphone, e-mail, date de naissance ni information sensible. Les
montants sont facultatifs. Les adresses s'effacent en un clic une fois les cartes envoyées, et un événement
s'efface entièrement (export proposé avant). Mention dans l'application : garder le minimum, effacer une fois
les remerciements faits. Aucune règle juridique citée (pas de donnée datée à maintenir).

## Démo (fictive, relative à aujourd'hui)

Trois événements : « Mariage de Camille et Hugo » (il y a 26 jours, 16 foyers : cadeaux de la liste, cagnotte
« Voyage de noces » avec montants, chèque, présence, foyers envoyés, écrits, à écrire, sans adresse, en retard
sur l'objectif), « Naissance de Léo » (il y a 9 semaines, 6 foyers presque tous remerciés), « Obsèques de
Jeanne » (il y a 3 semaines, 5 foyers : fleurs, messages, don à une association, présence ; ton sobre).

## Base intégrée (`donnees.js`)

Types d'événement (vocabulaire, tons, cadeaux proposés), 9 types de cadeaux ou d'attentions, 4 canaux,
4 tons, 44 modèles de messages originaux, 4 formats de planches d'étiquettes, conseils de démarrage.

## Risques et points à suivre

- Formats d'étiquettes : dimensions de planches courantes ; marges à ajuster selon l'imprimante (décalage
  réglable, impression d'essai sur papier ordinaire conseillée).
- Ton des modèles pour les obsèques : relu pour éviter toute formule festive ; à relire par Quentin.
- Usage à deux (couple) : même clé sur deux appareils, conflit 409 commun ; pas de rôles.

## Statut

**Prêt** le 14/11/2026, « Mise en vente prochaine » : démo libre, page `catalogue/remerciements/`, communication dans
`docs/templates/communication/remerciements/`. Restent la fiche Gumroad et la clé de licence (Quentin), le pack PMR
(`netlify/lib/packs.mjs`), la carte anglaise et les plannings LinkedIn et Instagram.
