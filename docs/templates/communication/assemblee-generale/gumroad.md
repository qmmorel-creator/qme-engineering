# Fiche Gumroad · Assemblée générale et vie statutaire

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin**. **Aucun produit
Gumroad n'a été créé** (consigne de la mission du 14/11/2026). La clé de licence est à activer à la main dans
l'éditeur Gumroad (Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans
`PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad` de `AGS`). L'entrée n'a pas été ajoutée à
`../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `AGS` (préfixe des codes), application `https://qm-engineering.fr/templates/assemblee-generale/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-assemblee-generale-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon espace association »
- **Catégorie** : `business-and-money` proposée, **à confirmer** dans la liste Gumroad.
- **Pack** : « Associations et clubs » (PAS), où T93 est prévu. L'ajout de `AGS` aux `produits` du pack
  (`netlify/lib/packs.mjs`) et la régénération des pages (`outils/packs/generer.mjs`) sont laissés au coordinateur.

## Nom

Assemblée générale et vie statutaire

## Prix

19 € (achat unique).

## Permalien prévu

`assemblee-generale-association` → `https://qmengineering.gumroad.com/l/assemblee-generale-association` (à
confirmer à la création ; à reporter dans `section-site.html` s'il change).

## Résumé

L'AG de ton association en règle : rétroplanning daté depuis tes statuts, convocation et pouvoir prêts, feuille
de présence, quorum et majorités calculés avec tes règles, procès-verbal imprimable, mandats du bureau suivis
jusqu'au renouvellement.

## Description

Voir `description` dans `gumroad.json` (HTML prêt à coller) : accroche « Une AG en règle, sans stress. »,
problème, 6 points « Ce que tu obtiens », « Comment ça marche » en 3 étapes, achat unique, aucun envoi par
l'outil, avertissement (les statuts font foi, pas de conseil juridique), lien vers la démo.

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et l'espace de
ton association s'ouvre. Commence par recopier les règles de tes statuts, puis ajoute les membres. Garde cet
e-mail : la même clé fonctionne sur tous les appareils du bureau.

## Tags

association, assemblee generale, loi 1901, benevolat, club, proces-verbal, francais

## Détails

Format : application web (ordinateur, tablette, téléphone) · Accès : clé de licence envoyée par e-mail ·
Langue : français · Paiement : achat unique, sans abonnement · Pour : bureaux d'associations, clubs, amicales.

## Avant de publier

1. Quentin active le bloc License key (Content → Insert → License key) ; vérifier `"is_licensed":true` sur la
   page de la fiche (`reference.md`).
2. Reporter l'identifiant du produit dans `PRODUITS` (`gumroad`), puis appliquer la liste « À chaque publication
   Gumroad » de `reference.md` (page catalogue en version `section-site.html`, carte du catalogue en vente,
   retrait du lien « Bientôt en vente » de la démo avec un nouveau `?v=`).
