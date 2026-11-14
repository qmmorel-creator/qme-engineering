# Fiche Gumroad · Cadeaux reçus et remerciements

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (12 €, le minimum de la règle du 13/11/2026) : **nom et prix à
confirmer par Quentin**. **Aucun produit Gumroad n'a été créé** (consigne de la mission du 14/11/2026). La clé
de licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes),
puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad` de
`CDX`). L'entrée n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `CDX` (préfixe des codes), application `https://qm-engineering.fr/templates/remerciements/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-remerciements-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon suivi des remerciements »
- **Catégorie** : `self-improvement` proposée, **à confirmer** dans la liste Gumroad (aucune catégorie
  « mariage » ou « famille » vérifiée ; `design` ou `other` possibles).
- **Packs** : « Mariage et installation à deux » (PMR), où T86 est prévu ; utile aussi au pack Famille.
  L'ajout de `CDX` aux `produits` du pack (`netlify/lib/packs.mjs`) et la régénération des pages
  (`outils/packs/generer.mjs`) sont laissés au coordinateur.

## Nom

Cadeaux reçus et remerciements

## Prix

12 € (achat unique).

## Permalien prévu

`cadeaux-remerciements` → `https://qmengineering.gumroad.com/l/cadeaux-remerciements` (à confirmer à la création).

## Résumé

Qui a offert quoi, un message de remerciement prêt pour chaque foyer (44 modèles par événement et par ton), le
compteur « reste à remercier » et les étiquettes d'adresses A4. Mariage, naissance, anniversaire, retraite,
obsèques.

## Description

Voir `description` dans `gumroad.json` (HTML prêt à coller) : accroche « Personne n'est oublié. », problème,
6 points « Ce que tu obtiens », « Comment ça marche » en 3 étapes, achat unique, aucun envoi par l'outil, lien
vers la démo.

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton suivi
des remerciements s'ouvre. Crée ton événement et note les cadeaux reçus : un message est prêt pour chaque foyer.
Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Tags

mariage, remerciements, naissance, cadeaux, organisation, famille, francais

## Détails

Format : application web (ordinateur, tablette, téléphone) · Accès : clé de licence envoyée par e-mail ·
Langue : français · Paiement : achat unique, sans abonnement · Pour : jeunes mariés, jeunes parents, familles.

## Avant de publier

1. Quentin active le bloc License key (Content → Insert → License key) ; vérifier `"is_licensed":true` sur la
   page de la fiche (`reference.md`).
2. Reporter l'identifiant du produit dans `PRODUITS` (`gumroad`), puis appliquer la liste « À chaque publication
   Gumroad » de `reference.md` (page catalogue en version `section-site.html`, carte du catalogue en vente,
   retrait du lien « Bientôt en vente » de la démo avec un nouveau `?v=`).
