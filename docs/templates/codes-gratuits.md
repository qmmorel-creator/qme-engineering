# Codes d'accès gratuits (hors Gumroad)

Registre des codes `PRODUIT-…` offerts. Le site ne stocke aucun code : ce registre est la seule trace.
Dossier `docs/` non servi par Netlify (404).

- Générer : `TEMPLATES_SECRET=… npm run code -- <PRODUIT> 1` (préfixes dans `PRODUITS` de
  `netlify/lib/templates-acces.mjs`), puis ajouter une ligne ici.
- Révoquer : ajouter l'identifiant (colonne « Id ») à la variable Netlify `TEMPLATES_CODES_REVOQUES`,
  et passer le statut à `révoqué`.

| Date | Produit | Code | Id (révocation) | Destinataire | Statut |
|---|---|---|---|---|---|
| 13/11/2026 | HBT | `HBT-QK5A-C4M8-HYQE-WV5X` | `QK5AC4M8` | Floriane Jolliot | actif |

## Codes de réduction Gumroad

Codes créés dans Gumroad (réduction sur l'achat, la clé de licence est délivrée normalement). Révoquer : le
supprimer ou le faire expirer dans Gumroad (Checkout → Discounts).

| Date | Code | Réduction | Produits | Utilisations max | Expire | Usage | Statut |
|---|---|---|---|---|---|---|---|
| 15/11/2026 | `TESTACHAT26` | 100 % | tous | 5 | 30/11/2026 23:59 | Test du parcours d'achat sur téléphone par 5 proches de Quentin (plan stratégique) | actif |
