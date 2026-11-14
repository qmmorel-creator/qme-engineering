# Fiche Gumroad · Planning de mémoire ou de thèse

Valeurs à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json` (source unique du texte : résumé, description HTML, tags, reçu, détails). Prix prévu : 15 €
(nom et prix choisis par délégation, à confirmer par Quentin). **Aucun produit Gumroad n'a été créé** et l'entrée
n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, à compléter par le coordinateur). La clé de
licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes), puis
l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad` de `MMR`).

- **Produit interne** : `MMR` (préfixe des codes), application `https://qm-engineering.fr/templates/memoire/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-memoire-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon planning »
- **Catégorie** : `education` (Education)
- **Nom** : Planning de mémoire ou de thèse
- **Prix** : 15 € (achat unique)
- **Permalien** : `planning-memoire` (à confirmer à la création ; `memoire` seul risque d'être pris)
- **Tags** : `memoire`, `these`, `etudiant`, `master`, `redaction`, `planning`, `francais`

## Points à vérifier avant publication

- Mention « repères indicatifs, sans valeur officielle » (jalons, mots proposés) et « aucune norme bibliographique
  revendiquée » présentes dans la description.
- Aucun nom d'université, d'école ou de logiciel de bibliographie comme argument.
- Clé de licence active (`"is_licensed":true` sur la page de la fiche) avant toute publication.
