# Codes d'accès gratuits (hors Gumroad)

Registre des codes `PRODUIT-…` offerts. Le site ne stocke aucun code : ce registre est la seule trace.
Dossier `docs/` non servi par Netlify (404).

- Générer : `TEMPLATES_SECRET=… npm run code -- <PRODUIT> 1` (préfixes dans `PRODUITS` de
  `netlify/lib/templates-acces.mjs`), puis ajouter une ligne ici.
- Version privée « Révisions QME X Laurine » (produit `RVX`) : accès par Gumroad ; un code manuel n'est possible qu'en
  secours, avec `TEMPLATES_SECRET=… npm run code -- RVX 1`. Détail : `docs/templates/revisions-laurine.md`.
- Révoquer : ajouter l'identifiant (colonne « Id ») à la variable Netlify `TEMPLATES_CODES_REVOQUES`,
  et passer le statut à `révoqué`.

| Date | Produit | Code | Id (révocation) | Destinataire | Statut |
|---|---|---|---|---|---|
| 13/11/2026 | HBT | `HBT-QK5A-C4M8-HYQE-WV5X` | `QK5AC4M8` | Floriane Jolliot | actif |
| 28/11/2026 | RVX (code de réduction Gumroad 100 %, 1 utilisation, jusqu'au 31/12/2026) | `QUENTIN-RVX-DX832` | à expirer sur Gumroad (agent Gumroad) | Quentin Morel (démo PCSI) | actif |
| 28/11/2026 | RVX (code de réduction Gumroad 100 %, 1 utilisation, jusqu'au 31/12/2026) | `LAURINE-RVX-Q9O9P` | à expirer sur Gumroad (agent Gumroad) | Laurine Mebs, Optimind (démo PASS) | actif · envoyé le 28/11/2026 |
