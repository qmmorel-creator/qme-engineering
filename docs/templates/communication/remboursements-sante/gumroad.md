# Fiche Gumroad · Remboursements santé

Valeurs à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json` (source unique du texte : résumé, description HTML, tags, reçu, détails). Prix prévu : 12 €
(prix minimum de Quentin ; nom et prix choisis par délégation, à confirmer par Quentin). **Aucun produit Gumroad
n'a été créé** et l'entrée n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, à compléter par le
coordinateur). La clé de licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key,
sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ
`gumroad` de `RBS`).

- **Produit interne** : `RBS` (préfixe des codes), application `https://qm-engineering.fr/templates/remboursements-sante/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-remboursements-sante-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon suivi »
- **Catégorie** : `business-and-money/personal-finance` (Business & Money › Personal Finance)
- **Nom** : Remboursements santé
- **Prix** : 12 € (achat unique)
- **Permalien** : `remboursements-sante` (à confirmer à la création)
- **Tags** : `sante`, `mutuelle`, `remboursement`, `budget`, `famille`, `finances-personnelles`, `francais`

## Points à vérifier avant publication

- Avertissement présent dans la description (outil d'aide, ne remplace ni un avis professionnel ni les relevés
  officiels ; aucun taux intégré).
- Données de santé : la description mentionne l'accord demandé au premier lancement et l'hébergement dans l'UE,
  comme la fiche Nutrition. Aucune marque de mutuelle ni le nom « Ameli » comme argument (cité seulement pour
  dire qu'aucun compte n'est connecté).
- Clé de licence active (`"is_licensed":true` sur la page de la fiche) avant toute publication.
